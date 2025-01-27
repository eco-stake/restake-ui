import React, { useState, useEffect } from 'react';
import Moment from 'react-moment';
import _ from 'lodash'

import {
  Table,
  Button,
} from 'react-bootstrap'
import { XCircle, ExclamationTriangle } from "react-bootstrap-icons";

import ProposalProgress from './ProposalProgress';
import TooltipIcon from './TooltipIcon';

function Proposals(props) {
  const { proposals, tallies, votes } = props

  function renderProposal(proposal) {
    const proposalId = proposal.proposal_id
    const vote = votes[proposalId]
    return (
      <tr key={proposalId} className={proposal.isSpam ? 'opacity-50' : ''}>
        <td className="d-none d-md-table-cell">{proposalId}</td>
        <td>
          <div className="d-flex align-items-center">
            <span role="button" onClick={() => props.showProposal(proposal)}>
              {proposal.title}
            </span>
            {proposal.isSpam && (
              <div className="ms-auto d-flex align-items-center text-danger">
                <TooltipIcon icon={<ExclamationTriangle />} identifier={proposalId} tooltip="This proposal appears to be spam - do not click any links!" />
              </div>
            )}
          </div>
        </td>
        <td className="d-none d-sm-table-cell text-center text-nowrap">
          {proposal.statusHuman}
        </td>
        <td className="d-none d-sm-table-cell text-center text-nowrap">
          <Moment fromNow>
            {proposal.isDeposit ? proposal.deposit_end_time : proposal.voting_end_time}
          </Moment>
        </td>
        <td className="text-center">
          {proposal.isVoting && (
            vote ? vote.optionHuman : <XCircle className="opacity-50" />
          )}
        </td>
        <td className="d-none d-md-table-cell text-center">
          <ProposalProgress
            proposal={proposal}
            tally={tallies[proposalId]} />
        </td>
        <td>
          <div className="d-grid gap-2 d-md-flex justify-content-end">
            <Button size="sm" variant={proposal.isSpam ? 'danger' : 'primary'} onClick={() => props.showProposal(proposal)}>
              View
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {proposals.length > 0 &&
        <Table className="align-middle table-striped">
          <thead>
            <tr>
              <th className="d-none d-md-table-cell">#</th>
              <th>Proposal</th>
              <th className="d-none d-sm-table-cell text-center">Status</th>
              <th className="d-none d-sm-table-cell text-center">End Time</th>
              <th className="text-center">Vote</th>
              <th className="d-none d-md-table-cell text-center">Progress</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {proposals.map(item => renderProposal(item))}
          </tbody>
        </Table>
      }
      {proposals.length < 1 &&
        <p className="text-center my-5"><em>No proposals found</em></p>
      }
    </>
  )
}

export default Proposals;
