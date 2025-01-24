import {
  defaultRegistryTypes,
  createDefaultAminoConverters
} from "@cosmjs/stargate";

export class MsgBase {
  typeUrl = null;
  binaryConverter = null;
  aminoConverter = null;

  static binaryConverters = new Map(defaultRegistryTypes);
  static aminoConverters = new Map(Object.entries(createDefaultAminoConverters()));

  constructor (params) {
    this.params = params
  }

  protoType() {
    return this.binaryConverter || MsgBase.binaryConverters.get(this.typeUrl)
  }

  aminoType() {
    return this.aminoConverter || MsgBase.aminoConverters.get(this.typeUrl)
  }

  toProto() {
    return {
      typeUrl: this.typeUrl,
      value: this.toBinary()
    }
  }

  toBinary() {
    const protoType = this.protoType()
    return protoType.encode(protoType.fromPartial(this.params)).finish()
  }

  toAmino () {
    const aminoType = this.aminoType()
    return {
      type: aminoType.aminoType,
      value: aminoType.toAmino(this.params)
    }
  }
}
