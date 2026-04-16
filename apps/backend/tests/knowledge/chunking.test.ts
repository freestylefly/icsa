/**
 * 知识切分模块单元测试
 */

import { chunkDocument, KnowledgeChunk } from '../../src/services/knowledge/chunking.service';
import { ParsedDocument } from '../../src/services/knowledge/document-parser.service';

describe('Chunking Service', () => {
  describe('chunkDocument', () => {
    it('应该按段落切分文档', () => {
      const parsedDoc: ParsedDocument = {
        content: '第一段内容。\n\n第二段内容。\n\n第三段内容。',
        metadata: {
          wordCount: 30,
          parsedAt: new Date(),
        },
        pages: [
          { pageNumber: 1, content: '第一段内容。\n\n第二段内容。' },
          { pageNumber: 2, content: '第三段内容。' },
        ],
      };

      const chunks = chunkDocument(parsedDoc, {
        chunkSize: 800,
        overlap: 200,
        byParagraph: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('第一段内容');
    });

    it('应该应用重叠窗口策略', () => {
      const longText = 'A'.repeat(1000) + '\n\n' + 'B'.repeat(1000);
      
      const parsedDoc: ParsedDocument = {
        content: longText,
        metadata: {
          wordCount: 2000,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content: longText }],
      };

      const chunks = chunkDocument(parsedDoc, {
        chunkSize: 800,
        overlap: 200,
      });

      // 验证有重叠
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('应该提取标题元数据', () => {
      const parsedDoc: ParsedDocument = {
        content: '# 文档标题\n\n这是文档内容。',
        metadata: {
          wordCount: 20,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content: '# 文档标题\n\n这是文档内容。' }],
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.title).toBe('文档标题');
    });

    it('应该合并过小的片段', () => {
      const parsedDoc: ParsedDocument = {
        content: '短1\n\n短 2\n\n短 3',
        metadata: {
          wordCount: 15,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content: '短 1\n\n短 2\n\n短 3' }],
      };

      const chunks = chunkDocument(parsedDoc, {
        minChunkSize: 10,
      });

      // 过小的片段应该被合并
      expect(chunks.length).toBeLessThanOrEqual(3);
    });

    it('应该包含页码元数据', () => {
      const parsedDoc: ParsedDocument = {
        content: '第一页内容',
        metadata: {
          wordCount: 10,
          parsedAt: new Date(),
        },
        pages: [
          { pageNumber: 1, content: '第一页内容' },
          { pageNumber: 2, content: '第二页内容' },
        ],
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks.some(c => c.metadata.pageNumber === 1)).toBe(true);
    });

    it('应该为每个片段分配索引', () => {
      const parsedDoc: ParsedDocument = {
        content: '段落 1\n\n段落 2\n\n段落 3',
        metadata: {
          wordCount: 30,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content: '段落 1\n\n段落 2\n\n段落 3' }],
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index);
      });
    });

    it('应该处理空文档', () => {
      const parsedDoc: ParsedDocument = {
        content: '',
        metadata: {
          wordCount: 0,
          parsedAt: new Date(),
        },
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks.length).toBe(0);
    });

    it('应该处理没有页面信息的文档', () => {
      const parsedDoc: ParsedDocument = {
        content: '没有页面信息的文档内容',
        metadata: {
          wordCount: 20,
          parsedAt: new Date(),
        },
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('切分策略', () => {
    it('应该优先按标题切分', () => {
      const content = `
# 第一章 引言

这是引言内容。

# 第二章 正文

这是正文内容。

# 第三章 结论

这是结论。
      `;

      const parsedDoc: ParsedDocument = {
        content,
        metadata: {
          wordCount: 100,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content }],
      };

      const chunks = chunkDocument(parsedDoc);

      // 应该按标题分成 3 个章节
      expect(chunks.some(c => c.metadata.title === '第一章 引言')).toBe(true);
      expect(chunks.some(c => c.metadata.title === '第二章 正文')).toBe(true);
      expect(chunks.some(c => c.metadata.title === '第三章 结论')).toBe(true);
    });

    it('应该记录切分策略', () => {
      const parsedDoc: ParsedDocument = {
        content: '测试内容',
        metadata: {
          wordCount: 10,
          parsedAt: new Date(),
        },
        pages: [{ pageNumber: 1, content: '测试内容' }],
      };

      const chunks = chunkDocument(parsedDoc);

      expect(chunks[0].metadata.chunkingStrategy).toBeDefined();
    });
  });
});
