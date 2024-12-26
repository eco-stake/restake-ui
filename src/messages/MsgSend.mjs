import {
  MsgSend as InjectiveMsgSend
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgSend extends MsgBase {
  typeUrl = "/cosmos.bank.v1beta1.MsgSend";

  toInjective(){
    return new InjectiveMsgSend({
      ...this.params,
      srcInjectiveAddress: this.params.fromAddress,
      dstInjectiveAddress: this.params.toAddress,
    })
  }
}
