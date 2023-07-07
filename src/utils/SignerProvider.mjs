export default class SignerProvider {
  suggestChainSupport = true
  authzAminoLiftedValueSupport = true

  constructor(provider) {
    this.provider = provider
  }

  available() {
    return !!this.provider
  }

  connected() {
    return this.available()
  }

  isLedger() {
    return this.key?.isNanoLedger || this.key?.isHardware;
  }

  signDirectSupport(){
    return !!this.signer?.signDirect
  }

  signAminoSupport(){
    return !!this.signer?.signAmino
  }

  async connect(network) {
    this.key = null
    this.signer = null
    try {
      await this.enable(network)
      await this.getKey(network)
      await this.getSigner(network)

      return this.key
    } catch (e) {
      console.log(e)
      if (!this.suggestChainSupport) {
        this.handleEnableError(network, e)
      }
      try {
        await this.suggestChain(network)
        await this.getKey(network)
        await this.getSigner(network)
        return this.key
      } catch (s) {
        console.log(s)
        this.handleSuggestError(network, e)
      }
    }
  }

  disconnect() {
  }

  enable(network) {
    const { chainId } = network
    return this.provider.enable(chainId)
  }

  async getKey(network) {
    if(!this.key){
      const { chainId } = network
      this.key = await this.provider.getKey(chainId)
    }
    return this.key
  }

  async getSigner(network) {
    if(!this.signer){
      const { chainId } = network
      this.signer = await this.provider.getOfflineSignerAuto(chainId)
    }
    return this.signer
  }

  async getAddress(){
    if(this.signer.getAddress){
      return this.signer.getAddress()
    }else{
      const accounts = await this.getAccounts();
      return accounts[0].address;
    }
  }

  getAccounts(){
    return this.signer.getAccounts()
  }

  signDirect(...args){
    return this.signer.signDirect(...args)
  }

  signAmino(...args){
    return this.signer.signAmino(...args)
  }

  suggestChain(network) {
    if (this.suggestChainSupport) {
      return this.provider.experimentalSuggestChain(this.suggestChainData(network))
    } else {
      throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
    }
  }

  handleEnableError(network, error) {
    throw (error)
  }

  handleSuggestError(network, error) {
    throw (error)
  }

  setOptions(options) {
    return {}
  }

  getOptions() {
    return {}
  }

  suggestChainData(network){
    const currency = {
      coinDenom: network.symbol,
      coinMinimalDenom: network.denom,
      coinDecimals: network.decimals
    }
    if(network.coinGeckoId){
      currency.coinGeckoId = network.coinGeckoId
    }
    const data = {
      rpc: network.rpcUrl,
      rest: network.restUrl,
      chainId: network.chainId,
      chainName: network.prettyName,
      stakeCurrency: currency,
      bip44: { coinType: network.slip44 },
      walletUrlForStaking: "https://restake.app/" + network.name,
      bech32Config: {
        bech32PrefixAccAddr: network.prefix,
        bech32PrefixAccPub: network.prefix + "pub",
        bech32PrefixValAddr: network.prefix + "valoper",
        bech32PrefixValPub: network.prefix + "valoperpub",
        bech32PrefixConsAddr: network.prefix + "valcons",
        bech32PrefixConsPub: network.prefix + "valconspub"
      },
      currencies: [currency],
      feeCurrencies: [{...currency, gasPriceStep: network.gasPriceStep }]
    }
    if(network.data.keplrFeatures){
      data.features = network.data.keplrFeatures
    }else if(network.slip44 === 60){
      data.features = ["ibc-transfer", "ibc-go", "eth-address-gen", "eth-key-sign"]
    }
    return data
  }
}
