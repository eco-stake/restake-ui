import React, { useState, useReducer, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import { round } from 'mathjs'

import { format, add } from 'mathjs'

import Coins from "./Coins";
import Coin from "./Coin";
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button,
  Nav,
  Spinner,
  Badge
} from 'react-bootstrap'
import { XCircle } from "react-bootstrap-icons";

import ValidatorName from "./ValidatorName";
import ValidatorServices from './ValidatorServices';
import REStakeStatus from './REStakeStatus';
import AlertMessage from './AlertMessage';
import { omit, sumCoins } from '../utils/Helpers.mjs';

function Validators(props) {
  const { address, wallet, network, validators, operators, delegations, operatorGrants } = props

  const [filter, setFilter] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    {keywords: '', status: 'active', group: 'all'}
  )
  const [results, setResults] = useState([])

  const showCommission = results && Object.values(results).find(el => el.isValidatorOperator(address))

  useEffect(() => {
    if(delegations && filter.group !== 'delegated'){
      return setFilter({ group: 'delegated' })
    }
  }, [Object.keys(delegations || {}).length]);

  useEffect(() => {
    let filtered = filteredValidators(validators, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = 'all'
      filtered = filteredValidators(validators, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ group })
      }
    }
    setResults(filtered)
  }, [validators, operators, delegations, operatorGrants, filter]);

  function sortValidators(validators){
    validators = _.sortBy(validators, ({ operator_address: address }) => {
      const delegation = delegations && delegations[address]
      return 0 - (delegation?.balance?.amount || 0)
    });
    return _.sortBy(validators, ({ operator_address: address, public_nodes, path }) => {
      if(network.ownerAddress === address) return -6
      if(path === 'ecostake') return -5

      const delegation = delegations && delegations[address]
      const publicNodes = Object.entries(public_nodes || {}).length > 0
      const operator = operators && operators.find(el => el.address === address)

      let score = 1
      if (delegation) {
        score = operator ? -3 : -2
      } else if(operator){
        score = -1
      }
      if(publicNodes) score--
      return score
    });
  }

  function filterValidators(event){
    setFilter({keywords: event.target.value})
  }

  function filteredValidators(validators, filter){
    let searchResults
    if (props.exclude){
      searchResults = Object.values(omit(validators, ...props.exclude))
    }else{
      searchResults = Object.values(validators)
    }
    const { keywords, status, group } = filter

    if(status){
      searchResults = searchResults.filter(result => {
        if (status === 'active') {
          return result.status === 'BOND_STATUS_BONDED'
        } else if (status === 'inactive') {
          return result.status !== 'BOND_STATUS_BONDED'
        } else {
          return true
        }
      })
    }

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortValidators(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['description.moniker'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(validators, group){
    switch (group) {
      case 'delegated':
        validators = validators.filter(({operator_address: address}) => {
          return delegations && delegations[address]
        })
        break;
    }
    return validators
  }

  function operatorForValidator(validatorAddress) {
    return operators.find((el) => el.address === validatorAddress);
  }

  function ownerValidator(){
    return Object.values(validators).find(validator => validator.address === network.ownerAddress)
  }

  function totalDelegation(){
    return results.reduce((sum, result) => {
      const delegation = delegations && delegations[result.operator_address]
      if (!delegation) return sum

      return add(sum, delegation.balance.amount)
    }, 0)
  }

  function totalRewards(){
    return sumCoins(results.flatMap(result => {
      const rewards = props.rewards[result.operator_address]?.reward || []
      return rewards
    }))
  }

  function totalCommission(){
    return sumCoins(results.flatMap(result => {
      const commission = props.commission[result.operator_address]?.commission || []
      return commission
    }))
  }

  function renderValidator(validator) {
    const validatorAddress = validator.operator_address
    const delegation = delegations && delegations[validatorAddress];
    const validatorOperator = validator.isValidatorOperator(address)
    const rewards = props.rewards && props.rewards[validatorAddress];
    const commission = props.commission && props.commission[validatorAddress]
    const operator = operatorForValidator(validatorAddress);
    const grants = operator && operatorGrants[operator.botAddress]

    let rowVariants = []
    if (validatorOperator) rowVariants.push('table-info')
    if (validator.path == 'ecostake') rowVariants.push('border-bottom border-info fw-bold')
    const rowVariant = _.compact(rowVariants).join(' ')

    const delegationBalance = (delegation && delegation.balance) || {
      amount: 0,
      denom: network.denom,
    };

    let badge
    if (validator.jailed) {
      badge = { bg: 'danger', text: 'Jailed' }
    } else if (!validator.active) {
      badge = { bg: 'light', text: 'Inactive' }
    }

    return (
      <tr key={validatorAddress} className={rowVariant}>
        <td
          className="px-1" width={30}
          role="button"
          onClick={() => props.showValidator(validator, { activeTab: 'profile' })}
        >
          <ValidatorImage
            validator={validator}
            width={30}
            height={30}
          />
        </td>
        <td
          className="ps-1 text-break"
          role="button"
          onClick={() => props.showValidator(validator, { activeTab: 'profile' })}
        >
          <div className="d-flex align-items-start align-items-sm-center justify-content-end flex-column flex-sm-row gap-1 gap-sm-3">
            <ValidatorName validator={validator} className="me-auto" />
            {badge ? <small><Badge bg={badge.bg} className="opacity-75">{badge.text}</Badge></small> : null}
            <div className="text-muted small d-none d-md-block text-nowrap">#{validator.rank}</div>
          </div>
        </td>
        <td
          className="text-center"
        >
          <REStakeStatus
            network={network}
            validator={validator}
            operator={operator}
            delegation={delegation}
            rewards={rewards}
            grants={grants}
            authzSupport={props.authzSupport}
            isLoading={props.isLoading}
            onClick={() => props.showValidator(validator, { activeTab: 'stake' })}
          />
        </td>
        {network.apyEnabled && (
          <td
            className={filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}
            role="button"
            onClick={() => props.showValidator(validator, { activeTab: 'profile' })}
          >
            {props.validatorApy[validatorAddress] !== undefined
              ? <small>{round(props.validatorApy[validatorAddress] * 100, 1).toLocaleString() + "%"}</small>
              : "-"
            }
          </td>
        )}
        <td
          className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}
          role="button"
          onClick={() => props.showValidator(validator, { activeTab: 'profile' })}
        >
          <small>{format(validator.commission.commission_rates.rate * 100, 2)}%</small>
        </td>
        {props.isLoading('delegations') || Object.keys(delegations || {}).length ? (
          <td
            className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}
            role="button"
            onClick={() => props.showValidator(validator, { activeTab: 'stake' })}
          >
            {!props.isLoading('delegations') ? (
              delegationBalance?.amount ? (
                <small>
                  <Coin
                    {...delegationBalance}
                    asset={network.baseAsset}
                    precision={3}
                  />
                </small>
              ) : null
            ) : (
              <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )}
          </td>
        ) : null}
        {!props.modal && filter.group === 'delegated' && (
          <td
            className="d-none d-md-table-cell"
            role="button"
            onClick={() => props.showValidator(validator, { activeTab: 'stake' })}
          >
            {!props.isLoading('rewards') ? rewards && (
              <small>
                <Coins coins={rewards.reward} network={network} precision={3} allowShowLowValue={false} />
              </small>
            ) : (
              <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )}
          </td>
        )}
        {!props.modal && filter.group === 'delegated' && showCommission && (
          <td
            className="d-none d-lg-table-cell"
            role="button"
            onClick={() => props.showValidator(validator, { activeTab: 'stake' })}
          >
            {!props.isLoading('commission') ? commission && (
              <small>
                <Coins coins={commission.commission} network={network} precision={3} allowShowLowValue={false} />
              </small>
            ) : (
              <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            )}
          </td>
        )}
        {!props.modal && (
          <td className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}>
            <div className="d-grid justify-content-end align-items-center">
              <ValidatorServices validator={validator} network={network} show={['stakingrewards', 'nodes']} theme={props.theme} />
            </div>
          </td>
        )}
        <td className="d-none d-sm-table-cell" width={60}>
          <div className="d-grid justify-content-end align-items-center">
            {props.buttonText ? (
              <Button size="sm" onClick={() => props.showValidator(validator, {activeTab: 'stake'})}>
                {props.buttonText}
              </Button>
            ) : props.manageControl ? props.manageControl({validator, operator, delegation, rewards, grants, filter}) : null}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {ownerValidator() && !ownerValidator().active && (
        <AlertMessage variant="info" dismissible={false}>
          <div role="button" onClick={() => props.showValidator(ownerValidator(), { activeTab: 'profile' })}>
            {ownerValidator().moniker} is currently inactive on {network.prettyName}. Help support our projects by <u>staking with us</u>.
          </div>
        </AlertMessage>
      )}
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-3 position-relative">
        <div className="d-none d-sm-flex">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterValidators} value={filter.keywords} type="text" placeholder="Search.." style={{maxWidth: 150}} />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className="w-100 d-flex d-sm-none mb-2">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterValidators} value={filter.keywords} type="text" placeholder="Search.." />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className={`${!props.modal && 'd-md-flex'} d-none justify-content-center align-self-center`}>
          <Nav fill variant="pills" activeKey={filter.group} className={`flex-row${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({group: e})}>
            <Nav.Item>
              <Nav.Link eventKey="delegated" disabled={filteredValidators(validators, {...filter, group: 'delegated'}).length < 1}>My Delegations</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="all">All Validators</Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className={`d-flex ${!props.modal && 'd-md-none'} justify-content-center`}>
          <select className="form-select w-auto h-auto" aria-label="Delegation group" value={filter.group} onChange={(e) => setFilter({group: e.target.value})}>
            <option value="delegated" disabled={filteredValidators(validators, {...filter, group: 'delegated'}).length < 1}>My Delegations</option>
            <option value="all">All Validators</option>
          </select>
        </div>
        <div className="d-flex justify-content-end">
          <select className="form-select w-auto h-auto" aria-label="Validator status" value={filter.status} onChange={(e) => setFilter({status: e.target.value})}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      {results.length > 0 &&
        <Table className="align-middle table-striped">
          <thead>
            <tr>
              <th colSpan={2}>Validator</th>
              <th className="text-center">REStake</th>
              {network.apyEnabled && (
                <th className={filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}>
                  <TooltipIcon
                    icon={<span className="text-decoration-underline">APY</span>}
                    identifier="delegations-apy"
                  >
                    <div className="mt-2 text-center">
                      <p>Based on commission, compounding frequency and recent block times.</p>
                      <p>This is a best case scenario and may not be 100% accurate.</p>
                    </div>
                  </TooltipIcon>
                </th>
              )}
              <th className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}>Fee</th>
              {props.isLoading('delegations') || Object.keys(delegations || {}).length ? (
                <th className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}>Delegation</th>
              ) : null}
              {!props.modal && filter.group === 'delegated' && (
                <th className="d-none d-md-table-cell">Rewards</th>
              )}
              {!props.modal && filter.group === 'delegated' && showCommission && (
                <th className="d-none d-lg-table-cell">Commission</th>
              )}
              {!props.modal && (
                <th className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}></th>
              )}
              <th className="d-none d-sm-table-cell text-center"></th>
            </tr>
          </thead>
          <tbody>
            {results.map(item => renderValidator(item))}
          </tbody>
          {results.length > 1 && (
            <tfoot>
              <tr>
                <td colSpan={2}></td>
                <td className="text-center"></td>
                {network.apyEnabled && (
                  <td className={filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}></td>
                )}
                <td className={network.apyEnabled ? 'text-center d-none d-lg-table-cell' : filter.group === 'delegated' ? 'd-none d-lg-table-cell text-centre' : 'text-center'}></td>
                {props.isLoading('delegations') || Object.keys(delegations || {}).length ? (
                  <td className={filter.group === 'delegated' ? '' : 'd-none d-sm-table-cell'}>
                    <strong className="small">
                      <Coin
                        amount={totalDelegation()}
                        denom={network.denom}
                        asset={network.baseAsset}
                        precision={3}
                      />
                    </strong>
                  </td>
                ) : null}
                {!props.modal && filter.group === 'delegated' && (
                  <td className="d-none d-md-table-cell">
                    {props.rewards && (
                      <strong className="small">
                        <Coins
                          coins={totalRewards()}
                          network={network}
                          precision={3}
                        />
                      </strong>
                    )}
                  </td>
                )}
                {!props.modal && filter.group === 'delegated' && showCommission && (
                  <td className="d-none d-lg-table-cell">
                    {props.commission && (
                      <strong className="small">
                        <Coins
                          coins={totalCommission()}
                          network={network}
                          precision={3}
                        />
                      </strong>
                    )}
                  </td>
                )}
                {!props.modal && (
                  <td className={filter.group === 'delegated' ? 'd-none d-sm-table-cell' : ''}></td>
                )}
                <td className="d-none d-sm-table-cell"></td>
              </tr>
            </tfoot>
          )}
        </Table>
      }
      {results.length < 1 &&
        <p className="text-center my-5"><em>No validators found</em></p>
      }
    </>
  )
}

export default Validators;
