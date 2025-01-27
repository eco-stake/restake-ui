import React, { useState, useEffect, useReducer } from 'react';
import _ from 'lodash'

import {
  Nav,
  Spinner,
  Pagination
} from 'react-bootstrap'
import { useParams, useNavigate } from "react-router-dom";

import AlertMessage from './AlertMessage';
import Proposals from './Proposals';
import { executeSync, mapSync } from '../utils/Helpers.mjs';
import ProposalModal from './ProposalModal';
import Proposal from '../utils/Proposal.mjs';
import { PROPOSAL_STATUSES } from '../utils/Proposal.mjs';
import Vote from '../utils/Vote.mjs';

function Voting(props) {
  const { address, wallet, network } = props
  const [showModal, setShowModal] = useState()
  const [proposal, setProposal] = useState()
  const [proposals, setProposals] = useState([])
  const [tallies, setTallies] = useReducer(
    (tallies, newTallies) => (!newTallies ? {} : {...tallies, ...newTallies}),
    {}
  )
  const [votes, setVotes] = useReducer(
    (votes, newVotes) => (!newVotes ? {} : {...votes, ...newVotes}),
    {}
  )
  const [filter, setFilter] = useReducer(
    (filter, newFilter) => (!newFilter ? {} : {...filter, ...newFilter}),
    {status: '', group: 'voting'}
  )
  const [nextKey, setNextKey] = useState()
  const [page, setPage] = useState(1)
  const [pagesLoaded, setPagesLoaded] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState()
  const navigate = useNavigate();
  const params = useParams();
  const pageSize = 10

  const voteGrants = (wallet?.grants || []).filter(grant => {
    return grant.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' &&
      grant.authorization.msg === '/cosmos.gov.v1beta1.MsgVote'
  })

  useEffect(() => {
    setProposals([])
    setProposal(null)
    setPagesLoaded(0)
    setFilter({status: '', group: 'voting'})
    setTallies(false)
    setVotes(false)
  }, [network]);

  useEffect(() => {
    setError(false)
    setLoading(true)
    setPage(1)
    const abortController = new AbortController();
    getProposals({clearExisting: true, signal: abortController.signal}).then((updateProposals) => {
      if(updateProposals.length == 0 && filter.group === 'voting'){
        setFilter({group: 'all'})
      }else{
        setPagesLoaded(1)
        setLoading(false)
      }
    }).catch((error) => {
      if(error.code === 'ERR_CANCELED') return
      console.log(error)

      setError(`Failed to load proposals: ${error.message}`);
      setProposals([])
      setLoading(false)
    });
    return () => { abortController.abort() }
  }, [filter]);

  useEffect(() => {
    const abortController = new AbortController();
    const interval = setInterval(() => {
      getProposals({signal: abortController.signal, ignoreNextKey: true}).catch((error) => console.log(error))
    }, 120_000);
    return () => {
      clearInterval(interval)
      abortController.abort()
    }
  }, [network, proposals, filter]);

  useEffect(() => {
    if(!params.proposalId) return

    const abortController = new AbortController();
    const prop = proposals.find(el => el.proposal_id === params.proposalId)
    if(prop){
      showProposal(prop)
    }else{
      getProposal(params.proposalId, {signal: abortController.signal}).then(prop => {
        showProposal(prop)
      }).catch((error) => {
        console.log(error)
        if(error.response?.status === 404){
          setError(`Proposal not found`);
          closeProposal()
        }else{
          setError(`Failed to load proposal: ${error.message}`);
        }
      })
    }
    return () => {
      abortController.abort()
    }
  }, [params.proposalId])

  useEffect(() => {
    const allProposals = _.uniqBy(_.compact([proposal, ...proposals]))
    if(!allProposals.length) return

    getTallies(allProposals)

    if(address){
      getVotes(allProposals)
    }
  }, [proposals, proposal]);

  useEffect(() => {
    setVotes(false)
    if(address){
      getVotes(_.uniqBy(_.compact([proposal, ...proposals])), {clearExisting: true})
    }
  }, [address]);

  function getNextProposals(){
    if(pagesLoaded > page){
      setPage(page + 1)
    }else{
      setLoading(true)
      getProposals({nextKey}).then(() => {
        setPage(page + 1)
        setLoading(false)
        setPagesLoaded(pagesLoaded + 1)
      }).catch((error) => {
        if(error.code === 'ERR_CANCELED') return
        console.log(error)

        setError(`Failed to load proposals: ${error.message}`);
        setLoading(false)
      });
    }
  }

  function getPrevProposals(){
    setPage(page - 1)
  }

  async function getProposals(opts) {
    if(!network.restClient) return

    const { clearExisting, ignoreNextKey, ...options } = opts || {}
    if(filter.group === 'voting'){
      options.status = Object.keys(PROPOSAL_STATUSES).indexOf('PROPOSAL_STATUS_VOTING_PERIOD')
    }else if(filter.status){
      options.status = Object.keys(PROPOSAL_STATUSES).indexOf(filter.status)
    }

    const data = await network.restClient.getProposals({ pageSize, ...options })
    if(!ignoreNextKey) setNextKey(data.pagination?.next_key)
    let newProposals = data.proposals
    newProposals = await mapSync(newProposals.map(el => {
      return async () => {
        return await Proposal(el)
      }
    }), 5)

    setError()
    let updateProposals = []
    if(clearExisting){
      updateProposals = sortProposals([...newProposals])
    }else{
      updateProposals = sortProposals(_.uniqBy([...proposals, ...newProposals], 'proposal_id'))
    }
    setProposals(updateProposals)
    setTallies(newProposals.reduce((sum, proposal) => {
      if (!_.every(Object.values(proposal.final_tally_result), el => el === '0')) {
        sum[proposal.proposal_id] = proposal.final_tally_result
      }
      return sum
    }, {}))
    return updateProposals
  }

  async function getProposal(proposalId, opts) {
    if(!network.restClient) return

    const data = await network.restClient.getProposal(proposalId, { timeout: 10000, ...opts })
    const proposal = await Proposal(data)
    if (!_.every(Object.values(proposal.final_tally_result), el => el === '0')) {
      setTallies({[proposal.proposal_id]: proposal.final_tally_result})
    }
    return proposal
  }

  async function getTallies(proposals) {
    const calls = proposals.map((proposal) => {
      return () => {
        const { proposal_id, final_tally_result: result } = proposal
        if (tallies[proposal_id]) return

        const talliesInvalid = _.every(Object.values(result), el => el === '0')
        if (proposal.isVoting && talliesInvalid) {
          return network.restClient.getProposalTally(proposal_id).then(result => {
            return setTallies({ [proposal_id]: result.tally })
          }).catch(error => { })
        }
      }
    });

    await executeSync(calls, 2)
  };

  async function getVotes(proposals, opts) {
    const { clearExisting } = opts || {}
    const calls = proposals.filter(el => el.isVoting).map((proposal) => {
      return () => {
        const { proposal_id } = proposal
        if (votes[proposal_id] && !clearExisting) return

        return network.restClient.getProposalVote(proposal_id, address, {
          'axios-retry': { retryCondition: (e) => e.response.status !== 400 }
        }
        ).then(result => {
          return setVotes({ [proposal_id]: Vote(result.vote) })
        }).catch(error => { })
      }
    });

    await executeSync(calls, 2)
  };

  function showProposal(proposal){
    setProposal(proposal)
    setShowModal(true)
    if (proposal.proposal_id !== params.proposalId) {
      navigate(`/${network.name}/vote/${proposal.proposal_id}`)
    }
  }

  function closeProposal(){
    setShowModal(false)
    navigate(`/${network.name}/vote`)
  }

  function onVote(proposal, vote){
    setError(null)
    setVotes({
      [proposal.proposal_id]: vote
    })
    closeProposal()
  }

  function sortProposals(proposals){
    return _.sortBy(proposals, ({ proposal_id }) => {
      return 0 - parseInt(proposal_id)
    });
  }

  const alerts = (
    <>
      <AlertMessage message={error} />
    </>
  );

  if(loading && !pagesLoaded){
    return (
      <div className="my-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  }

  const proposalsForDisplay = _.chunk(proposals, pageSize)[page-1] || []

  return (
    <>
      {alerts}
      <div className="mb-2">
        <div className="d-flex flex-wrap justify-content-center align-items-start mb-3 position-relative">
          <div className="d-lg-flex d-none position-absolute mx-auto justify-content-center align-self-center">
            <Nav fill variant="pills" activeKey={filter.group} className={`${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({group: e})}>
              <Nav.Item>
                <Nav.Link eventKey="voting" disabled={proposals.filter(el => el.isVoting).length == 0}>Voting Period</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="all">All Proposals</Nav.Link>
              </Nav.Item>
            </Nav>
          </div>
          <div className="d-flex d-lg-none justify-content-center">
            <select className="form-select w-auto h-auto" aria-label="Proposal group" value={filter.group} onChange={(e) => setFilter({group: e.target.value})}>
              <option value="voting" disabled={proposals.filter(el => el.isVoting).length == 0}>Voting Period</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex-fill d-flex justify-content-end">
            <select className="form-select w-auto h-auto" aria-label="Proposal status" disabled={filter.group == 'voting'} value={filter.status} onChange={(e) => setFilter({status: e.target.value})}>
              {Object.entries(PROPOSAL_STATUSES).map(([key, value]) => {
                return (
                  <option key={key} value={key}>{value}</option>
                )
              })}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="my-5 text-center">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : (
          <>
            <Proposals
              network={network}
              address={address}
              proposals={proposalsForDisplay}
              tallies={tallies}
              votes={votes}
              showProposal={showProposal}
              setError={setError}
              onVote={onVote} />

            <Pagination className="justify-content-between">
              <Pagination.Next onClick={getNextProposals} disabled={nextKey === null}>&lsaquo; Older</Pagination.Next>
              <Pagination.Prev onClick={getPrevProposals} disabled={page === 1}>Newer &rsaquo;</Pagination.Prev>
            </Pagination>
          </>
        )}
      </div>
      <ProposalModal
        show={showModal}
        proposal={proposal}
        network={network}
        wallet={wallet}
        address={address}
        tally={proposal && tallies[proposal.proposal_id]}
        vote={proposal && votes[proposal.proposal_id]}
        granters={voteGrants.map(el => el.granter)}
        favouriteAddresses={props.favouriteAddresses}
        closeProposal={closeProposal}
        onVote={onVote}
        setError={setError}
      />
    </>
  );
}

export default Voting;
