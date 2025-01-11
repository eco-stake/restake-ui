import {
  MsgRevoke as InjectiveMsgRevoke
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgRevoke extends MsgBase {
  typeUrl = "/cosmos.authz.v1beta1.MsgRevoke";

  toAmino () {
    return {
      type: "cosmos-sdk/MsgRevoke",
      value: {
        granter: this.params.granter,
        grantee: this.params.grantee,
        msg_type_url: this.params.msgTypeUrl
      }
    }
  }

  toInjective(){
    return new InjectiveMsgRevoke({
      ...this.params,
      messageType: this.params.msgTypeUrl
    })
  }
}
