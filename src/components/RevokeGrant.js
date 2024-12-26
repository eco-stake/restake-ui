import _ from 'lodash'
import {
  Dropdown,
  Button
} from 'react-bootstrap'
import { execableMessage } from '../utils/Helpers.mjs'
import { MsgRevoke } from '../messages/MsgRevoke.mjs'

function RevokeGrant(props) {
  const { address, wallet, grantAddress, grants } = props

  const buttonText = props.buttonText || 'Revoke'

  async function revoke(){
    props.setError(null)
    if(props.setLoading) props.setLoading(true)

    let msgTypes = _.compact(grants).map(grant => {
      switch (grant.authorization['@type']) {
        case "/cosmos.staking.v1beta1.StakeAuthorization":
          return "/cosmos.staking.v1beta1.MsgDelegate"
        case "/cosmos.authz.v1beta1.GenericAuthorization":
          return grant.authorization.msg
      }
    })
    let messages = msgTypes.map(type => buildRevokeMsg(type))
    messages = execableMessage(messages, wallet.address, address)

    try {
      const gas = await wallet.simulate(messages)
      const result = await wallet.signAndBroadcast(messages, gas)
      console.log("Successfully broadcasted:", result);
      if(props.setLoading) props.setLoading(false)
      props.onRevoke(grantAddress, msgTypes)
    } catch (error) {
      console.log('Failed to broadcast:', error)
      if(props.setLoading) props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    }
  }

  function buildRevokeMsg(type){
    return new MsgRevoke({
      granter: address,
      grantee: grantAddress,
      msgTypeUrl: type
    })
  }

  function disabled(){
    return props.disabled || !wallet?.hasPermission(address, 'Revoke') || !wallet?.authzSupport()
  }

  if(props.button){
    return (
      <Button variant="danger" size={props.size} disabled={disabled()} onClick={() => revoke()}>
        {buttonText}
      </Button>
    )
  }

  return (
    <Dropdown.Item as="button" disabled={disabled()} onClick={() => revoke()} >
      {buttonText}
    </Dropdown.Item>
  )
}

export default RevokeGrant;
