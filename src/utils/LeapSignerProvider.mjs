import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"
import {
  isMobile,
} from "react-device-detect";

export default class LeapSignerProvider extends SignerProvider {
  name = 'leap'
  label = 'Leap Wallet'
  keychangeEvent = 'leap_keystorechange'

  async connect(network) {
    if(this.provider){
      return super.connect(network)
    }else if(isMobile){
      window.location.href = 'https://leapcosmoswallet.page.link/HawhyWcCuygLbkvT6';
      throw new Error('Please use the in-app browser to access REStake.')
    }
  }

  signEIP712(...args){
    return this.provider.experimentalSignEIP712CosmosTx_v0(...args)
  }

  available() {
    return !!this.provider || isMobile
  }
}
