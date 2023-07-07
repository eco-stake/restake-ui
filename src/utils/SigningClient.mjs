import _ from 'lodash'
import axios from 'axios'
import { multiply, ceil, bignumber } from 'mathjs'

import {
  assertIsDeliverTxSuccess,
  GasPrice,
} from "@cosmjs/stargate";
import { sleep } from "@cosmjs/utils";
import { toBase64 } from '@cosmjs/encoding'
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";

import { coin } from './Helpers.mjs'
import DefaultSigningAdapter from '../adapters/DefaultSigningAdapter.mjs';
import TerraSigningAdapter from '../adapters/TerraSigningAdapter.mjs';

const adapters = {
  terra: TerraSigningAdapter
}

function SigningClient(network, signerProvider) {
  const adapter = new (adapters[network.path] || DefaultSigningAdapter)(network, signerProvider)
  const {
    restUrl,
    gasPrice: defaultGasPrice,
    gasModifier: defaultGasModifier,
  } = network

  function getAccount(address) {
    return axios
      .get(restUrl + "/cosmos/auth/v1beta1/accounts/" + address)
      .then((res) => res.data.account)
      .then((value) => {
        if(!value) throw new Error('Failed to fetch account, please try again')

        // see https://github.com/chainapsis/keplr-wallet/blob/7ca025d32db7873b7a870e69a4a42b525e379132/packages/cosmos/src/account/index.ts#L73
        // If the chain modifies the account type, handle the case where the account type embeds the base account.
        // (Actually, the only existent case is ethermint, and this is the line for handling ethermint)
        const baseAccount =
          value.BaseAccount || value.baseAccount || value.base_account;
        if (baseAccount) {
          value = baseAccount;
        }

        // If the account is the vesting account that embeds the base vesting account,
        // the actual base account exists under the base vesting account.
        // But, this can be different according to the version of cosmos-sdk.
        // So, anyway, try to parse it by some ways...
        const baseVestingAccount =
          value.BaseVestingAccount ||
          value.baseVestingAccount ||
          value.base_vesting_account;
        if (baseVestingAccount) {
          value = baseVestingAccount;

          const baseAccount =
            value.BaseAccount || value.baseAccount || value.base_account;
          if (baseAccount) {
            value = baseAccount;
          }
        }

        // Handle nested account like Desmos
        const nestedAccount = value.account
        if(nestedAccount){
          value = nestedAccount
        }

        return value
      })
      .catch((error) => {
        if(error.response?.status === 404){
          throw new Error('Account does not exist on chain')
        }else{
          throw error
        }
      })
  };

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
    if (!gas)
      gas = await simulate(address, messages, memo);
    const fee = getFee(gas, gasPrice);
    const txBody = await sign(address, messages, memo, fee)
    return broadcast(txBody)
  }

  async function sign(address, messages, memo, fee){
    const account = await getAccount(address)
    return adapter.sign(account, messages, memo, fee)
  }

  async function simulate(address, messages, memo, modifier) {
    const account = await getAccount(address)
    const fee = getFee(100_000)
    const txBody = await adapter.simulate(account, messages, memo, fee)
    try {
      const estimate = await axios.post(restUrl + '/cosmos/tx/v1beta1/simulate', {
        tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      }).then(el => el.data.gas_info.gas_used)
      return (parseInt(estimate * (modifier || defaultGasModifier)));
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  async function broadcast(txBody){
    const timeoutMs = network.txTimeout || 60_000
    const pollIntervalMs = 3_000
    let timedOut = false
    const txPollTimeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    const pollForTx = async (txId) => {
      if (timedOut) {
        throw new Error(
          `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${timeoutMs / 1000} seconds.`
        );
      }
      await sleep(pollIntervalMs);
      try {
        const response = await axios.get(restUrl + '/cosmos/tx/v1beta1/txs/' + txId);
        const result = parseTxResult(response.data.tx_response)
        return result
      } catch {
        return pollForTx(txId);
      }
    };

    const response = await axios.post(restUrl + '/cosmos/tx/v1beta1/txs', {
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      mode: "BROADCAST_MODE_SYNC"
    })
    const result = parseTxResult(response.data.tx_response)
    assertIsDeliverTxSuccess(result)
    return pollForTx(result.transactionHash).then(
      (value) => {
        clearTimeout(txPollTimeout);
        assertIsDeliverTxSuccess(value)
        return value
      },
      (error) => {
        clearTimeout(txPollTimeout);
        return error
      },
    )
  }

  function parseTxResult(result){
    return {
      code: result.code,
      height: result.height,
      rawLog: result.raw_log,
      transactionHash: result.txhash,
      gasUsed: result.gas_used,
      gasWanted: result.gas_wanted,
    }
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
