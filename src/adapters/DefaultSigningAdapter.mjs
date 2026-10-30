import _ from 'lodash'
import { uint64, returnedAccountNumber, ExactBinaryWriter } from '../utils/Uint64.mjs';
import { fromBase64 } from '@cosmjs/encoding'
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys.js";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";
import { AuthInfo, Fee, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";

export default class DefaultSigningAdapter {
  constructor(network, signerProvider) {
    this.network = network;
    this.signerProvider = signerProvider;
  }

  async sign(account, messages, memo, fee){
    const { chainId } = this.network
    const { address } = account
    const accountNumber = uint64(account.account_number, 'account number')
    const sequence = uint64(account.sequence, 'sequence')
    messages = messages.map(m => m.forNetwork(this.network))
    let aminoMsgs
    try {
      aminoMsgs = messages.map(message => this.toAmino(message))
    } catch (e) { console.log(e) }
    if(aminoMsgs && this.signerProvider.signAminoSupport()){
      // Sign as amino if possible for Ledger and Keplr support
      const signDoc = { chain_id: chainId, account_number: accountNumber, sequence,
        msgs: aminoMsgs, fee, memo: memo || '' }
      const requested = _.cloneDeep(signDoc)
      const { signature, signed } = await this.signerProvider.signAmino(address, signDoc);
      this.assertAminoResponse(signed, requested)
      const authInfoBytes = await this.makeAuthInfoBytes(account, {
        amount: signed.fee.amount,
        gasLimit: signed.fee.gas,
        payer: signed.fee.payer,
        granter: signed.fee.granter,
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
      const txBodyBytes = this.makeBodyBytes(messages, memo)
      const signDoc = { bodyBytes: txBodyBytes, authInfoBytes, chainId, accountNumber: BigInt(accountNumber) }
      const requested = _.cloneDeep(signDoc)
      const { signature, signed } = await this.signerProvider.signDirect(address, signDoc);
      this.assertDirectResponse(signed, requested)
      return {
        bodyBytes: signed.bodyBytes,
        authInfoBytes: signed.authInfoBytes,
        signatures: [fromBase64(signature.signature)],
      }
    }else{
      throw new Error('Unable to sign message with this wallet/signer')
    }
  }

  assertAminoResponse(signed, requested) {
    if (signed.chain_id !== requested.chain_id ||
        uint64(signed.account_number, 'account number') !== requested.account_number ||
        uint64(signed.sequence, 'sequence') !== requested.sequence ||
        _.has(signed, 'timeout_height') !== _.has(requested, 'timeout_height') ||
        signed.timeout_height !== requested.timeout_height ||
        !_.isEqual(signed.msgs, requested.msgs)) {
      throw new Error('Wallet changed the signing identity or messages')
    }
  }

  assertDirectResponse(signed, requested) {
    const beforeAuth = AuthInfo.decode(requested.authInfoBytes)
    const afterAuth = AuthInfo.decode(signed.authInfoBytes)
    const beforeBody = TxBody.decode(requested.bodyBytes)
    const afterBody = TxBody.decode(signed.bodyBytes)
    if (signed.chainId !== requested.chainId ||
        returnedAccountNumber(signed.accountNumber) !== uint64(requested.accountNumber, 'account number') ||
        !_.isEqual(afterAuth.signerInfos, beforeAuth.signerInfos) ||
        !_.isEqual({ ...afterBody, memo: '' }, { ...beforeBody, memo: '' })) {
      throw new Error('Wallet changed the signing identity or messages')
    }
  }

  async simulate(account, messages, memo, fee) {
    messages = messages.map(m => m.forNetwork(this.network))
    return {
      bodyBytes: this.makeBodyBytes(messages, memo),
      authInfoBytes: await this.makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      }, SignMode.SIGN_MODE_UNSPECIFIED),
      signatures: [new Uint8Array()],
    }
  }

  toProto(message){
    return message.toProto()
  }

  toAmino(message){
    this.checkAminoSupport(message)
    let aminoMessage = message.toAmino()
    if(this.network.authzAminoLiftedValues){
      aminoMessage = this.liftAuthzAmino(aminoMessage)
    }
    return aminoMessage
  }

  checkAminoSupport(message){
    if(message.typeUrl.startsWith('/cosmos.authz')){
      if(!this.network.authzAminoSupport){
        throw new Error('This chain does not support amino conversion for Authz messages')
      }
      if(this.network.authzAminoGenericOnly && this.signerProvider.signDirectSupport()){
        throw new Error('This chain does not fully support amino conversion for Authz messages, using signDirect instead')
      }
    }
    if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec'){
      const execTypes = message.params.msgs.map(msg => msg.typeUrl)
      const preventedTypes = execTypes.filter(type => this.network.authzAminoExecPreventTypes.some(prevent => type.match(_.escapeRegExp(prevent))))
      if(preventedTypes.length > 0){
        throw new Error(`This chain does not support amino conversion for Authz Exec with message types: ${preventedTypes.join(', ')}`)
      }
    }else if(this.network.aminoPreventTypes.some(prevent => message.typeUrl.match(_.escapeRegExp(prevent)))){
      throw new Error(`This chain does not support amino conversion for message type: ${message.typeUrl}`)
    }
  }

  liftAuthzAmino(aminoMessage){
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
    return aminoMessage;
  }

  makeBodyBytes(messages, memo, timeoutHeight){
    const protoMsgs = messages.map(message => this.toProto(message));

    const txBody = {
      messages: protoMsgs,
      memo: memo,
    }

    if (timeoutHeight) {
      txBody.timeoutHeight = BigInt(uint64(timeoutHeight, 'timeout height'))
    }

    return TxBody.encode(
      TxBody.fromPartial(txBody), new ExactBinaryWriter()
    ).finish()
  }

  async makeAuthInfoBytes(account, fee, mode){
    const { sequence } = account
    const accountFromSigner = (await this.signerProvider.getAccounts())
      .find(signer => signer.address === account.address)
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
          sequence: BigInt(uint64(sequence, 'sequence')),
          modeInfo: { single: { mode: mode } },
        },
      ],
      fee: Fee.fromPartial({ ...fee, gasLimit: BigInt(uint64(fee.gasLimit, 'gas limit')) }),
    }, new ExactBinaryWriter()).finish()
  }

  pubkeyTypeUrl(pub_key){
    if(pub_key && pub_key['@type']) return pub_key['@type']

    if(this.network.ethermint){
      return '/ethermint.crypto.v1.ethsecp256k1.PubKey'
    }
    return '/cosmos.crypto.secp256k1.PubKey'
  }
}
