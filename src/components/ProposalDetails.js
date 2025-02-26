import React, { useState, useEffect } from 'react';
import Moment from 'react-moment';
import {micromark} from 'micromark';
import {gfm, gfmHtml} from 'micromark-extension-gfm';
import DOMPurify from 'dompurify';


import {
  Table,
  Tab,
  Nav
} from 'react-bootstrap'

import Coin from './Coin';
import ProposalProgress from './ProposalProgress';
import ProposalMessages from './ProposalMessages';
import VoteForm from './VoteForm';
import AlertMessage from './AlertMessage';
import Vote from '../utils/Vote.mjs';

function ProposalDetails(props) {
  const { proposal, tally, vote, network } = props
  const [granter, setGranter] = useState()
  const [granterVote, setGranterVote] = useState()
  const [error, setError] = useState()

  const { proposal_id, title, description } = proposal

  const fixDescription = description?.replace(/\\n/g, '  \n')

  const transformHTMLString = (htmlString, isSpam) => {
    let transformedString = htmlString;

    // Transform headings
    transformedString = transformedString.replace(/<h[2-6]>(.*?)<\/h[2-6]>/g, '<h6>$1</h6>');
    transformedString = transformedString.replace(/<h1>(.*?)<\/h1>/g, '<h5>$1</h5>');

    // Remove all <a> tags if proposal is spam
    if (isSpam) {
      transformedString = transformedString.replace(/<a[^>]*>(.*?)<\/a>/g, '<span>$1</span>');
    }

    // Apply table class
    transformedString = transformedString.replace(/<table>/g, '<table class="table">');

    return transformedString;
  };

  const htmlDescription = micromark(fixDescription, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
  const sanitizedHtml = DOMPurify.sanitize(htmlDescription);
  const transformedDescription = transformHTMLString(sanitizedHtml, proposal.isSpam);

  useEffect(() => {
    if(props.address !== props.wallet?.address && props.granters.includes(props.address)){
      setGranter(props.address)
    }
  }, [props.address]);

  useEffect(() => {
    if(granter){
      network.restClient.getProposalVote(proposal_id, granter).then(result => {
        return setGranterVote(Vote(result.vote))
      }).catch(error => {
        setGranterVote(null)
      })
    }else{
      setGranterVote(null)
    }
  }, [granter]);

  function onVote(proposal, vote){
    if(granter && props.address !== granter){
      setGranterVote(vote)
    }else{
      props.onVote(proposal, vote)
    }
  }

  return (
    <>
      {error &&
        <AlertMessage variant="danger" className="text-break small">
          {error}
        </AlertMessage>
      }
      {proposal.isSpam &&
        <AlertMessage variant="danger" className="text-break small" dismissible={false}>
          This proposal appears to be spam - do not click any links!
        </AlertMessage>
      }
      <div className="row">
        <div className="col-12 col-lg-6">
          <Table>
            <tbody className="small">
              <tr>
                <td scope="row">ID</td>
                <td className="text-break">#{proposal_id}</td>
              </tr>
              <tr>
                <td scope="row">Status</td>
                <td>{proposal.statusHuman}</td>
              </tr>
              <tr>
                <td scope="row">Type</td>
                <td>
                  <div>
                    {proposal.typeHuman}
                  </div>
                  {proposal.messages && proposal.messages.length > 3 ? (
                    <span className="text-muted">and {(proposal.messages.length - 3).toLocaleString(undefined)} more...</span>
                  ) : null}
                </td>
              </tr>
              {!proposal.isDeposit && (
                <>
                  <tr>
                    <td scope="row">Submit time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.submit_time}
                      </Moment>
                    </td>
                  </tr>
                  <tr>
                    <td scope="row">Voting end time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.voting_end_time}
                      </Moment>
                    </td>
                  </tr>
                </>
              )}
              {proposal.isDeposit && (
                <>
                  <tr>
                    <td scope="row">Deposit end time</td>
                    <td>
                      <Moment format="LLL">
                        {proposal.deposit_end_time}
                      </Moment>
                    </td>
                  </tr>
                  <tr>
                    <td scope="row">Total deposit</td>
                    <td>
                      {proposal.total_deposit.map(coin => {
                        return <Coin key={coin.denom} {...coin} asset={network.baseAsset} />
                      })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </div>
        {props.address && (
          <div className="col-12 col-lg-6">
            <p className="mb-2">
              {props.granters.length > 0 ? (
                <select className="form-select form-select-sm" aria-label="Granter" disabled={!proposal.isVoting} value={granter} onChange={(e) => setGranter(e.target.value)}>
                  <option value="">Your vote</option>
                  <optgroup label="Authz Grants">
                    {props.granters.map(granterAddress => {
                      const favourite = props.favouriteAddresses.find(el => el.address === granterAddress)
                      return <option key={granterAddress} value={granterAddress}>{favourite?.label || granterAddress}</option>
                    })}
                  </optgroup>
                </select>
              ) : (
                <strong>Your Vote</strong>
              )}
            </p>
            <VoteForm
              network={network}
              proposal={proposal}
              vote={granter ? granterVote : vote}
              address={props.address}
              wallet={props.wallet}
              granter={granter}
              onVote={onVote}
              setError={setError} />
          </div>
        )}
      </div>
      <div className="mb-4 mt-2">
        <ProposalProgress
          proposal={proposal}
          tally={tally}
          height={25} />
      </div>
      <Tab.Container id="proposal-tabs" defaultActiveKey="description">
        <Nav variant="tabs" className="small mb-3 d-flex">
          <Nav.Item>
            <Nav.Link role="button" eventKey="description">Description</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link role="button" eventKey="messages">Messages</Nav.Link>
          </Nav.Item>
        </Nav>
        <Tab.Content>
          <Tab.Pane eventKey="description">
            <div className="row mt-3">
              <div className="col">
                <h5 className="mb-3">{title}</h5>
                <div className="proposal-content" dangerouslySetInnerHTML={{ __html: transformedDescription }}></div>
              </div>
            </div>
          </Tab.Pane>
          <Tab.Pane eventKey="messages">
            <div className="row mt-3">
              <div className="col">
                <ProposalMessages proposal={proposal} network={network} />
              </div>
            </div>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </>
  )
}

export default ProposalDetails
