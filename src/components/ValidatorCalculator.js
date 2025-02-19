import _ from 'lodash'
import React, { useState, useEffect } from 'react';
import { pow, round, multiply, divide, min, subtract } from 'mathjs'
import parse from 'parse-duration'

import {
  Table,
  Form,
  Dropdown
} from 'react-bootstrap'
import { QuestionCircle } from "react-bootstrap-icons";

import TooltipIcon from './TooltipIcon'
import Coin from './Coin';

function ValidatorCalculator(props) {
  const { validator, operator, network, delegation } = props
  const [amount, setAmount] = useState('');
  const [amountDenom, setAmountDenom] = useState('');
  const [amountChanged, setAmountChanged] = useState(false);
  const [apr, setApr] = useState('');
  const [restakeEnabled, setRestakeEnabled] = useState(operator ? true : false);
  const [frequency, setFrequency] = useState('');
  const [frequencyPeriod, setFrequencyPeriod] = useState('days');
  const [frequencyLimited, setFrequencyLimited] = useState(false);

  const asset = network.baseAsset
  let { decimals, symbol, prices } = asset || {}
  decimals = decimals ?? 6
  const usd = prices?.coingecko?.usd

  const frequencies = [
    'minutes',
    'hours',
    'days',
    'weeks'
  ]

  useEffect(() => {
    if(network.apyEnabled){
      setApr(round(network.chain.estimatedApr * 100, 2))
    }else{
      setApr('')
    }
    setAmount('')
    setAmountDenom(network.symbol)
    setAmountChanged(false)
  }, [network])

  useEffect(() => {
    if(!amount && delegation?.balance && !amountChanged){
      setAmountDenom(network.symbol)
      setAmount(divide(delegation.balance.amount, pow(10, decimals)))
    }
  }, [delegation])

  useEffect(() => {
    if(restakeEnabled && operator){
      const runsPerDay = operator.runsPerDay(network.data.maxPerDay)
      const runsPerYear = runsPerDay * 365
      const minimumRewardPerRun = operator.minimumReward
      let calculatedFrequency = divide(365, runsPerYear)
      let calculatedFrequencyPeriod = 'days'

      if(amount && apr){
        const baseAmount = multiply(delegationAmount(), pow(10, decimals))
        const rewardsPerYear = multiply(effectiveApr(), baseAmount)
        const rewardsPerRun = divide(rewardsPerYear, runsPerYear)

        const minimumRewardRunsPerYear = divide(runsPerYear, divide(minimumRewardPerRun, rewardsPerRun))

        if(minimumRewardRunsPerYear < runsPerYear){
          setFrequencyLimited(true)
        }else{
          setFrequencyLimited(false)
        }
        calculatedFrequency = divide(365, min(minimumRewardRunsPerYear, runsPerYear))
      }else{
        setFrequencyLimited(false)
      }

      if(calculatedFrequency > 7){
        calculatedFrequency = divide(calculatedFrequency, 7)
        calculatedFrequencyPeriod = 'weeks'
      }

      if(calculatedFrequency < 1){
        calculatedFrequency = multiply(calculatedFrequency, 24)
        calculatedFrequencyPeriod = 'hours'
      }

      if(calculatedFrequency < 1){
        calculatedFrequency = multiply(calculatedFrequency, 60)
        calculatedFrequencyPeriod = 'minutes'
      }

      setFrequency(round(calculatedFrequency, 2))
      setFrequencyPeriod(calculatedFrequencyPeriod)
    }else if(!restakeEnabled){
      setFrequency('')
      setFrequencyPeriod('days')
      setFrequencyLimited(false)
    }
  }, [restakeEnabled, operator, amount, apr])

  function delegationAmount(){
    if(!amount) return 0

    if(amountDenom === network.symbol){
      return amount
    }else if(amountDenom === 'USD'){
      return divide(amount, usd)
    }

    return 0
  }

  function usdAmount(){
    if(amountDenom === network.symbol){
      return multiply(amount, usd)
    }else if(amountDenom === 'USD'){
      return amount
    }
  }

  function effectiveApr(){
    return multiply(divide(apr, 100), subtract(1, validator.commissionRate))
  }

  function apy(){
    let periodPerYear
    if(frequency){
      const compoundPerDay = parse('1d') / parse(`${frequency} ${frequencyPeriod}`)
      periodPerYear = compoundPerDay * 365;
    }else{
      periodPerYear = 1;
    }
    return (1 + effectiveApr() / periodPerYear) ** periodPerYear - 1;
  }

  function rewardsPerYear(){
    const baseAmount = multiply(delegationAmount(), pow(10, decimals))
    return multiply(baseAmount, apy())
  }

  function handleAmountChange(event) {
    setAmount(event.target.value)
    setAmountChanged(true)
  }

  function handleAmountDenomChange(denom) {
    if(denom === amountDenom) return

    setAmountDenom(denom)
    if(!amount) return

    if(denom === network.symbol){
      setAmount(divide(amount, usd))
    }else if(denom === 'USD'){
      setAmount(multiply(amount, usd))
    }
  }

  function handleAprChange(event) {
    setApr(event.target.value)
  }

  function handleRestakeEnabledChange(event) {
    setRestakeEnabled(event.target.checked)
  }

  function handleFrequencyChange(event) {
    if(event.target.value == '' || event.target.value > 0){
      setFrequency(event.target.value)
    }
  }

  return (
    <>
      <div className="row">
        <div className="col-12 col-lg-6 small mb-3">
          <Table>
            <tbody>
              <tr>
                <td scope="row">
                  <Form.Label htmlFor="amount" className="mb-0 mt-2">Delegation</Form.Label>
                </td>
                <td className="text-break">
                  <div className="input-group">
                    <Form.Control
                      id="amount"
                      name="amount"
                      type="number"
                      min={0}
                      step={divide(1, pow(10, decimals))}
                      placeholder="10"
                      required={true}
                      value={amount}
                      onChange={handleAmountChange}
                    />
                    {usd ? (
                      <div className="input-group-append">
                        <Dropdown>
                          <Dropdown.Toggle variant="secondary">
                            {amountDenom}
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                              <Dropdown.Item
                                as="button"
                                onClick={() => handleAmountDenomChange(network.symbol)}
                              >
                                {network.symbol}
                              </Dropdown.Item>
                              <Dropdown.Item
                                as="button"
                                onClick={() => handleAmountDenomChange('USD')}
                              >
                                USD
                              </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </div>
                    ) : (
                      <span className="input-group-text">{symbol}</span>
                    )}
                  </div>
                  {usd && amount && (
                    <div className="form-text">
                      {amountDenom === network.symbol ? (
                        <span>${usdAmount().toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                      ) : (
                        <Coin
                          amount={multiply(delegationAmount(), pow(10, decimals))}
                          denom={network.denom}
                          asset={network.baseAsset}
                          fullPrecision={true}
                          showValue={false}
                          showImage={false}
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <td scope="row" className="text-nowrap">
                  <Form.Label htmlFor="apr" className="mb-0 mt-2">Staking APR</Form.Label>
                </td>
                <td className="text-break">
                  <div className="input-group">
                    <Form.Control
                      id="apr"
                      name="apr"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="10"
                      required={true}
                      value={apr}
                      onChange={handleAprChange}
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td scope="row">
                  <Form.Label htmlFor="commission" className="mb-0 mt-2">Commission</Form.Label>
                </td>
                <td>
                  <div className="input-group">
                    <Form.Control
                      id="commission"
                      name="commission"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="10"
                      required={true}
                      value={round(validator.commissionRate * 100, 2).toLocaleString()}
                      disabled={true}
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td scope="row">
                  <Form.Label htmlFor="restakeEnabled" className="mb-0">REStake</Form.Label>
                </td>
                <td className="text-break">
                  <div className="input-group">
                    <Form.Check
                      type="switch"
                      id="restakeEnabled"
                      checked={restakeEnabled}
                      onChange={handleRestakeEnabledChange}
                      disabled={!operator}
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <td scope="row">
                  <Form.Label htmlFor="frequency" className="mb-0 mt-2">Compound</Form.Label>
                </td>
                <td className="text-break">
                  <div className="input-group">
                    <span className="input-group-text">every</span>
                    <Form.Control
                      id="frequency"
                      name="frequency"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="1"
                      required={true}
                      value={frequency}
                      onChange={handleFrequencyChange}
                      disabled={restakeEnabled}
                    />
                    <div className="input-group-append">
                      <Dropdown>
                        <Dropdown.Toggle variant="secondary" disabled={restakeEnabled}>
                          {frequencyPeriod}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          {frequencies.map((period) => (
                            <Dropdown.Item
                              as="button"
                              key={period}
                              onClick={() => setFrequencyPeriod(period)}
                            >
                              {period}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  </div>
                  {frequencyLimited && operator && (
                    <div className="form-text">
                      <Coin
                        amount={operator.minimumReward}
                        denom={network.denom}
                        asset={network.baseAsset}
                        fullPrecision={true}
                        showValue={false}
                        showImage={false}
                      /> minimum reward required
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
        <div className="col-12 col-lg-6 small mb-3">
          {apr && (
            <Table>
              <tbody>
                <tr>
                  <td scope="row" className="w-25">
                    APR
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      <span>{round(multiply(effectiveApr(), 100), 2).toLocaleString()}%</span>
                      <TooltipIcon
                        icon={<QuestionCircle className="ms-2" />}
                        identifier="delegations-apy"
                      >
                        <div className="mt-2 text-center">
                          <p>
                            {apr}% staking APR<br />
                            - {multiply(validator.commissionRate, 100)}% commission.
                          </p>
                          <p>Staking APR is calculated based on recent block time and is not guaranteed.</p>
                        </div>
                      </TooltipIcon>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td scope="row" className="w-25">
                    APY
                  </td>
                  <td>
                    {frequency ? (
                      <div className="d-flex align-items-center">
                        <span>{round(apy() * 100, 2).toLocaleString()}%</span>
                        <TooltipIcon
                          icon={<QuestionCircle className="ms-2" />}
                          identifier="delegations-apy"
                        >
                          <div className="mt-2 text-center">
                            <p>
                              {round(multiply(effectiveApr(), 100), 2).toLocaleString()}% APR<br />
                              {frequency && (
                                `compounded every ${frequency} ${frequencyPeriod}`
                              )}
                            </p>
                            <p>This is an estimate and best case scenario.</p>
                          </div>
                        </TooltipIcon>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </Table>
          )}
          <Table>
            <tbody>
              <tr>
                <td scope="row" className="w-25">Daily</td>
                <td className="text-break">
                  <Coin
                    amount={divide(rewardsPerYear(), 365)}
                    denom={network.denom}
                    asset={network.baseAsset}
                    fullPrecision={true}
                    showImage={false}
                  />
                </td>
              </tr>
              <tr>
                <td scope="row" className="w-25">Weekly</td>
                <td className="text-break">
                  <Coin
                    amount={divide(rewardsPerYear(), 52)}
                    denom={network.denom}
                    asset={network.baseAsset}
                    fullPrecision={true}
                    showImage={false}
                  />
                </td>
              </tr>
              <tr>
                <td scope="row" className="w-25">Monthly</td>
                <td className="text-break">
                  <Coin
                    amount={divide(rewardsPerYear(), 12)}
                    denom={network.denom}
                    asset={network.baseAsset}
                    fullPrecision={true}
                    showImage={false}
                  />
                </td>
              </tr>
              <tr>
                <td scope="row" className="w-25">Yearly</td>
                <td className="text-break">
                  <Coin
                    amount={rewardsPerYear()}
                    denom={network.denom}
                    asset={network.baseAsset}
                    fullPrecision={true}
                    showImage={false}
                  />
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      </div>
    </>
  )
}

export default ValidatorCalculator
