import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"

export default class CosmiframeSignerProvider extends SignerProvider {
  name = 'cosmiframe'
  label = 'DAO DAO'
  visible = false
  isReady = false
  // keychangeEvent = 'keplr_keystorechange'

  constructor(provider) {
    super(provider.getKeplrClient())
    this.client = provider
  }

  available() {
    return this.isReady
  }

  async getAddress(){
    return this.key?.bech32Address
  }

  async autoconnect() {
    const isReady = await this.client.isReady()
    if(isReady) {
      // sleep for 1 second to allow DAODAO to connect fully
      await new Promise(r => setTimeout(r, 1000));
      this.isReady = true
      this.visible = true
    }
    return isReady
  }
}
