/**
 * 规则书检索工具
 * 使用本地文件搜索规则书内容
 */

import fs from 'fs';
import path from 'path';

// 规则书中的剧本模组列表
export const SCENARIO_MODULES = [
  { 
    name: '被扭曲的世界', 
    keywords: ['被扭曲的世界', '扭曲', '世界', 'phantom', '沼川市'], 
    isStarter: true,
    description: '沼川市出现了神秘的phantom事件，市民接连失踪。作为新手假面骑士，你需要调查真相并阻止phantom的阴谋。适合第一次接触游戏的玩家，学习基本规则和战斗流程。',
    difficulty: '简单',
    mainEnemy: 'Phantom',
    chapters: 3
  },
  { 
    name: '假面骑士部 连接未来的希望之所', 
    keywords: ['假面骑士部', '连接未来', '希望之所', '灯志郎', '再兴'],
    description: '灯志郎致力于再兴"假面骑士部"，召集年轻骑士加入。你将参与骑士部的建立，面对各种考验，成为连接未来的希望。',
    difficulty: '普通',
    mainEnemy: '未知',
    chapters: 3
  },
  { 
    name: '另一个 全球冻结之夜', 
    keywords: ['全球冻结', '另一个', '冻结之夜', 'Roidmude', '重加速'],
    description: '重加速现象再次出现，Roidmude的阴谋正在蔓延。在"另一个"全球冻结之夜，你需要揭示真相，阻止这一灾难的重演。',
    difficulty: '普通',
    mainEnemy: 'Roidmude',
    chapters: 4
  },
  { 
    name: '镜世界疾驰之人', 
    keywords: ['镜世界', '疾驰', 'Undead', 'BOARD', '卡牌'],
    description: '镜世界与现实世界的界限变得模糊，Undead的威胁正在逼近。你将作为BOARD成员，使用卡牌系统对抗敌人。',
    difficulty: '普通',
    mainEnemy: 'Undead',
    chapters: 3
  },
  { 
    name: '成为那片晴空', 
    keywords: ['晴空', '成为', '新手模组', '入门'], 
    isStarter: true,
    description: '一个关于成长与守护的故事。在追寻成为那片晴空的梦想中，你将学会何为真正的英雄。适合新手玩家入门。',
    difficulty: '简单',
    mainEnemy: '未知',
    chapters: 2
  },
  { 
    name: 'Knights·of·the·round', 
    keywords: ['圆桌', '骑士', '卡利巴', '圆之丘市', 'Knights', 'round'],
    description: '圆之丘市流传着圆桌骑士的传说。当卡利巴出现时，你将揭开古老骑士的秘密，成为新的圆桌骑士。',
    difficulty: '困难',
    mainEnemy: '卡利巴',
    chapters: 4
  },
  { 
    name: '镜中映照的鬼', 
    keywords: ['镜中', '映照', '鬼', '镜怪兽', '镜魔境'],
    description: '镜魔境中出现了一只被诅咒的鬼，它的力量正在侵蚀现实世界。你需要进入镜世界深处，解救被囚禁的灵魂。',
    difficulty: '困难',
    mainEnemy: '镜怪兽',
    chapters: 4
  },
  { 
    name: '真夏夜之噩梦', 
    keywords: ['真夏夜', '噩梦', '真夏', '学园'],
    description: '盛夏的学园发生了一连串诡异事件，学生们陷入噩梦无法醒来。你需要调查学园的秘密，从噩梦中拯救所有人。',
    difficulty: '普通',
    mainEnemy: '未知',
    chapters: 3
  },
  { 
    name: '轮回的宿命', 
    keywords: ['轮回', '宿命', 'Smart Brain', 'Kaixa', '流星塾'],
    description: 'Smart Brain的阴谋再次浮现，流星塾的学员们卷入了命运的漩涡。在轮回的宿命中，你将面临艰难的选择。',
    difficulty: '困难',
    mainEnemy: 'Smart Brain',
    chapters: 5
  },
];

// 检索结果接口
export interface SearchResult {
  found: boolean;
  content: string;
  source: 'file' | 'none';
  chunks?: string[];
}

/**
 * 从规则书文件中搜索相关内容
 */
function searchInRulebookFile(query: string, maxChunks: number = 5): string[] {
  try {
    const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
    if (!fs.existsSync(rulebookPath)) {
      console.log('规则书文件不存在:', rulebookPath);
      return [];
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    const results: string[] = [];
    
    const keywords = query.toLowerCase()
      .replace(/[？?！!，。、]/g, ' ')
      .split(/\s+/)
      .filter(k => k.length > 1);
    
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
 */
export async function searchRulebook(
  query: string,
  options: {
    maxChunks?: number;
    minScore?: number;
  } = {}
): Promise<SearchResult> {
  const { maxChunks = 5 } = options;
  
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
  } = {}
): Promise<SearchResult> {
  const { maxChunksPerQuery = 3 } = options;
  
  const allChunks: string[] = [];
  const seenChunks = new Set<string>();
  
  for (const query of queries) {
    if (!query) continue;
    
    const result = await searchRulebook(query, { maxChunks: maxChunksPerQuery });
    
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
      source: 'file',
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
  const module = SCENARIO_MODULES.find(m => 
    m.name === scenarioName || 
    m.keywords.some(k => scenarioName.includes(k))
  );
  
  if (module) {
    return searchRulebook(module.name, { maxChunks: 10 });
  }
  
  return searchRulebook(`剧本 ${scenarioName}`, { maxChunks: 5 });
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
 * 种族能力值分配点数据（从规则书提取的核心规则）
 */
export const RACE_ABILITY_POINTS: Record<string, number> = {
  '人类': 10,
  '人类（林多）': 10,
  '林多': 10,
  '古朗基': 15,
  '古朗基族': 15,
  '奥菲以诺': 15,
  'Unknown': 18,
  'Undead': 22,
  'Worm': 15,
  '异虫': 15,
  '原虫': 15,
  'Fangire': 15,
  'Fangire族': 15,
  'Kivat族': 15,
  '传说偶兽族': 15,
  '哥布林（鬼）族': 15,
  '狼人族': 13,
  '鱼人族': 13,
  '人鱼族': 13,
  '科学怪人族': 13,
  '巨人族': 13,
  '霍比特族': 13,
  '异魔神': 15,
  'Greed': 15,
  'Phantom': 15,
  '恶魔族': 15,
  'Roidmude': 15,
  '机械变异体': 15,
  'Bugster': 15,
  '崩源体': 13,
  '兽人': 15,
  '魔之国的魔人': 15,
  '克莱西斯人': 10,
  '怪魔机器人': 15,
  '怪魔异生兽': 15,
  '人造人类': 15,
  '霸主异域者': 22,
  'SOLU': 10,
  '宇宙铁人': 15,
  '傀儡': 15,
};

/**
 * 能力值种类与关联项目
 */
export const ABILITY_TYPES = {
  '肉体': '腕力、体力、强韧。近身武器的DP、HP、回避（招架）',
  '运动': '运动能力全项目，近距离武器的命中、移动',
  '器用': '灵巧度、精细操作。远距离武器的命中、DP',
  '意志': '精神力、忍耐力。精神攻击的DP、HP',
  '机知': '智力、判断力。知识判定、先制判定',
};

/**
 * 搜索种族能力值分配规则（精确搜索）
 */
export async function searchRaceAbilityRules(raceName?: string): Promise<SearchResult> {
  // 首先查找预定义的种族数据
  const abilityPoints = raceName ? RACE_ABILITY_POINTS[raceName] : undefined;
  
  // 构建精确的搜索查询
  const queries: string[] = [];
  
  if (raceName) {
    // 搜索特定种族的能力值分配点
    queries.push(`${raceName} 能力值分配点`);
    queries.push(`【${raceName}】能力值`);
    
    // 尝试不同的名称变体
    if (raceName.includes('人类') || raceName === '林多') {
      queries.push('人类（林多） 能力值分配点');
    }
    if (raceName.includes('古朗基')) {
      queries.push('古朗基族 能力值分配点');
    }
    if (raceName.includes('奥菲')) {
      queries.push('奥菲以诺 能力值分配点');
    }
  }
  
  // 添加通用的能力值分配规则
  queries.push('能力值分配点 种族');
  queries.push('能力值的种类 肉体 运动');
  
  const result = await searchMultipleQueries(queries, { maxChunksPerQuery: 3 });
  
  // 如果找到了预定义数据，添加到结果中
  if (abilityPoints !== undefined && result.found) {
    const predefinedInfo = `
【核心规则 - 种族能力值分配点】
${raceName}的能力值分配点为 ${abilityPoints} 点。

这是选择种族时获得的点数，可以自由分配到五项能力值（肉体、运动、器用、意志、机知）上。
每个能力值最少需分配1点。
`;
    return {
      ...result,
      content: predefinedInfo + '\n\n---规则书原文---\n\n' + result.content,
    };
  }
  
  return result;
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
