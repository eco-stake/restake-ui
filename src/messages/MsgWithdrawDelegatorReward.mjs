import {
  MsgWithdrawDelegatorReward as InjectiveMsgWithdrawDelegatorReward
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgWithdrawDelegatorReward extends MsgBase {
  typeUrl = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";

  toInjective(){
    return new InjectiveMsgWithdrawDelegatorReward({
      ...this.params
    })
  }
}
