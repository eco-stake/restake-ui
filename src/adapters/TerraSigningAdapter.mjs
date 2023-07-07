import { Msg } from '@terra-money/terra.js';
import DefaultSigningAdapter from "./DefaultSigningAdapter.mjs";

export default class TerraSigningAdapter extends DefaultSigningAdapter {
  convertToAmino(messages){
    return super.convertToAmino(messages).map(message => {
      // Terra uses custom Amino message types, use Terra.js to convert them
      return Msg.fromAmino(message).toAmino(true)
    })
  }
}
