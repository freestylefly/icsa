/**
 * 文档上传组件
 * 支持拖拽上传、进度显示、多文件上传
 */

import React, { useState, useCallback } from 'react';
import { Upload, Button, message, Progress, Space, Tag } from 'antd';
import { InboxOutlined, UploadOutlined, CloseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { Dragger } = Upload;

interface DocumentUploaderProps {
  knowledgeBaseId: string;
  onUploadComplete?: () => void;
}

interface UploadStatus {
  uid: string;
  name: string;
  status: 'uploading' | 'success' | 'error';
  percent?: number;
  error?: string;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  knowledgeBaseId,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // 允许的文件类型
  const allowedTypes = [
    '.pdf',
    '.docx',
    '.doc',
    '.txt',
    '.md',
  ];

  // 最大文件大小（50MB）
  const maxSize = 50 * 1024 * 1024;

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    action: `/api/knowledge-bases/${knowledgeBaseId}/documents/batch`,
    fileList,
    headers: {
      'x-tenant-id': localStorage.getItem('tenantId') || '',
    },
    beforeUpload: (file) => {
      // 验证文件类型
      const fileType = file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(`.${fileType}`)) {
        message.error(`不支持的文件类型：${file.name}`);
        return false;
      }

      // 验证文件大小
      if (file.size > maxSize) {
        message.error(`文件过大：${file.name}（最大 50MB）`);
        return false;
      }

      return true;
    },
    onChange: ({ file, fileList: newFileList }) => {
      setFileList(newFileList);

      // 更新上传状态
      if (file.status === 'uploading') {
        setUploading(true);
        setUploadStatuses(prev => [
          ...prev.filter(s => s.uid !== file.uid),
          {
            uid: file.uid,
            name: file.name,
            status: 'uploading',
            percent: file.percent || 0,
          },
        ]);
      } else if (file.status === 'done') {
        setUploadStatuses(prev => [
          ...prev.filter(s => s.uid !== file.uid),
          {
            uid: file.uid,
            name: file.name,
            status: 'success',
            percent: 100,
          },
        ]);
      } else if (file.status === 'error') {
        setUploadStatuses(prev => [
          ...prev.filter(s => s.uid !== file.uid),
          {
            uid: file.uid,
            name: file.name,
            status: 'error',
            error: file.response?.error || '上传失败',
          },
        ]);
      }

      // 检查是否所有文件都完成
      const allDone = newFileList.every(f => f.status === 'done' || f.status === 'error');
      if (allDone && newFileList.length > 0) {
        setUploading(false);
        const successCount = newFileList.filter(f => f.status === 'done').length;
        const errorCount = newFileList.filter(f => f.status === 'error').length;
        
        if (successCount > 0) {
          message.success(`上传成功 ${successCount} 个文件`);
          onUploadComplete?.();
        }
        if (errorCount > 0) {
          message.error(`上传失败 ${errorCount} 个文件`);
        }
      }
    },
    onRemove: (file) => {
      setUploadStatuses(prev => prev.filter(s => s.uid !== file.uid));
      return true;
    },
  };

  return (
    <div>
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 PDF、DOCX、DOC、TXT、MD 格式，单个文件最大 50MB
        </p>
      </Dragger>

      {uploadStatuses.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>上传进度</h3>
          {uploadStatuses.map(status => (
            <div
              key={status.uid}
              style={{
                marginBottom: 12,
                padding: 12,
                border: '1px solid #f0f0f0',
                borderRadius: 4,
              }}
            >
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{status.name}</span>
                <Space>
                  {status.status === 'uploading' && (
                    <Tag color="blue">上传中</Tag>
                  )}
                  {status.status === 'success' && (
                    <>
                      <Tag color="green">完成</Tag>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    </>
                  )}
                  {status.status === 'error' && (
                    <>
                      <Tag color="red">失败</Tag>
                      <CloseOutlined style={{ color: '#ff4d4f' }} />
                    </>
                  )}
                </Space>
              </Space>
              
              {status.status === 'uploading' && (
                <Progress
                  percent={status.percent || 0}
                  style={{ marginTop: 8 }}
                />
              )}
              
              {status.status === 'error' && status.error && (
                <div style={{ color: '#ff4d4f', marginTop: 8, fontSize: 12 }}>
                  {status.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button disabled>
            正在上传...
          </Button>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
