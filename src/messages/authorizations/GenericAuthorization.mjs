import { GenericAuthorization as GenericAuthorizationType } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgBase } from "../MsgBase.mjs";

export class GenericAuthorization extends MsgBase {
  typeUrl = "/cosmos.authz.v1beta1.GenericAuthorization"
  binaryConverter = GenericAuthorizationType

  toAmino () {
    return {
      type: "cosmos-sdk/GenericAuthorization",
      value: this.params
    }
  }
}
