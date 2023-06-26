import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import NetworkSelect from './NetworkSelect'
import Delegations from './Delegations';
import Coins from './Coins'
import About from './About'

import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import {
  Container,
  Dropdown,
  ButtonGroup,
  Navbar,
  Nav,
  Spinner
} from 'react-bootstrap';
import {
  Droplet,
  DropletFill,
  DropletHalf,
  CashCoin,
  Coin,
  EnvelopePaper,
  Stars,
  WrenchAdjustableCircle,
  WrenchAdjustableCircleFill,
  Magic,
  Clipboard,
  ClipboardCheck,
  Eye,
  Key
} from 'react-bootstrap-icons'
import { CopyToClipboard } from 'react-copy-to-clipboard';
import GitHubButton from 'react-github-btn'
import Logo from '../assets/logo.png'
import Logo2x from '../assets/logo@2x.png'
import Logo3x from '../assets/logo@3x.png'
import LogoWhite from '../assets/logo-white.png'
import LogoWhite2x from '../assets/logo-white@2x.png'
import LogoWhite3x from '../assets/logo-white@3x.png'

import PoweredByAkash from '../assets/powered-by-akash.svg'
import PoweredByAkashWhite from '../assets/powered-by-akash-white.svg'
import TooltipIcon from './TooltipIcon';
import Voting from './Voting';
import Networks from './Networks';
import Grants from './Grants';
import Favourite from './Favourite';
import WalletModal from './WalletModal';
import Wallet from '../utils/Wallet.mjs';
import SendModal from './SendModal';
import KeplrSignerProvider from '../utils/KeplrSignerProvider.mjs';
import FalconSignerProvider from '../utils/FalconSignerProvider.mjs';
import LeapSignerProvider from '../utils/LeapSignerProvider.mjs';
import KeplrMobileSignerProvider from '../utils/KeplrMobileSignerProvider.mjs';
import ConnectWalletModal from './ConnectWalletModal';
import { truncateAddress } from '../utils/Helpers.mjs';
import CosmostationSignerProvider from '../utils/CosmostationSignerProvider.mjs';
import SigningClient from '../utils/SigningClient.mjs';

class App extends React.Component {
  constructor(props) {
    super(props);
    const favouriteJson = localStorage.getItem('favourites')
    const favouriteAddressJson = localStorage.getItem('favourite-addresses')
    this.state = {
      favourites: favouriteJson ? JSON.parse(favouriteJson) : [],
      favouriteAddresses: favouriteAddressJson ? JSON.parse(favouriteAddressJson) : {}
    }
    this.signerProviders = [
      new KeplrSignerProvider(window.keplr),
      new LeapSignerProvider(window.leap),
      new CosmostationSignerProvider(window.cosmostation?.providers?.keplr, window.cosmostation?.cosmos),
      new KeplrMobileSignerProvider({
        connectModal: {
          open: (uri, callback) => {
            this.setState({
              connectWallet: true,
              qrCodeUri: uri || this.state.qrCodeUri,
              qrCodeCallback: callback || this.state.qrCodeCallback
            })
          },
          close: () => {
            this.setState({ connectWallet: false })
          }
        }
      }),
      // new FalconSignerProvider(window.falcon)
    ]
    this.signerConnectors = {}
    this.connectAuto = this.connectAuto.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.showNetworkSelect = this.showNetworkSelect.bind(this);
    this.getBalance = this.getBalance.bind(this);
    this.onSend = this.onSend.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
    this.toggleFavourite = this.toggleFavourite.bind(this);
    this.toggleFavouriteAddress = this.toggleFavouriteAddress.bind(this);
    this.updateFavouriteAddresses = this.updateFavouriteAddresses.bind(this);
  }

  async componentDidMount() {
    this.connect()
    window.addEventListener("load", this.connectAuto)
    this.signerProviders.forEach(provider => {
      const connector = (event) => this.connectAuto(event, provider.name)
      this.signerConnectors[provider.name] = connector
      window.addEventListener(provider.keychangeEvent, connector)
    })
  }

  async componentDidUpdate(prevProps, prevState) {
    if (!this.props.network) return

    if (this.props.network !== prevProps.network) {
      this.clearRefreshInterval()
      this.setState({ balance: undefined, address: undefined, wallet: undefined, grants: undefined, error: undefined })
      this.connect()
    }else if(this.state.address != prevState.address){
      this.clearRefreshInterval()
      this.setState({ balance: undefined, grants: undefined, error: undefined })
      this.getBalance()
      this.getGrants().then(() => {
        this.refreshInterval();
      })
    }
  }

  componentWillUnmount() {
    this.clearRefreshInterval()
    window.removeEventListener("load", this.connectAuto)
    this.signerProviders.forEach(provider => {
      window.removeEventListener(provider.keychangeEvent, this.signerConnectors[provider.name])
    })
  }

  showNetworkSelect() {
    this.setState({ showNetworkSelect: true })
  }

  connected() {
    return this.props.network?.connected
  }

  getSignerProvider(providerKey){
    return providerKey && this.signerProviders.find(el => el.name === providerKey)
  }

  disconnect() {
    localStorage.removeItem('connected')
    this.state.signerProvider?.disconnect()
    this.setState({
      error: null,
      address: null,
      balance: null,
      wallet: null,
      signingClient: null,
      signerProvider: null
    })
  }

  connectAuto(event, providerKey){
    return this.connect(providerKey)
  }

  async connect(providerKey, manual) {
    if (this.props.network && !this.connected()) {
      return this.setState({
        error: 'Could not connect to any available API servers'
      })
    }

    let storedKey = localStorage.getItem('connected')
    if(storedKey === '1'){ // deprecate
      storedKey = 'keplr'
      localStorage.setItem('connected', storedKey)
    }

    const signerProvider = this.getSignerProvider(providerKey || storedKey)

    if(!signerProvider) return

    providerKey = signerProvider.name

    if (manual && !signerProvider.available()) {
      return this.setState({
        providerError: providerKey
      })
    }

    const { network } = this.props
    if (!network || !signerProvider.available()) return

    if (!manual && (providerKey !== storedKey || !signerProvider.connected())) {
      return
    }

    this.setState({ signerProvider })

    const wallet = new Wallet(network, signerProvider)
    try {
      const key = await wallet.connect();
      if (!network.ledgerSupport && (key.isNanoLedger || key.isHardware)) {
        throw new Error('Ledger support is coming soon')
      }
    } catch (e) {
      return this.setState({
        error: `Unable to connect to ${signerProvider?.label || 'signer'}: ${e.message}`,
        address: null,
        wallet: null,
        signingClient: null
      })
    }
    try {
      const signingClient = SigningClient(network, signerProvider)
      signingClient.registry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant)
      signingClient.registry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke)

      const address = await wallet.getAddress();

      localStorage.setItem('connected', providerKey)
      this.setState({
        address,
        wallet,
        signingClient,
        error: false,
        qrCodeUri: null,
        qrCodeCallback: null
      })
    } catch (e) {
      console.log(e)
      return this.setState({
        error: `Failed to connect to ${signerProvider?.label || 'signer'}: ${e.message}`
      })
    }
  }

  refreshInterval() {
    this.setState({ refresh: true })
    this.refreshTimeout()
  }

  refreshTimeout() {
    if(!this.state.refresh) return

    const grantTimeout = setTimeout(() => {
      this.getGrants().then(() => {
        this.refreshTimeout()
      });
    }, 60_000);
    this.setState({ grantTimeout });
  }

  clearRefreshInterval() {
    clearTimeout(this.state.grantTimeout);
    this.setState({ refresh: false })
  }

  toggleFavourite(network) {
    const { favourites } = this.state
    let newFavourites
    if (favourites.includes(network.path)) {
      newFavourites = favourites.filter(el => el !== network.path)
    } else {
      newFavourites = [...favourites, network.path]
    }
    localStorage.setItem('favourites', JSON.stringify(newFavourites))
    this.setState({ favourites: newFavourites })
  }

  toggleFavouriteAddress(address, label) {
    const favourites = this.favouriteAddresses()
    let newFavourites
    if (favourites.some(el => el.address === address)) {
      newFavourites = favourites.filter(el => el.address !== address)
    } else {
      newFavourites = [...favourites, { address, label }]
    }
    this.updateFavouriteAddresses({ ...this.state.favouriteAddresses, [this.props.network.path]: newFavourites })
  }

  updateFavouriteAddresses(newFavourites) {
    localStorage.setItem('favourite-addresses', JSON.stringify(newFavourites))
    this.setState({ favouriteAddresses: newFavourites })
  }

  favouriteAddresses(){
    return this.state.favouriteAddresses[this.props.network.path] || []
  }

  currentFavouriteAddress(){
    return this.favouriteAddresses().find(el => el.address === this.state.address)
  }

  otherFavouriteAddresses() {
    return this.favouriteAddresses().filter(el => el.address !== this.state.wallet?.address)
  }

  viewingWallet() {
    return this.state.address && this.state.address === this.state.wallet?.address
  }

  addressName() {
    if(!this.state.address) return null

    if(this.viewingWallet()) return this.state.wallet.name
    return this.currentFavouriteAddress()?.label || this.state.address
  }

  async getBalance() {
    if (!this.state.address) return

    this.props.queryClient.getBalance(this.state.address)
      .then(
        (balances) => {
          const balance = balances?.find(
            (element) => element.denom === this.props.network.denom
          ) || { denom: this.props.network.denom, amount: 0 };
          this.setState({
            balance,
            balances,
            error: null
          })
        },
        (error) => console.log(error)
      )
  }

  async getGrants() {
    if (!this.state.address || !this.props.network.authzSupport) return
    const address = this.state.address
    let granterGrants, granteeGrants, grantQuerySupport

    try {
      granterGrants = await this.props.queryClient.getGranterGrants(address)
      this.setGrants(address, granterGrants, 'granter', true)
      granteeGrants = await this.props.queryClient.getGranteeGrants(address)
      return this.setGrants(address, granteeGrants, 'grantee')
    } catch (error) {
      console.log('Failed to get all grants in batch', error.message)
      grantQuerySupport = error.response?.status !== 501
      this.setState((state) => {
        if (address !== state.address) return {}
        return { grantQuerySupport }
      })
      if(grantQuerySupport){
        return this.setState({ error: "Failed to load all grants" })
      }
    }

    let addresses = this.props.operators.map(el => el.botAddress)
    const favourites = this.favouriteAddresses()
    addresses = addresses.concat(favourites.filter(el => !addresses.includes(el.address)).map(el => el.address))

    granterGrants = await this.getGrantsIndividually(addresses.map(el => {
      return { grantee: el, granter: address }
    }))
    this.setGrants(address, granterGrants, 'granter', grantQuerySupport)
    granteeGrants = await this.getGrantsIndividually(favourites.map(el => {
      return { granter: el.address, grantee: address }
    }))
    this.setGrants(address, granteeGrants, 'grantee', grantQuerySupport)
  }

  async getGrantsIndividually(grants){
    const address = this.state.address
    const calls = grants.map(({granter, grantee}) => {
      return () => {
        if (address !== this.state.address) return

        return this.props.queryClient.getGrants(grantee, granter).then(
          (result) => {
            return result.map(grant => {
              return {
                ...grant,
                grantee,
                granter
              }
            })
          });
      }
    });

    const batchCalls = _.chunk(calls, 5);

    let allGrants = []
    for (const batchCall of batchCalls) {
      if (address !== this.state.address) return
      const grants = (await Promise.allSettled(batchCall.map(call => call()))).map(el => el.status === 'fulfilled' && el.value)
      allGrants = allGrants.concat(_.compact(grants.flat()))
    }
    return allGrants
  }

  setGrants(address, grants, type, grantQuerySupport){
    if(type === 'grantee' && this.state.wallet?.address === address){
      this.state.wallet.grants = grants || []
    }
    if (address !== this.state.address) return
    this.setState((state) => {
      if (address !== state.address) return {}
      return {
        grants: {
          ...state.grants,
          [type]: grants,
        },
        grantQuerySupport: grantQuerySupport ?? state.grantQuerySupport
      }
    })
  }

  onSend(recipient, amount){
    this.setState({showSendModal: false})
    setTimeout(() => {
      this.getBalance()
    }, 2_000);
  }

  onGrant(grantee, grant) {
    const filterGrant = (el) => {
      if (el.grantee !== grantee) return true
      if (el.authorization['@type'] === grant.authorization['@type'] && el.authorization.msg === grant.authorization.msg) {
        return false
      }
      return true
    }
    this.setState((state, props) => {
      if(!state.grants) return {}

      const granterGrants = state.grants.granter?.filter(filterGrant) || []
      granterGrants.push(grant)
      return { grants: { ...state.grants, granter: granterGrants } }
    })
    if(this.state.wallet && grantee === this.state.wallet.address){
      const grants = this.state.wallet.grants.filter(filterGrant)
      grants.push(grant)
      this.state.wallet.grants = grants
    }
  }

  onRevoke(grantee, msgTypes) {
    const filterGrant = (el) => {
      if (el.grantee !== grantee) return true
      if (msgTypes.includes('/cosmos.staking.v1beta1.MsgDelegate')) {
        if (el.authorization['@type'] === '/cosmos.staking.v1beta1.StakeAuthorization') return false
      }
      if (el.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' && msgTypes.includes(el.authorization.msg)) return false
      return true;
    }
    this.setState((state, props) => {
      if(!state.grants || !state.grants.granter) return {}

      const granterGrants = state.grants.granter.filter(filterGrant)
      return { grants: { ...state.grants, granter: granterGrants } }
    })
    if(this.state.wallet && grantee === this.state.wallet.address){
      this.state.wallet.grants = this.state.wallet.grants.filter(filterGrant)
    }
  }

  showWalletModal(opts) {
    opts = opts || {}
    this.setState((state) => {
      return { walletModal: { ...state.validatorModal, show: true, ...opts } }
    })
  }

  hideWalletModal(opts) {
    opts = opts || {}
    this.setState((state) => {
      return { walletModal: { ...state.walletModal, show: false } }
    })
  }

  setCopied() {
    this.setState({ copied: true })
    setTimeout(() => {
      this.setState({ copied: false })
    }, 2000)
  }

  themeIcon() {
    const { theme, themeChoice, themeDefault, setThemeChoice } = this.props
    let icon, switchTo
    let iconProps = {
      size: '1.4em',
      className: 'me-3',
      role: 'button',
      onClick: () => setThemeChoice(switchTo)
    }
    if (themeChoice === 'auto') {
      icon = <DropletHalf {...iconProps} />
      switchTo = theme === 'dark' ? 'light' : 'dark'
    } else {
      icon = themeChoice === 'dark' ? <DropletFill {...iconProps} /> : <Droplet {...iconProps} />
      switchTo = themeDefault !== theme ? 'auto' : theme === 'dark' ? 'light' : 'dark'
    }
    const tooltip = `Switch to ${switchTo} mode`
    return (
      <span>
        <TooltipIcon icon={icon} tooltip={tooltip} placement="left" rootClose={true} />
      </span>
    )
  }

  networkIcon() {
    let icon, mode
    let iconProps = {
      size: '1.4em',
      className: 'mx-2 mx-md-3',
      role: 'button',
      onClick: () => this.props.changeNetworkMode(mode)
    }
    if (this.props.directory.testnet) {
      iconProps.className = iconProps.className + ' text-warning'
      icon = <WrenchAdjustableCircleFill {...iconProps} />
      mode = 'mainnet'
    } else {
      iconProps.className = iconProps.className + ' text-muted'
      icon = <WrenchAdjustableCircle {...iconProps} />
      mode = 'testnet'
    }
    const tooltip = `Switch to ${mode}`
    return (
      <span className="text-reset">
        <TooltipIcon icon={icon} tooltip={tooltip} placement="left" />
      </span>
    )
  }

  introText(){
    switch (this.props.active) {
      case 'networks':
        return <span>REStake automatically imports <a href="https://cosmos.network/" target="_blank" className="text-reset"><strong>Cosmos</strong></a> chains from the <a href="https://github.com/cosmos/chain-registry" target="_blank" className="text-reset"><strong>Chain Registry</strong></a></span>
      case 'voting':
        return <span>REStake let's you vote on behalf of your other {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong>} wallets using Authz</span>
      case 'grants':
        return <span>REStake manages all your {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong>} Authz grants in one place</span>
    }
    return <span>REStake allows validators to <strong onClick={() => this.setState({ showAbout: true })} className="text-decoration-underline" role="button">auto-compound</strong> your {this.props.network && <strong onClick={this.showNetworkSelect} className="text-decoration-underline" role="button">{this.props.network.prettyName}</strong>} staking rewards</span>
  }

  render() {
    return (
      <Container fluid="lg">
        <header className="">
          <div className="d-flex justify-content-between align-items-center py-3 border-bottom">
            <div className="logo d-flex align-items-end text-reset text-decoration-none">
              <span onClick={() => this.props.setActive('networks')} role="button" className="text-reset text-decoration-none">
                {this.props.theme === 'light'
                  ? (
                    <img src={Logo} srcSet={`${Logo2x} 2x, ${Logo3x} 3x`} alt="REStake" />
                  ) : (
                    <img src={LogoWhite} srcSet={`${LogoWhite2x} 2x, ${LogoWhite3x} 3x`} alt="REStake" />
                  )}
              </span>
              {this.props.directory.testnet && (
                <small className="ms-2 text-muted">testnet</small>
              )}
            </div>
            <div className="d-flex align-items-center text-reset text-decoration-none">
              <p className="lead fs-6 text-center m-0 px-3 d-lg-block d-none">
                {this.introText()}
              </p>
            </div>
            <div className="d-flex align-items-center text-reset text-decoration-none">
              {this.networkIcon()}
              {this.themeIcon()}
              <NetworkSelect show={this.state.showNetworkSelect} onHide={() => { this.setState({ showNetworkSelect: false }) }} networks={this.props.networks}
                network={this.props.network}
                favourites={this.state.favourites || []}
                validators={this.props.validators}
                changeNetwork={this.props.changeNetwork} />
            </div>
          </div>
          <div className="d-flex justify-content-between border-bottom">
            <Navbar className={`navbar navbar-expand ${this.props.theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}>
              <div className="justify-content-center">
                <Nav activeKey={this.props.active} onSelect={(e) => this.props.setActive(e)}>
                  <div className="nav-item pe-2 border-end">
                    <Nav.Link eventKey="networks">
                      <Stars className="mb-1 me-1" /><span className="d-none d-sm-inline"> Explore</span>
                    </Nav.Link>
                  </div>
                  {this.props.network && (
                    <>
                      <div className="nav-item px-2 border-end">
                        <Nav.Link eventKey="delegations">
                          <Coin className="mb-1 me-1" /><span className="d-none d-sm-inline"> Stake</span>
                        </Nav.Link>
                      </div>
                      <div className="nav-item px-2 border-end">
                        <Nav.Link eventKey="voting">
                          <EnvelopePaper className="mb-1 me-1" /><span className="d-none d-sm-inline"> Vote</span>
                        </Nav.Link>
                      </div>
                      {this.state.address && this.props.network.authzSupport && (
                        <div className="nav-item ps-2">
                          <Nav.Link eventKey="grants">
                            <Magic className="mb-1 me-1" /><span className="d-none d-sm-inline"> Grant</span>
                          </Nav.Link>
                        </div>
                      )}
                    </>
                  )}
                </Nav>
              </div>
            </Navbar>
            <nav className={`navbar navbar-expand ${this.props.theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}>
              <div className="justify-content-center">
                <ul className="navbar-nav">
                  {this.props.network && (
                    <>
                      {(this.state.wallet || this.favouriteAddresses().length > 0) && (
                        <li className="nav-item pe-3 border-end d-flex align-items-center">
                          {this.state.address && (
                            <>
                              <span className="d-none d-md-inline pe-2">
                                <Favourite
                                  favourites={this.favouriteAddresses()}
                                  value={this.state.address}
                                  label={this.viewingWallet() && this.state.wallet?.name}
                                  toggle={this.toggleFavouriteAddress} />
                              </span>
                              <span>
                                {this.viewingWallet() ? (
                                  <TooltipIcon tooltip="Viewing your wallet" rootClose={true}>
                                    <span role="button" onClick={() => this.showWalletModal({ activeTab: 'wallet' })}>
                                      <Key />
                                    </span>
                                  </TooltipIcon>
                                ) : (
                                  <TooltipIcon tooltip="Viewing saved address" rootClose={true}>
                                    <span role="button" onClick={() => this.showWalletModal({ activeTab: 'saved' })}>
                                      <Eye />
                                    </span>
                                  </TooltipIcon>
                                )}
                              </span>
                            </>
                          )}
                          {this.otherFavouriteAddresses().length < 1 && this.state.wallet ? (
                            <span role="button" onClick={() => this.showWalletModal({ activeTab: 'wallet' })} className="small d-none d-lg-inline ms-2">{this.state.wallet.name || truncateAddress(this.state.wallet.address)}</span>
                          ) : (
                            <select className="form-select form-select-sm d-none d-lg-block ms-2" aria-label="Address" value={this.state.address || ''} onChange={(e) => this.setState({ address: e.target.value })} style={{maxWidth: 200}}>
                              {this.state.wallet ? (
                                <optgroup label={this.state.signerProvider.label}>
                                  <option value={this.state.wallet.address}>{this.state.wallet.name || truncateAddress(this.state.wallet.address)}</option>
                                </optgroup>
                              ) : (
                                <option value="">Choose address</option>
                              )}
                              <optgroup label="Saved">
                                {this.otherFavouriteAddresses().map(({ address, label }) => {
                                  return <option key={address} value={address}>{label || truncateAddress(address)}</option>
                                })}
                              </optgroup>
                            </select>
                          )}
                          {this.state.address && (
                            <span className="d-none d-md-inline ms-2">
                              <TooltipIcon tooltip="Copy address" rootClose={true}>
                                <span>
                                  <CopyToClipboard text={this.state.address}
                                    onCopy={() => this.setCopied()}>
                                    <span role="button" className="d-flex align-items-center">{this.state.copied ? <ClipboardCheck /> : <Clipboard />}</span>
                                  </CopyToClipboard>
                                </span>
                              </TooltipIcon>
                            </span>
                          )}
                        </li>
                      )}
                      {this.state.address && (
                      <li className="nav-item px-3 border-end align-items-center d-none d-md-flex">
                        <div role="button" onClick={() => this.showWalletModal({activeTab: this.state.wallet ? 'wallet' : 'saved'})}>
                          {this.state.balance ? (
                            <Coins
                              coins={this.state.balance}
                              asset={this.props.network.baseAsset}
                              className="small text-end"
                            />
                          ) : (
                            <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                              <span className="visually-hidden">Loading...</span>
                            </Spinner>
                          )}
                        </div>
                      </li>
                      )}
                      <li className="nav-item ps-3 d-flex align-items-center">
                        <Dropdown as={ButtonGroup}>
                          <Dropdown.Toggle size="sm" className="rounded">
                            {this.state.address ? (
                              <>
                                <CashCoin className="me-1" />
                              </>
                            ) : 'Connect'}
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            {this.state.address && (
                              <div className="d-block d-md-none">
                                <Dropdown.Header className="text-truncate">{this.addressName()}</Dropdown.Header>
                                <Dropdown.Item as="button" onClick={() => this.showWalletModal({activeTab: this.state.wallet ? 'wallet' : 'saved'})}>
                                  <Coins
                                    coins={this.state.balance}
                                    asset={this.props.network.baseAsset}
                                    className="small"
                                  />
                                </Dropdown.Item>
                                <Dropdown.Divider />
                              </div>
                            )}
                            {this.state.wallet ? (
                              <>
                                <Dropdown.Item
                                  as="button"
                                  disabled={!this.state.wallet?.hasPermission(this.state.address, 'Send')}
                                  onClick={() => this.setState({ showSendModal: true })}
                                >
                                  Send {this.props.network.symbol}
                                </Dropdown.Item>
                              </>
                            ) : (
                              <>
                                {this.signerProviders.map(provider => {
                                  return <Dropdown.Item as="button" key={provider.name} onClick={() => this.connect(provider.name, true)} disabled={!provider.available()}>Connect {provider.label}</Dropdown.Item>
                                })}
                                <Dropdown.Divider />
                              </>
                            )}
                            <Dropdown.Item as="button" onClick={() => this.showWalletModal({ activeTab: 'saved' })}>Saved Addresses</Dropdown.Item>
                            {this.state.address && (
                              <>
                                <Dropdown.Divider />
                                <Dropdown.Item as="button" onClick={this.disconnect}>{this.state.wallet ? `Disconnect ${this.state.signerProvider?.label}` : 'Close'}</Dropdown.Item>
                              </>
                            )}
                          </Dropdown.Menu>
                        </Dropdown>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </nav>
          </div>
        </header>
        <div className="my-4">
          {this.props.network?.experimental && this.props.active !== 'networks' && (
            <AlertMessage variant="info" dismissible={false}>
              This network was added to REStake automatically and has not been thoroughly tested yet. <a href="https://github.com/eco-stake/restake-ui/issues" target="_blank">Raise an issue</a> if you have any problems.
            </AlertMessage>
          )}
          <AlertMessage message={this.state.error} variant="danger" dismissible={false} />
          {!this.state.providerError === 'keplr' && (
            <AlertMessage variant="warning" dismissible={true} onClose={() => this.setState({ providerError: false })}>
              Please install the <a href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap?hl=en" target="_blank" rel="noreferrer">Keplr browser extension</a> using desktop Google Chrome.<br />WalletConnect and mobile support is coming soon.
            </AlertMessage>
          )}
          {this.props.active === 'networks' && (
            <Networks
              networks={Object.values(this.props.networks)}
              changeNetwork={this.props.changeNetwork}
              favourites={this.state.favourites}
              toggleFavourite={this.toggleFavourite} />
          )}
          {this.props.active === 'delegations' &&
            <>
              <Delegations
                theme={this.props.theme}
                network={this.props.network}
                networks={this.props.networks}
                address={this.state.address}
                wallet={this.state.wallet}
                balance={this.state.balance}
                operators={this.props.operators}
                validators={this.props.validators}
                validator={this.props.validator}
                grants={this.state.grants}
                getBalance={this.getBalance}
                showAbout={() => this.setState({ showAbout: true })}
                onGrant={this.onGrant}
                onRevoke={this.onRevoke}
                queryClient={this.props.queryClient}
                signingClient={this.state.signingClient} />
            </>
          }
          {this.props.active === 'voting' && (
            <Voting
              network={this.props.network}
              address={this.state.address}
              wallet={this.state.wallet}
              favouriteAddresses={this.favouriteAddresses()}
              queryClient={this.props.queryClient}
              signingClient={this.state.signingClient} />
          )}
          {this.props.active === 'grants' && this.state.address && this.props.network.authzSupport && (
            <Grants
              network={this.props.network}
              address={this.state.address}
              wallet={this.state.wallet}
              grants={this.state.grants}
              operators={this.props.operators}
              validators={this.props.validators}
              favouriteAddresses={this.favouriteAddresses()}
              showFavouriteAddresses={() => this.showWalletModal({ activeTab: 'saved' })}
              toggleFavouriteAddress={this.toggleFavouriteAddress}
              onGrant={this.onGrant}
              onRevoke={this.onRevoke}
              queryClient={this.props.queryClient}
              grantQuerySupport={this.state.grantQuerySupport}
              signingClient={this.state.signingClient} />
          )}
        </div>
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 my-4 border-top">
          <a href="https://akash.network" target="_blank" rel="noreferrer" className="col-md-4 mb-0 text-muted">
            {this.props.theme === 'light'
              ? (
                <img src={PoweredByAkash} alt="Powered by Akash" width={200} />
              ) : (
                <img src={PoweredByAkashWhite} alt="Powered by Akash" width={200} />
              )}
          </a>

          <div className="col-md-4 align-items-center text-center me-lg-auto">
            <a href="https://ecostake.com" target="_blank" rel="noreferrer" className="text-reset text-decoration-none d-block mb-2">
              <span className="d-none d-sm-inline">Built with 💚&nbsp;</span> by ECO Stake 🌱
            </a>
            <a href={`https://${this.props.directory.domain}`} target="_blank" className="text-reset text-decoration-none d-block small">
              <span className="d-none d-sm-inline">Interchain APIs from</span> <u>cosmos.directory</u>
            </a>
          </div>

          <p className="col-md-4 mb-0 text-muted text-end justify-content-end d-none d-lg-flex">
            {this.props.theme === 'light'
              ? (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub">Star</GitHubButton>
              ) : (
                <GitHubButton href="https://github.com/eco-stake/restake" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star eco-stake/restake on GitHub" data-color-scheme="no-preference: dark; light: dark; dark: dark;">Star</GitHubButton>
              )}
          </p>
        </footer>
        <About show={this.state.showAbout} onHide={() => this.setState({ showAbout: false })} />
        <WalletModal
          show={this.state.walletModal?.show} onHide={() => this.hideWalletModal()}
          activeTab={this.state.walletModal?.activeTab}
          network={this.props.network}
          networks={Object.values(this.props.networks)}
          address={this.state.address}
          wallet={this.state.wallet}
          signerProvider={this.state.signerProvider}
          balances={this.state.balances}
          favouriteAddresses={this.state.favouriteAddresses}
          updateFavouriteAddresses={this.updateFavouriteAddresses}
          toggleFavouriteAddress={this.toggleFavouriteAddress}
          setAddress={(value) => {
            this.setState({address: value})
            this.hideWalletModal()
          }}
        />
        <ConnectWalletModal
          show={this.state.connectWallet}
          signerProvider={this.state.signerProvider}
          uri={this.state.qrCodeUri}
          callback={this.state.qrCodeCallback}
          onClose={() => this.setState({connectWallet: false})}
        />
        {this.props.network && (
          <SendModal
            show={this.state.showSendModal}
            network={this.props.network}
            address={this.state.address}
            wallet={this.state.wallet}
            balance={this.state.balance}
            favouriteAddresses={this.favouriteAddresses()}
            signingClient={this.state.signingClient}
            onHide={() => this.setState({ showSendModal: false })}
            onSend={this.onSend}
          />
        )}
      </Container>
    )
  }
}

export default App;
