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

  async connect(network) {
    try {
      await this.enable(network)
      return await this.getKey(network)
    } catch (e) {
      console.log(e)
      if (!this.suggestChainSupport) {
        this.handleEnableError(network, e)
      }
      try {
        await this.suggestChain(network)
        return await this.getKey(network)
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
    const { chainId } = network
    const key = await this.provider.getKey(chainId)
    return key
  }

  getSigner(network, _key) {
    const { chainId } = network
    return this.provider.getOfflineSignerAuto(chainId)
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
