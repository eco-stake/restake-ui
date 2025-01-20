import _ from 'lodash'
import {
  createWeb3Extension,
  createTxRawEIP712,
  getEip712TypedData
} from '@injectivelabs/sdk-ts'
import {
  BigNumberInBase,
  DEFAULT_BLOCK_TIMEOUT_HEIGHT
} from '@injectivelabs/utils'
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";

import DefaultSigningAdapter from "./DefaultSigningAdapter.mjs";

export default class InjectiveSigningAdapter extends DefaultSigningAdapter {
  async sign(account, messages, memo, fee){
    if(!this.signerProvider.isLedger()){
      return super.sign(account, messages, memo, fee)
    }

    if(!this.signerProvider.signEIP712){
      throw new Error('Unable to sign message with this wallet/signer')
    }

    const { chainId } = this.network
    const ethereumChainId = 1
    const { account_number: accountNumber, sequence, address } = account

    const latestBlock = await this.network.restClient.getLatestBlock()
    const latestHeight = latestBlock.block.header.height
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(
      DEFAULT_BLOCK_TIMEOUT_HEIGHT,
    )

    const injMessages = messages.map((m) => m.toInjective())

    const eip712TypedData = getEip712TypedData({
      msgs: injMessages,
      fee,
      tx: {
        memo: memo,
        accountNumber: accountNumber.toString(),
        sequence: sequence.toString(),
        timeoutHeight: timeoutHeight.toFixed(),
        chainId,
      },
      ethereumChainId,
    })

    const { signature, signed } = await this.signerProvider.signEIP712(
      chainId,
      address,
      eip712TypedData,
      {
        chain_id: chainId,
        timeout_height: timeoutHeight.toFixed(),
        account_number: accountNumber.toString(),
        sequence: sequence.toString(),
        fee,
        msgs: injMessages.map((m) => m.toEip712()),
        memo: memo || '',
      }
    )

    const txRaw = {
      authInfoBytes: await this.makeAuthInfoBytes(account, {
        amount: signed.fee.amount,
        gasLimit: signed.fee.gas,
      }, SignMode.SIGN_MODE_LEGACY_AMINO_JSON),
      bodyBytes: this.makeBodyBytes(messages, signed.memo, timeoutHeight),
    }

    const web3Extension = createWeb3Extension({
      ethereumChainId,
    })
    const txRawEip712 = createTxRawEIP712(txRaw, web3Extension)

    const signatureBuff = Buffer.from(
      signature.signature,
      'base64',
    )
    txRawEip712.signatures = [signatureBuff]

    return txRawEip712
  }

  toProto(message){
    if(!this.signerProvider.isLedger()){
      return super.toProto(message)
    }

    const injMessage = message.toInjective()
    return {
      typeUrl: injMessage.toDirectSign().type,
      value: injMessage.toBinary()
    }
  }

  pubkeyTypeUrl(pub_key){
    if(pub_key && pub_key['@type']) return pub_key['@type']

    return '/injective.crypto.v1beta1.ethsecp256k1.PubKey'
  }
}
