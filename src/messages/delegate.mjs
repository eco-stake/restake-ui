import Message from "./message.mjs";

export default class Delegate extends Message {
  typeUrl = "/cosmos.staking.v1beta1.MsgDelegate";
}
