/**
 * 坐席工作台页面
 * 客服坐席的主要工作界面，包含会话列表、聊天窗口、坐席状态控制
 */

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Badge, Avatar, Tag, Space, Divider, Input, Spin } from 'antd';
import {
  MessageOutlined,
  UserOutlined,
  SettingOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header, Content, Sider } = Layout;
const { TextArea } = Input;

// 模拟数据类型
interface Session {
  id: string;
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'waiting' | 'closed';
}

interface AgentStatus {
  status: 'online' | 'busy' | 'offline' | 'break';
  currentSessions: number;
  maxConcurrentSessions: number;
}

const AgentWorkbench: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    status: 'online',
    currentSessions: 3,
    maxConcurrentSessions: 10,
  });

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: '1',
      userId: 'user_001',
      userName: '张先生',
      lastMessage: '这个产品怎么使用？',
      lastMessageTime: '10:30',
      unreadCount: 2,
      status: 'active',
    },
    {
      id: '2',
      userId: 'user_002',
      userName: '李女士',
      lastMessage: '退款什么时候到账？',
      lastMessageTime: '10:28',
      unreadCount: 0,
      status: 'active',
    },
    {
      id: '3',
      userId: 'user_003',
      userName: '王总',
      lastMessage: '好的，谢谢',
      lastMessageTime: '10:25',
      unreadCount: 1,
      status: 'waiting',
    },
  ]);

  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    time: string;
  }>>([
    { id: '1', role: 'user', content: '你好，我想咨询一下产品使用方法', time: '10:28' },
    { id: '2', role: 'assistant', content: '您好！很高兴为您服务。请问您咨询的是哪款产品呢？', time: '10:29' },
    { id: '3', role: 'user', content: '就是你们新推出的智能客服系统', time: '10:30' },
  ]);

  const [inputMessage, setInputMessage] = useState('');

  // 坐席状态切换
  const handleStatusChange = (status: AgentStatus['status']) => {
    setAgentStatus(prev => ({ ...prev, status }));
    // TODO: 调用 API 更新状态
    console.log('坐席状态变更为:', status);
  };

  // 发送消息
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage = {
      id: String(Date.now()),
      role: 'assistant' as const,
      content: inputMessage,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');

    // TODO: 调用 API 发送消息
  };

  // 结束会话
  const handleEndSession = () => {
    if (!selectedSession) return;
    // TODO: 调用 API 结束会话
    console.log('结束会话:', selectedSession);
  };

  // 转接会话
  const handleTransfer = () => {
    if (!selectedSession) return;
    // TODO: 调用 API 转接会话
    console.log('转接会话:', selectedSession);
  };

  // 生成对话摘要
  const handleGenerateSummary = async () => {
    if (!selectedSession) return;
    // TODO: 调用 API 生成摘要
    console.log('生成摘要:', selectedSession);
  };

  // 状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'green';
      case 'busy':
        return 'red';
      case 'offline':
        return 'gray';
      case 'break':
        return 'orange';
      default:
        return 'default';
    }
  };

  const sessionMenuItems: MenuProps['items'] = sessions.map(session => ({
    key: session.id,
    label: (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{session.userName}</strong>
          <span style={{ fontSize: '12px', color: '#999' }}>{session.lastMessageTime}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          {session.lastMessage}
        </div>
        {session.unreadCount > 0 && (
          <Badge count={session.unreadCount} style={{ marginTop: '4px' }} />
        )}
      </div>
    ),
    icon: <MessageOutlined />,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧会话列表 */}
      <Sider width={300} theme="light" style={{ borderRight: '1px solid #e8e8e8' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <strong>会话列表</strong>
            <Badge count={agentStatus.currentSessions} showZero />
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedSession || '']}
          onClick={({ key }) => setSelectedSession(key)}
          items={sessionMenuItems}
          style={{ borderRight: 'none' }}
        />
      </Sider>

      {/* 中间聊天窗口 */}
      <Content style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {selectedSession ? (
          <>
            {/* 聊天头部 */}
            <div style={{ 
              padding: '16px', 
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Space>
                <Avatar icon={<UserOutlined />} />
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {sessions.find(s => s.id === selectedSession)?.userName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    对话时长：15 分钟
                  </div>
                </div>
              </Space>
              <Space>
                <Button icon={<PhoneOutlined />}>语音</Button>
                <Button icon={<VideoCameraOutlined />}>视频</Button>
                <Button icon={<ClockCircleOutlined />}>摘要</Button>
                <Divider type="vertical" />
                <Button onClick={handleTransfer}>转接</Button>
                <Button type="primary" danger onClick={handleEndSession}>结束</Button>
              </Space>
            </div>

            {/* 消息列表 */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    marginBottom: '16px',
                    justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                  }}
                >
                  {msg.role === 'user' && <Avatar icon={<UserOutlined />} style={{ marginRight: '8px' }} />}
                  <div
                    style={{
                      maxWidth: '60%',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: msg.role === 'user' ? '#f5f5f5' : '#1890ff',
                      color: msg.role === 'user' ? '#333' : '#fff',
                    }}
                  >
                    <div>{msg.content}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{msg.time}</div>
                  </div>
                  {msg.role === 'assistant' && (
                    <Avatar
                      style={{ marginLeft: '8px', backgroundColor: '#1890ff' }}
                      icon={<UserOutlined />}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 消息输入框 */}
            <div style={{ padding: '16px', borderTop: '1px solid #e8e8e8' }}>
              <TextArea
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onPressEnter={e => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入消息... (Shift+Enter 换行)"
                rows={3}
                style={{ marginBottom: '8px' }}
              />
              <Space style={{ justifyContent: 'space-between' }}>
                <Space>
                  <Button>常用语</Button>
                  <Button onClick={handleGenerateSummary}>生成摘要</Button>
                </Space>
                <Button type="primary" onClick={handleSendMessage}>发送</Button>
              </Space>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#999' }}>
              <MessageOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>请选择一个会话开始聊天</div>
            </div>
          </div>
        )}
      </Content>

      {/* 右侧坐席状态 */}
      <Sider width={250} theme="light" style={{ borderLeft: '1px solid #e8e8e8' }}>
        <div style={{ padding: '16px' }}>
          <strong style={{ fontSize: '16px' }}>坐席状态</strong>
          <Divider />

          {/* 当前状态 */}
          <div style={{ marginBottom: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Tag color={getStatusColor(agentStatus.status)} style={{ fontSize: '14px' }}>
                {agentStatus.status === 'online' && '🟢 在线'}
                {agentStatus.status === 'busy' && '🔴 忙碌'}
                {agentStatus.status === 'offline' && '⚫ 离线'}
                {agentStatus.status === 'break' && '🟠 休息'}
              </Tag>

              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>当前会话</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {agentStatus.currentSessions} / {agentStatus.maxConcurrentSessions}
                </div>
              </div>
            </Space>
          </div>

          {/* 状态切换按钮 */}
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              type={agentStatus.status === 'online' ? 'primary' : 'default'}
              onClick={() => handleStatusChange('online')}
            >
              🟢 在线
            </Button>
            <Button
              block
              type={agentStatus.status === 'busy' ? 'primary' : 'default'}
              onClick={() => handleStatusChange('busy')}
            >
              🔴 忙碌
            </Button>
            <Button
              block
              type={agentStatus.status === 'break' ? 'primary' : 'default'}
              onClick={() => handleStatusChange('break')}
            >
              🟠 休息
            </Button>
            <Button
              block
              danger
              type={agentStatus.status === 'offline' ? 'primary' : 'default'}
              onClick={() => handleStatusChange('offline')}
            >
              ⚫ 离线
            </Button>
          </Space>

          <Divider />

          {/* 快捷操作 */}
          <div>
            <strong>快捷操作</strong>
            <Space direction="vertical" style={{ width: '100%', marginTop: '12px' }}>
              <Button block icon={<CheckCircleOutlined />}>标记为已解决</Button>
              <Button block icon={<CloseCircleOutlined />}>关闭会话</Button>
              <Button block>查看用户信息</Button>
              <Button block>历史记录</Button>
            </Space>
          </div>
        </div>
      </Sider>
    </Layout>
  );
};

export default AgentWorkbench;
