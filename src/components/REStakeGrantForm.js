import React, { useState, useEffect, useReducer } from 'react';
import moment from 'moment'
import { pow, multiply, divide, larger, bignumber } from 'mathjs'

import {
  Button,
  Form,
} from 'react-bootstrap'

import Coin from './Coin';
import { coin, execableMessage, rewardAmount } from '../utils/Helpers.mjs';
import RevokeGrant from './RevokeGrant';
import AlertMessage from './AlertMessage';
import OperatorLastRestakeAlert from './OperatorLastRestakeAlert';
import { GenericAuthorization } from '../messages/authorizations/GenericAuthorization.mjs';
import { StakeAuthorization } from '../messages/authorizations/StakeAuthorization.mjs';
import { MsgGrant } from '../messages/MsgGrant.mjs';

function REStakeGrantForm(props) {
  const { grants, wallet, operator, address, network, lastExec } = props
  const { stakeGrant, maxTokens, validators } = grants || {}
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { maxTokensValue: '', expiryDateValue: defaultExpiry.format('YYYY-MM-DD') }
  )
  const genericGrantOnly = wallet.signAminoSupportOnly() && network.authzAminoGenericOnly

  const reward = rewardAmount(props.rewards, network.denom)

  useEffect(() => {
    if(!address) return

    network.restClient.getWithdrawAddress(address).then(withdraw => {
      if (withdraw !== address) {
        setError('You have a different withdraw address set. REStake WILL NOT WORK!')
      }
    }, error => {
      console.log('Failed to get withdraw address', error)
    })
  }, [address])

  useEffect(() => {
    setState({
      validators: validators || (!stakeGrant && !genericGrantOnly && [operator.address]),
      maxTokens,
      expiryDate: expiryDate(),
    })
  }, [grants, operator])

  useEffect(() => {
    setState({
      expiryDateValue: (expiryDate() || defaultExpiry).format('YYYY-MM-DD'),
      maxTokensValue: maxTokens && state.maxTokensValue === '' ? divide(bignumber(maxTokens), pow(10, network.decimals)) : maxTokens ? state.maxTokensValue : '',
    })
  }, [operator])

  function handleInputChange(e) {
    setState({ [e.target.name]: e.target.value });
  }

  function expiryDate() {
    const stakeExpiry = stakeGrant && stakeGrant.expiration && moment(stakeGrant.expiration)
    return stakeExpiry
  }

  function maxTokensDenom() {
    if (state.maxTokensValue === '') return

    const decimals = pow(10, network.decimals)
    return bignumber(multiply(state.maxTokensValue, decimals))
  }

  function maxTokensValid() {
    return !maxTokensDenom() || larger(maxTokensDenom(), reward)
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    showLoading(true)
    const expiry = moment(state.expiryDateValue)
    let maxTokens
    if (state.maxTokensValue !== '') {
      maxTokens = coin(maxTokensDenom(), network.denom)
    }

    let authorization
    if(genericGrantOnly){
      authorization = new GenericAuthorization({
        msg: '/cosmos.staking.v1beta1.MsgDelegate'
      })
    }else{
      authorization = new StakeAuthorization({
        allowList: { address: [operator.address] },
        maxTokens: maxTokens,
        authorizationType: 1
      })
    }

    const message = new MsgGrant({
      granter: address,
      grantee: operator.botAddress,
      grant: {
        authorization: authorization,
        expiration: expiry.unix()
      }
    })

    wallet.signAndBroadcast(execableMessage(message, wallet.address, address)).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      props.onGrant(operator.botAddress, {
        grantee: operator.botAddress,
        granter: address,
        expiration: expiry,
        authorization: genericGrantOnly ? {
          '@type': "/cosmos.authz.v1beta1.GenericAuthorization",
          msg: '/cosmos.staking.v1beta1.MsgDelegate'
        } : {
          '@type': "/cosmos.staking.v1beta1.StakeAuthorization",
          max_tokens: maxTokens,
          allow_list: { address: [operator.address] }
        }
      });
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function grantInformation() {
    return (
      <>
        <p className="small">{operator.moniker} will be able to carry out the following transactions on your behalf:</p>
        <p className="small"><strong>Delegate</strong> - allowed to delegate <em>{maxTokensDenom() ? <>a maximum of <Coin amount={maxTokensDenom()} denom={network.denom} asset={network.baseAsset} fullPrecision={true} showImage={false} showValue={false} /></> : 'any amount'}</em> to <em>{!state.validators ? 'any validator' : !state.validators.length || (state.validators.length === 1 && state.validators.includes(operator.address)) ? 'only their own validator' : 'validators ' + state.validators.join(', ')}</em>.</p>
        <p className="small">This grant will expire automatically on <em>{state.expiryDateValue}</em> and you can revoke it at any time.</p>
        <p className="small">{operator.moniker} will only auto-compound their accrued rewards and tries not to touch your balance.<br /><strong>They will pay the transaction fees for you.</strong></p>
        {genericGrantOnly && (
          <p className="small"><em>{network.prettyName} only supports generic Authz grants with this wallet, full support is coming soon.</em></p>
        )}
      </>
    )
  }

  const step = () => {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      <OperatorLastRestakeAlert operator={operator} lastExec={lastExec} />
      {error &&
        <AlertMessage variant="danger" className="text-break small">
          {error}
        </AlertMessage>
      }
      <Form onSubmit={handleSubmit}>
        <div className="row">
          <div className="col-12 col-md-6 order-md-1 mb-3">
            <fieldset disabled={!props.address || !props.wallet}>
              <Form.Group className="mb-3">
                <Form.Label>Max amount</Form.Label>
                <div className="mb-3">
                  <div className="input-group">
                    <Form.Control type="number" disabled={genericGrantOnly} name="maxTokensValue" min={divide(1, pow(10, network.decimals))} className={!maxTokensValid() ? 'is-invalid' : 'is-valid'} step={step()} placeholder={maxTokens ? divide(bignumber(maxTokens), pow(10, network.decimals)) : 'Unlimited'} required={false} value={state.maxTokensValue} onChange={handleInputChange} />
                    <span className="input-group-text">{network.symbol}</span>
                  </div>
                  <div className="form-text text-end">
                    {genericGrantOnly ? (
                      <>{network.prettyName} does not support amount with this wallet yet</>
                    ) : (
                      <>Reduces with every delegation made by the validator<br />Leave empty for unlimited</>
                    )}

                  </div>
                </div>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Expiry date</Form.Label>
                <Form.Control type="date" className="text-start" name='expiryDateValue' min={moment().format('YYYY-MM-DD')} required={true} value={state.expiryDateValue} onChange={handleInputChange} />
                <div className="form-text text-end">Date the grant expires, after which you will need to re-grant</div>
              </Form.Group>
            </fieldset>
          </div>
          <div className="col-12 col-md-6 mb-3">
            {grantInformation()}
          </div>
        </div>
        <div className="text-end">
          {!loading
            ? (
              <div className="d-flex justify-content-end gap-2">
                {props.closeForm && (
                  <Button variant="secondary" onClick={props.closeForm}>Cancel</Button>
                )}
                {grants?.grantsExist && (
                  <RevokeGrant
                    button={true}
                    address={address}
                    wallet={wallet}
                    operator={operator}
                    grants={[grants.stakeGrant, grants.claimGrant]}
                    grantAddress={operator.botAddress}
                    onRevoke={props.onRevoke}
                    setLoading={(loading) => showLoading(loading)}
                    setError={setError}
                    buttonText="Disable"
                  />
                )}
                <Button type="submit" disabled={!wallet?.hasPermission(address, 'Grant')} className="btn btn-primary">{grants?.grantsExist ? 'Update' : 'Enable REStake'}</Button>
              </div>
            )
            : <Button className="btn btn-primary" type="button" disabled>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
            </Button>
          }
        </div>
      </Form>
    </>
  )
}

export default REStakeGrantForm;
