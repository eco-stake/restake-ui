import axios from "axios";
import axiosRetry from 'axios-retry';
import _ from "lodash";
import {
  assertIsDeliverTxSuccess
} from "@cosmjs/stargate";
import { sleep } from "@cosmjs/utils";

const RestClient = async (chainId, restUrls, opts) => {
  const config = _.merge({
    connectTimeout: 10000,
  }, opts)
  const restUrl = await findAvailableUrl(restUrls, { timeout: config.connectTimeout })

  function getAllValidators(pageSize, opts, pageCallback) {
    return getAllPages((nextKey) => {
      return getValidators(pageSize, opts, nextKey);
    }, pageCallback).then((pages) => {
      const validators = _.shuffle(pages.map((el) => el.validators).flat());
      return validators.reduce(
        (a, v) => ({ ...a, [v.operator_address]: v }),
        {}
      );
    });
  }

  function getValidators(pageSize, opts, nextKey) {
    opts = opts || {};
    const searchParams = new URLSearchParams();
    if (opts.status)
      searchParams.append("status", opts.status);
    if (pageSize)
      searchParams.append("pagination.limit", pageSize);
    if (nextKey)
      searchParams.append("pagination.key", nextKey);
    return axios
      .get(
        apiUrl('staking', `validators?${searchParams.toString()}`), {
        timeout: opts.timeout || 10000,
      })
      .then((res) => res.data);
  }

  function getAllValidatorDelegations(validatorAddress,
    pageSize,
    opts,
    pageCallback) {
    return getAllPages((nextKey) => {
      return getValidatorDelegations(validatorAddress, pageSize, opts, nextKey);
    }, pageCallback).then((pages) => {
      return pages.map((el) => el.delegation_responses).flat();
    });
  }

  function getValidatorDelegations(validatorAddress, pageSize, opts, nextKey) {
    const searchParams = new URLSearchParams();
    if (pageSize)
      searchParams.append("pagination.limit", pageSize);
    if (nextKey)
      searchParams.append("pagination.key", nextKey);

    return axios
      .get(apiUrl('staking', `validators/${validatorAddress}/delegations?${searchParams.toString()}`), opts)
      .then((res) => res.data);
  }

  function getBalance(address, denom, opts) {
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      if (nextKey)
        searchParams.append("pagination.key", nextKey);
      return axios
        .get(apiUrl('bank', `balances/${address}?${searchParams.toString()}`), opts)
        .then((res) => res.data)
    }).then((pages) => {
      const result = pages.map((el) => el.balances).flat()
      if (!denom)
        return result

      const balance = result.find(
        (element) => element?.denom === denom
      ) || { denom: denom, amount: 0 };
      return balance;
    });
  }

  function getDelegations(address) {
    return axios
      .get(apiUrl('staking', `delegations/${address}`))
      .then((res) => res.data)
      .then((result) => {
        const delegations = result.delegation_responses.reduce(
          (a, v) => ({ ...a, [v.delegation.validator_address]: v }),
          {}
        );
        return delegations;
      });
  }

  function getRewards(address, opts) {
    return axios
      .get(apiUrl('distribution', `delegators/${address}/rewards`), opts)
      .then((res) => res.data)
      .then((result) => {
        const rewards = result.rewards.reduce(
          (a, v) => ({ ...a, [v.validator_address]: v }),
          {}
        );
        return rewards;
      });
  }

  function getCommission(validatorAddress, opts) {
    return axios
      .get(apiUrl('distribution', `validators/${validatorAddress}/commission`), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.commission;
      });
  }

  function getProposals(opts) {
    const { pageSize } = opts || {};
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey)
        searchParams.append("pagination.key", nextKey);

      return axios
        .get(apiUrl('gov', `proposals?${searchParams.toString()}`), opts)
        .then((res) => res.data);
    }).then((pages) => {
      return pages.map(el => el.proposals).flat();
    });
  }

  function getProposalTally(proposal_id, opts) {
    return axios
      .get(apiUrl('gov', `proposals/${proposal_id}/tally`), opts)
      .then((res) => res.data);
  }

  function getProposalVote(proposal_id, address, opts) {
    return axios
      .get(apiUrl('gov', `proposals/${proposal_id}/votes/${address}`), opts)
      .then((res) => res.data);
  }

  function getGranteeGrants(grantee, opts, pageCallback) {
    const { pageSize } = opts || {};
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey)
        searchParams.append("pagination.key", nextKey);

      return axios
        .get(apiUrl('authz', `grants/grantee/${grantee}?${searchParams.toString()}`), opts)
        .then((res) => res.data);
    }, pageCallback).then((pages) => {
      return pages.map(el => el.grants).flat();
    });
  }

  function getGranterGrants(granter, opts, pageCallback) {
    const { pageSize } = opts || {};
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey)
        searchParams.append("pagination.key", nextKey);

      return axios
        .get(apiUrl('authz', `grants/granter/${granter}?${searchParams.toString()}`), opts)
        .then((res) => res.data);
    }, pageCallback).then((pages) => {
      return pages.map(el => el.grants).flat();
    });
  }

  function getGrants(grantee, granter, opts) {
    const searchParams = new URLSearchParams();
    if (grantee)
      searchParams.append("grantee", grantee);
    if (granter)
      searchParams.append("granter", granter);
    return axios
      .get(apiUrl('authz', `grants?${searchParams.toString()}`), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.grants;
      });
  }

  function getWithdrawAddress(address, opts) {
    return axios
      .get(apiUrl('distribution', `delegators/${address}/withdraw_address`))
      .then((res) => res.data)
      .then((result) => {
        return result.withdraw_address;
      });
  }

  function getTransactions(params, _opts) {
    const { pageSize, order, retries, ...opts } = _opts;
    const searchParams = new URLSearchParams();
    params.forEach(({ key, value }) => {
      searchParams.append(key, value);
    });
    if (pageSize) {
      searchParams.append('pagination.limit', pageSize);
      searchParams.append('limit', pageSize);
    }
    if (order)
      searchParams.append('order_by', order);
    const client = axios.create({ baseURL: restUrl });
    axiosRetry(client, { retries: retries || 0, shouldResetTimeout: true, retryCondition: (e) => true });
    return client.get(apiPath('tx', `txs?${searchParams.toString()}`), opts).then((res) => res.data);
  }

  function getTransaction(txHash) {
    return axios.get(apiUrl('tx', `txs/${txHash}`)).then((res) => res.data);
  }

  function getAccount(address) {
    return axios
      .get(apiUrl('auth', `accounts/${address}`))
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

  function simulate(params){
    return axios.post(apiUrl('tx', `simulate`), params)
      .then((res) => res.data)
  }

  function broadcast(params){
    return axios.post(apiUrl('tx', `txs`), params)
      .then((res) => parseTxResult(res.data.tx_response))
  }

  async function broadcastAndWait(params, timeout, pollInterval){
    const timeoutMs = timeout || 60_000
    const pollIntervalMs = pollInterval || 3_000
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
        const response = await getTransaction(txId);
        const result = parseTxResult(response.tx_response)
        return result
      } catch {
        return pollForTx(txId);
      }
    };

    const result = await broadcast(params)
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

  async function getAllPages(getPage, pageCallback) {
    let pages = [];
    let nextKey, error;
    do {
      const result = await getPage(nextKey);
      pages.push(result);
      nextKey = result.pagination?.next_key;
      if (pageCallback)
        await pageCallback(pages);
    } while (nextKey);
    return pages;
  }

  async function findAvailableUrl(urls, opts) {
    if(!urls) return

    if (!Array.isArray(urls)) {
      if (urls.match('cosmos.directory')) {
        return urls // cosmos.directory health checks already
      } else {
        urls = [urls]
      }
    }
    return Promise.any(urls.map(async (url) => {
      url = url.replace(/\/$/, '')
      try {
        let data = await getLatestBlock({ ...opts, url: url })
        if (data.block?.header?.chain_id === chainId) {
          return url;
        }
      } catch { }
    }));
  }

  async function getLatestBlock(opts){
    const { timeout } = opts || {}
    const url = opts?.url || restUrl
    const path = opts?.path || apiPath('/base/tendermint', 'blocks/latest')
    try {
      return await axios.get(url + path, { timeout })
        .then((res) => res.data)
    } catch (error) {
      const fallback = '/blocks/latest'
      if (fallback !== path && error.response?.status === 501) {
        return getLatestBlock({ ...opts, path: fallback })
      }
      throw(error)
    }
  }

  function apiUrl(type, path){
    return restUrl + apiPath(type, path)
  }

  function apiPath(type, path){
    const versions = config.apiVersions || {}
    const version = versions[type] || 'v1beta1'
    return `/cosmos/${type}/${version}/${path}`
  }

  return {
    connected: !!restUrl,
    restUrl,
    getAllValidators,
    getValidators,
    getAllValidatorDelegations,
    getValidatorDelegations,
    getBalance,
    getDelegations,
    getRewards,
    getCommission,
    getProposals,
    getProposalTally,
    getProposalVote,
    getGrants,
    getGranteeGrants,
    getGranterGrants,
    getWithdrawAddress,
    getTransactions,
    getTransaction,
    getLatestBlock,
    getAccount,
    simulate,
    broadcast,
    broadcastAndWait
  };
};

export default RestClient;
