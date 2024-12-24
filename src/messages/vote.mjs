import Message from "./message.mjs";

export default class NewVote extends Message {
  typeUrl = "/cosmos.gov.v1beta1.MsgVote";

  toAmino () {
    return {
      type: "cosmos-sdk/MsgVote",
      value: {
        proposal_id: this.params.proposalId,
        voter: this.params.voter,
        option: this.params.option
      }
    }
  }
}
