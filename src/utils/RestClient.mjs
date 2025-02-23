import axios from "axios";
import axiosRetry from 'axios-retry';
import _ from "lodash";
import {
  assertIsDeliverTxSuccess
} from "@cosmjs/stargate";
import { sleep } from "@cosmjs/utils";

const RestClient = async (chainId, restUrls, opts) => {
  const config = _.merge({
    timeout: 5000,
    retries: 2,
    apiVersions: {}
  }, opts)
  const restUrl = await findAvailableUrl(restUrls, { timeout: 10000 })
  const client = axios.create({ baseURL: restUrl, timeout: config.timeout });
  axiosRetry(client, { retries: config.retries, shouldResetTimeout: true, retryCondition: () => true });

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
    return client
      .get(
        apiPath('staking', `validators?${searchParams.toString()}`), {
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

    return client
      .get(apiPath('staking', `validators/${validatorAddress}/delegations?${searchParams.toString()}`), opts)
      .then((res) => res.data);
  }

  function getBalance(address, denom, opts) {
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      if (nextKey)
        searchParams.append("pagination.key", nextKey);
      return client
        .get(apiPath('bank', `balances/${address}?${searchParams.toString()}`), opts)
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
    return client
      .get(apiPath('staking', `delegations/${address}`))
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
    return client
      .get(apiPath('distribution', `delegators/${address}/rewards`), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.rewards || [];
      });
  }

  function getCommission(validatorAddress, opts) {
    return client
      .get(apiPath('distribution', `validators/${validatorAddress}/commission`), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.commission?.commission || [];
      });
  }

  function getProposals(opts) {
    const { pageSize, nextKey, status, ...options } = opts || {};
    const searchParams = new URLSearchParams();
    searchParams.append("pagination.reverse", true);
    searchParams.append("pagination.limit", pageSize || 10);
    if (nextKey) searchParams.append("pagination.key", nextKey);
    if (status) searchParams.append("proposal_status", status);

    return client
      .get(apiPath('gov', `proposals?${searchParams.toString()}`), options)
      .then((res) => res.data);
  }

  function getProposal(proposalId, opts) {
    const { ...options } = opts || {};

    return client
      .get(apiPath('gov', `proposals/${proposalId}`), options)
      .then((res) => res.data.proposal);
  }

  function getProposalTally(proposal_id, opts) {
    return client
      .get(apiPath('gov', `proposals/${proposal_id}/tally`), opts)
      .then((res) => res.data);
  }

  function getProposalVote(proposal_id, address, opts) {
    return client
      .get(apiPath('gov', `proposals/${proposal_id}/votes/${address}`), opts)
      .then((res) => res.data);
  }

  function getGranteeGrants(grantee, opts, pageCallback) {
    const { pageSize } = opts || {};
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey)
        searchParams.append("pagination.key", nextKey);

      return client
        .get(apiPath('authz', `grants/grantee/${grantee}?${searchParams.toString()}`), opts)
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

      return client
        .get(apiPath('authz', `grants/granter/${granter}?${searchParams.toString()}`), opts)
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
    return client
      .get(apiPath('authz', `grants?${searchParams.toString()}`), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.grants;
      });
  }

  function getWithdrawAddress(address, opts) {
    return client
      .get(apiPath('distribution', `delegators/${address}/withdraw_address`))
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
    return client.get(apiPath('tx', `txs?${searchParams.toString()}`), {
      'axios-retry': { retries: retries ?? config.retries },
      ...opts
    }).then((res) => res.data);
  }

  function getTransaction(txHash, _opts) {
    const { retries, ...opts } = _opts;
    return client.get(apiPath('tx', `txs/${txHash}`), {
      'axios-retry': { retries: retries ?? config.retries },
      ...opts
    }).then((res) => res.data);
  }

  function getAccount(address) {
    return client
      .get(apiPath('auth', `accounts/${address}`))
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
    return client.post(apiPath('tx', `simulate`), params, { timeout: 30000 })
      .then((res) => res.data)
  }

  function broadcast(params){
    return client.post(apiPath('tx', `txs`), params, { timeout: 30000, 'axios-retry': { retries: 0 } })
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
        const response = await getTransaction(txId, { retries: 0 });
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
    let blockClient = client
    if(opts?.url){
      blockClient = axios.create({ baseURL: opts.url });
    }
    const path = opts?.path || apiPath('/base/tendermint', 'blocks/latest')
    try {
      return await blockClient.get(path, { timeout })
        .then((res) => res.data)
    } catch (error) {
      const fallback = '/blocks/latest'
      if (fallback !== path && error.response?.status === 501) {
        return getLatestBlock({ ...opts, path: fallback })
      }
      throw(error)
    }
  }

  function apiPath(type, path){
    const version = config.apiVersions[type] || 'v1beta1'
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
    getProposal,
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
