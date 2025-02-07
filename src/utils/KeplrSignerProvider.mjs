import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"
import {
  isMobile,
  isAndroid,
  isIOS
} from "react-device-detect";

export default class KeplrSignerProvider extends SignerProvider {
  name = 'keplr'
  label = 'Keplr Wallet'
  keychangeEvent = 'keplr_keystorechange'

  async connect(network) {
    if(this.provider){
      return super.connect(network)
    }else if(isMobile){
      if(isIOS){
        window.location.href = `keplrwallet://web-browser?url=https://restake.app/${network.path}`;
      }else if(isAndroid){
        window.location.href = `intent://web-browser?url=https://restake.app/${network.path}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;
      }
      throw new Error('Please use the in-app browser to access REStake.')
    }
  }

  signEIP712(...args){
    return this.provider.experimentalSignEIP712CosmosTx_v0(...args)
  }

  available() {
    return !!this.provider || isMobile
  }

  setOptions(options){
    return _.merge(this.provider.defaultOptions, options)
  }

  getOptions(){
    return this.provider.defaultOptions
  }

  isMobile(){
    return isMobile
  }
}
