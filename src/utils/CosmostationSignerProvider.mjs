import _ from 'lodash'
import KeplrSignerProvider from './KeplrSignerProvider.mjs'

export default class CosmostationSignerProvider extends KeplrSignerProvider {
  key = 'cosmostation'
  label = 'Cosmostation Wallet'
  keychangeEvent = 'cosmostation_keystorechange'
  authzAminoLiftedValueSupport = false

  constructor(keplrProvider, cosmostationProvider) {
    super(keplrProvider)
    this.cosmostationProvider = cosmostationProvider
  }

  getSigner(network, key) {
    const { chainId } = network

    if(this.getIsNanoLedger(key)){
      return this.provider.getOfflineSignerOnlyAmino(chainId)
    }else{
      return this.provider.getOfflineSigner(chainId)
    }
  }

  getIsNanoLedger(key) {
    if(!key) return false
    return key.isNanoLedger || key.isHardware;
  }

  suggestChain(network) {
    if (this.suggestChainSupport) {
      return this.cosmostationProvider.request({
        method: 'cos_addChain',
        params: this.suggestChainData(network)
      })
    } else {
      throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
    }
  }

  suggestChainData(network){
    const data = {
      chainId: network.chainId,
      chainName: network.prettyName,
      addressPrefix: network.prefix,
      baseDenom: network.denom,
      displayDenom: network.symbol,
      restURL: network.restUrl,
      coinType: `${network.slip44}`, // optional (default: '118')
      decimals: network.decimals, // optional (default: 6)
      gasRate: {
        // optional (default: { average: '0.025', low: '0.0025', tiny: '0.00025' })
        average: `${network.gasPriceStep.high}`,
        low: `${network.gasPriceStep.average}`,
        tiny: `${network.gasPriceStep.low}`
      },
      // sendGas: "80000", // optional (default: '100000')
    }
    if(network.data.keplrFeatures?.includes('eth-address-gen') || network.slip44 === 60){
      data.type = 'ETHERMINT'
    }
    return data
  }
}
