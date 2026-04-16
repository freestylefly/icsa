/**
 * 文档解析器服务
 * 支持 PDF、Word、TXT、MD 格式解析
 */

import { logger } from '../../utils/logger';
import { createBadRequestError } from '../../middleware/errorHandler';
import { downloadFileFromMinIO } from './file-upload.service';

export interface ParsedDocument {
  content: string;
  metadata: DocumentMetadata;
  pages?: PageContent[];
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  wordCount: number;
  createdAt?: Date;
  parsedAt: Date;
}

export interface PageContent {
  pageNumber: number;
  content: string;
}

/**
 * PDF 解析（使用 pdf-parse）
 */
const parsePDF = async (buffer: Buffer): Promise<ParsedDocument> => {
  try {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);

    const pages: PageContent[] = [];
    
    // 按页分割内容
    const pageTexts = data.text.split(/\n\s*\n/).filter(Boolean);
    let currentPage = 1;
    let charCount = 0;
    let pageContent = '';

    for (const line of data.text.split('\n')) {
      pageContent += line + '\n';
      charCount += line.length;

      // 每 1000 字符或遇到分页符时分割
      if (charCount > 1000 || line.includes('---')) {
        pages.push({
          pageNumber: currentPage,
          content: pageContent.trim(),
        });
        currentPage++;
        pageContent = '';
        charCount = 0;
      }
    }

    // 添加最后一页
    if (pageContent.trim()) {
      pages.push({
        pageNumber: currentPage,
        content: pageContent.trim(),
      });
    }

    return {
      content: data.text,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        pageCount: data.numpages,
        wordCount: data.text.length,
        parsedAt: new Date(),
      },
      pages,
    };
  } catch (error: any) {
    logger.error('PDF 解析失败', { error });
    throw new Error(`PDF 解析失败：${error.message}`);
  }
};

/**
 * Word 文档解析（使用 mammoth）
 */
const parseWord = async (buffer: Buffer): Promise<ParsedDocument> => {
  try {
    const mammoth = await import('mammoth');
    
    // 提取纯文本
    const result = await mammoth.extractRawText({ buffer });
    
    // 提取 HTML（保留基本格式）
    const htmlResult = await mammoth.convertToHtml({ buffer });

    // 简单分割段落
    const paragraphs = result.value.split(/\n\s*\n/).filter(Boolean);
    const pages: PageContent[] = paragraphs.map((para, index) => ({
      pageNumber: Math.floor(index / 10) + 1, // 每 10 段算一页
      content: para.trim(),
    }));

    return {
      content: result.value,
      metadata: {
        wordCount: result.value.length,
        parsedAt: new Date(),
      },
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, content: result.value }],
    };
  } catch (error: any) {
    logger.error('Word 文档解析失败', { error });
    throw new Error(`Word 文档解析失败：${error.message}`);
  }
};

/**
 * TXT 文件解析
 */
const parseText = async (buffer: Buffer, filename: string): Promise<ParsedDocument> => {
  try {
    const content = buffer.toString('utf-8');
    
    // 按段落分割
    const paragraphs = content.split(/\n\s*\n/).filter(Boolean);
    const pages: PageContent[] = paragraphs.map((para, index) => ({
      pageNumber: Math.floor(index / 10) + 1,
      content: para.trim(),
    }));

    return {
      content,
      metadata: {
        title: filename.replace(/\.[^/.]+$/, ''), // 移除扩展名
        wordCount: content.length,
        parsedAt: new Date(),
      },
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, content }],
    };
  } catch (error: any) {
    logger.error('TXT 文件解析失败', { error });
    throw new Error(`TXT 文件解析失败：${error.message}`);
  }
};

/**
 * Markdown 文件解析
 */
const parseMarkdown = async (buffer: Buffer, filename: string): Promise<ParsedDocument> => {
  try {
    const content = buffer.toString('utf-8');
    
    // 提取标题作为元数据
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.[^/.]+$/, '');

    // 按标题分割章节
    const sections = content.split(/^#\s+/m).filter(Boolean);
    const pages: PageContent[] = sections.map((section, index) => {
      const firstLine = section.split('\n')[0].trim();
      return {
        pageNumber: index + 1,
        content: `# ${firstLine}\n\n${section.split('\n').slice(1).join('\n')}`,
      };
    });

    return {
      content,
      metadata: {
        title,
        wordCount: content.length,
        parsedAt: new Date(),
      },
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, content }],
    };
  } catch (error: any) {
    logger.error('Markdown 文件解析失败', { error });
    throw new Error(`Markdown 文件解析失败：${error.message}`);
  }
};

/**
 * 统一文档解析接口
 * 根据 MIME 类型自动选择解析器
 */
export const parseDocument = async (
  storageKey: string,
  mimeType: string,
  filename: string
): Promise<ParsedDocument> => {
  logger.info('开始解析文档', { storageKey, mimeType, filename });

  // 下载文件
  const buffer = await downloadFileFromMinIO(storageKey);

  let result: ParsedDocument;

  // 根据 MIME 类型选择解析器
  if (mimeType === 'application/pdf') {
    result = await parsePDF(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    result = await parseWord(buffer);
  } else if (mimeType === 'text/plain') {
    result = await parseText(buffer, filename);
  } else if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') {
    result = await parseMarkdown(buffer, filename);
  } else {
    throw createBadRequestError(`不支持的文件类型：${mimeType}`);
  }

  // 添加文件名到元数据
  result.metadata.title = result.metadata.title || filename.replace(/\.[^/.]+$/, '');

  logger.info('文档解析完成', {
    storageKey,
    wordCount: result.metadata.wordCount,
    pageCount: result.pages?.length,
  });

  return result;
};

/**
 * 批量解析文档
 */
export const parseMultipleDocuments = async (
  documents: Array<{
    storageKey: string;
    mimeType: string;
    filename: string;
  }>
): Promise<Array<{ storageKey: string; result: ParsedDocument } | { storageKey: string; error: string }>> => {
  const results: Array<any> = [];

  for (const doc of documents) {
    try {
      const result = await parseDocument(doc.storageKey, doc.mimeType, doc.filename);
      results.push({ storageKey: doc.storageKey, result });
    } catch (error: any) {
      results.push({
        storageKey: doc.storageKey,
        error: error.message,
      });
    }
  }

  return results;
};
