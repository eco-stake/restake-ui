import React, { useState, useMemo } from 'react';

import { LiquidityModal, NETWORK } from '@leapwallet/elements'
// import '@leapwallet/elements/styles.css'

function LeapElements(props) {
  const { address, networks, signerProvider, testnet } = props

  const renderLiquidityButton = ({ onClick }) => {
    return (
      <button onClick={onClick}>
        <span>💳</span>
        <span>Buy Now</span>
      </button>
    )
  }

  const leapWalletClient = () => {
    return useMemo(() => {
      return {
        enable: (chainIds) => {
          return Promise.all(chainIds.map(chainId => {
            const network = networks.find(el => el.chainId === chainId)
            return signerProvider?.connect(network)
          }))
        },
        getAccount: async (chainId) => {
          const network = networks.find(el => el.chainId === chainId)
          return signerProvider?.getKey(network)
        },
        getSigner: async (chainId) => {
          const provider = signerProvider?.provider
          const signer = await provider.getOfflineSignerDirect(chainId)
          const aminoSigner = await provider.getOfflineSignerAmino(chainId)

          return {
            signDirect: async (address, signDoc) => {
              const result = await signer.signDirect(address, signDoc)
              return {
                signature: new Uint8Array(Buffer.from(result.signature.signature, 'base64')),
                signed: result.signed
              }
            },
            signAmino: async (address, signDoc) => {
              const result = await aminoSigner.signAmino(address, signDoc)
              return {
                signature: new Uint8Array(Buffer.from(res.signature.signature, 'base64')),
                signed: res.signed
              }
            },
            network: testnet ? NETWORK.TESTNET : NETWORK.MAINNET
          }
        },
      }
    }, [networks, signerProvider, testnet])
  }


  return (
    <>
      <LiquidityModal
        renderLiquidityButton={renderLiquidityButton}
        theme='light'
        walletClientConfig={{
          userAddress: address,
          walletClient: leapWalletClient(),
          connectWallet: () => {
            console.log('connect wallet')
          }
        }}
        config={{
          icon: 'https://assets.leapwallet.io/stars.png',
          title: 'Buy Bad Kid #44',
          subtitle: 'Price: 42K STARS'
        }}
      />
    </>
  );
}

export default LeapElements
