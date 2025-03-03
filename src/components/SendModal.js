import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import { pow, multiply, divide, numeric, bignumber, format } from 'mathjs'

import { MsgSend } from "../messages/MsgSend.mjs";

import {
  Modal,
  Button,
  Form,
  Dropdown
} from 'react-bootstrap'

import AlertMessage from './AlertMessage';
import { coin, execableMessage, sortCoins, truncateAddress } from '../utils/Helpers.mjs';
import Coin from './Coin';

function SendModal(props) {
  const { show, network, address, wallet, balances } = props
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useState({recipientValue: '', customRecipientValue: '', amountValue: '', denomValue: '', memoValue: ''});

  const asset = state.denomValue && network.assetForDenom(state.denomValue)
  const balance = asset && balances?.find(el => el.denom === asset.denom)
  const sortedBalances = sortCoins(balances, network)
  const assets = _.compact(sortedBalances?.map(el => network.assetForDenom(el.denom)) || [])
  const step = 1 / pow(10, asset?.decimals || 6)
  let value
  if(state.amountValue && asset && asset.prices?.coingecko?.usd){
    value = numeric(multiply(state.amountValue, asset.prices.coingecko.usd), 'number')
  }

  useEffect(() => {
    setState({
      ...state,
      recipientValue: '',
      customRecipientValue: '',
      amountValue: '',
      denomValue: network.denom,
      memoValue: '',
    })
    setError(null)
  }, [address])

  function handleInputChange(e) {
    setState({ ...state, [e.target.name]: e.target.value });
  }

  function handleDenomValueChange(denom) {
    setState({ ...state, amountValue: '', denomValue: denom });
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if(!valid()) return

    showLoading(true)
    setError(null)

    const coinValue = coinAmount()

    const messages = [
      buildSendMsg(address, recipient(), [coinValue])
    ]

    wallet.signAndBroadcast(messages, null, state.memoValue).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      setState({
        recipientValue: '',
        customRecipientValue: '',
        amountValue: '',
        denomValue: network.denom,
        memoValue: '',
      })
      props.onSend(recipient(), coinValue);
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function handleClose() {
    setError(null)
    props.onHide();
  }

  function buildSendMsg(address, recipient, amount) {
    let message = new MsgSend({
      fromAddress: address,
      toAddress: recipient,
      amount: amount
    })
    return execableMessage(message, wallet.address, address)
  }

  async function setAvailableAmount(){
    const decimals = pow(10, asset.decimals)
    const amount = divide(bignumber(balance.amount), decimals)
    setState({...state, amountValue: format(amount, {notation: 'fixed'})})
  }

  function recipient(){
    return state.recipientValue === 'custom' ? state.customRecipientValue : state.recipientValue
  }

  function coinAmount(){
    if(!state.amountValue || !asset) return null

    const decimals = pow(10, asset.decimals)
    const denomAmount = multiply(state.amountValue, decimals)
    if(denomAmount > 0){
      return coin(denomAmount, asset.denom)
    }
  }

  function valid(){
    if(!state.recipientValue) return true
    return validRecipient() && coinAmount() && validBalance() && wallet?.hasPermission(address, 'Send')
  }

  function validAmount(){
    if(!state.amountValue) return true

    return !!coinAmount()
  }

  function validRecipient(){
    const value = state.recipientValue === 'custom' ? state.customRecipientValue : state.recipientValue
    if(!value) return true;

    return !network.prefix || value.startsWith(network.prefix)
  }

  function validBalance(){
    if(!state.amountValue) return true

    const coinValue = coinAmount()
    if(!coinValue) return false

    return bignumber(coinValue.amount).lte(balance.amount)
  }

  function favourites(){
    return props.favouriteAddresses.filter(el => el.address !== props.address)
  }

  return (
    <>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate pe-4">Send</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error &&
            <AlertMessage variant="danger" className="text-break small">
              {error}
            </AlertMessage>
          }
          <Form.Group className="mb-3">
            <Form.Label>Recipient</Form.Label>
            <select className="form-select" name="recipientValue" aria-label="Recipient" value={state.recipientValue} onChange={handleInputChange}>
              <option value='' disabled>Choose address</option>
              {favourites().length > 0 && (
                <optgroup label="Favourites">
                  {favourites().map(({ label, address }) => {
                    if (props.address === address) return null

                    return (
                      <option key={address} value={address}>{label || truncateAddress(address)}</option>
                    )
                  })}
                </optgroup>
              )}
              <option value='custom'>Custom</option>
            </select>
            {state.recipientValue === 'custom' && (
              <Form.Control placeholder={`${network.prefix}1...`} className="mt-1" type="text" name='customRecipientValue' required={true} value={state.customRecipientValue} isInvalid={!validRecipient()} onChange={handleInputChange} />
            )}
          </Form.Group>
          {recipient() && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Amount</Form.Label>
                <div className="mb-3">
                  <div className="input-group">
                    <Form.Control name="amountValue" type="number" min={0} step={step} placeholder="10" required={true} isInvalid={!validAmount()} value={state.amountValue} onChange={handleInputChange} />
                    <div className="input-group-append">
                      <Dropdown>
                        <Dropdown.Toggle variant="secondary">
                          {asset?.symbol}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          {assets.map((asset, index) => (
                            <Dropdown.Item
                              as="button"
                              key={asset.denom}
                              onClick={() => handleDenomValueChange(asset.denom)}
                            >
                              {asset.symbol}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  </div>
                  <div className="form-text d-flex justify-content-between">
                    <span className="value">
                      {value ? (
                        <em>${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</em>
                      ) : null}
                    </span>
                    {balance ? (
                      <span role="button" onClick={() => setAvailableAmount()}>
                        Available: <Coin {...balance} asset={asset} fullPrecision={true} showValue={false} showImage={false} />
                      </span>
                    ) : <span></span>}
                  </div>
                </div>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Memo</Form.Label>
                <Form.Control name="memoValue" as="textarea" rows={3} value={state.memoValue} onChange={handleInputChange} />
              </Form.Group>
              <p className="text-end">
                {!loading
                  ? (
                    <Button type="button" onClick={handleSubmit} className="btn btn-primary ms-2" disabled={!valid()}>
                      Send {coinAmount() && <Coin {...coinAmount()} asset={asset} fullPrecision={true} showValue={false} showImage={false} />}
                    </Button>
                  )
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  </Button>
                }
              </p>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default SendModal
