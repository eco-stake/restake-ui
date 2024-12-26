import {
  MsgVote as InjectiveMsgVote
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgVote extends MsgBase {
  typeUrl = "/cosmos.gov.v1beta1.MsgVote";

  toInjective(){
    return new InjectiveMsgVote({
      ...this.params,
      vote: this.params.option
    })
  }
}
