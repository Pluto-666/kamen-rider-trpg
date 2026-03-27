/**
 * 扣子知识库客户端
 * 用于检索用户上传的规则书和角色卡示例
 */

import { 
  KnowledgeClient, 
  Config 
} from 'coze-coding-dev-sdk';

// 知识库客户端实例
let knowledgeClient: KnowledgeClient | null = null;

/**
 * 获取知识库客户端实例
 */
function getKnowledgeClient(): KnowledgeClient {
  if (!knowledgeClient) {
    const config = new Config();
    knowledgeClient = new KnowledgeClient(config);
  }
  return knowledgeClient;
}

/**
 * 知识库搜索结果接口
 */
export interface KnowledgeSearchResult {
  success: boolean;
  content: string;
  chunks: Array<{
    content: string;
    score: number;
    doc_id: string;
  }>;
}

/**
 * 搜索知识库
 * @param query 搜索查询文本
 * @param options 搜索选项
 */
export async function searchKnowledge(
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    tableNames?: string[];
  } = {}
): Promise<KnowledgeSearchResult> {
  const { topK = 5, minScore = 0.3, tableNames } = options;
  
  try {
    const client = getKnowledgeClient();
    
    const response = await client.search(
      query,
      tableNames && tableNames.length > 0 ? tableNames : undefined,
      topK,
      minScore
    );
    
    if (response.code === 0 && response.chunks && response.chunks.length > 0) {
      // 合并搜索结果
      const content = response.chunks
        .map((chunk, index) => `[搜索结果 ${index + 1}] (相关度: ${chunk.score.toFixed(2)})\n${chunk.content}`)
        .join('\n\n---\n\n');
      
      return {
        success: true,
        content,
        chunks: response.chunks.map(chunk => ({
          content: chunk.content,
          score: chunk.score,
          doc_id: chunk.doc_id || '',
        })),
      };
    }
    
    return {
      success: false,
      content: '',
      chunks: [],
    };
  } catch (error) {
    console.error('知识库搜索错误:', error);
    return {
      success: false,
      content: `搜索失败: ${error}`,
      chunks: [],
    };
  }
}

/**
 * 搜索规则书内容
 * @param query 搜索查询
 */
export async function searchRulebookKnowledge(
  query: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库规则书:', query);
  return searchKnowledge(query, { topK: 5, minScore: 0.3 });
}

/**
 * 搜索角色卡示例
 * @param query 搜索查询
 */
export async function searchCharacterExample(
  query: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库角色卡示例:', query);
  // 搜索角色卡示例相关内容
  return searchKnowledge(`角色卡示例 ${query}`, { topK: 3, minScore: 0.3 });
}

/**
 * 搜索剧本模组
 * @param scenarioName 剧本名称
 */
export async function searchScenarioKnowledge(
  scenarioName: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库剧本:', scenarioName);
  return searchKnowledge(`剧本 ${scenarioName}`, { topK: 5, minScore: 0.3 });
}

/**
 * 搜索检定规则
 * @param checkType 检定类型
 */
export async function searchCheckKnowledge(
  checkType: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库检定规则:', checkType);
  return searchKnowledge(`检定 ${checkType}`, { topK: 3, minScore: 0.3 });
}

/**
 * 搜索战斗规则
 */
export async function searchCombatKnowledge(): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库战斗规则');
  return searchKnowledge('战斗规则 攻击 回合', { topK: 5, minScore: 0.3 });
}

/**
 * 搜索角色创建规则
 */
export async function searchCharacterCreationKnowledge(): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库角色创建规则');
  return searchKnowledge('角色创建 种族 职业 能力值', { topK: 5, minScore: 0.3 });
}

/**
 * 搜索假面骑士系统规则
 * @param systemName 骑士系统名称
 */
export async function searchRiderSystemKnowledge(
  systemName: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库骑士系统:', systemName);
  return searchKnowledge(`${systemName} 驱动器 变身 规则`, { topK: 5, minScore: 0.3 });
}
