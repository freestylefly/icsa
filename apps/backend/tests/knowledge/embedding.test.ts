/**
 * 向量化服务单元测试
 */

import { cosineSimilarity, validateEmbedding } from '../../src/services/knowledge/embedding.service';

describe('Embedding Service', () => {
  describe('cosineSimilarity', () => {
    it('应该计算两个相同向量的相似度为 1', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0, 0];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('应该计算两个正交向量的相似度为 0', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('应该计算两个相反向量的相似度为 -1', () => {
      const vecA = [1, 0, 0];
      const vecB = [-1, 0, 0];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('应该处理不同长度的向量', () => {
      const vecA = [1, 2, 3, 4, 5];
      const vecB = [5, 4, 3, 2, 1];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该处理 1536 维向量', () => {
      const vecA = Array(1536).fill(0).map((_, i) => Math.random());
      const vecB = Array(1536).fill(0).map((_, i) => Math.random());

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('当向量维度不匹配时应抛出错误', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];

      expect(() => cosineSimilarity(vecA, vecB)).toThrow('向量维度不匹配');
    });

    it('应该处理零向量', () => {
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBe(0);
    });
  });

  describe('validateEmbedding', () => {
    it('应该验证 1536 维向量', () => {
      const embedding = Array(1536).fill(0.5);

      expect(validateEmbedding(embedding)).toBe(true);
    });

    it('应该拒绝错误维度的向量', () => {
      const embedding = Array(1000).fill(0.5);

      expect(validateEmbedding(embedding)).toBe(false);
    });

    it('应该拒绝非数组输入', () => {
      expect(validateEmbedding(null as any)).toBe(false);
      expect(validateEmbedding('string' as any)).toBe(false);
      expect(validateEmbedding({} as any)).toBe(false);
    });

    it('应该接受自定义维度', () => {
      const embedding = Array(768).fill(0.5);

      expect(validateEmbedding(embedding, 768)).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理单位向量', () => {
      const vecA = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
      const vecB = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该处理负值向量', () => {
      const vecA = [-1, -2, -3];
      const vecB = [-3, -2, -1];

      const similarity = cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });
});
