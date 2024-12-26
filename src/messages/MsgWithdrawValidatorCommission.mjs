import {
  MsgWithdrawValidatorCommission as InjectiveMsgWithdrawValidatorCommission
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgWithdrawValidatorCommission extends MsgBase {
  typeUrl = "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission";

  toInjective(){
    return new InjectiveMsgWithdrawValidatorCommission({
      ...this.params
    })
  }
}
