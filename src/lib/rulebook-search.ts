/**
 * 规则书检索工具
 * 使用本地文件搜索规则书内容
 * 
 * 核心原则：优先检索基础扩展【假面舞会】的规则
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// 【假面舞会】核心规则行号范围定义
// 基于规则书目录结构，【假面舞会】是基础扩展，位于规则书开头部分
// ============================================================================

/**
 * 规则书分段信息（基于目录结构）
 * 每段约158,329字符，对应约5000行
 */
export const RULEBOOK_SEGMENTS = {
  SEGMENT_01: { start: 1, end: 5000, desc: '基础扩展【假面舞会】、种族规则' },
  SEGMENT_02: { start: 5001, end: 10000, desc: '变身系统规则（龙骑/Blade/响鬼）' },
  SEGMENT_03: { start: 10001, end: 15000, desc: '战斗系统规则（Kabuto/Clock Up）' },
  SEGMENT_04: { start: 15001, end: 20000, desc: 'OOO/Wizard规则' },
  SEGMENT_05: { start: 20001, end: 25000, desc: 'Wizard魔法/Drive规则' },
  SEGMENT_06: { start: 25001, end: 30000, desc: 'Drive变档战车/Ex-Aid规则' },
  SEGMENT_07: { start: 30001, end: 35000, desc: 'Ex-Aid Bugster规则' },
  SEGMENT_08: { start: 35001, end: 40000, desc: 'Build满装瓶规则' },
  SEGMENT_09: { start: 40001, end: 45000, desc: 'Kiva时间列车规则' },
  SEGMENT_10: { start: 45001, end: 50000, desc: 'Decade/OOO假面驾驭规则' },
  SEGMENT_11: { start: 50001, end: 55000, desc: 'Fourze/ZECT规则' },
  SEGMENT_12: { start: 55001, end: 60000, desc: 'Zero One Progrise规则' },
  SEGMENT_13: { start: 60001, end: 65000, desc: 'Amazon规则' },
  SEGMENT_14: { start: 65001, end: 70000, desc: 'BIG O Megadeus规则' },
  SEGMENT_15: { start: 70001, end: 75000, desc: '综合规则、属性表、宝具系统' },
};

/**
 * 【假面舞会】核心规则区域（精确范围）
 */
export const MASQUERADE_RANGES = {
  // 世界观设定
  WORLD_SETTING: { start: 500, end: 1500, desc: '世界观设定' },
  
  // 角色创建规则（核心）
  CHARACTER_CREATION: { start: 6100, end: 7500, desc: '角色创建规则' },
  
  // 种族列表
  RACE_LIST: { start: 6700, end: 8500, desc: '种族列表与能力值分配' },
  
  // 职业列表
  CLASS_LIST: { start: 8500, end: 10000, desc: '职业列表' },
  
  // 基础战斗规则
  BASIC_COMBAT: { start: 10000, end: 12000, desc: '基础战斗规则' },
  
  // GM规范
  GM_RULES: { start: 82000, end: 86000, desc: 'GM规范' },
};

/**
 * 扩展规则映射表
 * 记录各骑士系统/扩展内容的规则位置
 * 当基础规则没有详细设定时，应搜索对应的扩展规则
 */
export const EXTENSION_RULES: Record<string, {
  extensionName: string;
  lineRange: { start: number; end: number };
  keywords: string[];
  description: string;
}> = {
  // 假面骑士Decade - 扩展08【时空幻境】
  'decade': {
    extensionName: '扩展08【时空幻境】',
    lineRange: { start: 44700, end: 45500 },
    keywords: ['Decade', 'decade', '假面驾驭', '驾驭驱动器', '骑士卡', 'Diend', '大修卡'],
    description: '假面驾驭系统详细规则：变身为Decade时能力值分配点视为20点，追加HP+20点，可变身为所有假面骑士'
  },
  // 假面骑士Kiva - 扩展08【时空幻境】
  'kiva': {
    extensionName: '扩展08【时空幻境】',
    lineRange: { start: 163800, end: 165000 },
    keywords: ['Kiva', 'kiva', 'Kivat', '笛哨', '城堡', '传说偶兽'],
    description: 'Kiva系统规则：使用Kivat变身，笛哨系统等'
  },
  // 假面骑士电王 - 扩展08【时空幻境】
  'den-o': {
    extensionName: '扩展08【时空幻境】',
    lineRange: { start: 163800, end: 165000 },
    keywords: ['Den-O', '电王', '异魔神', 'Toritick', '时间列车'],
    description: '电王系统规则：异魔神附身变身，时间列车等'
  },
  // 假面骑士Blade - 扩展02
  'blade': {
    extensionName: '扩展02',
    lineRange: { start: 5001, end: 10000 },
    keywords: ['Blade', 'BOARD', 'Undead', '觉醒卡', '封印'],
    description: '觉醒卡系统规则：使用Undead封印卡变身'
  },
  // 假面骑士Kabuto - 扩展03
  'kabuto': {
    extensionName: '扩展03',
    lineRange: { start: 10001, end: 15000 },
    keywords: ['Kabuto', 'Zecter', 'Cast Off', 'Clock Up', 'ZECT'],
    description: 'Zecter系统规则：Cast Off变身，Clock Up超加速'
  },
  // 假面骑士OOO - 扩展04
  'ooo': {
    extensionName: '扩展04',
    lineRange: { start: 15001, end: 20000 },
    keywords: ['OOO', '核心硬币', 'Greeed', '细胞驱动器', '硬币组合'],
    description: '硬币系统规则：使用核心硬币变身，不同组合获得不同能力'
  },
  // 假面骑士Wizard - 扩展05
  'wizard': {
    extensionName: '扩展05',
    lineRange: { start: 20001, end: 25000 },
    keywords: ['Wizard', '魔法', 'Phantom', '魔法戒指', '魔力'],
    description: '魔法系统规则：使用魔法戒指，Phantom力量'
  },
  // 假面骑士Drive - 扩展06
  'drive': {
    extensionName: '扩展06',
    lineRange: { start: 25001, end: 30000 },
    keywords: ['Drive', 'Roidmude', '变档战车', '重加速'],
    description: '变档战车系统规则：使用变档战车变身'
  },
  // 假面骑士Ex-Aid - 扩展07
  'ex-aid': {
    extensionName: '扩展07',
    lineRange: { start: 30001, end: 35000 },
    keywords: ['Ex-Aid', 'Bugster', '卡带', '游戏驱动器', '玩家'],
    description: '卡带系统规则：使用游戏卡带变身，Bugster相关'
  },
  // 假面骑士Build - 扩展08
  'build': {
    extensionName: '扩展08',
    lineRange: { start: 35001, end: 40000 },
    keywords: ['Build', '满装瓶', 'Smash', 'Best Match', '危险等级'],
    description: '满装瓶系统规则：使用满装瓶变身，Best Match组合'
  },
  // 假面骑士Zi-O - 扩展08【时空幻境】
  'zi-o': {
    extensionName: '扩展08【时空幻境】',
    lineRange: { start: 44700, end: 45500 },
    keywords: ['Zi-O', '时空驱动器', 'Ridewatch', '驾驭表头'],
    description: '时空驱动器规则：使用Ridewatch变身，借用历代骑士力量'
  },
  // 假面骑士Zero-One - 扩展12
  'zero-one': {
    extensionName: '扩展12',
    lineRange: { start: 55001, end: 60000 },
    keywords: ['Zero One', 'Progrise', '秘钥', 'Humagear', '亚克'],
    description: 'Progrise系统规则：使用秘钥变身'
  },
  // 龙骑 - 扩展02
  'ryuki': {
    extensionName: '扩展02',
    lineRange: { start: 5001, end: 10000 },
    keywords: ['Ryuki', '龙骑', '镜世界', '契约兽', '降临卡'],
    description: '镜世界规则：使用降临卡与契约兽契约变身'
  },
  // 响鬼 - 扩展02
  'hibiki': {
    extensionName: '扩展02',
    lineRange: { start: 5001, end: 10000 },
    keywords: ['Hibiki', '响鬼', '音击', '鬼', '音叉'],
    description: '音击系统规则：使用音击武器战斗'
  },
  // Agito - 扩展01
  'agito': {
    extensionName: '扩展01',
    lineRange: { start: 1, end: 5000 },
    keywords: ['Agito', '觉醒', 'Unknown', '超能力', '光之力'],
    description: '觉醒系统规则：觉醒超能力变身'
  },
  // 空我 - 扩展01
  'kuuga': {
    extensionName: '扩展01',
    lineRange: { start: 1, end: 5000 },
    keywords: ['Kuuga', '空我', '古朗基', '超古代', '力量形态'],
    description: '空我形态规则：多种形态切换'
  },
  // W - 扩展04
  'w': {
    extensionName: '扩展04',
    lineRange: { start: 15001, end: 20000 },
    keywords: ['W', 'Double', '盖亚记忆体', '双重驱动器'],
    description: '盖亚记忆体规则：两种记忆体组合变身'
  },
  // Fourze - 扩展11
  'fourze': {
    extensionName: '扩展11',
    lineRange: { start: 50001, end: 55000 },
    keywords: ['Fourze', '天文开关', 'Zodiarts', '宇宙'],
    description: '天文开关规则：使用天文开关装备各种能力'
  },
  // Ghost - 扩展07
  'ghost': {
    extensionName: '扩展07',
    lineRange: { start: 30001, end: 35000 },
    keywords: ['Ghost', '眼魂', '幽灵', '伟人'],
    description: '眼魂系统规则：使用伟人眼魂变身'
  },
  // Amazon - 扩展13
  'amazon': {
    extensionName: '扩展13',
    lineRange: { start: 60001, end: 65000 },
    keywords: ['Amazon', '亚马逊', '臂环', '野生'],
    description: '亚马逊系统规则：臂环变身，野生本能'
  },
  // Faiz/555 - 基础扩展中有部分
  'faiz': {
    extensionName: '扩展01',
    lineRange: { start: 1, end: 5000 },
    keywords: ['Faiz', '555', '奥菲以诺', 'Smart Brain', '手机变身'],
    description: '奥菲以诺规则：奥菲以诺种族规则'
  },
};

/**
 * 根据关键词查找对应的扩展规则
 */
export function findExtensionRule(keyword: string): {
  extensionName: string;
  lineRange: { start: number; end: number };
  description: string;
  keywords: string[];
} | null {
  const lowerKeyword = keyword.toLowerCase();
  
  for (const [key, rule] of Object.entries(EXTENSION_RULES)) {
    // 匹配扩展名称
    if (lowerKeyword.includes(key)) {
      return {
        extensionName: rule.extensionName,
        lineRange: rule.lineRange,
        description: rule.description,
        keywords: rule.keywords,
      };
    }
    // 匹配关键词
    for (const kw of rule.keywords) {
      if (lowerKeyword.includes(kw.toLowerCase())) {
        return {
          extensionName: rule.extensionName,
          lineRange: rule.lineRange,
          description: rule.description,
          keywords: rule.keywords,
        };
      }
    }
  }
  
  return null;
}

/**
 * 检索优先级配置
 */
const SEARCH_PRIORITY = {
  // 高优先级：优先在【假面舞会】基础规则中搜索
  HIGH_PRIORITY_RANGE: { start: 500, end: 12000 },
  
  // 角色创建相关的高优先级范围
  CHARACTER_RELATED_RANGE: { start: 6000, end: 12000 },
  
  // GM相关的高优先级范围
  GM_RELATED_RANGE: { start: 82000, end: 86000 },
};

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
  priority?: 'high' | 'normal' | 'low';
  ruleType?: 'basic' | 'extended' | 'mixed';  // 规则类型：基础规则、扩展规则、混合
}

/**
 * 从规则书文件的指定行号范围搜索内容
 * @param query 搜索关键词
 * @param startLine 起始行号
 * @param endLine 结束行号
 * @param maxChunks 最大返回块数
 */
function searchInRange(
  lines: string[],
  query: string,
  startLine: number,
  endLine: number,
  maxChunks: number = 3
): string[] {
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
  
  // 在指定范围内搜索
  for (let i = startLine; i < endLine && i < lines.length && results.length < maxChunks; i++) {
    const line = lines[i].toLowerCase();
    const hasMatch = expandedKeywords.some(k => line.includes(k));
    
    if (hasMatch) {
      const start = Math.max(startLine, i - 30);
      const end = Math.min(endLine, lines.length, i + 30);
      const chunk = lines.slice(start, end).join('\n');
      
      const chunkPreview = chunk.substring(0, 100);
      if (!results.some(r => r.includes(chunkPreview))) {
        results.push(chunk);
      }
      i += 30;
    }
  }
  
  return results;
}

/**
 * 优先在【假面舞会】基础规则中搜索
 * 这是核心检索函数，实现优先级检索策略
 * 返回结果会标记规则类型：基础规则（【假面舞会】）或扩展规则
 */
function searchMasqueradeFirst(
  lines: string[],
  query: string,
  options: {
    maxChunks?: number;
    preferCharacterRules?: boolean;
    preferGMRules?: boolean;
    preferCombatRules?: boolean;
  } = {}
): { chunks: string[]; priority: 'high' | 'normal' | 'low'; ruleType: 'basic' | 'extended' | 'mixed' } {
  const { maxChunks = 5, preferCharacterRules = false, preferGMRules = false, preferCombatRules = false } = options;
  const basicChunks: string[] = [];  // 【假面舞会】基础规则
  const extendedChunks: string[] = [];  // 扩展规则
  let searchPriority: 'high' | 'normal' | 'low' = 'high';
  let ruleType: 'basic' | 'extended' | 'mixed' = 'basic';
  
  // 第一步：确定优先搜索范围
  let priorityRange = SEARCH_PRIORITY.HIGH_PRIORITY_RANGE;
  
  if (preferCharacterRules) {
    priorityRange = SEARCH_PRIORITY.CHARACTER_RELATED_RANGE;
  } else if (preferGMRules) {
    priorityRange = SEARCH_PRIORITY.GM_RELATED_RANGE;
  } else if (preferCombatRules) {
    priorityRange = { start: MASQUERADE_RANGES.BASIC_COMBAT.start, end: 15000 };
  }
  
  // 第二步：在优先范围内搜索（【假面舞会】基础规则区域）
  const priorityChunks = searchInRange(lines, query, priorityRange.start, priorityRange.end, Math.ceil(maxChunks * 0.7));
  basicChunks.push(...priorityChunks);
  
  // 第三步：如果优先范围结果不足，扩展到【假面舞会】完整范围
  if (basicChunks.length < maxChunks) {
    const extendedBasicChunks = searchInRange(
      lines, 
      query, 
      MASQUERADE_RANGES.WORLD_SETTING.start, 
      12000, 
      maxChunks - basicChunks.length
    );
    basicChunks.push(...extendedBasicChunks);
  }
  
  // 第四步：如果仍然不足，搜索扩展规则（其他骑士系列规则）
  if (basicChunks.length < maxChunks) {
    // 扩展规则主要在第2段之后（第5000行之后）
    const fullChunks = searchInRange(lines, query, 12000, lines.length, maxChunks - basicChunks.length);
    extendedChunks.push(...fullChunks);
    if (fullChunks.length > 0) {
      searchPriority = 'normal';
      ruleType = 'mixed';
    }
  }
  
  // 判断检索结果来源
  if (basicChunks.length === 0 && extendedChunks.length === 0) {
    searchPriority = 'low';
    ruleType = 'basic';
  } else if (basicChunks.length > 0 && extendedChunks.length === 0) {
    searchPriority = 'high';
    ruleType = 'basic';
  } else if (basicChunks.length > 0 && extendedChunks.length > 0) {
    searchPriority = 'high';
    ruleType = 'mixed';
  } else {
    searchPriority = 'normal';
    ruleType = 'extended';
  }
  
  // 合并结果，基础规则在前
  const allChunks = [...basicChunks, ...extendedChunks];
  
  return { chunks: allChunks, priority: searchPriority, ruleType };
}

/**
 * 从规则书文件中搜索相关内容
 * 已优化为优先检索【假面舞会】规则
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
    
    // 使用优先检索策略
    const result = searchMasqueradeFirst(lines, query, { maxChunks });
    return result.chunks;
  } catch (error) {
    console.error('文件搜索错误:', error);
    return [];
  }
}

/**
 * 按行号范围检索规则书内容
 * @param startLine 起始行号（从1开始）
 * @param endLine 结束行号（可选，默认为起始行+50）
 * @param contextLines 上下文行数（前后各显示多少行）
 */
export function searchByLineNumber(
  startLine: number,
  endLine?: number,
  contextLines: number = 10
): SearchResult {
  try {
    const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
    if (!fs.existsSync(rulebookPath)) {
      console.log('规则书文件不存在:', rulebookPath);
      return { found: false, content: '规则书文件不存在', source: 'none' };
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    // 行号从1开始，转换为数组索引（从0开始）
    const startIdx = Math.max(0, (startLine - 1) - contextLines);
    const endIdx = Math.min(totalLines, (endLine || startLine) + contextLines);
    
    // 获取指定行范围的内容
    const resultLines = lines.slice(startIdx, endIdx);
    
    // 添加行号标记
    const numberedLines = resultLines.map((line, idx) => {
      const actualLineNum = startIdx + idx + 1;
      const isTargetRange = actualLineNum >= startLine && actualLineNum <= (endLine || startLine);
      return isTargetRange ? `>>> ${actualLineNum}: ${line}` : `    ${actualLineNum}: ${line}`;
    });
    
    const resultContent = `规则书总行数: ${totalLines}
请求行号范围: ${startLine}${endLine ? ` - ${endLine}` : ''}

${numberedLines.join('\n')}

【说明】标记 >>> 的行为目标行`;

    return {
      found: true,
      content: resultContent,
      source: 'file',
    };
  } catch (error) {
    console.error('行号检索错误:', error);
    return { found: false, content: `检索失败: ${error}`, source: 'none' };
  }
}

/**
 * 解析行号请求字符串
 * 支持格式: "第6450行", "6450行", "第6450-6516行", "6450到6516行"
 */
export function parseLineRequest(query: string): { startLine: number; endLine?: number } | null {
  // 匹配 "第X行" 或 "X行"
  const singleLineMatch = query.match(/第?(\d+)\s*行/);
  if (singleLineMatch) {
    return { startLine: parseInt(singleLineMatch[1]) };
  }
  
  // 匹配 "第X到Y行" 或 "第X-Y行" 或 "X到Y行"
  const rangeMatch = query.match(/第?(\d+)\s*(?:到|-|~)\s*(\d+)\s*行/);
  if (rangeMatch) {
    return { 
      startLine: parseInt(rangeMatch[1]), 
      endLine: parseInt(rangeMatch[2]) 
    };
  }
  
  // 匹配纯数字（假设为行号）
  const numberMatch = query.match(/^(\d+)$/);
  if (numberMatch) {
    return { startLine: parseInt(numberMatch[1]) };
  }
  
  return null;
}

/**
 * 智能搜索规则书内容
 * 自动识别是行号搜索还是关键词搜索
 * 优先检索【假面舞会】基础规则
 */
export async function searchRulebook(
  query: string,
  options: {
    maxChunks?: number;
    minScore?: number;
    preferCharacterRules?: boolean;
    preferGMRules?: boolean;
    preferCombatRules?: boolean;
  } = {}
): Promise<SearchResult> {
  const { maxChunks = 5, preferCharacterRules = false, preferGMRules = false, preferCombatRules = false } = options;
  
  // 首先检查是否是行号请求
  const lineRequest = parseLineRequest(query);
  if (lineRequest) {
    console.log('检测到行号请求:', lineRequest);
    return searchByLineNumber(lineRequest.startLine, lineRequest.endLine);
  }
  
  // 使用优先检索策略
  try {
    const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
    if (!fs.existsSync(rulebookPath)) {
      console.log('规则书文件不存在:', rulebookPath);
      return { found: false, content: '规则书文件不存在', source: 'none' };
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    
    const result = searchMasqueradeFirst(lines, query, { 
      maxChunks, 
      preferCharacterRules, 
      preferGMRules,
      preferCombatRules 
    });
    
    if (result.chunks.length > 0) {
      // 根据规则类型添加来源标记
      let ruleTypeLabel = '';
      if (result.ruleType === 'basic') {
        ruleTypeLabel = '【基础规则 - 假面舞会】以下内容来自基础扩展【假面舞会】，是游戏的核心规则依据。\n\n';
      } else if (result.ruleType === 'extended') {
        ruleTypeLabel = '【扩展规则】以下内容来自骑士系列扩展规则，在【假面舞会】基础上使用。\n\n';
      } else {
        ruleTypeLabel = '【混合规则】以下内容包含基础规则【假面舞会】和扩展规则，优先参考基础规则。\n\n';
      }
      
      return {
        found: true,
        content: ruleTypeLabel + result.chunks.join('\n\n---\n\n'),
        source: 'file',
        chunks: result.chunks,
        priority: result.priority,
        ruleType: result.ruleType,
      };
    }
    
    return {
      found: false,
      content: '',
      source: 'none',
    };
  } catch (error) {
    console.error('规则书搜索错误:', error);
    return { found: false, content: `搜索失败: ${error}`, source: 'none' };
  }
}

/**
 * 搜索多个查询并合并结果
 * 优先检索【假面舞会】基础规则
 */
export async function searchMultipleQueries(
  queries: string[],
  options: {
    maxChunksPerQuery?: number;
    preferCharacterRules?: boolean;
    preferGMRules?: boolean;
    preferCombatRules?: boolean;
  } = {}
): Promise<SearchResult> {
  const { maxChunksPerQuery = 3, preferCharacterRules = false, preferGMRules = false, preferCombatRules = false } = options;
  
  const allChunks: string[] = [];
  const seenChunks = new Set<string>();
  
  for (const query of queries) {
    if (!query) continue;
    
    const result = await searchRulebook(query, { 
      maxChunks: maxChunksPerQuery,
      preferCharacterRules,
      preferGMRules,
      preferCombatRules,
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
 * 【优先检索】【假面舞会】的人物创建部分
 */
export async function searchCharacterCreationRules(
  specificRace?: string,
  specificClass?: string
): Promise<SearchResult> {
  // 构建优先检索【假面舞会】角色创建规则的查询
  const queries = [
    '角色制作 角色作成',
    '角色的准备 简易角色制作',
    '能力值分配点 种族',
    '假面骑士 变身 系统',
    specificRace ? `种族 ${specificRace}` : '',
    specificClass ? `职业 ${specificClass}` : '',
    '技能 特殊能力',
    'HP 计算',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { 
    maxChunksPerQuery: 2,
    preferCharacterRules: true,
  });
}

/**
 * 搜索骑士系统/变身道具相关规则
 * 【重要】首先检查扩展规则映射，如果找到对应扩展则直接搜索扩展内容
 * 如果扩展中没有，再搜索基础规则
 */
export async function searchRiderSystemRules(
  systemName?: string
): Promise<SearchResult> {
  if (!systemName) {
    // 没有指定系统名，搜索通用的骑士系统规则
    return searchMultipleQueries(['假面骑士系统 变身', '驱动器 变身道具', '骑士形态 能力'], { maxChunksPerQuery: 3 });
  }
  
  const lowerName = systemName.toLowerCase();
  
  // 第一步：检查扩展规则映射表
  const extensionRule = findExtensionRule(systemName);
  
  if (extensionRule) {
    console.log(`找到骑士系统【${systemName}】对应的扩展规则: ${extensionRule.extensionName}`);
    console.log(`规则位置: 第${extensionRule.lineRange.start}-${extensionRule.lineRange.end}行`);
    
    // 直接搜索扩展规则范围
    try {
      const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
      if (fs.existsSync(rulebookPath)) {
        const content = fs.readFileSync(rulebookPath, 'utf-8');
        const lines = content.split('\n');
        
        // 在扩展规则范围内搜索
        const extensionChunks: string[] = [];
        const keywords = [systemName, ...extensionRule.keywords.map(k => k.toLowerCase())];
        
        for (let i = extensionRule.lineRange.start; i < extensionRule.lineRange.end && i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          const hasMatch = keywords.some(k => line.includes(k.toLowerCase()));
          
          if (hasMatch) {
            const start = Math.max(extensionRule.lineRange.start, i - 30);
            const end = Math.min(extensionRule.lineRange.end, lines.length, i + 30);
            const chunk = lines.slice(start, end).join('\n');
            
            const chunkPreview = chunk.substring(0, 100);
            if (!extensionChunks.some(r => r.includes(chunkPreview))) {
              extensionChunks.push(chunk);
            }
            i += 30;
          }
          
          if (extensionChunks.length >= 5) break;
        }
        
        if (extensionChunks.length > 0) {
          return {
            found: true,
            content: `【扩展规则 - ${extensionRule.extensionName}】\n${extensionRule.description}\n\n---规则书原文---\n\n${extensionChunks.join('\n\n---\n\n')}`,
            source: 'file',
            chunks: extensionChunks,
            priority: 'high',
            ruleType: 'extended',
          };
        }
      }
    } catch (error) {
      console.error('搜索扩展规则错误:', error);
    }
  }
  
  // 第二步：扩展规则没找到，使用通用关键词搜索
  console.log(`在扩展规则映射中未找到【${systemName}】，使用通用搜索`);
  
  const queries: string[] = [];
  
  // 常见骑士系统的关键词映射（保留原有逻辑作为备选）
  const systemKeywords: Record<string, string[]> = {
    'faiz': ['Faiz', '555', 'Smart Brain', '奥菲以诺', '手机变身'],
    '555': ['Faiz', '555', 'Smart Brain', '奥菲以诺'],
    'blad': ['Blade', 'BOARD', 'Undead', '卡牌'],
    'blade': ['Blade', 'BOARD', 'Undead', '卡牌'],
    'agito': ['Agito', '觉醒', 'Unknown', '超能力'],
    'ryuki': ['Ryuki', '龙骑', '镜世界', '契约兽'],
    'hibiki': ['Hibiki', '响鬼', '音击', '鬼'],
    'kabuto': ['Kabuto', '甲斗', 'Zecter', 'Cast Off'],
    'den-o': ['Den-O', '电王', '异魔神', 'Toritick'],
    'kiva': ['Kiva', '月骑', 'Kivat', 'Fangire'],
    'double': ['W', 'Double', '双重驱动器', '盖亚记忆体'],
    'ooo': ['OOO', '硬币驱动器', '核心硬币', 'Greeed'],
    'fourze': ['Fourze', '天文开关', 'Zodiarts'],
    'wizard': ['Wizard', '魔法', 'Phantom', 'Wizard驱动器'],
    'gaim': ['Gaim', '战极驱动器', 'Lockseed', '海姆冥界'],
    'drive': ['Drive', 'Drive驱动器', 'Roidmude', '移速战车'],
    'ghost': ['Ghost', 'Ghost驱动器', '眼魂'],
    'ex-aid': ['Ex-Aid', 'Bugster', '玩家驱动器', '卡带'],
    'build': ['Build', 'Build驱动器', '满装瓶', 'Smash'],
    'zi-o': ['Zi-O', '时空驱动器', 'Ridewatch'],
    'decade': ['Decade', '假面驾驭', '驾驭驱动器', '骑士卡', 'Diend', '大修卡'],
  };
  
  // 查找匹配的系统关键词
  let matchedKeywords: string[] = [systemName];
  for (const [key, keywords] of Object.entries(systemKeywords)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      matchedKeywords = keywords;
      break;
    }
  }
  
  // 使用匹配的关键词进行搜索
  for (const keyword of matchedKeywords) {
    queries.push(keyword);
    queries.push(`${keyword} 驱动器`);
    queries.push(`${keyword} 变身`);
  }
  
  // 添加通用的骑士系统规则
  queries.push('假面骑士系统 变身');
  queries.push('驱动器 变身道具');
  queries.push('骑士形态 能力');
  
  // 去重
  const uniqueQueries = [...new Set(queries.filter(Boolean))];
  
  return searchMultipleQueries(uniqueQueries, { maxChunksPerQuery: 3 });
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
 * 【优先检索】【假面舞会】的种族规则
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
  
  const result = await searchMultipleQueries(queries, { 
    maxChunksPerQuery: 3,
    preferCharacterRules: true,
  });
  
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
 * 【优先检索】【假面舞会】的战斗规则
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
  
  return searchMultipleQueries(queries, { 
    maxChunksPerQuery: 2,
    preferCombatRules: true,
  });
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

/**
 * 搜索GM规则
 * 【优先检索】【假面舞会】的GM部分
 */
export async function searchGMRules(
  topic?: string
): Promise<SearchResult> {
  const queries = [
    'GM规范 主持人',
    'NPC管理 敌人',
    '场景控制 节奏',
    '判定调整 规则',
    topic ? topic : '',
  ].filter(Boolean);
  
  return searchMultipleQueries(queries, { 
    maxChunksPerQuery: 3,
    preferGMRules: true,
  });
}

/**
 * AI主持人专用：智能检索规则
 * 根据AI主持人的需求，优先检索【假面舞会】规则
 * 
 * @param context AI主持人的上下文（如"战斗"、"角色创建"等）
 * @param query 具体的检索内容
 */
export async function searchForAI(
  context: 'character_creation' | 'combat' | 'gm' | 'general',
  query: string
): Promise<SearchResult> {
  const options = {
    maxChunks: 5,
    preferCharacterRules: context === 'character_creation',
    preferGMRules: context === 'gm',
    preferCombatRules: context === 'combat',
  };
  
  return searchRulebook(query, options);
}

/**
 * 获取【假面舞会】核心规则摘要
 * 用于AI主持人快速了解基础规则
 */
export async function getMasqueradeCoreRules(): Promise<SearchResult> {
  // 检索【假面舞会】核心规则区域
  const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
  
  try {
    if (!fs.existsSync(rulebookPath)) {
      return { found: false, content: '规则书文件不存在', source: 'none' };
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    
    // 检索角色创建规则
    const charCreationLines = lines.slice(
      MASQUERADE_RANGES.CHARACTER_CREATION.start,
      MASQUERADE_RANGES.CHARACTER_CREATION.end
    );
    
    // 检索基础战斗规则
    const combatLines = lines.slice(
      MASQUERADE_RANGES.BASIC_COMBAT.start,
      MASQUERADE_RANGES.BASIC_COMBAT.end
    );
    
    const coreRules = `
【假面舞会】核心规则摘要

=== 角色创建规则 ===
${charCreationLines.slice(0, 100).join('\n')}

=== 基础战斗规则 ===
${combatLines.slice(0, 100).join('\n')}
`;
    
    return {
      found: true,
      content: coreRules,
      source: 'file',
    };
  } catch (error) {
    console.error('获取核心规则错误:', error);
    return { found: false, content: `获取失败: ${error}`, source: 'none' };
  }
}
