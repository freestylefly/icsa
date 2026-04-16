/**
 * 仪表盘页面
 * 显示核心指标、数据图表、实时监控
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Progress,
  Space,
  Select,
  DatePicker,
  Button,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MessageOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 模拟数据
const conversationTrendData = {
  dates: ['2024-04-01', '2024-04-02', '2024-04-03', '2024-04-04', '2024-04-05', '2024-04-06', '2024-04-07'],
  total: [120, 132, 101, 134, 90, 230, 210],
  resolved: [95, 110, 80, 115, 75, 200, 185],
  transferred: [25, 22, 21, 19, 15, 30, 25],
};

const topFAQsData = [
  { rank: 1, question: '如何重置密码？', count: 245, category: '账户问题' },
  { rank: 2, question: '退款流程是什么？', count: 198, category: '支付问题' },
  { rank: 3, question: '产品如何使用？', count: 176, category: '产品使用' },
  { rank: 4, question: '发货时间多久？', count: 154, category: '物流问题' },
  { rank: 5, question: '如何联系客服？', count: 132, category: '其他' },
  { rank: 6, question: '发票怎么开具？', count: 121, category: '发票问题' },
  { rank: 7, question: '优惠券怎么用？', count: 98, category: '营销活动' },
  { rank: 8, question: '如何修改订单？', count: 87, category: '订单管理' },
  { rank: 9, question: '支持哪些支付方式？', count: 76, category: '支付问题' },
  { rank: 10, question: '售后政策是什么？', count: 65, category: '售后服务' },
];

const agentRankingData = [
  { rank: 1, agentName: '客服小王', score: 95.8, conversations: 156, resolutionRate: 98.5, avgResponseTime: 45 },
  { rank: 2, agentName: '客服小李', score: 94.2, conversations: 142, resolutionRate: 96.8, avgResponseTime: 52 },
  { rank: 3, agentName: '客服小张', score: 92.5, conversations: 138, resolutionRate: 95.2, avgResponseTime: 48 },
  { rank: 4, agentName: '客服小赵', score: 91.3, conversations: 129, resolutionRate: 94.5, avgResponseTime: 55 },
  { rank: 5, agentName: '客服小刘', score: 89.7, conversations: 125, resolutionRate: 93.8, avgResponseTime: 58 },
];

const satisfactionData = {
  averageRating: 4.6,
  totalRatings: 1234,
  distribution: [
    { rating: 5, count: 856, percentage: 69.4 },
    { rating: 4, count: 247, percentage: 20.0 },
    { rating: 3, count: 86, percentage: 7.0 },
    { rating: 2, count: 31, percentage: 2.5 },
    { rating: 1, count: 14, percentage: 1.1 },
  ],
  topTags: [
    { tag: '响应快', count: 456 },
    { tag: '专业', count: 389 },
    { tag: '态度好', count: 342 },
    { tag: '解决问题', count: 298 },
    { tag: '耐心', count: 256 },
  ],
};

const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'week' | 'month'>('day');

  // 核心指标
  const coreMetrics = {
    totalConversations: 1234,
    activeConversations: 56,
    resolutionRate: 94.5,
    avgResponseTime: 52,
    satisfactionScore: 4.6,
    transferRate: 12.3,
  };

  // 坐席排名表格列
  const agentColumns: ColumnsType<typeof agentRankingData[0]> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => (
        <Tag color={rank <= 3 ? 'gold' : 'blue'}>{rank}</Tag>
      ),
    },
    {
      title: '坐席',
      dataIndex: 'agentName',
      key: 'agentName',
    },
    {
      title: '综合得分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (score) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />
      ),
    },
    {
      title: '接待量',
      dataIndex: 'conversations',
      key: 'conversations',
      sorter: (a, b) => a.conversations - b.conversations,
    },
    {
      title: '解决率',
      dataIndex: 'resolutionRate',
      key: 'resolutionRate',
      sorter: (a, b) => a.resolutionRate - b.resolutionRate,
      render: (rate) => `${rate}%`,
    },
    {
      title: '平均响应时间',
      dataIndex: 'avgResponseTime',
      key: 'avgResponseTime',
      sorter: (a, b) => a.avgResponseTime - b.avgResponseTime,
      render: (time) => `${time}s`,
    },
  ];

  // 常见问题表格列
  const faqColumns: ColumnsType<typeof topFAQsData[0]> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => (
        <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>
      ),
    },
    {
      title: '问题',
      dataIndex: 'question',
      key: 'question',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag>{category}</Tag>,
    },
    {
      title: '出现次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部筛选 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space>
          <span>时间范围:</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
          />
          <Select
            value={timeGranularity}
            onChange={(value) => setTimeGranularity(value)}
            style={{ width: 120 }}
          >
            <Option value="day">按日</Option>
            <Option value="week">按周</Option>
            <Option value="month">按月</Option>
          </Select>
          <Button type="primary">查询</Button>
          <Button>导出报表</Button>
        </Space>
      </Card>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="总会话数"
              value={coreMetrics.totalConversations}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="进行中会话"
              value={coreMetrics.activeConversations}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="解决率"
              value={coreMetrics.resolutionRate}
              precision={1}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={coreMetrics.avgResponseTime}
              suffix="秒"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="满意度评分"
              value={coreMetrics.satisfactionScore}
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card>
            <Statistic
              title="转人工率"
              value={coreMetrics.transferRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 对话趋势和满意度 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} xl={16}>
          <Card title="对话趋势" style={{ height: '400px' }}>
            {/* TODO: 集成 ECharts 图表 */}
            <div style={{ 
              height: '320px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: '#f5f5f5',
              borderRadius: '4px',
            }}>
              <div style={{ textAlign: 'center', color: '#999' }}>
                <MessageOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>ECharts 对话趋势图</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  显示近 7 天的对话量、解决量、转人工量趋势
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="满意度分布" style={{ height: '400px' }}>
            <div style={{ padding: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#722ed1' }}>
                  {satisfactionData.averageRating}
                </div>
                <div style={{ color: '#999' }}>平均评分 / 5</div>
                <div style={{ marginTop: '8px' }}>
                  共 {satisfactionData.totalRatings} 条评价
                </div>
              </div>

              {/* 评分分布 */}
              <Space direction="vertical" style={{ width: '100%' }}>
                {satisfactionData.distribution.map(item => (
                  <div key={item.rating}>
                    <Space>
                      <Tag color={item.rating >= 4 ? 'green' : item.rating >= 3 ? 'orange' : 'red'}>
                        {item.rating}星
                      </Tag>
                      <Progress
                        percent={item.percentage}
                        size="small"
                        status={item.rating >= 4 ? 'success' : 'normal'}
                      />
                      <span style={{ fontSize: '12px', color: '#999', width: '50px' }}>
                        {item.count}
                      </span>
                    </Space>
                  </div>
                ))}
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 坐席排名和常见问题 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="坐席绩效排名 TOP5">
            <Table
              columns={agentColumns}
              dataSource={agentRankingData}
              rowKey="rank"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="常见问题 TOP10">
            <Table
              columns={faqColumns}
              dataSource={topFAQsData}
              rowKey="rank"
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 热门标签 */}
      <Card title="满意度热门标签" style={{ marginTop: '24px' }}>
        <Space wrap>
          {satisfactionData.topTags.map(item => (
            <Tag key={item.tag} color="blue" style={{ fontSize: '14px', padding: '8px 16px' }}>
              {item.tag} × {item.count}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default Dashboard;
