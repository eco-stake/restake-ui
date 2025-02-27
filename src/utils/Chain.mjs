import _ from 'lodash';
import { compareVersions, validate } from 'compare-versions';
import ChainAsset from "./ChainAsset.mjs";

const Chain = (data, assets) => {
  const dataAssets = data.assets?.map(el => ChainAsset(el)) || []
  assets = _.uniqBy([...(assets || []), ...dataAssets], 'denom')
  assets.forEach((el, i) => {
    const dataAsset = dataAssets.find(asset => asset.denom === el.denom)
    if(!el.prices && dataAsset?.prices){
      el.prices = dataAsset.prices
    }
  })
  const stakingTokens = data.staking?.staking_tokens
  const baseAsset = stakingTokens && assets.find(el => el.denom === stakingTokens[0].denom) || assets[0]
  const { cosmos_sdk_version } = data.versions || {}
  const slip44 = data.slip44 || 118
  const ethermint = data.ethermint ?? slip44 === 60
  const ledgerSupport = data.ledgerSupport ?? !ethermint // no ethereum ledger support for now
  const sdk46OrLater = validate(cosmos_sdk_version) && compareVersions(cosmos_sdk_version, '0.46') >= 0
  const sdk50OrLater = validate(cosmos_sdk_version) && compareVersions(cosmos_sdk_version, '0.50') >= 0
  const sdkAuthzAminoSupport = sdk46OrLater
  const aminoPreventTypes = data.aminoPreventTypes || []
  const authzSupport = data.authzSupport ?? data.params?.authz
  const authzAminoSupport = data.authzAminoSupport ?? true
  const authzAminoGenericOnly = authzAminoSupport && (data.authzAminoGenericOnly ?? !sdkAuthzAminoSupport)
  const authzAminoLiftedValues = authzAminoSupport && (data.authzAminoLiftedValues ?? authzAminoGenericOnly)
  const authzAminoExecPreventTypes = aminoPreventTypes.concat(data.authzAminoExecPreventTypes || [])
  const apiVersions = {
    gov: sdk46OrLater ? 'v1' : 'v1beta1',
    ...data.apiVersions || {}
  }
  const restakeSupport = authzSupport && (data.restakeEnabled ?? true)

  return {
    ...data,
    prettyName: data.prettyName || data.pretty_name,
    chainId: data.chainId || data.chain_id,
    prefix: data.prefix || data.bech32_prefix,
    slip44,
    estimatedApr: data.params?.calculated_apr,
    ethermint,
    ledgerSupport,
    aminoPreventTypes,
    authzSupport,
    authzAminoSupport,
    authzAminoGenericOnly,
    authzAminoLiftedValues,
    authzAminoExecPreventTypes,
    apiVersions,
    restakeSupport,
    sdk46OrLater,
    sdk50OrLater,
    denom: data.denom || baseAsset.denom,
    symbol: data.symbol || baseAsset?.symbol,
    decimals: data.decimals || baseAsset?.decimals,
    image: baseAsset?.image || data.image,
    coinGeckoId: baseAsset?.coingecko_id,
    assets,
    baseAsset
  }
}

export default Chain;
