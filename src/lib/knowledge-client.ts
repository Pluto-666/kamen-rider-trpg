/**
 * 扣子知识库客户端
 * 用于检索用户上传的规则书和角色卡示例
 * 
 * 支持全面检索所有扩展规则，包括：
 * - 基础扩展【假面舞会】
 * - 各骑士系列扩展（龙骑、Blade、Kabuto、OOO、Wizard等）
 */

import { 
  KnowledgeClient, 
  Config 
} from 'coze-coding-dev-sdk';

// 知识库客户端实例
let knowledgeClient: KnowledgeClient | null = null;

/**
 * 扩展规则定义
 * 包含各扩展的关键词、别名和检索策略
 */
export const EXTENSION_DEFINITIONS = {
  // 基础扩展
  'masquerade': {
    name: '假面舞会',
    aliases: ['Masquerade Style', '基础扩展', '假面舞会'],
    keywords: ['假面舞会', 'Masquerade', '基础规则'],
    description: '基础扩展，包含角色创建、战斗、检定等核心规则',
  },
  
  // 龙骑系扩展
  'ryuki': {
    name: '龙骑',
    aliases: ['Ryuki', '龙骑系', '镜世界'],
    keywords: ['龙骑', 'Ryuki', '镜世界', '契约兽', 'V-Buckle'],
    relatedSystems: ['龙骑驱动器', '契约卡', '镜世界'],
  },
  
  // Blade系扩展
  'blade': {
    name: 'Blade',
    aliases: ['Blade', '剑系', '觉醒卡'],
    keywords: ['Blade', '剑', '觉醒卡', 'Undead', '封印'],
    relatedSystems: ['Blay驱动器', 'Garren驱动器', '觉醒卡组'],
  },
  
  // Kabuto系扩展
  'kabuto': {
    name: 'Kabuto',
    aliases: ['Kabuto', '甲斗', 'Clock Up'],
    keywords: ['Kabuto', '甲斗', 'Clock Up', 'Zecter', 'Cast Off'],
    relatedSystems: ['Kabuto Zecter', 'Gatack Zecter', 'TheBee'],
  },
  
  // 电王系扩展
  'den-o': {
    name: '电王',
    aliases: ['Den-O', '电王', '异魔神'],
    keywords: ['Den-O', '电王', '异魔神', 'DenLiner', 'Rider Pass'],
    relatedSystems: ['电王驱动器', '异魔神附身', 'Rider Pass'],
  },
  
  // Kiva系扩展
  'kiva': {
    name: 'Kiva',
    aliases: ['Kiva', '牙王', 'Kivat'],
    keywords: ['Kiva', '牙王', 'Kivat', '城堡', '血统'],
    relatedSystems: ['Kivat驱动器', '笛哨', '城堡'],
  },
  
  // Decade系扩展（时空幻境）
  'decade': {
    name: 'Decade',
    aliases: ['Decade', '十年', '时空幻境'],
    keywords: ['Decade', '十年', 'Kamen Ride', '时空幻境', '世界破坏'],
    relatedSystems: ['Decade驱动器', 'Kamen Ride卡', 'Final Attack Ride'],
  },
  
  // W系扩展
  'double': {
    name: 'W',
    aliases: ['W', 'Double', '盖亚记忆体'],
    keywords: ['W', 'Double', '盖亚记忆体', 'Gaia Memory', '双重驱动'],
    relatedSystems: ['W驱动器', '盖亚记忆体', 'Cyclone', 'Joker'],
  },
  
  // OOO系扩展
  'ooo': {
    name: 'OOO',
    aliases: ['OOO', '欧兹', '硬币'],
    keywords: ['OOO', '欧兹', '硬币', 'Core Medal', 'Greeed', '欲望'],
    relatedSystems: ['OOO驱动器', '核心硬币', 'Greeed'],
  },
  
  // Fourze系扩展
  'fourze': {
    name: 'Fourze',
    aliases: ['Fourze', '卌骑', '天文开关'],
    keywords: ['Fourze', '卌骑', '天文开关', 'Astro Switch', '假面骑士部'],
    relatedSystems: ['Fourze驱动器', '天文开关', 'Rocket', 'Launcher'],
  },
  
  // Wizard系扩展
  'wizard': {
    name: 'Wizard',
    aliases: ['Wizard', '巫骑', '魔法'],
    keywords: ['Wizard', '巫骑', '魔法戒指', 'Wizard Ring', 'Phantom'],
    relatedSystems: ['Wizard驱动器', '魔法戒指', 'Phantom'],
  },
  
  // 铠武系扩展
  'gaim': {
    name: '铠武',
    aliases: ['Gaim', '铠武', '战极驱动器'],
    keywords: ['Gaim', '铠武', '战极驱动器', 'Lock Seed', '异域者'],
    relatedSystems: ['战极驱动器', '定锁种子', 'Overlord'],
  },
  
  // Drive系扩展
  'drive': {
    name: 'Drive',
    aliases: ['Drive', '驰骑', '变档战车'],
    keywords: ['Drive', '驰骑', '变档战车', 'Shift Car', 'Roidmude'],
    relatedSystems: ['Drive驱动器', '变档战车', 'Roidmude'],
  },
  
  // Ghost系扩展
  'ghost': {
    name: 'Ghost',
    aliases: ['Ghost', '灵骑', '眼魂'],
    keywords: ['Ghost', '灵骑', '眼魂', 'Eyecon', '英灵'],
    relatedSystems: ['Ghost驱动器', '眼魂', 'Ganma'],
  },
  
  // Ex-Aid系扩展
  'ex-aid': {
    name: 'Ex-Aid',
    aliases: ['Ex-Aid', '艾克赛德', '卡带'],
    keywords: ['Ex-Aid', '艾克赛德', '卡带', 'Gashat', 'Bugster'],
    relatedSystems: ['玩家驱动器', '卡带', 'Bugster'],
  },
  
  // Build系扩展
  'build': {
    name: 'Build',
    aliases: ['Build', '创骑', '满装瓶'],
    keywords: ['Build', '创骑', '满装瓶', 'Full Bottle', 'Smash', 'Best Match'],
    relatedSystems: ['Build驱动器', '满装瓶', 'Smash'],
  },
  
  // Zi-O系扩展
  'zi-o': {
    name: 'Zi-O',
    aliases: ['Zi-O', '时王', 'Ridewatch'],
    keywords: ['Zi-O', '时王', 'Ridewatch', '时空驱动器', 'Another Rider'],
    relatedSystems: ['时空驱动器', 'Ridewatch', 'Another Rider'],
  },
  
  // Zero-One系扩展
  'zero-one': {
    name: 'Zero-One',
    aliases: ['Zero-One', '零一', 'Progrise'],
    keywords: ['Zero-One', '零一', 'Progrise Key', 'Hiden Intelligence', 'Ark'],
    relatedSystems: ['Zero-One驱动器', 'Progrise Key', 'Magatsu'],
  },
  
  // Saber系扩展
  'saber': {
    name: 'Saber',
    aliases: ['Saber', '圣刃', '奇幻驾驭书'],
    keywords: ['Saber', '圣刃', '奇幻驾驭书', 'Wonder Ride Book', '真理之剑'],
    relatedSystems: ['圣剑驱动器', '奇幻驾驭书', 'Megid'],
  },
  
  // Revice系扩展
  'revice': {
    name: 'Revice',
    aliases: ['Revice', '利维斯', '罪恶印章'],
    keywords: ['Revice', '利维斯', '罪恶印章', 'Vistamp', '恶魔'],
    relatedSystems: ['Revice驱动器', '罪恶印章', 'Deadmans'],
  },
  
  // Geats系扩展
  'geats': {
    name: 'Geats',
    aliases: ['Geats', '极狐', 'Raise Buckle'],
    keywords: ['Geats', '极狐', 'Raise Buckle', 'Desire Grand Prix', 'DGP'],
    relatedSystems: ['欲望大奖赛驱动器', 'Raise Buckle', 'Jyamato'],
  },
  
  // Gotchard系扩展
  'gotchard': {
    name: 'Gotchard',
    aliases: ['Gotchard', '歌查德', '凯米'],
    keywords: ['Gotchard', '歌查德', 'Chemy', '凯米', '炼金术'],
    relatedSystems: ['Gotchard驱动器', '凯米卡', 'Malgam'],
  },
};

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
 * 全面搜索规则书内容
 * 同时检索基础规则和所有相关扩展规则
 * @param query 搜索查询
 * @param extensions 要检索的扩展列表（可选，默认检索所有相关扩展）
 */
export async function searchRulebookComprehensive(
  query: string,
  extensions?: string[]
): Promise<KnowledgeSearchResult> {
  console.log('全面检索知识库规则书:', query, extensions ? `指定扩展: ${extensions.join(', ')}` : '检索所有相关扩展');
  
  // 构建包含所有扩展关键词的搜索查询
  const searchQueries: string[] = [query];
  
  // 如果指定了扩展，只检索这些扩展
  if (extensions && extensions.length > 0) {
    for (const extKey of extensions) {
      const ext = EXTENSION_DEFINITIONS[extKey as keyof typeof EXTENSION_DEFINITIONS];
      if (ext) {
        searchQueries.push(`${ext.name} ${query}`);
        if (ext.keywords) {
          searchQueries.push(`${ext.keywords.join(' ')} ${query}`);
        }
      }
    }
  } else {
    // 自动检测查询中是否包含扩展关键词
    const lowerQuery = query.toLowerCase();
    for (const [key, ext] of Object.entries(EXTENSION_DEFINITIONS)) {
      // 检查查询中是否包含该扩展的关键词或别名
      const hasKeyword = ext.keywords?.some(k => lowerQuery.includes(k.toLowerCase()));
      const hasAlias = ext.aliases?.some(a => lowerQuery.includes(a.toLowerCase()));
      
      if (hasKeyword || hasAlias) {
        searchQueries.push(`${ext.name} ${query}`);
        console.log(`检测到扩展关键词，添加扩展检索: ${ext.name}`);
      }
    }
  }
  
  // 执行多个搜索查询
  const results: KnowledgeSearchResult[] = [];
  for (const searchQuery of searchQueries) {
    const result = await searchKnowledge(searchQuery, { topK: 3, minScore: 0.3 });
    if (result.success) {
      results.push(result);
    }
  }
  
  // 合并所有结果，去重
  if (results.length > 0) {
    const allChunks: Map<string, { content: string; score: number; doc_id: string }> = new Map();
    
    for (const result of results) {
      for (const chunk of result.chunks) {
        // 使用内容的前100字符作为去重键
        const key = chunk.content.substring(0, 100);
        if (!allChunks.has(key) || allChunks.get(key)!.score < chunk.score) {
          allChunks.set(key, chunk);
        }
      }
    }
    
    // 按相关度排序
    const sortedChunks = Array.from(allChunks.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // 最多返回8个结果
    
    const content = sortedChunks
      .map((chunk, index) => `[搜索结果 ${index + 1}] (相关度: ${chunk.score.toFixed(2)})\n${chunk.content}`)
      .join('\n\n---\n\n');
    
    return {
      success: true,
      content,
      chunks: sortedChunks,
    };
  }
  
  return {
    success: false,
    content: '',
    chunks: [],
  };
}

/**
 * 搜索规则书内容（向后兼容）
 * @param query 搜索查询
 */
export async function searchRulebookKnowledge(
  query: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库规则书:', query);
  // 使用全面检索
  return searchRulebookComprehensive(query);
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
 * 搜索检定规则（全面检索所有扩展）
 * @param checkType 检定类型
 */
export async function searchCheckKnowledge(
  checkType: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库检定规则（全面检索）:', checkType);
  // 全面检索检定规则，包括基础规则和各扩展的特殊检定
  return searchRulebookComprehensive(`检定 ${checkType}`);
}

/**
 * 搜索战斗规则（全面检索所有扩展）
 */
export async function searchCombatKnowledge(): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库战斗规则（全面检索）');
  // 全面检索战斗规则，包括基础规则和各扩展的特殊战斗规则
  return searchRulebookComprehensive('战斗规则 攻击 回合 伤害');
}

/**
 * 搜索角色创建规则（全面检索所有扩展）
 */
export async function searchCharacterCreationKnowledge(): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库角色创建规则（全面检索）');
  // 全面检索角色创建规则，包括基础规则和各扩展的特殊规则
  return searchRulebookComprehensive('角色创建 种族 职业 能力值');
}

/**
 * 搜索假面骑士系统规则（全面检索所有扩展）
 * @param systemName 骑士系统名称
 */
export async function searchRiderSystemKnowledge(
  systemName: string
): Promise<KnowledgeSearchResult> {
  console.log('搜索知识库骑士系统（全面检索）:', systemName);
  
  // 识别骑士系统对应的扩展
  const lowerName = systemName.toLowerCase();
  let matchedExtensions: string[] = [];
  
  for (const [key, ext] of Object.entries(EXTENSION_DEFINITIONS)) {
    // 检查系统名称是否匹配该扩展
    const hasKeyword = ext.keywords?.some((k: string) => lowerName.includes(k.toLowerCase()));
    const hasAlias = ext.aliases?.some((a: string) => lowerName.includes(a.toLowerCase()));
    const hasSystem = 'relatedSystems' in ext && ext.relatedSystems?.some((s: string) => lowerName.includes(s.toLowerCase()));
    
    if (hasKeyword || hasAlias || hasSystem) {
      matchedExtensions.push(key);
      console.log(`匹配到扩展: ${ext.name} (${key})`);
    }
  }
  
  // 如果匹配到了扩展，使用全面检索
  if (matchedExtensions.length > 0) {
    return searchRulebookComprehensive(`${systemName} 驱动器 变身 规则`, matchedExtensions);
  }
  
  // 否则进行普通检索
  return searchKnowledge(`${systemName} 驱动器 变身 规则`, { topK: 5, minScore: 0.3 });
}

/**
 * 搜索特定扩展的规则
 * @param extensionKey 扩展标识（如 'blade', 'kabuto', 'ooo' 等）
 * @param query 额外的搜索关键词
 */
export async function searchExtensionRules(
  extensionKey: string,
  query: string = ''
): Promise<KnowledgeSearchResult> {
  const ext = EXTENSION_DEFINITIONS[extensionKey as keyof typeof EXTENSION_DEFINITIONS];
  if (!ext) {
    console.warn(`未知的扩展标识: ${extensionKey}`);
    return { success: false, content: '', chunks: [] };
  }
  
  console.log(`搜索扩展【${ext.name}】规则:`, query);
  
  const searchQuery = query 
    ? `${ext.name} ${ext.keywords?.join(' ') || ''} ${query}`
    : `${ext.name} ${ext.keywords?.join(' ') || ''}`;
  
  return searchKnowledge(searchQuery, { topK: 5, minScore: 0.3 });
}

/**
 * 批量搜索多个扩展的规则
 * @param extensionKeys 扩展标识数组
 * @param query 额外的搜索关键词
 */
export async function searchMultipleExtensions(
  extensionKeys: string[],
  query: string = ''
): Promise<KnowledgeSearchResult> {
  console.log(`批量搜索 ${extensionKeys.length} 个扩展的规则:`, query);
  
  const results: KnowledgeSearchResult[] = [];
  
  for (const key of extensionKeys) {
    const result = await searchExtensionRules(key, query);
    if (result.success) {
      results.push(result);
    }
  }
  
  // 合并所有结果
  if (results.length > 0) {
    const allChunks: Map<string, { content: string; score: number; doc_id: string }> = new Map();
    
    for (const result of results) {
      for (const chunk of result.chunks) {
        const key = chunk.content.substring(0, 100);
        if (!allChunks.has(key) || allChunks.get(key)!.score < chunk.score) {
          allChunks.set(key, chunk);
        }
      }
    }
    
    const sortedChunks = Array.from(allChunks.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    const content = sortedChunks
      .map((chunk, index) => `[搜索结果 ${index + 1}] (相关度: ${chunk.score.toFixed(2)})\n${chunk.content}`)
      .join('\n\n---\n\n');
    
    return {
      success: true,
      content,
      chunks: sortedChunks,
    };
  }
  
  return {
    success: false,
    content: '',
    chunks: [],
  };
}

/**
 * 获取所有可用的扩展列表
 */
export function getAvailableExtensions(): string[] {
  return Object.keys(EXTENSION_DEFINITIONS);
}

/**
 * 获取扩展的详细信息
 * @param extensionKey 扩展标识
 */
export function getExtensionInfo(extensionKey: string): {
  name: string;
  aliases: string[];
  keywords: string[];
  description?: string;
  relatedSystems?: string[];
} | null {
  const ext = EXTENSION_DEFINITIONS[extensionKey as keyof typeof EXTENSION_DEFINITIONS];
  return ext || null;
}
