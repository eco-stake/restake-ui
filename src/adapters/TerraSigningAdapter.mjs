import { Msg } from '@terra-money/terra.js';
import DefaultSigningAdapter from "./DefaultSigningAdapter.mjs";

export default class TerraSigningAdapter extends DefaultSigningAdapter {
  toAmino(messages){
    return super.toAmino(messages).map(message => {
      // Terra uses custom Amino message types, use Terra.js to convert them
      return Msg.fromAmino(message).toAmino(true)
    })
  }
}
