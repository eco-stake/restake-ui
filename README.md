# [REStake](https://restake.app)

REStake allows delegators to grant permission for a validator to compound their rewards, and provides a script validators can run to find their granted delegators and send the compounding transactions automatically.

REStake is also a convenient staking tool, allowing you to claim and compound your rewards individually or in bulk. This can save transaction fees and time, and many more features are planned.

[![](./docs/screenshot.png)](https://restake.app)

Try it out at [restake.app](https://restake.app).

The REStake autostaking script has it's own dedicated repository at [eco-stake/restake](https://github.com/eco-stake/restake).

## How it works / Authz

Authz is a new feature for Tendermint chains which lets you grant permission to another wallet to carry out certain transactions for you. These transactions are sent by the grantee on behalf of the granter, meaning the validator will send and pay for the TX, but actions will affect your wallet (such as claiming rewards).

REStake specifically lets you grant a validator permission to send `Delegate` transactions for their validator only. The validator cannot send any other transaction types, and has no other access to your wallet. You authorize this using Keplr as normal. REStake no longer requires a `Withdraw` permission to autostake.

A script is also provided which allows a validator to automatically search their delegators, check each for the required grants, and if applicable carry out the claim and delegate transactions on their behalf in a single transaction. This script should be run daily, and the time you will run it can be specified when you [add your operator](#become-an-operator).

## Limitations

- Authz is also not fully supported yet. Many chains are yet to update. The REStake UI will fall back to being a manual staking app with useful manual compounding features.
- Currently REStake needs the browser extension version of Keplr, but WalletConnect and Keplr iOS functionality will be added ASAP.
- REStake requires Nodejs version 17.x or later, it will not work with earlier versions.

## Become an operator

Follow the instructions in the [eco-stake/restake](https://github.com/eco-stake/restake#become-an-operator) repository to become a REStake operator.

## Contributing

### Adding/updating a network

Network information is sourced from the [Chain Registry](https://github.com/cosmos/chain-registry) via the [registry.cosmos.directory](https://registry.cosmos.directory) API. Chains in the master branch are automatically added to REStake assuming enough basic information is provided.

The `networks.json` file defines which chains appear as 'supported' in REStake; so long as the chain name matches the directory name from the Chain Registry, all chain information will be sourced automatically. Alternatively chains _can_ be supported in `networks.json` alone, but this is not a documented feature.

To add or override a chain in REStake, add the required information to `networks.json` as follows:

```json
{
  "name": "osmosis",
  "prettyName": "Osmosis",
  "gasPrice": "0.025uosmo",
  "authzSupport": true
}
```

Note that most attributes from Chain Registry can be overridden by defining the camelCase version in networks.json.

### Running the UI

Run the UI using docker with one line:

```bash
docker run -p 80:80 -t ghcr.io/eco-stake/restake-ui
```

Alternative run from source using `docker-compose up` or `npm start`.

## Ethos

The REStake UI is both validator and network agnostic. Any validator can be added as an operator and run this tool to provide an auto-compounding service to their delegators, but they can also run their own UI if they choose and adjust the branding to suit themselves.

For this to work, we need a common source of chain information, and a common source of 'operator' information. Chain information is sourced from the [Chain Registry](https://github.com/cosmos/chain-registry), via an API provided by [cosmos.directory](https://github.com/eco-stake/cosmos-directory). Operator information lives in the [Validator Registry](https://github.com/eco-stake/validator-registry).

Now we have a common source of operator information, applications can integrate with REStake validators easier using the data directly from GitHub, or via the [cosmos.directory](https://github.com/eco-stake/cosmos-directory) project.

## Disclaimer

The initial version of REStake was built quickly to take advantage of the new authz features. I'm personally not a React or Javascript developer, and this project leans extremely heavily on the [CosmJS project](https://github.com/cosmos/cosmjs) and other fantastic codebases like [Keplr Wallet](https://github.com/chainapsis/keplr-wallet) and [Osmosis Zone frontend](https://github.com/osmosis-labs/osmosis-frontend). It functions very well and any attack surface is very limited however. Any contributions, suggestions and ideas from the community are extremely welcome.

## ECO Stake 🌱

ECO Stake is a climate positive validator, but we care about the Cosmos ecosystem too. We built REStake to make it easy for all validators to run an autocompounder with Authz, and it's one of many projects we work on in the ecosystem. [Delegate with us](https://ecostake.com) to support more projects like this.
