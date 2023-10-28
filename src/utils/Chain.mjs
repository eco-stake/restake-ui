import { compareVersions, validate } from 'compare-versions';
import ChainAsset from "./ChainAsset.mjs";

const Chain = (data) => {
  const assets = data.assets?.map(el => ChainAsset(el)) || []
  const baseAsset = assets[0]
  const { cosmos_sdk_version } = data.versions || {}
  const slip44 = data.slip44 || 118
  const ledgerSupport = data.ledgerSupport ?? slip44 !== 60 // no ethereum ledger support for now
  const sdk46OrLater = validate(cosmos_sdk_version) && compareVersions(cosmos_sdk_version, '0.46') >= 0
  const sdkAuthzAminoSupport = sdk46OrLater
  const authzSupport = data.authzSupport ?? data.params?.authz
  const authzAminoSupport = data.authzAminoSupport ?? true
  const authzAminoGenericOnly = authzAminoSupport && (data.authzAminoGenericOnly ?? !sdkAuthzAminoSupport)
  const authzAminoLiftedValues = authzAminoSupport && (data.authzAminoLiftedValues ?? authzAminoGenericOnly)
  const authzAminoExecPreventTypes = data.authzAminoExecPreventTypes || []
  const apiVersions = {
    gov: sdk46OrLater ? 'v1' : 'v1beta1',
    ...data.apiVersions || {}
  }

  return {
    ...data,
    prettyName: data.prettyName || data.pretty_name,
    chainId: data.chainId || data.chain_id,
    prefix: data.prefix || data.bech32_prefix,
    slip44,
    estimatedApr: data.params?.calculated_apr,
    ledgerSupport,
    authzSupport,
    authzAminoSupport,
    authzAminoGenericOnly,
    authzAminoLiftedValues,
    authzAminoExecPreventTypes,
    apiVersions,
    denom: data.denom || baseAsset?.base?.denom,
    display: data.display || baseAsset?.display?.denom,
    symbol: data.symbol || baseAsset?.symbol,
    decimals: data.decimals || baseAsset?.decimals,
    image: baseAsset?.image || data.image,
    coinGeckoId: baseAsset?.coingecko_id,
    assets,
    baseAsset
  }
}

export default Chain;
