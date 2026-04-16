/**
 * 知识库列表页面
 * Phase 2 - 知识库管理后台
 */

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents: number;
    chunks: number;
    qaPairs: number;
  };
}

interface CreateKnowledgeBaseForm {
  name: string;
  description?: string;
}

const KnowledgeBaseList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();

  // 加载知识库列表
  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge-bases?page=${page}&limit=${pageSize}`, {
        headers: {
          'x-tenant-id': localStorage.getItem('tenantId') || '',
        },
      });
      const result = await response.json();
      
      if (result.success) {
        setKnowledgeBases(result.data);
        setTotal(result.pagination.total);
      } else {
        message.error('加载失败');
      }
    } catch (error) {
      message.error('加载知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, [page, pageSize]);

  // 创建/更新知识库
  const handleSubmit = async (values: CreateKnowledgeBaseForm) => {
    try {
      const url = editingKB
        ? `/api/knowledge-bases/${editingKB.id}`
        : '/api/knowledge-bases';
      
      const method = editingKB ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': localStorage.getItem('tenantId') || '',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (result.success) {
        message.success(editingKB ? '更新成功' : '创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingKB(null);
        loadKnowledgeBases();
      } else {
        message.error(result.error || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除知识库
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/knowledge-bases/${id}`, {
        method: 'DELETE',
        headers: {
          'x-tenant-id': localStorage.getItem('tenantId') || '',
        },
      });

      const result = await response.json();

      if (result.success) {
        message.success('删除成功');
        loadKnowledgeBases();
      } else {
        message.error(result.error || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 编辑知识库
  const handleEdit = (record: KnowledgeBase) => {
    setEditingKB(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
    });
    setModalVisible(true);
  };

  // 列定义
  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <strong>{name}</strong>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colorMap: Record<string, string> = {
          ACTIVE: 'green',
          ARCHIVED: 'orange',
          DELETED: 'red',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '文档数',
      key: 'documents',
      render: (_, record) => record._count?.documents || 0,
    },
    {
      title: '知识片段',
      key: 'chunks',
      render: (_, record) => record._count?.chunks || 0,
    },
    {
      title: '问答对',
      key: 'qaPairs',
      render: (_, record) => record._count?.qaPairs || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => window.location.href = `/knowledge-bases/${record.id}/documents`}
          >
            文档
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个知识库吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>知识库管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingKB(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          创建知识库
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={knowledgeBases}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
          },
        }}
      />

      <Modal
        title={editingKB ? '编辑知识库' : '创建知识库'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingKB(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgeBaseList;
