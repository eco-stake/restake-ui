import _ from 'lodash'
import Long from "long";

import {
  defaultRegistryTypes as defaultStargateTypes,
  AminoTypes,
  createBankAminoConverters,
  createDistributionAminoConverters,
  createFreegrantAminoConverters,
  createGovAminoConverters,
  createIbcAminoConverters,
  createStakingAminoConverters,
} from "@cosmjs/stargate";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import { makeSignDoc as makeAminoSignDoc } from "@cosmjs/amino";
import { fromBase64 } from '@cosmjs/encoding'
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys.js";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";
import { AuthInfo, Fee, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";

import { createAuthzAminoConverters, createAuthzExecAminoConverters } from '../converters/Authz.mjs'

export default class DefaultSigningAdapter {
  constructor(network, signerProvider) {
    this.network = network;
    this.signerProvider = signerProvider;

    this.registry = new Registry(defaultStargateTypes);
    const defaultConverters = {
      ...createAuthzAminoConverters(),
      ...createBankAminoConverters(),
      ...createDistributionAminoConverters(),
      ...createGovAminoConverters(),
      ...createStakingAminoConverters(this.network.prefix),
      ...createIbcAminoConverters(),
      ...createFreegrantAminoConverters(),
    }
    let aminoTypes = new AminoTypes(defaultConverters)
    this.aminoTypes = new AminoTypes({...defaultConverters, ...createAuthzExecAminoConverters(this.registry, aminoTypes)})
  }

  async sign(account, messages, memo, fee){
    const { chainId } = this.network
    const { account_number: accountNumber, sequence, address } = account
    const txBodyBytes = this.makeBodyBytes(messages, memo)
    let aminoMsgs
    try {
      aminoMsgs = this.convertToAmino(messages)
    } catch (e) { console.log(e) }
    if(aminoMsgs && this.signerProvider.signAminoSupport()){
      // Sign as amino if possible for Ledger and Keplr support
      const signDoc = makeAminoSignDoc(aminoMsgs, fee, chainId, memo, accountNumber, sequence);
      const { signature, signed } = await this.signerProvider.signAmino(address, signDoc);
      const authInfoBytes = await this.makeAuthInfoBytes(account, {
        amount: signed.fee.amount,
        gasLimit: signed.fee.gas,
      }, SignMode.SIGN_MODE_LEGACY_AMINO_JSON)
      return {
        bodyBytes: this.makeBodyBytes(messages, signed.memo),
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(signature.signature, "base64")],
      }
    }else if(this.signerProvider.signDirectSupport()){
      // Sign using standard protobuf messages
      const authInfoBytes = await this.makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      }, SignMode.SIGN_MODE_DIRECT)
      const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
      const { signature, signed } = await this.signerProvider.signDirect(address, signDoc);
      return {
        bodyBytes: signed.bodyBytes,
        authInfoBytes: signed.authInfoBytes,
        signatures: [fromBase64(signature.signature)],
      }
    }else{
      throw new Error('Unable to sign message with this wallet/signer')
    }
  }

  async simulate(account, messages, memo, fee) {
    return {
      bodyBytes: this.makeBodyBytes(messages, memo),
      authInfoBytes: await this.makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      }, SignMode.SIGN_MODE_UNSPECIFIED),
      signatures: [new Uint8Array()],
    }
  }

  convertToAmino(messages){
    return messages.map(message => {
      if(message.typeUrl.startsWith('/cosmos.authz')){
        if(!this.network.authzAminoSupport){
          throw new Error('This chain does not support amino conversion for Authz messages')
        }
        if(this.network.authzAminoGenericOnly && this.signerProvider.signDirectSupport()){
          throw new Error('This chain does not fully support amino conversion for Authz messages, using signDirect instead')
        }
      }
      if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec'){
        const execTypes = message.value.msgs.map(msg => msg.typeUrl)
        const preventedTypes = execTypes.filter(type => this.network.authzAminoExecPreventTypes.some(prevent => type.match(_.escapeRegExp(prevent))))
        if(preventedTypes.length > 0){
          throw new Error(`This chain does not support amino conversion for Authz Exec with types: ${preventedTypes.join(', ')}`)
        }
      }
      let aminoMessage = this.aminoTypes.toAmino(message)
      if(this.network.authzAminoLiftedValues){
        switch (aminoMessage.type) {
          case 'cosmos-sdk/MsgGrant':
            aminoMessage = aminoMessage.value
            aminoMessage.grant.authorization = aminoMessage.grant.authorization.value
            break;
          case 'cosmos-sdk/MsgRevoke':
            aminoMessage = aminoMessage.value
            break;
          case 'cosmos-sdk/MsgExec':
            throw new Error('This chain does not support amino conversion for MsgExec')
        }
      }
      return aminoMessage
    })
  }

  makeBodyBytes(messages, memo){
    const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m));
    return TxBody.encode(
      TxBody.fromPartial({
        messages: anyMsgs,
        memo: memo,
      })
    ).finish()
  }

  async makeAuthInfoBytes(account, fee, mode){
    const { sequence } = account
    const accountFromSigner = (await this.signerProvider.getAccounts())[0]
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const signerPubkey = accountFromSigner.pubkey;
    return AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            typeUrl: this.pubkeyTypeUrl(account.pub_key),
            value: PubKey.encode({
              key: signerPubkey,
            }).finish(),
          },
          sequence: Long.fromNumber(sequence, true),
          modeInfo: { single: { mode: mode } },
        },
      ],
      fee: Fee.fromPartial(fee),
    }).finish()
  }

  pubkeyTypeUrl(pub_key){
    if(pub_key && pub_key['@type']) return pub_key['@type']

    if(this.network.path === 'injective'){
      return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
    }

    if(this.network.slip44 === 60){
      return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
    }
    return '/cosmos.crypto.secp256k1.PubKey'
  }
}
