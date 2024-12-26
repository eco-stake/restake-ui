import {
  MsgDelegate as InjectiveMsgDelegate
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgDelegate extends MsgBase {
  typeUrl = "/cosmos.staking.v1beta1.MsgDelegate";

  toInjective(){
    return new InjectiveMsgDelegate({
      ...this.params,
      injectiveAddress: this.params.delegatorAddress
    })
  }
}
