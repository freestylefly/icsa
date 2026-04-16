/**
 * 连接状态指示器组件
 */

import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting,
}) => {
  return (
    <div className="ic-connection-status">
      {isConnecting && (
        <div className="ic-status-message ic-connecting">
          <span className="ic-status-spinner" />
          <span>连接中...</span>
        </div>
      )}
      {!isConnected && !isConnecting && (
        <div className="ic-status-message ic-disconnected">
          <span className="ic-status-dot" />
          <span>已断开</span>
          <button className="ic-reconnect-btn" onClick={() => window.location.reload()}>
            重连
          </button>
        </div>
      )}
      {isConnected && (
        <div className="ic-status-message ic-connected">
          <span className="ic-status-dot ic-dot-online" />
          <span>在线</span>
        </div>
      )}
    </div>
  );
};
