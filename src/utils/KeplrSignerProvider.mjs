import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"
import {
  isMobile,
} from "@walletconnect/browser-utils";

export default class KeplrSignerProvider extends SignerProvider {
  name = 'keplr'
  label = 'Keplr Wallet'
  keychangeEvent = 'keplr_keystorechange'

  async connect(network) {
    if(this.provider){
      return super.connect(network)
    }else if(isMobile()){
      window.location.href = 'keplrwallet://';
      throw new Error('Please use the in-app browser to access REStake.')
    }
  }

  signEIP712(...args){
    return this.provider.experimentalSignEIP712CosmosTx_v0(...args)
  }

  available() {
    return !!this.provider || isMobile()
  }

  setOptions(options){
    return _.merge(this.provider.defaultOptions, options)
  }

  getOptions(){
    return this.provider.defaultOptions
  }
}
