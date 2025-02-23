import { coin, execableMessage, rewardAmount } from "../utils/Helpers.mjs";

import {
  Dropdown,
  Button
} from 'react-bootstrap'

import { MsgDelegate } from "../messages/MsgDelegate.mjs";
import { MsgWithdrawDelegatorReward } from "../messages/MsgWithdrawDelegatorReward.mjs";
import { MsgWithdrawValidatorCommission } from "../messages/MsgWithdrawValidatorCommission.mjs";
import { smallerEq } from "mathjs";

function ClaimRewards(props) {
  const { network, address, wallet, rewards } = props

  async function claim(){
    props.setError()
    props.setLoading(true)

    let messages
    try {
      messages = await buildMessages()
    } catch (error) {
      props.setLoading(false)
      props.setError(error.message)
      return
    }

    wallet.signAndBroadcastWithoutBalanceCheck(messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onClaimRewards(result)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    })
  }

  function buildMessages(){
    const messages = rewards.map(validatorRewards => {
      let valMessages = []

      if(props.restake){
        const denomReward = rewardAmount(validatorRewards, network.denom)
        if(smallerEq(denomReward, 0)){
          throw new Error(`You have no ${network.symbol} rewards to compound`)
        }
        valMessages.push(new MsgDelegate({
          delegatorAddress: address,
          validatorAddress: validatorRewards.validator_address,
          amount: coin(denomReward, network.denom)
        }))
      }else{
        valMessages.push(new MsgWithdrawDelegatorReward({
          delegatorAddress: address,
          validatorAddress: validatorRewards.validator_address
        }))

        if (props.commission) {
          valMessages.push(new MsgWithdrawValidatorCommission({
            validatorAddress: validatorRewards.validator_address
          }))
        }
      }
      return valMessages
    }).flat()

    return execableMessage(messages, wallet.address, address)
  }

  function hasPermission(){
    const permissions = []
    if(props.restake) permissions.push('Delegate')
    if(!props.restake) permissions.push('WithdrawDelegatorReward')
    if(props.commission) permissions.push('WithdrawValidatorCommission')
    return permissions.every(type => wallet?.hasPermission(address, type))
  }

  function buttonText() {
    if(props.buttonText) return props.buttonText

    if(props.restake){
      return 'Manual Compound'
    }else if(props.commission){
      return 'Claim Commission'
    }else{
      return 'Claim Rewards'
    }
  }

  return (
    <>
      {props.button ? (
        <Button variant={props.variant} size={props.size} disabled={props.disabled || !hasPermission()} onClick={() => claim()}>
          {buttonText()}
        </Button>
      ) : (
        <Dropdown.Item as="button" disabled={props.disabled || !hasPermission()} onClick={() => claim()}>
          {buttonText()}
        </Dropdown.Item>
      )}
    </>
  )
}

export default ClaimRewards;
