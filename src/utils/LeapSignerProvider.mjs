import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"
import {
  isMobile,
} from "@walletconnect/browser-utils";

export default class LeapSignerProvider extends SignerProvider {
  key = 'leap'
  label = 'Leap Wallet'
  keychangeEvent = 'leap_keystorechange'
  suggestChainSupport = true

  async connect(network) {
    if(this.provider){
      return super.connect(network)
    }else if(isMobile()){
      window.location.href = 'https://leapcosmoswallet.page.link/HawhyWcCuygLbkvT6';
      throw new Error('Please use the in-app browser to access REStake.')
    }
  }

  available() {
    return !!this.provider || isMobile()
  }
}
