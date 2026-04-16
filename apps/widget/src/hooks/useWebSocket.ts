/**
 * WebSocket Hook
 * 管理 WebSocket 连接、断线重连、消息收发
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface UseWebSocketOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(
  apiBaseUrl: string,
  options: UseWebSocketOptions = {}
) {
  const {
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 转换 HTTP URL 为 WebSocket URL
  const getWebSocketUrl = (httpUrl: string) => {
    try {
      const url = new URL(httpUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.toString();
    } catch {
      // 如果不是完整 URL，添加协议
      if (httpUrl.startsWith('localhost')) {
        return `ws://${httpUrl}`;
      }
      return `ws://${httpUrl}`;
    }
  };

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('WebSocket 已连接');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wsUrl = getWebSocketUrl(apiBaseUrl);
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: autoReconnect,
        reconnectionDelay: reconnectInterval,
        reconnectionAttempts: maxReconnectAttempts,
      });

      socket.on('connect', () => {
        console.log('WebSocket 连接成功');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket 断开连接', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // 服务器主动断开，需要重连
          socket.connect();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('WebSocket 连接错误', err);
        setError(err);
        setIsConnecting(false);
        setIsConnected(false);
      });

      socket.on('receive_message', (data: WSMessage) => {
        setLastMessage(data);
      });

      socket.on('user_notification', (data: WSMessage) => {
        setLastMessage(data);
      });

      socket.on('error', (err: Error) => {
        console.error('WebSocket 错误', err);
        setError(err);
      });

      socketRef.current = socket;
    } catch (err: any) {
      console.error('创建 WebSocket 失败', err);
      setError(err);
      setIsConnecting(false);
    }
  }, [apiBaseUrl, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // 发送消息
  const send = useCallback((data: WSMessage) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn('WebSocket 未连接，无法发送消息');
      return false;
    }

    try {
      socketRef.current.emit('send_message', data);
      return true;
    } catch (err: any) {
      console.error('发送消息失败', err);
      return false;
    }
  }, []);

  // 认证
  const authenticate = useCallback((data: {
    type: 'user' | 'agent';
    tenantId: string;
    userId?: string;
    sessionId?: string;
    agentId?: string;
  }) => {
    if (!socketRef.current) {
      console.warn('WebSocket 未初始化');
      return false;
    }

    try {
      socketRef.current.emit('authenticate', data);
      return true;
    } catch (err: any) {
      console.error('认证失败', err);
      return false;
    }
  }, []);

  // 监听认证成功
  useEffect(() => {
    if (!socketRef.current) return;

    const handleAuthenticated = (data: { success: boolean }) => {
      console.log('WebSocket 认证成功', data);
    };

    socketRef.current.on('authenticated', handleAuthenticated);

    return () => {
      socketRef.current?.off('authenticated', handleAuthenticated);
    };
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    authenticate,
  };
}
