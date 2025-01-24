import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import { Widget } from '@skip-go/widget';
import AlertMessage from './AlertMessage';

function Swap(props) {
  const { address, wallet, network, theme, getBalance } = props
  const [connectedAddresses, setConnectedAddresses] = useState({})
  const [defaultRoute, setDefaultRoute] = useState({})
  const [error, setError] = useState()

  useEffect(() => {
    if(!network) return

    setDefaultRoute({
      destChainId: network.chainId,
      destAssetDenom: network.denom
    })
  }, [network])

  useEffect(() => {
    if(wallet) {
      if(network.ethermint && wallet.isLedger()){
        return setError('Swap from Ethermint chains is not supported with Ledger just yet')
      }

      setConnectedAddresses((prev) => ({
        ...prev,
        [network.chainId]: wallet.address
      }))
      setError()
    }
  }, [network, wallet?.address])

  async function getSigner(chainId) {
    if(wallet){
      return await wallet.signerProvider.getSignerForChainId(chainId)
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
