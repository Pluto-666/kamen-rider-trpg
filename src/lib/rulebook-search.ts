/**
 * 规则书检索工具
 * 提供统一的规则书搜索接口，支持知识库和文件搜索
 */

import { KnowledgeClient, Config } from 'coze-coding-dev-sdk';
import fs from 'fs';
import path from 'path';

// 规则书中的剧本模组列表（与规则书完全一致的名称）
export const SCENARIO_MODULES = [
  { name: '被扭曲的世界', keywords: ['被扭曲的世界', '扭曲', '世界', 'phantom', '沼川市'], isStarter: true },
  { name: '假面骑士部 连接未来的希望之所', keywords: ['假面骑士部', '连接未来', '希望之所', '灯志郎', '再兴'] },
  { name: '另一个 全球冻结之夜', keywords: ['全球冻结', '另一个', '冻结之夜', 'Roidmude', '重加速'] },
  { name: '镜世界疾驰之人', keywords: ['镜世界', '疾驰', 'Undead', 'BOARD', '卡牌'] },
  { name: '成为那片晴空', keywords: ['晴空', '成为', '新手模组', '入门'], isStarter: true },
  { name: 'Knights·of·the·round', keywords: ['圆桌', '骑士', '卡利巴', '圆之丘市', 'Knights', 'round'] },
  { name: '镜中映照的鬼', keywords: ['镜中', '映照', '鬼', '镜怪兽', '镜魔境'] },
  { name: '真夏夜之噩梦', keywords: ['真夏夜', '噩梦', '真夏', '学园'] },
  { name: '轮回的宿命', keywords: ['轮回', '宿命', 'Smart Brain', 'Kaixa', '流星塾'] },
];

// 检索结果接口
export interface SearchResult {
  found: boolean;
  content: string;
  source: 'knowledge' | 'file' | 'none' | 'mixed';
  chunks?: string[];
}

/**
 * 从规则书文件中搜索相关内容
 */
function searchInRulebookFile(query: string, maxChunks: number = 5): string[] {
  try {
    const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
    if (!fs.existsSync(rulebookPath)) {
      return [];
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    const results: string[] = [];
    
    // 关键词匹配 - 更宽松的匹配策略
    const keywords = query.toLowerCase()
      .replace(/[？?！!，。、]/g, ' ')
      .split(/\s+/)
      .filter(k => k.length > 1);
    
    // 额外拆分长关键词
    const expandedKeywords: string[] = [];
    for (const k of keywords) {
      expandedKeywords.push(k);
      if (k.length >= 3) {
        for (let i = 0; i <= k.length - 2; i++) {
          expandedKeywords.push(k.substring(i, i + 2));
        }
      }
    }
    
    for (let i = 0; i < lines.length && results.length < maxChunks; i++) {
      const line = lines[i].toLowerCase();
      const hasMatch = expandedKeywords.some(k => line.includes(k));
      
      if (hasMatch) {
        const start = Math.max(0, i - 30);
        const end = Math.min(lines.length, i + 30);
        const chunk = lines.slice(start, end).join('\n');
        
        const chunkPreview = chunk.substring(0, 100);
        if (!results.some(r => r.includes(chunkPreview))) {
          results.push(chunk);
        }
        i += 30;
      }
    }
    
    return results;
  } catch (error) {
    console.error('文件搜索错误:', error);
    return [];
  }
}

/**
 * 搜索规则书内容
 * 优先使用知识库，如果无结果则使用文件搜索
 */
export async function searchRulebook(
  query: string,
  options: {
    maxChunks?: number;
    minScore?: number;
    datasetName?: string;
  } = {}
): Promise<SearchResult> {
  const { maxChunks = 5, minScore = 0.2, datasetName = 'kamen_rider_trpg_rulebook' } = options;
  
  const config = new Config();
  const client = new KnowledgeClient(config);
  
  // 首先尝试知识库搜索
  try {
    const searchResponse = await client.search(
      query,
      undefined, // 搜索所有数据集
      maxChunks,
      minScore
    );
    
    if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
      return {
        found: true,
        content: searchResponse.chunks.map(c => c.content).join('\n\n---\n\n'),
        source: 'knowledge',
        chunks: searchResponse.chunks.map(c => c.content),
      };
    }
  } catch (error) {
    console.error('知识库搜索错误:', error);
  }
  
  // 如果知识库无结果，使用文件搜索
  console.log('知识库无结果，使用文件搜索备用方案');
  const fileResults = searchInRulebookFile(query, maxChunks);
  
  if (fileResults.length > 0) {
    return {
      found: true,
      content: fileResults.join('\n\n---\n\n'),
      source: 'file',
      chunks: fileResults,
    };
  }
  
  return {
    found: false,
    content: '',
    source: 'none',
  };
}

/**
 * 搜索多个查询并合并结果
 */
export async function searchMultipleQueries(
  queries: string[],
  options: {
    maxChunksPerQuery?: number;
    minScore?: number;
  } = {}
): Promise<SearchResult> {
  const { maxChunksPerQuery = 3, minScore = 0.2 } = options;
  
  const allChunks: string[] = [];
  const seenChunks = new Set<string>();
  
  for (const query of queries) {
    if (!query) continue;
    
    const result = await searchRulebook(query, {
      maxChunks: maxChunksPerQuery,
      minScore,
    });
    
    if (result.found && result.chunks) {
      for (const chunk of result.chunks) {
        const preview = chunk.substring(0, 100);
        if (!seenChunks.has(preview)) {
          seenChunks.add(preview);
          allChunks.push(chunk);
        }
      }
    }
  }
  
  if (allChunks.length > 0) {
    return {
      found: true,
      content: allChunks.join('\n\n---\n\n'),
      source: 'mixed',
      chunks: allChunks,
    };
  }
  
  return {
    found: false,
    content: '',
    source: 'none',
  };
}

/**
 * 搜索特定剧本模组
 */
export async function searchScenarioModule(scenarioName: string): Promise<SearchResult> {
  // 查找匹配的模组
  const module = SCENARIO_MODULES.find(m => 
    m.name === scenarioName || 
    m.keywords.some(k => scenarioName.includes(k))
  );
  
  if (module) {
    return searchRulebook(module.name, { maxChunks: 10, minScore: 0.1 });
  }
  
  // 如果不是预设模组，搜索自定义剧本关键词
  return searchRulebook(`剧本 ${scenarioName}`, { maxChunks: 5, minScore: 0.1 });
}

/**
 * 搜索角色创建规则
 */
export async function searchCharacterCreationRules(
  specificRace?: string,
  specificClass?: string
): Promise<SearchResult> {
  const queries = [
    '角色创建 属性',
    '假面骑士 变身 系统',
    specificRace ? `种族 ${specificRace}` : '',
    specificClass ? `职业 ${specificClass}` : '',
    '技能 特殊能力',
    'HP 计算',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { maxChunksPerQuery: 2 });
}

/**
 * 搜索战斗规则
 */
export async function searchCombatRules(
  actionType?: string
): Promise<SearchResult> {
  const queries = [
    '战斗 攻击 回合',
    '命中判定 回避判定',
    '伤害计算 HP',
    actionType ? actionType : '',
    '必杀技 技能',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { maxChunksPerQuery: 2 });
}

/**
 * 搜索检定规则
 */
export async function searchCheckRules(
  attribute?: string,
  situation?: string
): Promise<SearchResult> {
  const queries = [
    '难易度判定 成功数 失败',
    '判定骰 成功 5 6',
    '大成功 大失败',
    '能力检定 判定流程',
    '对抗判定 成功数比较',
    '判定协力 协力者',
    '剧情检定 成功条件',
    attribute ? `${attribute} 检定` : '',
    situation ? `${situation} 判定` : '',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { maxChunksPerQuery: 3 });
}

/**
 * 搜索世界观设定
 */
export async function searchWorldSetting(
  topic?: string
): Promise<SearchResult> {
  const queries = [
    '世界观 设定',
    '林多 古朗基',
    'Unknown 奥菲以诺',
    topic ? topic : '',
    '假面骑士 组织',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { maxChunksPerQuery: 2 });
}
