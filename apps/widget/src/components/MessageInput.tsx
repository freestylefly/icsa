/**
 * 消息输入框组件
 */

import React, { useRef } from 'react';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  primaryColor: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onSend,
  disabled,
  placeholder,
  primaryColor,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    adjustHeight();
  };

  return (
    <div className="ic-message-input-container">
      <textarea
        ref={textareaRef}
        className="ic-message-input"
        value={value}
        onChange={handleChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button
        className="ic-send-button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        style={{ backgroundColor: disabled ? '#d9d9d9' : primaryColor }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </div>
  );
};
