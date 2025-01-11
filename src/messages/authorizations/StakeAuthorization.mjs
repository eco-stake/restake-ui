import { StakeAuthorization as StakeAuthorizationType } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { MsgBase } from "../MsgBase.mjs";

export class StakeAuthorization extends MsgBase {
  typeUrl = "/cosmos.staking.v1beta1.StakeAuthorization"
  binaryConverter = StakeAuthorizationType

  toAmino () {
    return {
      type: "cosmos-sdk/StakeAuthorization",
      value: {
        Validators: {
          type: "cosmos-sdk/StakeAuthorization/AllowList",
          value: {
            allow_list: this.params.allowList
          }
        },
        max_tokens: this.params.maxTokens,
        authorization_type: this.params.authorizationType
      }
    }
  }
}
