import { NextRequest, NextResponse } from 'next/server';
import { deepSeekStream } from '@/lib/deepseek-client';
import { 
  searchCharacterCreationRules,
  searchRulebook,
  searchRaceAbilityRules,
  searchRiderSystemRules,
  searchForAI,
  parseLineRequest,
  searchByLineNumber,
  RACE_ABILITY_POINTS,
  ABILITY_TYPES
} from '@/lib/rulebook-search';
import {
  searchRulebookComprehensive,
  searchRulebookKnowledge,
  searchCharacterCreationKnowledge,
  searchCharacterExample,
  searchRiderSystemKnowledge,
  searchExtensionRules,
  EXTENSION_DEFINITIONS,
  getAvailableExtensions,
} from '@/lib/knowledge-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CharacterData {
  name?: string;
  playerName?: string;
  age?: number;
  gender?: string;
  race?: string;
  occupation?: string;
  background?: string;
  attributes?: Record<string, number>;
  transformItem?: string;
  finisherMove?: string;
  transformPhrase?: string;
  // 扩展字段 - 用于存储AI生成的详细信息
  skills?: Record<string, number>;
  racialTraits?: string[];
  equipment?: string[];
  characterType?: string;
  characterTypeFeatures?: Record<string, unknown>;
  derivedStats?: Record<string, unknown>;
  riderForm?: Record<string, unknown>;
  combatStyle?: Record<string, unknown>;
  rider_data?: Record<string, unknown>;
  [key: string]: unknown;
}

// 默认属性值（基于规则书）
function getDefaultAttributes(): Record<string, number> {
  return {
    body: 4,
    athletics: 3,
    dexterity: 1,
    will: 1,
    wit: 1,
    movement: 6,
    initiative: 1,
    hp: 20,
    transformHP: 45,
  };
}

// 从 AI 回复中提取 JSON 格式的角色数据
function extractJsonFromResponse(response: string): CharacterData | null {
  // 查找 JSON 代码块
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      console.error('JSON 解析失败:', e);
    }
  }
  return null;
}

// 从对话中提取角色数据
// 清理字段值中的格式问题（如 "**-通常**不消耗**命运点"）
function cleanFieldValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // 移除 Markdown 格式标记
    let cleaned = value.replace(/\*\*/g, '');
    // 移除类似 "-通常不消耗命运点" 的后缀
    cleaned = cleaned.replace(/\s*[-－][^\n]*/g, '');
    // 移除引号
    cleaned = cleaned.replace(/["""]/g, '');
    // 去除首尾空格
    cleaned = cleaned.trim();
    return cleaned || undefined;
  }
  return value;
}

// 清理对象中所有字符串字段
function cleanObjectFields(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      cleaned[key] = cleanFieldValue(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(v => 
        typeof v === 'string' ? cleanFieldValue(v) : 
        typeof v === 'object' && v !== null ? cleanObjectFields(v as Record<string, unknown>) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = cleanObjectFields(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function extractCharacterData(characterData: CharacterData, messages: Message[]): CharacterData {
  const data = { ...characterData };
  const recentMessages = messages.slice(-6);
  const text = recentMessages.map(m => m.content).join('\n');
  
  // 判断是否是提示性文本（不应该被保存）
  const isPromptText = (str: string): boolean => {
    const promptPatterns = [
      /您希望/,
      /请(?:描述|填写|输入|提供)/,
      /基于您的/,
      /请用\d/,
      /简单描述/,
      /\?$/,
      /？$/,
      /叫什么名字/,
      /是什么样的/,
      /是什么/,
      /待填写/,
      /待定/,
      /暂无/,
      /^字段$/,
    ];
    return promptPatterns.some(pattern => pattern.test(str)) || str.trim().length < 2;
  };
  
  // 首先尝试从最新的 AI 回复中提取 JSON 数据
  const lastAssistantMsg = [...recentMessages].reverse().find(m => m.role === 'assistant');
  if (lastAssistantMsg) {
    const jsonData = extractJsonFromResponse(lastAssistantMsg.content);
    if (jsonData) {
      console.log('从 JSON 提取到完整角色数据:', JSON.stringify(jsonData, null, 2));
      
      // 清理所有字段值
      const cleanedJson = cleanObjectFields(jsonData);
      console.log('清理后的角色数据:', JSON.stringify(cleanedJson, null, 2));
      
      // 基础字段直接合并（清理后）
      const baseFields: Record<string, unknown> = {};
      const baseFieldNames = ['name', 'playerName', 'age', 'gender', 'race', 'occupation', 
                              'background', 'attributes', 'transformItem', 'finisherMove', 'transformPhrase'];
      for (const field of baseFieldNames) {
        if (cleanedJson[field] !== undefined && cleanedJson[field] !== null && cleanedJson[field] !== '') {
          baseFields[field] = cleanedJson[field];
        }
      }
      
      // 如果 playerName 为空或无效，设置默认值
      if (!baseFields.playerName || isPromptText(baseFields.playerName as string)) {
        baseFields.playerName = '未知玩家';
      }
      
      // 扩展字段 - 合并到 rider_data
      const extendedFields: Record<string, unknown> = {};
      const extendedFieldNames = [
        'skills', 'racialTraits', 'equipment', 'characterType', 
        'characterTypeFeatures', 'derivedStats', 'riderForm', 
        'combatStyle', 'finisherDamage'
      ];
      
      for (const field of extendedFieldNames) {
        if (cleanedJson[field] !== undefined && cleanedJson[field] !== null) {
          // 对于技能，确保格式正确
          if (field === 'skills' && typeof cleanedJson[field] === 'object') {
            const skills = cleanedJson[field] as Record<string, unknown>;
            if (Object.keys(skills).length > 0) {
              extendedFields[field] = skills;
            }
          }
          // 对于骑士形态，确保包含所有必要字段
          else if (field === 'riderForm' && typeof cleanedJson[field] === 'object') {
            const form = cleanedJson[field] as Record<string, unknown>;
            if (form.formName || form.abilities || form.finisherDamage) {
              extendedFields[field] = form;
            }
          }
          // 对于角色类型，确保值有效
          else if (field === 'characterType' && typeof cleanedJson[field] === 'string') {
            const typeValue = cleanedJson[field] as string;
            if (typeValue.includes('BA') || typeValue.includes('DA') || typeValue.includes('SA') ||
                typeValue.includes('战斗型') || typeValue.includes('戏剧型') || typeValue.includes('支援型')) {
              extendedFields[field] = typeValue;
            }
          }
          else {
            extendedFields[field] = cleanedJson[field];
          }
        }
      }
      
      // 同时保留原有的 rider_data 内容
      const existingRiderData = cleanedJson.rider_data as Record<string, unknown> | undefined;
      if (existingRiderData) {
        Object.assign(extendedFields, existingRiderData);
      }
      
      // 构建最终的 rider_data
      const riderData: Record<string, unknown> = {
        riderSystem: cleanedJson.transformItem || (existingRiderData?.riderSystem as string) || '',
        transformationItem: cleanedJson.transformItem || (existingRiderData?.transformationItem as string) || '',
        finisherMoves: cleanedJson.finisherMove ? [cleanedJson.finisherMove] : ((existingRiderData?.finisherMoves as string[]) || []),
        specialAbilities: (existingRiderData?.specialAbilities as string[]) || [],
        transformationPhrase: cleanedJson.transformPhrase || (existingRiderData?.transformationPhrase as string) || '',
        // 添加扩展字段
        ...extendedFields,
      };
      
      console.log('最终 rider_data:', JSON.stringify(riderData, null, 2));
      
      return { 
        ...data,
        ...baseFields,
        rider_data: riderData,
      };
    }
  }
  
  // 如果没有 JSON，使用正则提取
  const nameMatch = text.match(/(?:角色名|名字|名称|假面骑士称号)[：:]\s*([^\n，。！？]+)/);
  if (nameMatch) data.name = nameMatch[1].trim();
  
  const playerMatch = text.match(/(?:玩家名|玩家)[：:]\s*([^\n，。！？]+)/);
  if (playerMatch) data.playerName = playerMatch[1].trim();
  
  const ageMatch = text.match(/(?:年龄|岁)[：:]?\s*(\d+)/);
  if (ageMatch) data.age = parseInt(ageMatch[1]);
  
  const genderMatch = text.match(/(?:性别)[：:]\s*(男|女|其他)/);
  if (genderMatch) data.gender = genderMatch[1];
  
  const raceMatch = text.match(/(?:种族)[：:]\s*([^\n，。！？]+)/);
  if (raceMatch) data.race = raceMatch[1].trim();
  
  const jobMatch = text.match(/(?:职业|工作)[：:]\s*([^\n，。！？]+)/);
  if (jobMatch) data.occupation = jobMatch[1].trim();
  
  // 背景故事 - 过滤提示性文本
  const bgMatch = text.match(/(?:背景|故事)[：:]\s*([^\n]+(?:\n[^\n]+)*)/);
  if (bgMatch && !isPromptText(bgMatch[1])) {
    data.background = bgMatch[1].trim();
  }
  
  // 变身道具 - 过滤提示性文本
  const transformMatch = text.match(/(?:变身道具|驱动器|骑士系统)[：:]\s*([^\n，。！？]+)/);
  if (transformMatch && !isPromptText(transformMatch[1])) {
    data.transformItem = transformMatch[1].trim();
  }
  
  // 必杀技 - 过滤提示性文本
  const finisherMatch = text.match(/(?:必杀技|终结技)[：:]\s*([^\n，。！？]+)/);
  if (finisherMatch && !isPromptText(finisherMatch[1])) {
    data.finisherMove = finisherMatch[1].trim();
  }
  
  // 变身口号 - 过滤提示性文本
  const phraseMatch = text.match(/(?:变身口号|口号)[：:]\s*([^\n，。！？]+)/);
  if (phraseMatch && !isPromptText(phraseMatch[1])) {
    data.transformPhrase = phraseMatch[1].trim();
  }
  
  // 提取属性值（支持中文名和英文名，支持 Markdown 格式）
  const attributes: Record<string, number> = data.attributes ? { ...data.attributes } : {};
  
  // 体力/Body - 支持 Markdown 格式如 **体力**: 8
  const bodyMatch = text.match(/(?:\*\*)?(?:体力|肉体|Body)(?:\*\*)?[：:\s]*(\d+)/i);
  if (bodyMatch) attributes.body = parseInt(bodyMatch[1]);
  
  // 运动/Athletics - 注意区分"敏捷"（运动）和"敏捷度"
  const athleticsMatch = text.match(/(?:\*\*)?(?:运动|敏捷度|Athletics)(?:\*\*)?[：:\s]*(\d+)/i);
  if (athleticsMatch) attributes.athletics = parseInt(athleticsMatch[1]);
  
  // 器用/Dexterity/技巧
  const dexterityMatch = text.match(/(?:\*\*)?(?:器用|技巧|Dexterity)(?:\*\*)?[：:\s]*(\d+)/i);
  if (dexterityMatch) attributes.dexterity = parseInt(dexterityMatch[1]);
  
  // 意志/Will
  const willMatch = text.match(/(?:\*\*)?(?:意志|Will)(?:\*\*)?[：:\s]*(\d+)/i);
  if (willMatch) attributes.will = parseInt(willMatch[1]);
  
  // 机知/Wit/智力
  const witMatch = text.match(/(?:\*\*)?(?:机知|智力|Wit)(?:\*\*)?[：:\s]*(\d+)/i);
  if (witMatch) attributes.wit = parseInt(witMatch[1]);
  
  // 魅力（如果有的话）
  const charmMatch = text.match(/(?:\*\*)?(?:魅力|Charm)(?:\*\*)?[：:\s]*(\d+)/i);
  if (charmMatch) attributes.charm = parseInt(charmMatch[1]);
  
  // HP/生命值
  const hpMatch = text.match(/(?:\*\*)?(?:HP|生命值)(?:\*\*)?[：:\s]*(\d+)/i);
  if (hpMatch) attributes.hp = parseInt(hpMatch[1]);
  
  // 行动速度/移动/敏捷
  const movementMatch = text.match(/(?:\*\*)?(?:行动速度|移动力|Movement)(?:\*\*)?[：:\s]*(\d+)/i);
  if (movementMatch) attributes.movement = parseInt(movementMatch[1]);
  
  // 基础攻击力
  const attackMatch = text.match(/(?:\*\*)?(?:基础攻击力|攻击力)(?:\*\*)?[：:\s]*(\d+)/i);
  if (attackMatch) attributes.attack = parseInt(attackMatch[1]);
  
  // 基础防御力
  const defenseMatch = text.match(/(?:\*\*)?(?:基础防御力|防御力)(?:\*\*)?[：:\s]*(\d+)/i);
  if (defenseMatch) attributes.defense = parseInt(defenseMatch[1]);
  
  // 命运点
  const fateMatch = text.match(/(?:\*\*)?(?:命运点|命运点数)(?:\*\*)?[：:\s]*(\d+)/);
  if (fateMatch) attributes.fatePoints = parseInt(fateMatch[1]);
  
  // 如果有任何属性被提取到，保存
  if (Object.keys(attributes).length > 0) {
    data.attributes = attributes;
  }
  
  return data;
}

// AI帮助玩家创建角色卡 - 流式输出 (使用 DeepSeek API)
export async function POST(request: NextRequest) {
  try {
    const { 
      characterData = {},
      dialogHistory = [],
      userMessage,
    } = await request.json();

    // 首先检查是否是行号检索请求
    let lineSearchResult = '';
    if (userMessage) {
      const lineRequest = parseLineRequest(userMessage);
      if (lineRequest) {
        console.log('检测到行号检索请求:', lineRequest);
        const result = searchByLineNumber(lineRequest.startLine, lineRequest.endLine);
        if (result.found) {
          lineSearchResult = result.content;
        }
      }
    }

    // 检索角色创建相关的规则书内容
    // ⭐ 优先从扣子知识库检索，知识库无结果时回退到本地规则
    console.log('检索角色创建规则（优先知识库）...');
    const raceParam = (characterData as CharacterData).race;
    const occupationParam = (characterData as CharacterData).occupation;
    const transformItemParam = (characterData as CharacterData).transformItem;
    
    // 优先从知识库检索角色创建规则
    let ruleContext = '';
    const kbCreationResult = await searchCharacterCreationKnowledge();
    if (kbCreationResult.success && kbCreationResult.content) {
      ruleContext += '【角色创建规则（来自知识库）】\n' + kbCreationResult.content + '\n\n';
    }
    
    // 使用新的精确种族能力值检索（优先【假面舞会】）作为补充
    const raceAbilityResult = await searchRaceAbilityRules(raceParam);
    if (raceAbilityResult.found) {
      ruleContext += '【种族能力值规则】\n' + raceAbilityResult.content + '\n\n';
    }
    
    // 如果知识库没有结果，回退到本地规则
    if (!kbCreationResult.success) {
      const ruleResult = await searchForAI('character_creation', '角色制作 角色作成 能力值分配 种族 职业');
      if (ruleResult.found) {
        ruleContext += '【角色创建规则 - 优先参考【假面舞会】】\n' + ruleResult.content + '\n\n';
      }
    }
    
    // 额外规则检索（根据用户消息内容）
    let additionalRules = '';
    if (userMessage) {
      // 种族相关
      if (userMessage.includes('种族') || userMessage.includes('古朗基') || userMessage.includes('奥菲以诺')) {
        const kbRaceResult = await searchRulebookKnowledge('种族 特殊能力');
        if (kbRaceResult.success && kbRaceResult.content) {
          additionalRules += '【种族规则（来自知识库）】\n' + kbRaceResult.content + '\n\n';
        } else {
          const raceSearch = await searchForAI('character_creation', '种族 特殊能力 能力值分配');
          if (raceSearch.found) additionalRules += '【种族规则 - 优先参考【假面舞会】】\n' + raceSearch.content + '\n\n';
        }
      }
      
      // 变身/形态相关
      if (userMessage.includes('变身') || userMessage.includes('形态')) {
        const kbTransformResult = await searchRulebookKnowledge('变身 形态');
        if (kbTransformResult.success && kbTransformResult.content) {
          additionalRules += '【变身规则（来自知识库）】\n' + kbTransformResult.content + '\n\n';
        } else {
          const transformSearch = await searchForAI('general', '变身 形态 变化');
          if (transformSearch.found) additionalRules += '【变身规则 - 优先参考【假面舞会】】\n' + transformSearch.content + '\n\n';
        }
      }
      
      // 技能/能力相关
      if (userMessage.includes('技能') || userMessage.includes('能力')) {
        const kbSkillResult = await searchRulebookKnowledge('技能 特殊能力');
        if (kbSkillResult.success && kbSkillResult.content) {
          additionalRules += '【技能规则（来自知识库）】\n' + kbSkillResult.content + '\n\n';
        } else {
          const skillSearch = await searchForAI('character_creation', '技能列表 特殊能力');
          if (skillSearch.found) additionalRules += '【技能规则 - 优先参考【假面舞会】】\n' + skillSearch.content + '\n\n';
        }
      }
      
      // 检测是否提到骑士系统/驱动器 - 优先使用知识库检索
      const riderSystemKeywords = ['驱动器', '骑士系统', '变身道具', 'Faiz', 'Blade', 'Agito', 'Kabuto', 'Den-O', 'Kiva', 'Double', 'OOO', 'Fourze', 'Wizard', 'Gaim', 'Drive', 'Ghost', 'Ex-Aid', 'Build', 'Zi-O', '555', '手机', '卡牌', '腰带'];
      const hasRiderSystemMention = riderSystemKeywords.some(k => userMessage.toLowerCase().includes(k.toLowerCase()));
      if (hasRiderSystemMention) {
        // 提取可能的骑士系统名称
        let systemName = '';
        for (const keyword of riderSystemKeywords) {
          if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
            systemName = keyword;
            break;
          }
        }
        // 优先从知识库检索骑士系统规则
        const kbRiderResult = await searchRiderSystemKnowledge(systemName || transformItemParam || '');
        if (kbRiderResult.success && kbRiderResult.content) {
          additionalRules += '【骑士系统规则（来自知识库）】\n' + kbRiderResult.content + '\n\n';
        } else {
          const riderSystemResult = await searchRiderSystemRules(systemName || transformItemParam);
          if (riderSystemResult.found) {
            additionalRules += '【骑士系统规则】\n' + riderSystemResult.content + '\n\n';
          }
        }
      }
      
      // 检测是否请求角色卡示例
      if (userMessage.includes('示例') || userMessage.includes('例子') || userMessage.includes('参考')) {
        const kbExampleResult = await searchCharacterExample(userMessage);
        if (kbExampleResult.success && kbExampleResult.content) {
          additionalRules += '【角色卡示例（来自知识库）】\n' + kbExampleResult.content + '\n\n';
        }
      }
    }
    
    // 如果角色数据中已有变身道具，也检索相关规则
    if (transformItemParam && !additionalRules.includes('骑士系统规则')) {
      const kbRiderResult = await searchRiderSystemKnowledge(transformItemParam);
      if (kbRiderResult.success && kbRiderResult.content) {
        additionalRules += '【骑士系统规则（来自知识库）】\n' + kbRiderResult.content + '\n\n';
      } else {
        const riderSystemResult = await searchRiderSystemRules(transformItemParam);
        if (riderSystemResult.found) {
          additionalRules += '【骑士系统规则】\n' + riderSystemResult.content + '\n\n';
        }
      }
    }

    // 添加额外规则到规则上下文
    ruleContext += additionalRules;
    
    // 如果有行号检索结果，优先展示
    if (lineSearchResult) {
      ruleContext = '【行号检索结果】\n' + lineSearchResult + '\n\n' + ruleContext;
    }

    // 构建消息历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 构建种族能力值分配点参考表
    const racePointsRef = Object.entries(RACE_ABILITY_POINTS)
      .map(([race, points]) => `- ${race}: ${points}点`)
      .join('\n');

    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。

## ⭐⭐⭐ 规则检索与优先级体系（核心原则！必须严格遵守！）⭐⭐⭐

### 规则书结构说明
本TRPG规则书分为**基础扩展**和**系列扩展**两部分，系统会自动检索所有相关规则：

### 基础扩展：【假面舞会】(Masquerade Style)
**【假面舞会】是本TRPG的基础扩展，包含核心角色创建机制。**

【假面舞会】角色创建核心规则：
- **角色类型**：战斗型[BA]、戏剧型[DA]、支援型[SA]（只有这三种，不可编造其他类型）
- **种族选择**：人类（林多）、古朗基族、奥菲以诺、Unknown等，每种种族有固定的能力值分配点
- **职业选择**：刑警、医生、学生、记者等，影响社会地位和技能
- **能力值系统**：肉体、运动、器用、意志、机知五项属性
- **角色配置**：根据角色类型获得的特殊能力配置

### 系列扩展：各骑士系列专属规则（系统会自动检索！）
**当玩家选择特定骑士系统时，系统会自动检索对应的扩展规则。**

目前已支持的系列扩展：
- **龙骑系 (Ryuki)**：镜世界契约兽系统、V-Buckle驱动器
- **Blade系**：觉醒卡系统、Undead封印、Blay驱动器
- **Kabuto系**：Zecter系统、Cast Off/Clock Up机制
- **电王系 (Den-O)**：异魔神附身系统、Rider Pass
- **Kiva系**：Kivat蝙蝠系统、笛哨召唤
- **Decade系**：Kamen Ride变身系统、时空幻境规则
- **W系 (Double)**：盖亚记忆体系统、双重驱动、Best Match
- **OOO系**：核心硬币组合系统、Greeed力量
- **Fourze系**：天文开关系统、假面骑士部
- **Wizard系**：魔法戒指系统、Phantom力量
- **铠武系 (Gaim)**：战极驱动器、定锁种子
- **Drive系**：变档战车系统、Roidmude规则
- **Ghost系**：眼魂系统、英灵召唤
- **Ex-Aid系**：卡带系统、Bugster规则
- **Build系**：满装瓶系统、Best Match、Smash规则
- **Zi-O系**：Ridewatch系统、时空驱动
- **Zero-One系**：Progrise Key系统、人工智能
- **Saber系**：奇幻驾驭书系统、真理之剑
- **Revice系**：罪恶印章系统、恶魔契约
- **Geats系**：Raise Buckle系统、欲望大奖赛
- **Gotchard系**：凯米卡系统、炼金术
- **以及更多扩展...**

### ⭐ 规则检索机制（重要！）
**系统会根据以下情况自动检索相关规则：**

1. **玩家选择骑士系统时**：自动检索该骑士系统对应的扩展规则
2. **玩家询问特定规则时**：自动检索相关规则原文
3. **需要角色卡示例时**：自动检索知识库中的角色卡示例

**检索结果会显示来源标记：**
- 【来自知识库】表示从用户上传的规则书中检索
- 【假面舞会】表示基础扩展规则
- 【扩展XX】表示特定系列扩展规则

### ⚠️ 角色类型详解（必须严格遵守，不可编造！）

规则书中只有以下三种角色类型：

#### 战斗型 [BA]
- **定位**：在华丽的战斗场面中活跃的英雄、怪人
- **特点**：帅气地战斗，偶尔也会华丽地败北，可以让游戏的气氛高涨
- **自动取得配置**：【终结技】
- **终结技效果**：最终伤害变为2倍。但若本次攻击不能让对手HP归0时，则给予的伤害不会翻倍。无法和其他伤害倍增的配置并用。可以和【必杀技】并用。
- **活跃配置**：[战斗系]+[情热系]

#### 戏剧型 [DA]
- **定位**：故事的女主角，见证始末的少年
- **特点**：虽然不擅长战斗，但是可以在故事的关键点改变命运，为英雄送去声援
- **自动取得配置**：【约定】
- **约定效果**：可以和任意一名其他角色进行一个约定（如"一定要打倒xxx"或"保护xxx"），只有在非战斗时才能订下约定。为实现此约定的必要行动，都能追加8个【判定骰子】。这个效果无论成功还是失败都只有一次。
- **活跃配置**：[会话系]+[情热系]

#### 支援型 [SA]
- **定位**：守护着英雄背后的青年，和英雄亲近的警官
- **特点**：虽然很难大活跃一番，但是可以不论场景的大范围活动
- **自动取得配置**：【弱点看破】
- **弱点看破效果**：在战斗中使用，能否看破由GM判定。能看破时，用【机知】做难度10的【剧情判定】，合计判定成功10次就完成。成功后，对目标的命中、回避判定都视为4以上成功。
- **活跃配置**：[探索系]+[情热系]

**⚠️ 严禁编造不存在的角色类型！规则书中没有"主角型"、"助战型"、"宿敌型"、"指导型"等类型！**

### 规则适用原则
1. **全面检索优先**：系统会自动检索基础规则和所有相关扩展规则
2. **扩展规则优先适用**：当涉及特定骑士系统时，优先使用该系列的扩展规则
3. **基础规则兜底**：如果扩展规则没有涉及某个情况，使用【假面舞会】基础规则
4. **规则冲突处理**：扩展规则与基础规则冲突时，以扩展规则为准（针对该系列内容）

## ⚠️ 核心规则 - 必须严格遵守（违反此规则是严重错误！）

### 1. 种族能力值分配点（【假面舞会】基础规则）
选择种族时获得的能力值分配点数是**固定**的，绝不可随意修改：

${racePointsRef}

### 2. 能力值分配规则
- 每项能力值（肉体、运动、器用、意志、机知）**初始值为1**（这是固定基础，不占用分配点）
- 能力值分配点可以自由分配到五项能力值上
- **每个能力值最少需分配1点**（加上初始1点，最少为2）
- 能力值种类说明：
  - 【肉体】＝腕力、体力、强韧。近身武器的DP、HP、回避（招架）
  - 【运动】＝运动能力全项目，近距离武器的命中、移动
  - 【器用】＝灵巧度、精细操作。远距离武器的命中、DP
  - 【意志】＝精神力、忍耐力。精神攻击的DP、HP
  - 【机知】＝智力、判断力。知识判定、先制判定

### 3. 禁止行为
- ❌ 绝对不可以自行发明或修改种族能力值分配点数
- ❌ 绝对不可以凭空编造规则（如"基础20点"等错误说法）
- ❌ 当玩家指出规则书内容时，必须核实并承认错误

## 角色创建流程（按顺序引导）
1. 【基本信息】角色名称 + 假面骑士称号
2. 【基本信息】年龄、性别
3. 【基本信息】种族（人类/古朗基/奥菲以诺/Unknown等）→ 根据种族确定能力值分配点！
4. 【角色类型】选择战斗型[BA]、戏剧型[DA]或支援型[SA]（只有这三种！）
5. 【基本信息】职业
6. 【背景】简短的背景故事（2-3句话）
7. 【属性】根据种族分配能力值分配点到五项属性
8. 【骑士系统】变身道具名称
9. 【骑士系统】必杀技名称
10. 【骑士系统】变身口号

## ⚠️ 输出格式规范（非常重要！）

### 提问时使用问句格式，不要使用"字段名：提示文本"格式
❌ 错误示例：
"骑士系统：您希望角色变身后的骑士叫什么名字？"
"必杀技：名称：基于您的硬币组合"
"背景：请用2-3句话简单描述角色的背景。"

✅ 正确示例：
"请告诉我您希望角色变身后的骑士叫什么名字？"
"您的必杀技叫什么名字？可以基于您的硬币组合来命名。"
"请用2-3句话简单描述您角色的背景故事。"

### 确认信息时使用明确格式
✅ 正确示例：
"【已确认】骑士系统：Kamen Rider Agito"
"【已确认】必杀技：Rider Kick"
"【已确认】背景：他是一名普通的中学体育教师，某天被神秘力量选中..."

### ⚠️ 角色卡完成时输出JSON格式（非常重要！必须包含所有字段！）
当所有信息收集完毕，最后输出完整的JSON，**必须包含以下所有字段，不可遗漏任何字段**：
\`\`\`json
{
  "name": "角色名（必填）",
  "playerName": "玩家名（必填，如果玩家未提供则填写\"未知玩家\"）",
  "race": "种族（必填，如：人类/古朗基/奥菲以诺等）",
  "occupation": "职业（必填，如：刑警/医生/学生等）",
  "age": 年龄（必填，数字）,
  "gender": "性别（必填，男/女/其他）",
  "background": "背景故事（必填，2-3句话描述）",
  "attributes": {
    "body": 肉体值（必填，数字）,
    "athletics": 运动值（必填，数字）,
    "dexterity": 器用值（必填，数字）,
    "will": 意志值（必填，数字）,
    "wit": 机知值（必填，数字）,
    "movementNormal": 通常移动力（必填，数字）,
    "movementTransform": 变身移动力（必填，数字）,
    "initiativeNormal": 通常先制力（必填，数字）,
    "initiativeTransform": 变身先制力（必填，数字）,
    "totalHP": 通常HP（必填，数字）,
    "transformHP": 变身HP（必填，数字）
  },
  "transformItem": "变身道具名（必填，如：OOO驱动器）",
  "finisherMove": "必杀技名（必填）",
  "transformPhrase": "变身口号（必填）",
  "characterType": "角色类型（必填，战斗型[BA]/戏剧型[DA]/支援型[SA]）",
  "skills": {
    "技能名1": 技能等级（数字）,
    "技能名2": 技能等级（数字）
  },
  "racialTraits": ["种族特性1", "种族特性2"],
  "equipment": ["装备1", "装备2"],
  "riderForm": {
    "formName": "骑士形态名（必填）",
    "attributeBonus": {"属性名": "加值"},
    "abilities": ["形态能力1", "形态能力2"],
    "finisherDamage": "必杀伤害值"
  },
  "combatStyle": {
    "primary": "主武器",
    "secondary": "副武器",
    "specialty": "特长",
    "tactics": "战术"
  }
}
\`\`\`

### ⚠️ JSON输出检查清单（输出前必须确认！）
在输出JSON前，请检查以下所有字段是否已填写：
- [ ] name - 角色名
- [ ] playerName - 玩家名（如果玩家未提供，填写"未知玩家"）
- [ ] race - 种族
- [ ] occupation - 职业
- [ ] age - 年龄
- [ ] gender - 性别
- [ ] background - 背景故事
- [ ] attributes - 完整属性（包含所有子字段）
- [ ] transformItem - 变身道具
- [ ] finisherMove - 必杀技
- [ ] transformPhrase - 变身口号
- [ ] characterType - 角色类型
- [ ] skills - 技能列表（至少3个技能）
- [ ] riderForm - 骑士形态信息

**如果有任何字段未填写，请不要输出JSON，继续询问玩家！**

## 当前已确认的角色信息
${Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考内容（⭐ 优先参考【假面舞会】基础扩展）
${ruleContext || '暂无相关规则，请根据假面骑士TRPG通用规则引导'}

## ⚠️ 关于骑士系统/变身道具的重要说明

### ⭐ 规则书结构说明
规则书分为**基础扩展**和**系列扩展**两部分：

1. **基础扩展【假面舞会】**：
   - 角色创建基础规则（种族、职业、角色类型、能力值）
   - 基础战斗规则
   - 世界观设定

2. **系列扩展**：各骑士系列的详细规则
   - 扩展08【时空幻境】：Decade、Zi-O、Kiva、电王等
   - 扩展02：Blade、龙骑、响鬼
   - 扩展03：Kabuto
   - 扩展04：OOO、W
   - 扩展05：Wizard
   - 扩展06：Drive
   - 扩展07：Ex-Aid、Ghost
   - 扩展08：Build
   - 扩展11：Fourze
   - 扩展12：Zero One
   - 等等...

### ⭐ 骑士系统检索机制
**当玩家选择某个骑士系统时，系统会自动检索对应的扩展规则：**

- **Decade** → 扩展08【时空幻境】：能力值分配点20点，追加HP+20，可变身为所有假面骑士
- **Zi-O** → 扩展08【时空幻境】：使用Ridewatch变身
- **Kiva** → 扩展08【时空幻境】：Kivat变身系统
- **电王** → 扩展08【时空幻境】：异魔神附身系统
- **Blade** → 扩展02：觉醒卡系统
- **Kabuto** → 扩展03：Zecter、Clock Up系统
- **OOO** → 扩展04：硬币组合系统
- **W** → 扩展04：盖亚记忆体系统
- **Wizard** → 扩展05：魔法戒指系统
- **Drive** → 扩展06：变档战车系统
- **Ex-Aid** → 扩展07：卡带系统
- **Ghost** → 扩展07：眼魂系统
- **Build** → 扩展08：满装瓶系统
- **Fourze** → 扩展11：天文开关系统
- **Zero One** → 扩展12：Progrise系统
- 等等...

### ⚠️ 重要原则
1. **不要只看基础规则**：当玩家选择某个骑士系统时，系统会自动检索对应的扩展规则
2. **如果检索结果显示有详细规则**：直接使用检索到的规则，不要说"基础规则里没有"
3. **如果确实没有规则**：才告知玩家需要自行设定

### 示例对话
❌ 错误示例：
玩家："我想用Decade驱动器"
AI："抱歉，基础规则里没有Decade驱动器的详细规则..." ← 错误！应该先检索扩展规则

✅ 正确示例：
玩家："我想用Decade驱动器"
AI：（系统检索到扩展08【时空幻境】的Decade规则）
"根据扩展08【时空幻境】的规则，Decade驱动器的设定如下：
- 变身为Decade时能力值分配点视为20点
- 追加HP+20点
- 骑士卡需要另外消耗命运点取得
- 可以变身为所有假面骑士
..."

## 行号检索说明
如果玩家请求查看特定行号的内容（如"第6450行"），系统会自动检索并展示对应行的规则书原文。
你只需要将检索结果展示给玩家，并解释相关规则即可。
【重要】行号检索结果中标记 >>> 的行为目标行，前后各10行为上下文。`;

    messages.push({ role: 'system', content: systemPrompt });

    // 添加对话历史
    const recentHistory = (dialogHistory as Message[]).slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // 添加当前用户消息
    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    // 如果没有历史，添加初始问候
    if (messages.length === 1) {
      messages.push({ role: 'user', content: '我想创建一个假面骑士角色，请引导我完成' });
    }

    // 创建流式响应
    const encoder = new TextEncoder();
    let fullResponse = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of deepSeekStream(messages, {
            model: 'deepseek-chat',
            temperature: 0.7,
          })) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
          }

          // 从对话中提取更新的角色数据
          const allMessages = [...recentHistory, { role: 'assistant' as const, content: fullResponse }];
          const updatedData = extractCharacterData(characterData as CharacterData, allMessages);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'character_data',
            data: updatedData,
            isComplete: fullResponse.includes('角色卡创建完成')
          })}\n\n`));

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('AI流式输出错误:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI响应失败' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI角色创建错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
