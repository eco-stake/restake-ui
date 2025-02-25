import _ from 'lodash'
import axios from 'axios'
import CoingeckoApi from './CoingeckoApi.mjs'
import ChainAsset from './ChainAsset.mjs'

function SkipApi(){
  async function getAssets(chainId){
    try {
      const res = await axios.get(`https://api.skip.build/v2/fungible/assets?chain_ids=${chainId}`)
      const data = res.data.chain_to_assets_map[chainId]?.assets || []
      const coingeckoIds = _.compact(data.map((el) => el.coingecko_id))
      const prices = await CoingeckoApi().getPrices(coingeckoIds)
      return data.map((asset) => {
        const { name, description, denom, symbol, decimals, coingecko_id } = asset
        const price = asset.coingecko_id && prices[asset.coingecko_id]
        return ChainAsset({
          name,
          description,
          denom,
          symbol,
          decimals,
          coingecko_id,
          image: asset.logo_uri,
          prices: price && { coingecko: price }
        })
      })
    } catch (err) {
      console.error(err)
    }
  }

  return {
    getAssets
  }
}

export default SkipApi
