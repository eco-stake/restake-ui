import {
  MsgUndelegate as InjectiveMsgUndelegate
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgUndelegate extends MsgBase {
  typeUrl = "/cosmos.staking.v1beta1.MsgUndelegate";

  toInjective(){
    return new InjectiveMsgUndelegate({
      ...this.params,
      injectiveAddress: this.params.delegatorAddress
    })
  }
}
