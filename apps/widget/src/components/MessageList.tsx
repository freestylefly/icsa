/**
 * 消息列表组件
 */

import React from 'react';
import { Message } from '../hooks/useConversation';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  if (messages.length === 0) {
    return (
      <div className="ic-empty-messages">
        <div className="ic-empty-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="ic-empty-text">您好！有什么可以帮助您的吗？</p>
      </div>
    );
  }

  return (
    <div className="ic-message-list">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id || index}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  );
};

interface MessageItemProps {
  message: Message;
  isLast: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isLast }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`ic-message ${isUser ? 'ic-message-user' : 'ic-message-bot'}`}>
      {!isUser && (
        <div className="ic-message-avatar">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
      <div className="ic-message-content">
        <div className="ic-message-bubble">{message.content}</div>
        <div className="ic-message-time">{time}</div>
        {message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="ic-message-sources">
            <span className="ic-sources-label">来源:</span>
            {message.metadata.sources.slice(0, 2).map((source, idx) => (
              <span key={idx} className="ic-source-tag">
                {source.documentName || '文档'}
              </span>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="ic-message-avatar ic-avatar-user">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="ic-typing-indicator">
    <div className="ic-typing-dot" />
    <div className="ic-typing-dot" />
    <div className="ic-typing-dot" />
  </div>
);
