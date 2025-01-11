import _ from 'lodash'
import { multiply, ceil, bignumber } from 'mathjs'

import {
  GasPrice,
} from "@cosmjs/stargate";
import { toBase64 } from '@cosmjs/encoding'
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";

import { coin } from './Helpers.mjs'
import DefaultSigningAdapter from '../adapters/DefaultSigningAdapter.mjs';
import TerraSigningAdapter from '../adapters/TerraSigningAdapter.mjs';
import InjectiveSigningAdapter from '../adapters/InjectiveSigningAdapter.mjs';

const adapters = {
  terra: TerraSigningAdapter,
  injective: InjectiveSigningAdapter
}

function SigningClient(network, signerProvider) {
  const adapter = new (adapters[network.path] || DefaultSigningAdapter)(network, signerProvider)
  const {
    restClient,
    gasPrice: defaultGasPrice,
    gasModifier: defaultGasModifier,
  } = network

  // vendored to handle large integers
  // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
  function calculateFee(gasLimit, gasPrice) {
    const processedGasPrice = typeof gasPrice === "string" ? GasPrice.fromString(gasPrice) : gasPrice;
    const { denom, amount: gasPriceAmount } = processedGasPrice;
    const amount = ceil(bignumber(multiply(bignumber(gasPriceAmount.toString()), bignumber(gasLimit.toString()))));
    return {
      amount: [coin(amount, denom)],
      gas: gasLimit.toString()
    };
  }

  function getFee(gas, gasPrice) {
    if (!gas)
      gas = 200000;
    return calculateFee(gas, gasPrice || defaultGasPrice);
  }

  async function signAndBroadcastWithoutBalanceCheck(address, msgs, gas, memo, gasPrice) {
    const defaultOptions = _.cloneDeep(signerProvider.getOptions())
    signerProvider.setOptions({ sign: { disableBalanceCheck: true } })
    try {
      return await signAndBroadcast(address, msgs, gas, memo, gasPrice)
    } finally {
      signerProvider.setOptions(defaultOptions)
    }
  }

  async function signAndBroadcast(address, messages, gas, memo, gasPrice) {
    messages = Array.isArray(messages) ? messages : [messages]
    console.log(messages)
    gas = gas || await simulate(address, messages, memo);
    const fee = getFee(gas, gasPrice);
    const txBody = await sign(address, messages, memo, fee)
    return broadcast(txBody)
  }

  async function sign(address, messages, memo, fee){
    const account = await restClient.getAccount(address)
    return adapter.sign(account, messages, memo, fee)
  }

  async function simulate(address, messages, memo, modifier) {
    messages = Array.isArray(messages) ? messages : [messages]
    const account = await restClient.getAccount(address)
    const fee = getFee(100_000)
    const txBody = await adapter.simulate(account, messages, memo, fee)
    try {
      const estimate = await restClient.simulate({
        tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      }).then(el => el.gas_info.gas_used)
      return (parseInt(estimate * (modifier || defaultGasModifier)));
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  async function broadcast(txBody){
    return await restClient.broadcastAndWait({
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      mode: "BROADCAST_MODE_SYNC"
    }, network.txTimeout)
  }

  return {
    signerProvider,
    registry: adapter.registry,
    getFee,
    simulate,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  };
}

export default SigningClient;
