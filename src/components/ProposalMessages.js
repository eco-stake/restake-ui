import React from 'react';
import {
  Table,
} from 'react-bootstrap'
import moment from 'moment'
import _ from 'lodash'
import Moment from 'react-moment';
import truncateMiddle from 'truncate-middle';
import { omit } from '../utils/Helpers.mjs';
import Coins from './Coins';

function ProposalMessages(props) {
  const { proposal, network } = props

  const { content, messages } = proposal

  let contentMessages = []

  if(messages){
    messages.forEach(message => {
      if(message['@type'] === '/cosmos.gov.v1.MsgExecLegacyContent'){
        contentMessages.push(message.content)
      }else{
        contentMessages.push(message)
      }
    })
  }else{
    contentMessages.push(content)
  }

  function messageData(message){
    const data = omit(message, 'title', 'name', '@type', 'description')
    switch (message['@type']) {
      case [
        '/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal',
        '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade'
      ].find(type => type === message['@type']):
        return {
          name: message.plan.name,
          height: message.plan.height,
          estimated_time: () => {
            return (
              <Moment format="LLL">
                {moment().add(network.timeToBlock(message.plan.height), 'seconds')}
              </Moment>
            )
          }
        }
      case [
        '/cosmos.distribution.v1beta1.CommunityPoolSpendProposal',
        '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend'
      ].find(type => type === message['@type']):
        return {
          ...data,
          amount: () => {
            return <Coins coins={data.amount} network={network} showTotalValue={false} />
          }
        }
      default:
        return _.mapValues(data, value => {
          if(typeof value === 'object' && value !== null){
            return <pre className="pre-wrap">{JSON.stringify(value, undefined, 2)}</pre>
          }else if(typeof value == "boolean"){
            return value ? 'true' : 'false'
          }else if(typeof value == "string"){
            return truncateMiddle(value, 100, 100, '…')
          }else{
            return value
          }
        })
    }
  }

  function renderMessage(message){
    const data = messageData(message)
    return (
      <>
        <h6>{message.title || message.name} <small className="text-muted">{message['@type']}</small></h6>
        <Table className="small">
          <tbody>
            {Object.entries(data).map(([key, value]) => {
              return (
                <tr key={key}>
                  <td scope="row" className="text-nowrap">{_.startCase(key)}</td>
                  <td className="text-break w-100">{typeof value === 'function' ? value() : value}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </>
    )
  }

  return (
    <>
      {contentMessages.map((message, index) => {
        return (
          <div key={index}>
            {index > 0 && <hr />}
            {renderMessage(message)}
          </div>
        )
      })}
    </>
  )
}

export default ProposalMessages
