import React, { useState, useEffect } from 'react';
import _ from 'lodash'

import {
  Modal,
  Tab,
  Nav,
  Table,
  Button
} from 'react-bootstrap'

import Address from './Address.js';
import Coin from './Coin.js';
import Favourite from './Favourite.js';
import SavedAddresses from './SavedAddresses.js';
import Coins from './Coins.js';

function WalletModal(props) {
  const { show, network, wallet, favouriteAddresses } = props
  const [activeTab, setActiveTab] = useState(props.activeTab || wallet ? 'wallet' : 'saved')

  useEffect(() => {
    if (props.activeTab && props.activeTab != activeTab) {
      setActiveTab(props.activeTab)
    }else if (!props.show){
      setActiveTab()
    }
  }, [props.show])

  function onHide() {
    props.onHide()
  }

  if(!network) return null

  const balances = props.balances?.length ? props.balances : [{amount: 0, denom: network.denom}]

  return (
    <>
      <Modal size="lg" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>Wallet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="wallet-tabs">
            <Nav variant="tabs" className="small mb-3 d-flex">
              <Nav.Item>
                <Nav.Link role="button" eventKey="wallet" disabled={!wallet}>Wallet</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link role="button" eventKey="saved">Saved Addresses</Nav.Link>
              </Nav.Item>
            </Nav>
            <Tab.Content>
              <Tab.Pane eventKey="wallet" className="small">
                {wallet && (
                  <>
                  <Table>
                    <tbody>
                      <tr>
                        <td scope="row">Wallet Provider</td>
                        <td className="text-break">
                          <div className="d-flex gap-2">
                            {wallet.signerProvider?.label || 'None'}
                          </div>
                        </td>
                      </tr>
                      {wallet.name && (
                        <tr>
                          <td scope="row">Wallet Name</td>
                          <td className="text-break">
                            <div className="d-flex gap-2">
                              {wallet.name}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td scope="row">Address</td>
                        <td className="text-break">
                          <div className="d-flex gap-2">
                            <Address address={wallet.address} />
                            <Favourite
                              value={(favouriteAddresses[network.path] || []).some(el => el['address'] === wallet.address)}
                              toggle={() => props.toggleFavouriteAddress(wallet.address, props.address === wallet?.address && wallet.name)}
                              onTooltip="Remove saved address"
                              offTooltip="Save address"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td scope="row">Balance</td>
                        <td className="text-break">
                          <Coins coins={balances} network={network} fullPrecision={true} />
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                  <div className="d-flex justify-content-end gap-2">
                    <Button variant="secondary" disabled={wallet.address === props.address} onClick={() => props.setAddress(wallet.address)}>
                      {wallet.address === props.address ? 'Viewing wallet' : 'View wallet'}
                    </Button>
                    <Button variant="primary" onClick={() => setActiveTab('saved')}>
                      Saved addresses
                    </Button>
                  </div>
                  </>
                )}
              </Tab.Pane>
              <Tab.Pane eventKey="saved" className="small">
                <SavedAddresses
                  network={props.network}
                  networks={props.networks}
                  address={props.address}
                  wallet={props.wallet}
                  favouriteAddresses={props.favouriteAddresses}
                  updateFavouriteAddresses={props.updateFavouriteAddresses}
                  setAddress={props.setAddress}
                />
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default WalletModal
