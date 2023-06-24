import _ from 'lodash'
import KeplrSignerProvider from './KeplrSignerProvider.mjs'

export default class CosmostationSignerProvider extends KeplrSignerProvider {
  name = 'cosmostation'
  label = 'Cosmostation Wallet'
  keychangeEvent = 'cosmostation_keystorechange'
  authzAminoLiftedValueSupport = false

  constructor(keplrProvider, cosmostationProvider) {
    super(keplrProvider)
    this.cosmostationProvider = cosmostationProvider
  }

  async getSigner(network) {
    if(!this.signer){
      const { chainId } = network
      if(this.isLedger()){
        this.signer = await this.provider.getOfflineSignerOnlyAmino(chainId)
      }else{
        this.signer = await this.provider.getOfflineSigner(chainId)
      }
    }
    return this.signer
  }

  suggestChain(network) {
    return this.cosmostationProvider.request({
      method: 'cos_addChain',
      params: this.suggestChainData(network)
    })
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
