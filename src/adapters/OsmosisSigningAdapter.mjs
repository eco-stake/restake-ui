import DefaultSigningAdapter from "./DefaultSigningAdapter.mjs";

export default class OsmosisSigningAdapter extends DefaultSigningAdapter {
  convertToAmino(messages){
    messages.forEach(message => {
      if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec'){
        // Osmosis MsgExec gov is broken with Amino currently
        // See https://github.com/osmosis-labs/cosmos-sdk/pull/342
        if(message.value.msgs.some(msg => msg.typeUrl.startsWith('/cosmos.gov'))){
          throw new Error('Osmosis does not support amino conversion for Authz Exec gov messages')
        }
      }
    })
    return super.convertToAmino(messages)
  }
}
