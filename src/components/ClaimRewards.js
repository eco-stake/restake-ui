import { coin, execableMessage, rewardAmount } from "../utils/Helpers.mjs";

import {
  Dropdown,
  Button
} from 'react-bootstrap'

import { add, subtract, multiply, divide, bignumber } from 'mathjs'
import { MsgDelegate } from "../messages/MsgDelegate.mjs";
import { MsgWithdrawDelegatorReward } from "../messages/MsgWithdrawDelegatorReward.mjs";
import { MsgWithdrawValidatorCommission } from "../messages/MsgWithdrawValidatorCommission.mjs";

function ClaimRewards(props) {
  const { network, address, wallet, rewards } = props

  async function claim(){
    props.setError()
    props.setLoading(true)

    const validatorRewards = mapRewards()
    const gasSimMessages = buildMessages(validatorRewards)

    let gas
    try {
      gas = await wallet.simulate(gasSimMessages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }

    const fee = wallet.getFee(gas)
    const feeAmount = fee.amount[0].amount

    const totalReward = validatorRewards.reduce((sum, validatorReward) => add(sum, bignumber(validatorReward.reward)), 0);
    const adjustedValidatorRewards = validatorRewards.map(validatorReward => {
      const shareOfFee = multiply(divide(bignumber(validatorReward.reward), totalReward), feeAmount); // To take a proportional amount from each validator relative to total reward
      return {
        validatorAddress: validatorReward.validatorAddress,
        reward: subtract(validatorReward.reward, shareOfFee),
      }
    })

    if(!props.commission && (adjustedValidatorRewards.length < 1 || adjustedValidatorRewards.some(validatorReward => validatorReward.reward <= 0))) {
      props.setLoading(false)
      props.setError('Reward is too low')
      return
    }

    let messages = buildMessages(adjustedValidatorRewards)
    try {
      gas = gas || await wallet.simulate(messages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }
    console.log(messages, gas)

    wallet.signAndBroadcastWithoutBalanceCheck(messages, gas).then((result) => {
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onClaimRewards(result)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    })
  }

  function mapRewards() {
    if (!rewards) return [];

    const validatorRewards = rewards
      .map(reward => {
        return {
          validatorAddress: reward.validator_address,
          reward: rewardAmount(reward, network.denom),
        }
      })
      .filter(validatorReward => validatorReward.reward );

    return validatorRewards;
  }

  // Expects a map of string -> string (validator -> reward)
  function buildMessages(validatorRewards){
    return validatorRewards.map(validatorReward => {
      let valMessages = []

      if(props.restake){
        valMessages.push(new MsgDelegate({
          delegatorAddress: address,
          validatorAddress: validatorReward.validatorAddress,
          amount: coin(validatorReward.reward, network.denom)
        }))
      }else{
        valMessages.push(new MsgWithdrawDelegatorReward({
          delegatorAddress: address,
          validatorAddress: validatorReward.validatorAddress
        }))
      }

      if (props.commission) {
        valMessages.push(new MsgWithdrawValidatorCommission({
          validatorAddress: validatorReward.validatorAddress
        }))
      }

      return execableMessage(valMessages, wallet.address, address)
    }).flat()
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
