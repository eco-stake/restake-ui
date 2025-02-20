import React, { useState, useReducer } from 'react';

import {
  Button,
  Form,
} from 'react-bootstrap'

import { pow, multiply, divide, numeric, bignumber, format } from 'mathjs'

import AlertMessage from './AlertMessage'
import Coin from './Coin'
import { coin, execableMessage } from '../utils/Helpers.mjs'
import { MsgBeginRedelegate } from '../messages/MsgBeginRedelegate.mjs';
import { MsgUndelegate } from '../messages/MsgUndelegate.mjs';
import { MsgDelegate } from '../messages/MsgDelegate.mjs';

function DelegateForm(props) {
  const { network, wallet, address, validator, selectedValidator, action } = props
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { amount: '', memo: '' }
  )

  const asset = network.baseAsset
  let value
  if(state.amount && asset && asset.prices?.coingecko?.usd){
    value = numeric(multiply(state.amount, asset.prices.coingecko.usd), 'number')
  }

  function handleInputChange(event) {
    const target = event.target;
    const value = target.value;
    const name = target.name;

    setState({
      [name]: value
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setState({ loading: true, error: null })

    const amount = state.amount
    const memo = state.memo

    const decimals = pow(10, network.decimals)
    const denomAmount = bignumber(multiply(amount, decimals))

    let messages = buildMessages(denomAmount)
    let gas
    try {
      gas = await wallet.simulate(messages)
    } catch (error) {
      console.log(error)
      setState({ loading: false, error: error.message })
      return
    }

    wallet.signAndBroadcast(messages, gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      setState({ loading: false, error: null })
      props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setState({ loading: false, error: `Failed to broadcast: ${error.message}` })
    })
  }

  function buildMessages(amount) {
    let message
    if (action === 'redelegate') {
      message = new MsgBeginRedelegate({
        delegatorAddress: address,
        validatorSrcAddress: validator.operator_address,
        validatorDstAddress: selectedValidator.operator_address,
        amount: coin(amount, network.denom)
      })
    } else {
      const type = action === 'undelegate' ? MsgUndelegate : MsgDelegate
      message = new type({
        delegatorAddress: address,
        validatorAddress: validator.operator_address,
        amount: coin(amount, network.denom)
      })
    }
    return execableMessage(message, wallet.address, address)
  }

  function hasPermission() {
    const permission = action === 'redelegate' ? 'BeginRedelegate' : action === 'undelegate' ? 'Undelegate' : 'Delegate'
    return wallet?.hasPermission(address, permission)
  }

  async function setAvailableAmount() {
    if (!wallet) return

    const decimals = pow(10, network.decimals)
    const amount = divide(bignumber(availableBalance().amount), decimals)
    setState({ amount: format(amount, {notation: 'fixed'})})
  }

  function availableBalance() {
    if (['redelegate', 'undelegate'].includes(action)) {
      return (props.delegation || {}).balance;
    } else {
      return props.balance;
    }
  }

  function actionText() {
    if (action === 'redelegate') return 'Redelegate'
    if (action === 'undelegate') return 'Undelegate'
    return 'Delegate'
  }

  function step() {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      {!state.error && (selectedValidator?.active ?? validator?.active) === false &&
        <AlertMessage variant="info" dismissible={false}>
          {(selectedValidator || validator).moniker} is inactive - you will not receive any staking rewards until they are in the active set.
        </AlertMessage>
      }
      {state.error &&
        <AlertMessage variant="danger">
          {state.error}
        </AlertMessage>
      }
        <Form onSubmit={handleSubmit}>
          <fieldset disabled={!address || !wallet}>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <div className="mb-3">
                <div className="input-group">
                  <Form.Control name="amount" type="number" min={0} step={step()} placeholder="10" required={true} value={state.amount} onChange={handleInputChange} />
                  <span className="input-group-text">{network.symbol}</span>
                </div>
                <div className="form-text d-flex justify-content-between">
                  <span className="value">
                    {value ? (
                      <em>${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</em>
                    ) : null}
                  </span>
                  {availableBalance() ? (
                    <span role="button" onClick={() => setAvailableAmount()}>
                      Available: <Coin {...availableBalance()} asset={asset} fullPrecision={true} showValue={false} showImage={false} />
                    </span>
                  ) : <span></span>}
                </div>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Memo</Form.Label>
              <Form.Control name="memo" as="textarea" rows={3} value={state.memo} onChange={handleInputChange} />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              {!state.loading
                ? (
                <>
                  {props.closeForm && (
                    <Button variant="secondary" onClick={props.closeForm}>Cancel</Button>
                  )}
                  <Button type="submit" disabled={!hasPermission()} className="btn btn-primary">{actionText()}</Button>
                </>
                ) : <Button className="btn btn-primary" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                </Button>
              }
            </div>
          </fieldset>
        </Form>
    </>
  )
}

export default DelegateForm
