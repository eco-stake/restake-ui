import {
  MsgVote as InjectiveMsgVote
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";
import { AtomoneMsgVote } from './atomone/MsgVote.mjs';

export class MsgVote extends MsgBase {
  typeUrl = "/cosmos.gov.v1beta1.MsgVote";

  forInjectiveLedger(){
    return new InjectiveMsgVote({
      ...this.params,
      vote: this.params.option
    })
  }

  forAtomone(){
    return new AtomoneMsgVote({
      ...this.params
    })
  }
}
