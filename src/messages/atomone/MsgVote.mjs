import { MsgBase } from "../MsgBase.mjs";
import { MsgVote } from "@atomone/atomone-types/atomone/gov/v1/tx"

export class AtomoneMsgVote extends MsgBase {
  typeUrl = "/atomone.gov.v1.MsgVote";
  binaryConverter = MsgVote;
  aminoConverter = MsgVote;

  toAmino () {
    const aminoType = this.aminoType()
    return aminoType.toAminoMsg(this.params)
  }
}
