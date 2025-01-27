import React from 'react'
import _ from 'lodash'
import {
  BookmarkPlus,
  BookmarkPlusFill
} from 'react-bootstrap-icons'
import TooltipIcon from './TooltipIcon'

function Favourite({
    value,
    toggle,
    onIcon: OnIcon = BookmarkPlusFill,
    offIcon: OffIcon = BookmarkPlus,
    tooltip,
    onTooltip,
    offTooltip,
    className,
    ...props
  }) {
  const classNames = _.compact([
    className,
    `favourite-${value ? 'on' : 'off'}`
  ]).join(' ')

  const button = (
    <div role="button" onClick={toggle} className={classNames} {...props}>
      <OnIcon width={20} height={20} className="on" />
      <OffIcon width={20} height={20} className="off" />
    </div>
  )

  let showTooltip = tooltip || (value ? onTooltip : offTooltip)

  if (showTooltip){
    return (
      <TooltipIcon tooltip={showTooltip}>
        {button}
      </TooltipIcon>
    )
  } else {
    return button
  }
}

export default Favourite
