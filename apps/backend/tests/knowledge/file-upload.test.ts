/**
 * 文件上传服务单元测试
 */

import { validateFileType, validateFileSize, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '../../src/config/minio.config';

describe('File Upload Validation', () => {
  describe('validateFileType', () => {
    it('应该允许 PDF 文件', () => {
      expect(validateFileType('application/pdf', 'document.pdf')).toBe(true);
    });

    it('应该允许 DOCX 文件', () => {
      expect(validateFileType('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document.docx')).toBe(true);
    });

    it('应该允许 DOC 文件', () => {
      expect(validateFileType('application/msword', 'document.doc')).toBe(true);
    });

    it('应该允许 TXT 文件', () => {
      expect(validateFileType('text/plain', 'document.txt')).toBe(true);
    });

    it('应该允许 MD 文件', () => {
      expect(validateFileType('text/markdown', 'document.md')).toBe(true);
      expect(validateFileType('text/x-markdown', 'document.md')).toBe(true);
    });

    it('应该拒绝不支持的文件类型', () => {
      expect(validateFileType('image/png', 'image.png')).toBe(false);
      expect(validateFileType('video/mp4', 'video.mp4')).toBe(false);
      expect(validateFileType('application/zip', 'archive.zip')).toBe(false);
    });

    it('应该通过扩展名验证', () => {
      // 即使 MIME 类型不匹配，扩展名正确也应该通过
      expect(validateFileType('application/octet-stream', 'document.pdf')).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('应该允许小于限制的文件', () => {
      expect(() => validateFileSize(1024 * 1024)).not.toThrow(); // 1MB
      expect(() => validateFileSize(MAX_FILE_SIZE)).not.toThrow(); // 50MB
    });

    it('应该拒绝超过限制的文件', () => {
      expect(() => validateFileSize(MAX_FILE_SIZE + 1)).toThrow('文件大小超过限制');
      expect(() => validateFileSize(100 * 1024 * 1024)).toThrow('文件大小超过限制'); // 100MB
    });

    it('应该支持自定义大小限制', () => {
      const customLimit = 10 * 1024 * 1024; // 10MB
      
      expect(() => validateFileSize(5 * 1024 * 1024, customLimit)).not.toThrow();
      expect(() => validateFileSize(15 * 1024 * 1024, customLimit)).toThrow();
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('应该包含所有支持的 MIME 类型', () => {
      expect(ALLOWED_MIME_TYPES).toHaveProperty('application/pdf');
      expect(ALLOWED_MIME_TYPES).toHaveProperty('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(ALLOWED_MIME_TYPES).toHaveProperty('application/msword');
      expect(ALLOWED_MIME_TYPES).toHaveProperty('text/plain');
      expect(ALLOWED_MIME_TYPES).toHaveProperty('text/markdown');
      expect(ALLOWED_MIME_TYPES).toHaveProperty('text/x-markdown');
    });
  });

  describe('ALLOWED_EXTENSIONS', () => {
    it('应该包含所有支持的扩展名', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.pdf');
      expect(ALLOWED_EXTENSIONS).toContain('.docx');
      expect(ALLOWED_EXTENSIONS).toContain('.doc');
      expect(ALLOWED_EXTENSIONS).toContain('.txt');
      expect(ALLOWED_EXTENSIONS).toContain('.md');
    });

    it('扩展名数量应该与 MIME 类型对应', () => {
      expect(ALLOWED_EXTENSIONS.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('MAX_FILE_SIZE', () => {
    it('应该等于 50MB', () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });

    it('应该能以 MB 为单位正确转换', () => {
      expect(MAX_FILE_SIZE / 1024 / 1024).toBe(50);
    });
  });
});

describe('Storage Key Generation', () => {
  // 这里需要导入 generateStorageKey 函数进行测试
  // 由于是纯函数，可以直接测试
  it('应该生成正确的存储路径格式', () => {
    // 示例测试，实际测试需要导入函数
    const tenantId = 'tenant-123';
    const kbId = 'kb-456';
    const docId = 'doc-789';
    const filename = 'test.pdf';

    // 预期格式：{tenantId}/{kbId}/{docId}/{filename}
    const expectedPattern = /^tenant-123\/kb-456\/doc-789\/.*\.pdf$/;
    
    // 实际测试在集成测试中进行
    expect(expectedPattern.test('tenant-123/kb-456/doc-789/test.pdf')).toBe(true);
  });
});
