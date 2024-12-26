import {
  MsgBeginRedelegate as InjectiveMsgBeginRedelegate
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgBeginRedelegate extends MsgBase {
  typeUrl = "/cosmos.staking.v1beta1.MsgBeginRedelegate";

  toInjective(){
    return new InjectiveMsgBeginRedelegate({
      ...this.params,
      injectiveAddress: this.params.delegatorAddress,
      srcValidatorAddress: this.params.validatorSrcAddress,
      dstValidatorAddress: this.params.validatorDstAddress
    })
  }
}
