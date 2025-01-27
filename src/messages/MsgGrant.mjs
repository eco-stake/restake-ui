import moment from "moment";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import { MsgBase } from "./MsgBase.mjs";

import { mapValuesToProperValueType, objectKeysToEip712Types } from "@injectivelabs/sdk-ts";

export class MsgGrant extends MsgBase {
  typeUrl = "/cosmos.authz.v1beta1.MsgGrant";

  toBinary () {
    const protoType = MsgBase.binaryConverters.get(this.typeUrl)
    return protoType.encode(protoType.fromPartial({
      ...this.params,
      grant: {
        authorization: this.params.grant.authorization.toProto(),
        expiration: {
          seconds: this.params.grant.expiration,
          nanos: 0
        }
      }
    })).finish()
  }

  toAmino () {
    return {
      type: "cosmos-sdk/MsgGrant",
      value: {
        granter: this.params.granter,
        grantee: this.params.grantee,
        grant: {
          authorization: this.params.grant.authorization.toAmino(),
          expiration: moment(Number(this.params.grant.expiration) * 1000).utc().format()
        }
      }
    }
  }

  toInjective () {
    // Injective MsgGrant throws an InvalidCharacterError currently.
    // For now we will implement the toEip712 methods on this class as the Amino
    // parameter order matches so we can avoid an Injective class right now.
    return this
  }

  toDirectSign(){
    return {
      type: this.typeUrl,
      message: this.params,
    }
  }

  toEip712Types(){
    const amino = this.toAmino()

    return objectKeysToEip712Types({
      object: amino.value,
      messageType: amino.type,
    })
  }

  toEip712(){
    const amino = this.toAmino()
    const { type, value } = amino

    return {
      type,
      value: mapValuesToProperValueType(value, type)
    }
  }
}
