import React, { useState } from 'react';
import _ from 'lodash'
import Coin from './Coin'
import { divide, multiply, pow, bignumber, numeric } from 'mathjs'
import { sortCoins } from '../utils/Helpers.mjs';

function Coins({ coins, network, showTotalValue = true, hideLowValue = true, allowShowLowValue = true, ...props }) {
  const [showHidden, setShowHidden] = useState(!hideLowValue)

  let items = sortCoins(coins || [], network).map((coin) => {
    const asset = network.assetForDenom(coin.denom)
    let value
    if(asset && asset.prices?.coingecko?.usd){
      value = numeric(multiply(divide(bignumber(coin.amount || 0), pow(10, asset.decimals)), asset.prices.coingecko.usd), 'number')
    }
    return {
      coin,
      asset,
      value
    }
  })
  const totalValue = items.reduce((a, v) => a + (v.value || 0), 0)

  items.forEach((item, index) => {
    if(index == 0) return
    if(totalValue > 0 && (!item.value || item.value < 1)){
      item.hide = true
    }
  })

  return (
    <div>
      {items.map((item) => (
        <div key={item.coin.denom} className={hideLowValue && !showHidden && item.hide ? 'd-none' : ''}>
          <Coin
            {...item.coin}
            asset={item.asset}
            showValue={!showTotalValue}
            {...props}
          />
        </div>
      ))}
      {items.filter(item => item.hide).length > 0 && (
        <div>
          {showHidden ? (
            <small
              role={allowShowLowValue ? 'button' : ''}
              className={`text-muted`}
              onClick={() => allowShowLowValue && setShowHidden(false)}
            >
              ...hide low value
            </small>
          ) : (
            <small
              role={allowShowLowValue ? 'button' : ''}
              className={`text-muted`}
              onClick={() => allowShowLowValue && setShowHidden(true)}
            >
              ...and {items.filter(item => item.hide).length} more
            </small>
          )}
        </div>
      )}
      {showTotalValue && totalValue ? (
        <>
          <span className="total-value">
            <em className="text-muted">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</em>
          </span>
        </>
      ) : null}
    </div>
  )
}

export default Coins;
