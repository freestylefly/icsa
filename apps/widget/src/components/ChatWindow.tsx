/**
 * 聊天窗口组件
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Message } from '../hooks/useConversation';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onClose: () => void;
  onMinimize: () => void;
  primaryColor: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  isConnected,
  isConnecting,
  onSendMessage,
  onClose,
  onMinimize,
  primaryColor,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 处理发送
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const content = inputValue.trim();
    setInputValue('');
    await onSendMessage(content);
  };

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ic-chat-window">
      {/* 头部 */}
      <div className="ic-chat-header" style={{ backgroundColor: primaryColor }}>
        <div className="ic-chat-title">
          <span className="ic-title-text">智能客服</span>
          <span className="ic-status-dot" style={{ backgroundColor: isConnected ? '#52c41a' : '#ff4d4f' }} />
        </div>
        <div className="ic-chat-actions">
          <button className="ic-action-btn" onClick={onMinimize} title="最小化">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button className="ic-action-btn" onClick={onClose} title="关闭">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="ic-chat-messages">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="ic-chat-input-wrapper">
        <MessageInput
          value={inputValue}
          onChange={setInputValue}
          onKeyPress={handleKeyPress}
          onSend={handleSend}
          disabled={isLoading || !isConnected}
          placeholder={isConnecting ? '连接中...' : '请输入消息...'}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
};
