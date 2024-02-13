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

  available() {
    return !!this.provider || isMobile()
  }

  enable(network){
    this.setOptions({
      sign: { preferNoSetFee: true }
    })
    return super.enable(network)
  }

  setOptions(options){
    return _.merge(this.provider.defaultOptions, options)
  }

  getOptions(){
    return this.provider.defaultOptions
  }
}
