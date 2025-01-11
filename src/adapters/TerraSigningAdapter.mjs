import { Msg } from '@terra-money/terra.js';
import DefaultSigningAdapter from "./DefaultSigningAdapter.mjs";

export default class TerraSigningAdapter extends DefaultSigningAdapter {
  toAmino(message){
    this.checkAminoSupport(message)
    // Terra uses custom Amino message types, use Terra.js to convert them
    let aminoMessage = Msg.fromAmino(message.toAmino()).toAmino(true)
    if(this.network.authzAminoLiftedValues){
      aminoMessage = this.liftAuthzAmino(aminoMessage)
    }
    return aminoMessage
  }

  liftAuthzAmino(aminoMessage){
    switch (aminoMessage.type) {
      case 'msgauth/MsgGrantAuthorization':
        throw new Error('This chain does not support amino conversion for MsgGrant')
      case 'cosmos-sdk/MsgRevoke':
        throw new Error('This chain does not support amino conversion for MsgRevoke')
      case 'cosmos-sdk/MsgExec':
        throw new Error('This chain does not support amino conversion for MsgExec')
    }
    return aminoMessage;
  }
}
