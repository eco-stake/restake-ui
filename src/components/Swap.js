import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import { Widget } from '@skip-go/widget';
import AlertMessage from './AlertMessage';

const initialConnectNetworks = [
  "agoric",
  "akash",
  "axelar",
  "celestia",
  "chihuahua",
  "cosmoshub",
  "cryptoorgchain",
  "dydx",
  "dymension",
  "evmos",
  "gateway",
  "injective",
  "juno",
  "kava",
  "kyve",
  "lava",
  "mars",
  "noble",
  "omniflixhub",
  "osmosis",
  "passage",
  "persistence",
  "pryzm",
  "quasar",
  "quicksilver",
  "regen",
  "saga",
  "secretnetwork",
  "seda",
  "sentinel",
  "sommelier",
  "stargaze",
  "stride",
  "terra",
  "terra2",
  "umee",
  "xpla"
];

function Swap(props) {
  const { networks, network, wallet, theme, getBalance } = props
  const [connectedAddresses, setConnectedAddresses] = useState({})
  const [defaultRoute, setDefaultRoute] = useState({})
  const [error, setError] = useState()

  useEffect(() => {
    if(!network) return

    setDefaultRoute({
      destChainId: network.chainId,
      destAssetDenom: network.denom
    })
  }, [network?.path])

  useEffect(() => {
    if(!networks) return

    if(wallet) {
      if(network.ethermint && wallet.isLedger()){
        setError('Swap from Ethermint chains is not supported with Ledger just yet')
      }else{
        setError()
      }

      let defaultNetworks = _.at(networks, initialConnectNetworks).filter((network) => {
        if(!network) return false

        const signerProvider = wallet.signerProvider
        if(signerProvider.name === 'keplr' && signerProvider.isMobile()){
          return network.path !== 'gateway'
        }
        return true
      })
      let chainIds = new Set(defaultNetworks.map((network) => network?.chainId))
      chainIds.add(network.chainId)
      chainIds = Array.from(chainIds)
      wallet.signerProvider.enable(chainIds).then(() => {
        const connected = {}
        Promise.all(
          chainIds.map(async (chainId) => {
            try {
              const keyInfo = await wallet.signerProvider.getKey(chainId);
              if (keyInfo && keyInfo.bech32Address) {
                connected[chainId] = keyInfo.bech32Address
              }
            } catch (error) {
              console.log(chainId, error)
            }
          })
        ).then (() => {
          setConnectedAddresses((prev) => ({
            ...prev,
            ...connected
          }))
        })
      }).catch((error) => {
        console.log(error)
        setConnectedAddresses({})
      })
    }else{
      setConnectedAddresses({})
    }
  }, [networks, network, wallet?.address])

  async function getSigner(chainId) {
    if(wallet){
      return await wallet.signerProvider.getSigner(chainId)
    }
  }

  let widgetTheme = {}
  switch (theme) {
    case 'dark':
      widgetTheme = {
        brandColor: "#2A2B2D",
        primary: {
          background: {
            normal: "#191A1C",
            transparent: "rgba(25, 26, 28, 0.5)",
          },
          text: {
            normal: "#E6EAE9",
            lowContrast: "#B0B3B5",
            ultraLowContrast: "#7C7F81",
          },
          ghostButtonHover: "#1F2022",
        },
        secondary: {
          background: {
            normal: "#2A2B2D",
            transparent: "rgba(42, 43, 45, 0.5)",
            hover: "#3A3B3D",
          },
        },
        success: {
          text: "#28A745",
        },
        warning: {
          background: "#FFC107",
          text: "#856404",
        },
        error: {
          background: "#DC3545",
          text: "#721C24",
        },
      }
      break;
    case 'light':
      widgetTheme = {
        brandColor: "#F8F9FA",
        primary: {
          background: {
            normal: "#FFFFFF",
            transparent: "rgba(255, 255, 255, 0.5)",
          },
          text: {
            normal: "#000000",
            lowContrast: "#6C757D",
            ultraLowContrast: "#ADB5BD",
          },
          ghostButtonHover: "#E9ECEF",
        },
        secondary: {
          background: {
            normal: "#F8F9FA",
            transparent: "rgba(248, 249, 250, 0.5)",
            hover: "#E2E6EA",
          },
        },
        success: {
          text: "#28A745",
        },
        warning: {
          background: "#FFC107",
          text: "#856404",
        },
        error: {
          background: "#DC3545",
          text: "#721C24",
        },
      }
      break;
    }

  return (
    <>
      <AlertMessage message={error} />
      <div className="mb-2 px-2 mx-auto" style={{ maxWidth: '500px' }}>
        <Widget
          connectedAddresses={connectedAddresses}
          getCosmosSigner={getSigner}
          defaultRoute={defaultRoute}
          theme={widgetTheme}
          onTransactionComplete={getBalance}
        />
      </div>
    </>
  );
}

export default Swap;
