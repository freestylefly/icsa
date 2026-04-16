/**
 * 未读消息徽章组件
 */

import React from 'react';

interface UnreadBadgeProps {
  count: number;
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({ count }) => {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="ic-unread-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};
