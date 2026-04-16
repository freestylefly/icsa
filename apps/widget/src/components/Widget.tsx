/**
 * Widget 主组件
 * 使用 Shadow DOM 隔离样式
 */

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ChatWindow } from './ChatWindow';
import { UnreadBadge } from './UnreadBadge';
import { ConnectionStatus } from './ConnectionStatus';
import { useConversation } from '../hooks/useConversation';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { WidgetConfig } from '../index';
import './widget.css';

interface WidgetProps {
  config: WidgetConfig;
}

export const Widget: React.FC<WidgetProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // 本地存储会话 ID
  const [sessionId, setSessionId] = useLocalStorage<string>('widget_session_id', '');
  
  // 对话钩子
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    connectToSession,
  } = useConversation(config.apiBaseUrl, config.tenantId);

  // WebSocket 钩子
  const {
    isConnected,
    isConnecting,
    lastMessage,
    connect,
    disconnect,
    send,
  } = useWebSocket(config.apiBaseUrl);

  // 未读消息数
  const [unreadCount, setUnreadCount] = useState(0);

  // 初始化
  useEffect(() => {
    // 连接 WebSocket
    connect();

    // 如果有会话 ID，加载历史
    if (sessionId) {
      connectToSession(sessionId);
    }

    return () => {
      disconnect();
    };
  }, []);

  // 监听新消息
  useEffect(() => {
    if (lastMessage && !isOpen) {
      setUnreadCount(prev => prev + 1);
    }
  }, [lastMessage, isOpen]);

  // 打开聊天窗口
  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  // 关闭聊天窗口
  const handleClose = () => {
    setIsOpen(false);
  };

  // 最小化
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  // 发送消息
  const handleSendMessage = async (content: string) => {
    try {
      const newSessionId = await sendMessage(content, sessionId);
      if (newSessionId && newSessionId !== sessionId) {
        setSessionId(newSessionId);
      }

      // 通过 WebSocket 发送（如果连接）
      if (isConnected) {
        send({ type: 'send_message', content });
      }
    } catch (error) {
      console.error('发送消息失败', error);
    }
  };

  // 渲染聊天按钮
  const renderChatButton = () => (
    <button
      className="ic-widget-button"
      onClick={handleOpen}
      style={{
        backgroundColor: config.theme?.primaryColor || '#1890ff',
        right: config.theme?.position === 'left' ? '20px' : 'auto',
        left: config.theme?.position === 'left' ? 'auto' : '20px',
      }}
    >
      <svg className="ic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <UnreadBadge count={unreadCount} />
    </button>
  );

  // 渲染聊天窗口
  const renderChatWindow = () => (
    <div
      className={`ic-widget-window ${isOpen ? 'ic-open' : ''} ${isMinimized ? 'ic-minimized' : ''}`}
      style={{
        right: config.theme?.position === 'left' ? 'auto' : '20px',
        left: config.theme?.position === 'left' ? '20px' : 'auto',
      }}
    >
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        isConnected={isConnected}
        isConnecting={isConnecting}
        onSendMessage={handleSendMessage}
        onClose={handleClose}
        onMinimize={handleMinimize}
        primaryColor={config.theme?.primaryColor || '#1890ff'}
      />
      <ConnectionStatus isConnected={isConnected} isConnecting={isConnecting} />
    </div>
  );

  return (
    <div className="ic-widget-container" ref={containerRef}>
      {renderChatButton()}
      {renderChatWindow()}
    </div>
  );
};

// 创建 Widget 实例（Shadow DOM）
export const createWidget = (config: WidgetConfig) => {
  const container = document.createElement('div');
  container.id = 'intelligent-customer-widget';
  
  // 创建 Shadow DOM
  const shadow = container.attachShadow({ mode: 'open' });
  
  // 创建样式
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      bottom: 0;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
  `;
  shadow.appendChild(style);

  // 创建 React 根
  const root = createRoot(shadow);

  // 渲染组件
  const render = () => {
    root.render(<Widget config={config} />);
  };

  // 销毁
  const destroy = () => {
    root.unmount();
    container.remove();
  };

  return {
    render,
    destroy,
    open: () => {
      const event = new CustomEvent('ic-widget:open');
      container.dispatchEvent(event);
    },
    close: () => {
      const event = new CustomEvent('ic-widget:close');
      container.dispatchEvent(event);
    },
  };
};
