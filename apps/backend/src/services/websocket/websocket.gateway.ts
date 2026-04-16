/**
 * WebSocket 网关
 * 使用 Socket.IO 实现实时通信
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import { conversationService } from '../conversation/conversation.service';
import { handoffService, HandoffTicket } from '../human-handoff/handoff.service';
import { queueManager } from '../human-handoff/queue-manager.service';

export interface ClientData {
  type: 'user' | 'agent';
  tenantId: string;
  userId?: string;
  sessionId?: string;
  agentId?: string;
}

export class WebSocketGateway {
  private io: SocketIOServer;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 秒

  constructor() {
    this.io = new SocketIOServer();
  }

  /**
   * 初始化 WebSocket 服务器
   */
  init(httpServer: HTTPServer) {
    this.io.attach(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info('WebSocket 连接建立', { socketId: socket.id });
      this.handleConnection(socket);
    });

    logger.info('WebSocket 网关已初始化');
  }

  /**
   * 处理连接
   */
  private handleConnection(socket: Socket) {
    let clientData: ClientData | null = null;

    // 客户端认证
    socket.on('authenticate', (data: ClientData) => {
      clientData = data;
      logger.info('客户端认证', { socketId: socket.id, type: data.type, tenantId: data.tenantId });

      // 加入房间
      const roomName = this.getRoomName(data);
      socket.join(roomName);
      logger.debug('加入房间', { socketId: socket.id, room: roomName });

      // 如果是坐席，注册到队列管理器
      if (data.type === 'agent' && data.agentId) {
        queueManager.registerAgent({
          agentId: data.agentId,
          tenantId: data.tenantId,
          status: 'online',
          currentLoad: 0,
          maxLoad: 10,
          lastHeartbeat: Date.now(),
        });
      }

      // 发送认证成功
      socket.emit('authenticated', { success: true });
    });

    // 心跳
    socket.on('heartbeat', () => {
      if (clientData?.type === 'agent' && clientData.agentId) {
        queueManager.heartbeat(clientData.agentId);
      }
      socket.emit('heartbeat_ack', { timestamp: Date.now() });
    });

    // 用户发送消息
    socket.on('send_message', async (data: { content: string }) => {
      if (!clientData || clientData.type !== 'user' || !clientData.sessionId) {
        socket.emit('error', { message: '未认证或会话无效' });
        return;
      }

      try {
        // 处理消息（非流式，流式需要特殊处理）
        const response = await conversationService.processMessage({
          tenantId: clientData.tenantId,
          userId: clientData.userId,
          sessionId: clientData.sessionId,
          message: data.content,
        });

        // 发送回复
        socket.emit('receive_message', {
          message: response.message,
          sources: response.sources,
        });

        // 如果需要转人工，通知坐席
        if (response.shouldHandoff) {
          this.notifyAgents(clientData.tenantId, {
            type: 'handoff_request',
            sessionId: clientData.sessionId,
            reason: response.handoffReason,
          });
        }
      } catch (error: any) {
        logger.error('处理消息失败', { error });
        socket.emit('error', { message: error.message });
      }
    });

    // 坐席接受工单
    socket.on('accept_ticket', async (data: { ticketId: string }) => {
      if (!clientData || clientData.type !== 'agent' || !clientData.agentId) {
        socket.emit('error', { message: '坐席未认证' });
        return;
      }

      try {
        await handoffService.acceptTicket(data.ticketId);
        
        // 通知用户
        const ticket = await handoffService.getTicket(data.ticketId);
        if (ticket && ticket.sessionId) {
          this.notifyUser(ticket.sessionId, {
            type: 'agent_accepted',
            agentId: clientData.agentId,
          });
        }

        socket.emit('ticket_accepted', { ticketId: data.ticketId });
      } catch (error: any) {
        logger.error('接受工单失败', { error });
        socket.emit('error', { message: error.message });
      }
    });

    // 坐席发送消息
    socket.on('agent_send_message', async (data: { sessionId: string; content: string }) => {
      if (!clientData || clientData.type !== 'agent' || !clientData.agentId) {
        socket.emit('error', { message: '坐席未认证' });
        return;
      }

      try {
        // 保存消息到历史
        await conversationService.getSessionHistory(data.sessionId);
        
        // 通知用户
        this.notifyUser(data.sessionId, {
          type: 'agent_message',
          content: data.content,
          agentId: clientData.agentId,
        });
      } catch (error: any) {
        logger.error('坐席发送消息失败', { error });
        socket.emit('error', { message: error.message });
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      logger.info('WebSocket 连接断开', { socketId: socket.id });
      
      if (clientData?.type === 'agent' && clientData.agentId) {
        queueManager.unregisterAgent(clientData.agentId);
      }
    });

    // 错误处理
    socket.on('error', (error: Error) => {
      logger.error('WebSocket 错误', { socketId: socket.id, error });
    });
  }

  /**
   * 通知坐席（广播给所有在线坐席）
   */
  private notifyAgents(tenantId: string, data: any) {
    const roomName = `agents:${tenantId}`;
    this.io.to(roomName).emit('agent_notification', data);
    logger.debug('通知坐席', { room: roomName, data });
  }

  /**
   * 通知用户
   */
  private notifyUser(sessionId: string, data: any) {
    const roomName = `user:${sessionId}`;
    this.io.to(roomName).emit('user_notification', data);
    logger.debug('通知用户', { room: roomName, data });
  }

  /**
   * 获取房间名称
   */
  private getRoomName(data: ClientData): string {
    if (data.type === 'agent') {
      return `agents:${data.tenantId}`;
    } else if (data.sessionId) {
      return `user:${data.sessionId}`;
    } else {
      return `tenant:${data.tenantId}`;
    }
  }

  /**
   * 广播消息
   */
  broadcast(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  /**
   * 获取 Socket.IO 实例
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

// 单例
export const websocketGateway = new WebSocketGateway();
