import {
  defaultRegistryTypes,
  createDefaultAminoConverters
} from "@cosmjs/stargate";
import { mapValuesToProperValueType, objectKeysToEip712Types } from "@injectivelabs/sdk-ts";

export default class Message {
  typeUrl = null;
  protoConverters = new Map(defaultRegistryTypes);
  aminoConverters = new Map(Object.entries(createDefaultAminoConverters()));

  constructor (params) {
    this.params = params
  }

  toProto () {
    return this.params
  }

  toProtoEncoded() {
    return {
      typeUrl: this.typeUrl,
      value: this.toBinary()
    }
  }

  toBinary() {
    const protoType = this.protoConverters.get(this.typeUrl)
    return protoType.encode(this.toProto()).finish()
  }

  toAmino () {
    const aminoType = this.aminoConverters.get(this.typeUrl)
    return {
      type: aminoType.aminoType,
      value: aminoType.toAmino(this.params)
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
