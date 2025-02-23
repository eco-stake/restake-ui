import _ from 'lodash'
import { multiply, pow, format, bignumber, number, larger } from 'mathjs'
import {
  GasPrice,
} from "@cosmjs/stargate";
import RestClient from './RestClient.mjs'
import Validator from './Validator.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'
import CosmosDirectory from './CosmosDirectory.mjs'
import SkipApi from './SkipApi.mjs';

class Network {
  constructor(data, operatorAddresses) {
    this.data = data
    this.enabled = data.enabled
    this.experimental = data.experimental
    this.ownerAddress = data.ownerAddress
    this.operatorAddresses = operatorAddresses || {}
    this.operatorCount = data.operators?.length || this.estimateOperatorCount()
    this.name = data.path || data.name
    this.path = data.path || data.name
    this.image = data.image
    this.prettyName = data.prettyName || data.pretty_name
    this.default = data.default
    this.testnet = data.testnet || data.network_type === 'testnet'
    this.setChain(this.data)

    this.directory = CosmosDirectory(this.testnet)
    this.rpcUrl = this.directory.rpcUrl(this.name) // only used for Keplr suggestChain
    this.restUrl = data.restUrl || this.directory.restUrl(this.name)

    this.usingDirectory = !![this.restUrl].find(el => {
      const match = el => el.match("cosmos.directory")
      if (Array.isArray(el)) {
        return el.find(match)
      } else {
        return match(el)
      }
    })
    this.online = !this.usingDirectory || this.connectedDirectory()
    this.disabledWallets = data.disabledWallets || []
  }

  connectedDirectory() {
    const proxy_status = this.chain ? this.chain['proxy_status'] : this.data['proxy_status']
    return proxy_status && ['rest'].every(type => proxy_status[type])
  }

  estimateOperatorCount() {
    if(!this.operatorAddresses) return 0
    return Object.keys(this.operatorAddresses).filter(el => this.allowOperator(el)).length
  }

  allowOperator(address){
    const allow = this.data.allowOperators
    const block = this.data.blockOperators
    if(allow && !allow.includes(address)) return false
    if(block && block.includes(address)) return false
    return true
  }

  async load() {
    const [chainData, validatorsData, skipAssets] = await Promise.all([
      this.directory.getChainData(this.path),
      this.directory.getValidators(this.path),
      SkipApi().getAssets(this.chainId)
    ]);
    this.setChain({...this.data, ...chainData}, skipAssets);
    this.validators = validatorsData.map(data => {
      return Validator(this, data);
    });
    const operators = (this.data.operators || this.validators.filter(el => el.restake && this.allowOperator(el.operator_address))).map(data => {
      return Operator(this, data)
    })
    this.operatorCount = operators.length
    if(this.restakeSupport){
      this.operators = operators
    }else{
      this.operators = []
    }
  }

  async setChain(data, assets){
    this.chain = Chain(data, assets)
    this.prettyName = this.chain.prettyName
    this.chainId = this.chain.chainId
    this.prefix = this.chain.prefix
    this.slip44 = this.chain.slip44
    this.assets = this.chain.assets
    this.baseAsset = this.chain.baseAsset
    this.denom = this.chain.denom
    this.symbol = this.chain.symbol
    this.decimals = this.chain.decimals
    this.image = this.chain.image
    this.coinGeckoId = this.chain.coinGeckoId
    this.estimatedApr = this.chain.estimatedApr
    this.ethermint = this.chain.ethermint
    this.apyEnabled = data.apyEnabled !== false && !!this.estimatedApr && this.estimatedApr > 0
    this.ledgerSupport = this.chain.ledgerSupport ?? true
    this.authzSupport = this.chain.authzSupport
    this.authzAminoSupport = this.chain.authzAminoSupport
    this.authzAminoGenericOnly = this.chain.authzAminoGenericOnly
    this.authzAminoLiftedValues = this.chain.authzAminoLiftedValues
    this.authzAminoExecPreventTypes = this.chain.authzAminoExecPreventTypes
    this.aminoPreventTypes = this.chain.aminoPreventTypes
    this.restakeSupport = this.chain.restakeSupport
    this.restakeAlert = data.restakeAlert
    this.networkAlert = data.networkAlert
    this.txTimeout = this.data.txTimeout || 60_000
    this.keywords = this.buildKeywords()

    const feeConfig = this.chain.fees?.fee_tokens?.find(el => el.denom === this.denom)
    let gasPrice
    if(this.data.gasPrice){
      gasPrice = number(GasPrice.fromString(this.data.gasPrice).amount.toString())
      this.gasPriceStep = this.data.gasPriceStep || {
        "low": gasPrice,
        "average": feeConfig?.average_gas_price ?? gasPrice,
        "high": feeConfig?.high_gas_price ?? multiply(gasPrice, 2),
      }
    }else{
      const minimumGasPrice = feeConfig?.low_gas_price ?? feeConfig?.fixed_min_gas_price
      let defaultGasPrice = number(format(bignumber(multiply(0.000000025, pow(10, this.decimals || 6))), { precision: 14 }))
      if(minimumGasPrice != undefined && larger(minimumGasPrice, defaultGasPrice)){
        defaultGasPrice = minimumGasPrice
      }
      gasPrice = feeConfig?.average_gas_price ?? defaultGasPrice
      this.gasPriceStep = this.data.gasPriceStep || {
        "low": minimumGasPrice ?? multiply(gasPrice, 0.5),
        "average": gasPrice,
        "high": feeConfig?.high_gas_price ?? multiply(gasPrice, 2),
      }
    }
    this.gasPrice = gasPrice + this.denom
    this.gasModifier = this.data.gasModifier || 1.5
  }

  async connect() {
    try {
      this.restClient = await RestClient(this.chain.chainId, this.restUrl, {
        apiVersions: this.chain.apiVersions
      })
      this.restUrl = this.restClient.restUrl
      this.connected = this.restClient.connected && (!this.usingDirectory || this.connectedDirectory())
    } catch (error) {
      console.log(error)
      this.connected = false
    }
  }

  async getApy(validators, operators){
    let validatorApy = {};
    for (const [address, validator] of Object.entries(validators)) {
      const operator = operators.find((el) => el.address === address)
      validatorApy[address] = validator.getAPY(operator)
    }
    return validatorApy;
  }

  getOperator(operatorAddress) {
    return this.operators.find(elem => elem.address === operatorAddress)
  }

  getOperatorByBotAddress(botAddress) {
    return this.operators.find(elem => elem.botAddress === botAddress)
  }

  getOperators() {
    return this.sortOperators()
  }

  sortOperators() {
    const random = _.shuffle(this.operators)
    if (this.ownerAddress) {
      return _.sortBy(random, ({ address }) => address === this.ownerAddress ? 0 : 1)
    }
    return random
  }

  getValidators(opts) {
    opts = opts || {}
    return (this.validators || []).filter(validator => {
      if (opts.status)
        return validator.status === opts.status
      return true
    }).reduce(
      (a, v) => ({ ...a, [v.operator_address]: v }),
      {}
    )
  }

  buildKeywords(){
    return _.compact([
      ...this.chain?.keywords || [],
      this.authzSupport && 'authz',
      this.authzAminoSupport && 'full authz ledger',
    ])
  }

  timeToBlock(height){
    const params = this.chain.params
    const currentHeight = params.current_block_height
    const blockTime = params.actual_block_time
    return (height - currentHeight) * blockTime
  }

  assetForDenom(denom){
    return this.assets.find(el => el.denom === denom)
  }
}

export default Network;
