import _ from 'lodash'
import axios from 'axios'

function CoingeckoApi(){
  async function getPrices(ids){
    if(!ids?.length) return {}

    try {
      const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
      return res.data
    } catch (err) {
      console.error(err)
      return {}
    }
  }

  return {
    getPrices
  }
}

export default CoingeckoApi
