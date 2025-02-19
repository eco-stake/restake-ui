function ChainAsset(data) {
  const { denom, symbol, decimals, image } = data

  return {
    ...data,
    denom,
    symbol,
    decimals,
    image
  }
}

export default ChainAsset
