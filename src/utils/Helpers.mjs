import _ from 'lodash'
import { format, floor, bignumber } from 'mathjs'
import { coin as _coin } from  '@cosmjs/stargate'
import truncateMiddle from 'truncate-middle'

export function timeStamp(...args) {
  console.log('[' + new Date().toISOString().substring(11, 23) + ']', ...args);
}

export function coin(amount, denom){
  return _coin(format(floor(amount), {notation: 'fixed'}), denom)
}

export function joinString(...args){
  return _.compact(args).join(' ')
}

export function truncateAddress(address) {
  const firstDigit = address.search(/\d/)
  return truncateMiddle(address, firstDigit + 6, 6, '…')
}

export function rewardAmount(rewards, denom, type){
  if (!rewards)
    return 0;
  type = type || 'reward'
  const reward = rewards && rewards[type]?.find((el) => el.denom === denom);
  return reward ? bignumber(reward.amount) : 0;
}

export function overrideNetworks(networks, overrides){
  networks = networks.reduce((a, v) => ({ ...a, [v.name]: v }), {})
  const names = [...Object.keys(networks), ...Object.keys(overrides)]
  return _.uniq(names).sort().map(name => {
    let network = networks[name]
    let override = overrides[name]
    if(!network || !network.name) network = { name, ...network }
    if(!override) return network
    override.overriden = true
    return _.mergeWith(network, override, (a, b) =>
      _.isArray(b) ? b : undefined
    );
  })
}

export function buildExecMessage(grantee, messages) {
  return {
    typeUrl: "/cosmos.authz.v1beta1.MsgExec",
    value: {
      grantee: grantee,
      msgs: messages
    }
  }
}

export function buildExecableMessage(type, typeUrl, value, shouldExec){
  if (shouldExec) {
    return {
      typeUrl: typeUrl,
      value: type.encode(type.fromPartial(value)).finish()
    }
  } else {
    return {
      typeUrl: typeUrl,
      value: value
    }
  }
}

export function parseGrants(grants, grantee, granter) {
  // claimGrant is removed but we track for now to allow revoke
  const claimGrant = grants.find((el) => {
    if (
      (!el.grantee || el.grantee === grantee) &&
      (!el.granter || el.granter === granter) &&
      (el.authorization["@type"] ===
      "/cosmos.authz.v1beta1.GenericAuthorization" &&
      el.authorization.msg ===
      "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward")
    ) {
      return Date.parse(el.expiration) > new Date();
    } else {
      return false;
    }
  });
  const stakeGrant = grants.find((el) => {
    if (
      (!el.grantee || el.grantee === grantee) &&
      (!el.granter || el.granter === granter) &&
      (el.authorization["@type"] ===
      "/cosmos.staking.v1beta1.StakeAuthorization" || (
        // Handle GenericAuthorization for Ledger
        el.authorization["@type"] ===
        "/cosmos.authz.v1beta1.GenericAuthorization" &&
        el.authorization.msg ===
        "/cosmos.staking.v1beta1.MsgDelegate"
      ))
    ) {
      return Date.parse(el.expiration) > new Date();
    } else {
      return false;
    }
  })
  return {
    claimGrant,
    stakeGrant,
  };
}

export function mapAsync(array, callbackfn) {
  return Promise.all(array.map(callbackfn));
}

export function findAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(findMap => {
    return array.find((value, index) => findMap[index]);
  });
}

export function filterAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(filterMap => {
    return array.filter((value, index) => filterMap[index]);
  });
}

export async function mapSync(calls, count, batchCallback) {
  const batchCalls = _.chunk(calls, count);
  let results = []
  let index = 0
  for (const batchCall of batchCalls) {
    const batchResults = await mapAsync(batchCall, call => call())
    results.push(batchResults)
    if (batchCallback) await batchCallback(batchResults, index)
    index++
  }
  return results.flat()
}

export async function executeSync(calls, count) {
  const batchCalls = _.chunk(calls, count);
  for (const batchCall of batchCalls) {
    await mapAsync(batchCall, call => call())
  }
}

export function authzSupportMessage(wallet){
  if(wallet.authzSupport()) return null;

  if (wallet.signerProvider.isLedger()){
    return `${wallet.signerProvider.label} can't send Authz transactions with Ledger on ${wallet.network.prettyName} just yet.`
  }else{
    return `${wallet.signerProvider.label} can't send Authz transactions on ${wallet.network.prettyName} just yet.`
  }
}

export function omit(o, ...paths){
  return Object.fromEntries(Object.entries(o).filter(([k]) => !paths.includes(k)))
}
