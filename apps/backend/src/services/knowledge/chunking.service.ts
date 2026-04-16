/**
 * 知识切分服务
 * 将文档内容切分为适合向量化的片段
 */

import { logger } from '../../utils/logger';
import { ParsedDocument, PageContent } from './document-parser.service';

export interface ChunkingOptions {
  /** 每个片段的目标字符数 */
  chunkSize?: number;
  /** 片段间重叠字符数 */
  overlap?: number;
  /** 最小片段字符数（小于该值的片段会合并） */
  minChunkSize?: number;
  /** 是否按段落切分 */
  byParagraph?: boolean;
}

export interface KnowledgeChunk {
  /** 片段内容 */
  content: string;
  /** 元数据 */
  metadata: ChunkMetadata;
  /** 片段索引 */
  index: number;
}

export interface ChunkMetadata {
  /** 来源文档 ID */
  documentId?: string;
  /** 页码 */
  pageNumber?: number;
  /** 段落索引 */
  paragraphIndex?: number;
  /** 片段在文档中的起始位置 */
  startPosition?: number;
  /** 片段在文档中的结束位置 */
  endPosition?: number;
  /** 标题（如果有） */
  title?: string;
  /** 切分策略 */
  chunkingStrategy: string;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  chunkSize: 800, // 每段 800 字符（500-1000 范围）
  overlap: 200,   // 重叠 200 字符
  minChunkSize: 300,
  byParagraph: true,
};

/**
 * 按段落切分
 */
const splitByParagraph = (text: string): string[] => {
  // 按双换行符分割段落
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map(p => p.trim());
};

/**
 * 按固定大小切分（带重叠窗口）
 */
const splitBySize = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // 如果不是最后一片，尝试在句子边界处切断
    if (end < text.length) {
      // 向前查找句子结束符
      const lastSentenceEnd = Math.max(
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('。'),
        chunk.lastIndexOf('!'),
        chunk.lastIndexOf('！'),
        chunk.lastIndexOf('?'),
        chunk.lastIndexOf('？'),
        chunk.lastIndexOf('\n')
      );

      if (lastSentenceEnd > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastSentenceEnd + 1);
      }
    }

    chunks.push(chunk.trim());
    start = end - overlap;

    // 防止无限循环
    if (start >= end) {
      start = end;
    }
  }

  return chunks;
};

/**
 * 按标题切分
 */
const splitByHeading = (text: string): Array<{ title: string; content: string }> => {
  const sections: Array<{ title: string; content: string }> = [];
  
  // 匹配 Markdown 标题或常见标题格式
  const headingRegex = /^(#{1,6}\s+.+)$/gm;
  const matches = Array.from(text.matchAll(headingRegex));

  if (matches.length === 0) {
    // 没有标题，返回整个文本
    return [{ title: '', content: text }];
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    
    const title = match[1].replace(/^#+\s*/, '').trim();
    const start = match.index! + match[0].length;
    const end = nextMatch ? nextMatch.index! : text.length;
    
    const content = text.slice(start, end).trim();
    
    if (content) {
      sections.push({ title, content });
    }
  }

  return sections;
};

/**
 * 提取文本中的标题
 */
const extractTitle = (text: string): string | undefined => {
  // 尝试匹配第一行作为标题
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 100 && !firstLine.match(/^[0-9]/)) {
    return firstLine.replace(/^#+\s*/, '');
  }
  return undefined;
};

/**
 * 智能切分文档
 * 优先按标题，其次按段落，最后按固定大小
 */
export const chunkDocument = (
  parsedDoc: ParsedDocument,
  options: ChunkingOptions = {}
): KnowledgeChunk[] => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const chunks: KnowledgeChunk[] = [];
  let globalIndex = 0;

  logger.info('开始切分文档', {
    wordCount: parsedDoc.metadata.wordCount,
    pageCount: parsedDoc.pages?.length,
    config,
  });

  // 如果有页面信息，按页面处理
  if (parsedDoc.pages && parsedDoc.pages.length > 0) {
    for (const page of parsedDoc.pages) {
      const pageChunks = chunkText(page.content, config, {
        pageNumber: page.pageNumber,
        documentId: parsedDoc.metadata.title,
      });
      
      chunks.push(...pageChunks.map(chunk => ({
        ...chunk,
        index: globalIndex++,
      })));
    }
  } else {
    // 直接处理整个文档
    const docChunks = chunkText(parsedDoc.content, config, {
      documentId: parsedDoc.metadata.title,
    });
    
    chunks.push(...docChunks.map(chunk => ({
      ...chunk,
      index: globalIndex++,
    })));
  }

  logger.info('文档切分完成', {
    totalChunks: chunks.length,
    avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length),
  });

  return chunks;
};

/**
 * 切分文本
 */
const chunkText = (
  text: string,
  config: Required<ChunkingOptions>,
  baseMetadata: Partial<ChunkMetadata>
): Omit<KnowledgeChunk, 'index'>[] => {
  const chunks: Omit<KnowledgeChunk, 'index'>[] = [];
  
  // 1. 尝试按标题切分
  const sections = splitByHeading(text);
  
  if (sections.length > 1) {
    // 有多个标题，按标题切分
    for (const section of sections) {
      // 如果章节仍然太大，继续切分
      if (section.content.length > config.chunkSize) {
        const subChunks = splitBySize(section.content, config.chunkSize, config.overlap);
        chunks.push(...subChunks.map(content => ({
          content,
          metadata: {
            ...baseMetadata,
            title: section.title || undefined,
            chunkingStrategy: 'heading+size',
          } as ChunkMetadata,
        })));
      } else if (section.content.length >= config.minChunkSize) {
        chunks.push({
          content: section.content,
          metadata: {
            ...baseMetadata,
            title: section.title || undefined,
            chunkingStrategy: 'heading',
          } as ChunkMetadata,
        });
      }
    }
  } else if (config.byParagraph) {
    // 2. 按段落切分
    const paragraphs = splitByParagraph(text);
    let currentChunk = '';
    let paragraphIndices: number[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      if (currentChunk.length + paragraph.length <= config.chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        paragraphIndices.push(i);
      } else {
        // 当前片段已满，保存并开始新片段
        if (currentChunk.length >= config.minChunkSize) {
          chunks.push({
            content: currentChunk,
            metadata: {
              ...baseMetadata,
              paragraphIndex: paragraphIndices[0],
              chunkingStrategy: 'paragraph',
            } as ChunkMetadata,
          });
        }
        
        // 如果段落本身超过 chunkSize，使用重叠窗口切分
        if (paragraph.length > config.chunkSize) {
          const subChunks = splitBySize(paragraph, config.chunkSize, config.overlap);
          chunks.push(...subChunks.map(content => ({
            content,
            metadata: {
              ...baseMetadata,
              paragraphIndex: i,
              chunkingStrategy: 'paragraph+size',
            } as ChunkMetadata,
          })));
          currentChunk = '';
          paragraphIndices = [];
        } else {
          currentChunk = paragraph;
          paragraphIndices = [i];
        }
      }
    }

    // 添加最后一个片段
    if (currentChunk.length >= config.minChunkSize) {
      chunks.push({
        content: currentChunk,
        metadata: {
          ...baseMetadata,
          paragraphIndex: paragraphIndices[0],
          chunkingStrategy: 'paragraph',
        } as ChunkMetadata,
      });
    }
  } else {
    // 3. 直接按固定大小切分
    const chunks_ = splitBySize(text, config.chunkSize, config.overlap);
    chunks.push(...chunks_.map(content => ({
      content,
      metadata: {
        ...baseMetadata,
        chunkingStrategy: 'size',
      } as ChunkMetadata,
    })));
  }

  // 合并过小的片段
  return mergeSmallChunks(chunks, config.minChunkSize);
};

/**
 * 合并过小的片段
 */
const mergeSmallChunks = (
  chunks: Omit<KnowledgeChunk, 'index'>[],
  minSize: number
): Omit<KnowledgeChunk, 'index'>[] => {
  if (chunks.length <= 1) return chunks;

  const merged: Omit<KnowledgeChunk, 'index'>[] = [];
  let current = { ...chunks[0] };

  for (let i = 1; i < chunks.length; i++) {
    if (current.content.length < minSize) {
      // 合并到当前片段
      current.content += '\n\n' + chunks[i].content;
      current.metadata = {
        ...current.metadata,
        chunkingStrategy: `${current.metadata.chunkingStrategy}+merged`,
      };
    } else {
      merged.push(current);
      current = { ...chunks[i] };
    }
  }

  // 添加最后一个片段
  if (current.content) {
    merged.push(current);
  }

  return merged;
};

/**
 * 为片段添加元数据
 */
export const enrichChunkMetadata = (
  chunk: KnowledgeChunk,
  documentId: string,
  knowledgeBaseId: string
): KnowledgeChunk => {
  return {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      documentId,
      knowledgeBaseId,
    },
  };
};
