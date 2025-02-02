import {
  MsgAuthzExec as InjectiveMsgExec
} from '@injectivelabs/sdk-ts'

import { MsgBase } from "./MsgBase.mjs";

export class MsgExec extends MsgBase {
  typeUrl = "/cosmos.authz.v1beta1.MsgExec";

  toBinary() {
    const protoType = MsgBase.binaryConverters.get(this.typeUrl)
    return protoType.encode(protoType.fromPartial({
      ...this.params,
      msgs: this.params.msgs.map(msg => msg.toProto())
    })).finish()
  }

  toAmino () {
    return {
      type: "cosmos-sdk/MsgExec",
      value: {
        grantee: this.params.grantee,
        msgs: this.params.msgs.map(msg => msg.toAmino())
      }
    }
  }

  toInjective(){
    return new InjectiveMsgExec({
      ...this.params,
      msgs: this.params.msgs.map(msg => msg.toInjective())
    })
  }
}
