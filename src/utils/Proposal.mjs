import axios from 'axios'

export const PROPOSAL_STATUSES = {
  '': 'All',
  'PROPOSAL_STATUS_DEPOSIT_PERIOD': 'Deposit Period',
  'PROPOSAL_STATUS_VOTING_PERIOD': 'Voting Period',
  'PROPOSAL_STATUS_PASSED': 'Passed',
  'PROPOSAL_STATUS_REJECTED': 'Rejected',
  'PROPOSAL_STATUS_FAILED': 'Failed'
}

export const PROPOSAL_SCAM_URLS = [
  'v2terra.d',
  'terrapro.a',
  'cosmos-network.io',
  'terraweb.at'
]

const Proposal = async (data) => {
  let { proposal_id, content, messages, metadata, title, summary: description } = data
  if(!proposal_id && data.id) proposal_id = data.id

  let typeHuman
  if(metadata){
    try {
      metadata = JSON.parse(metadata)
      title = title || metadata.title
      description = description || metadata.summary
    } catch {
      try {
        let ipfsUrl
        if(metadata.startsWith('ipfs://')){
          ipfsUrl = metadata.replace("ipfs://", "https://ipfs.io/ipfs/")
        }else if(metadata.startsWith('https://')){
          ipfsUrl = metadata
        }else{
          ipfsUrl = `https://ipfs.io/ipfs/${metadata}`
        }
        metadata = await axios.get(ipfsUrl, { timeout: 5000 }).then(res => res.data)
        title = metadata.title
        description = metadata.summary || metadata.description || metadata.details
      } catch (e) {
        console.log(e)
      }
    }
  }

  if(messages){
    content = messages.find(el => el['@type'] === '/cosmos.gov.v1.MsgExecLegacyContent')?.content
    messages = messages.filter(el => el['@type'] !== '/cosmos.gov.v1.MsgExecLegacyContent')
    typeHuman = messages.map(el => el['@type'].split('.').reverse()[0]).join(', ')
  }

  if(content){
    title = title || content.title
    description = description || content.description
    typeHuman = typeHuman || (content['@type'] ? content['@type'].split('.').reverse()[0] : 'Unknown')
  }

  title = title || typeHuman
  description = description || metadata

  const statusHuman = PROPOSAL_STATUSES[data.status]

  const isDeposit = data.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  const isVoting = data.status === 'PROPOSAL_STATUS_VOTING_PERIOD'
  const isSpam = PROPOSAL_SCAM_URLS.some(url => description && description.toLowerCase().includes(url))

  return {
    ...data,
    proposal_id,
    title,
    typeHuman,
    statusHuman,
    description,
    content,
    metadata,
    isDeposit,
    isVoting,
    isSpam
  }
}

export default Proposal;
