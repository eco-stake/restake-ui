import _ from 'lodash'
import { divide, bignumber, round, format } from 'mathjs'
import { truncateDenom } from '../utils/Helpers.mjs'

function Coin(props) {
  const { amount, denom, asset, fullPrecision, showValue = true, showImage = true, className } = props
  let { decimals, symbol, prices } = asset || {}
  const { coingecko } = prices || {}
  symbol = symbol || (denom && truncateDenom(denom?.toUpperCase()))

  function decimalAmount(){
    if(decimals){
      return round(divide(bignumber(amount), Math.pow(10, decimals)), precision())
    }else{
      return round(bignumber(amount), 0)
    }
  }

  function formattedAmount(){
    return separator(format(decimalAmount(), {notation: 'fixed'}))
  }

  function value(){
    return (amount / Math.pow(10, decimals) * coingecko.usd).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  }

  function separator(stringNum) {
    var str = stringNum.split(".");
    str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return str.join(".");
  }

  function precision(){
    if(fullPrecision) return decimals;
    if(props.precision) return props.precision;
    if(amount >= (1000 * Math.pow(10, decimals))) return 2
    if(amount >= (100 * Math.pow(10, decimals))) return 3
    return 6
  }

  if(!denom || amount === undefined){
    return null
  }

  const classNames = ['coins', className]
  if(showImage){
    classNames.push('d-inline-block align-top')
  }

  return (
    <span className={_.compact(classNames).join(' ')}>
      <span className={showImage ? `d-flex align-items-center` : undefined} title={!showValue && !!coingecko?.usd && !!amount ? `$${value()}` : ''}>
        {showImage && asset?.image && (
          <img src={asset.image} height={15} className={`rounded-circle me-1 image`} />
        )}
        <span className="amount">{formattedAmount()}</span>&nbsp;
        <small className="denom">{symbol}</small>
      </span>
      {showValue && !!coingecko?.usd && !!amount && (
        <div>
          <span className="value"><em className="text-muted">${value()}</em></span>
        </div>
      )}
    </span>
  )
}

export default Coin;
