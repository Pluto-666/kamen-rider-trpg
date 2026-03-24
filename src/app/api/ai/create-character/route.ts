import { NextRequest, NextResponse } from 'next/server';
import { deepSeekStream } from '@/lib/deepseek-client';
import { 
  searchCharacterCreationRules,
  searchRulebook,
  searchRaceAbilityRules,
  searchRiderSystemRules,
  parseLineRequest,
  searchByLineNumber,
  RACE_ABILITY_POINTS,
  ABILITY_TYPES
} from '@/lib/rulebook-search';

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
    ];
    return promptPatterns.some(pattern => pattern.test(str)) || str.trim().length < 2;
  };
  
  // 首先尝试从最新的 AI 回复中提取 JSON 数据
  const lastAssistantMsg = [...recentMessages].reverse().find(m => m.role === 'assistant');
  if (lastAssistantMsg) {
    const jsonData = extractJsonFromResponse(lastAssistantMsg.content);
    if (jsonData) {
      console.log('从 JSON 提取到完整角色数据:', JSON.stringify(jsonData, null, 2));
      
      // 基础字段直接合并
      const baseFields = {
        name: jsonData.name,
        playerName: jsonData.playerName,
        age: jsonData.age,
        gender: jsonData.gender,
        race: jsonData.race,
        occupation: jsonData.occupation,
        background: jsonData.background,
        attributes: jsonData.attributes,
        transformItem: jsonData.transformItem,
        finisherMove: jsonData.finisherMove,
        transformPhrase: jsonData.transformPhrase,
      };
      
      // 扩展字段 - 合并到 rider_data
      const extendedFields: Record<string, unknown> = {};
      const extendedFieldNames = [
        'skills', 'racialTraits', 'equipment', 'characterType', 
        'characterTypeFeatures', 'derivedStats', 'riderForm', 
        'combatStyle', 'finisherDamage', 'riderForm'
      ];
      
      for (const field of extendedFieldNames) {
        if (jsonData[field] !== undefined) {
          extendedFields[field] = jsonData[field];
        }
      }
      
      // 同时保留原有的 rider_data 内容
      if (jsonData.rider_data) {
        Object.assign(extendedFields, jsonData.rider_data);
      }
      
      // 构建最终的 rider_data
      const riderData: Record<string, unknown> = {
        riderSystem: jsonData.transformItem || jsonData.rider_data?.riderSystem || '',
        transformationItem: jsonData.transformItem || jsonData.rider_data?.transformationItem || '',
        finisherMoves: jsonData.finisherMove ? [jsonData.finisherMove] : (jsonData.rider_data?.finisherMoves || []),
        specialAbilities: jsonData.rider_data?.specialAbilities || [],
        transformationPhrase: jsonData.transformPhrase || jsonData.rider_data?.transformationPhrase || '',
        // 添加扩展字段
        ...extendedFields,
      };
      
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
    console.log('检索角色创建规则...');
    const raceParam = (characterData as CharacterData).race;
    const occupationParam = (characterData as CharacterData).occupation;
    const transformItemParam = (characterData as CharacterData).transformItem;
    
    // 使用新的精确种族能力值检索
    const raceAbilityResult = await searchRaceAbilityRules(raceParam);
    const ruleResult = await searchCharacterCreationRules(raceParam, occupationParam);
    
    let additionalRules = '';
    if (userMessage) {
      if (userMessage.includes('种族') || userMessage.includes('古朗基') || userMessage.includes('奥菲以诺')) {
        const raceSearch = await searchRulebook('种族 特殊能力');
        if (raceSearch.found) additionalRules += raceSearch.content + '\n\n';
      }
      if (userMessage.includes('变身') || userMessage.includes('形态')) {
        const transformSearch = await searchRulebook('变身 形态 变化');
        if (transformSearch.found) additionalRules += transformSearch.content + '\n\n';
      }
      if (userMessage.includes('技能') || userMessage.includes('能力')) {
        const skillSearch = await searchRulebook('技能列表 特殊能力');
        if (skillSearch.found) additionalRules += skillSearch.content + '\n\n';
      }
      // 检测是否提到骑士系统/驱动器
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
        const riderSystemResult = await searchRiderSystemRules(systemName || transformItemParam);
        if (riderSystemResult.found) {
          additionalRules += '【骑士系统规则】\n' + riderSystemResult.content + '\n\n';
        }
      }
    }
    
    // 如果角色数据中已有变身道具，也检索相关规则
    if (transformItemParam && !additionalRules.includes('骑士系统规则')) {
      const riderSystemResult = await searchRiderSystemRules(transformItemParam);
      if (riderSystemResult.found) {
        additionalRules += '【骑士系统规则】\n' + riderSystemResult.content + '\n\n';
      }
    }

    // 合并规则内容，行号检索结果优先，然后是种族能力值规则
    let ruleContext = '';
    
    // 如果有行号检索结果，优先展示
    if (lineSearchResult) {
      ruleContext += '【行号检索结果】\n' + lineSearchResult + '\n\n';
    }
    
    ruleContext += (raceAbilityResult.found ? raceAbilityResult.content : '') + '\n\n' + 
                   (ruleResult.found ? ruleResult.content : '') + '\n\n' + additionalRules;

    // 构建消息历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 构建种族能力值分配点参考表
    const racePointsRef = Object.entries(RACE_ABILITY_POINTS)
      .map(([race, points]) => `- ${race}: ${points}点`)
      .join('\n');

    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。

## ⚠️ 核心规则 - 必须严格遵守（违反此规则是严重错误！）

### 1. 种族能力值分配点（绝对规则）
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
4. 【基本信息】职业
5. 【背景】简短的背景故事（2-3句话）
6. 【属性】根据种族分配能力值分配点到五项属性
7. 【骑士系统】变身道具名称
8. 【骑士系统】必杀技名称
9. 【骑士系统】变身口号

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

### 角色卡完成时输出JSON格式
当所有信息收集完毕，最后输出完整的JSON：
\`\`\`json
{
  "name": "角色名",
  "playerName": "玩家名",
  "race": "种族",
  "occupation": "职业",
  "age": 年龄,
  "gender": "性别",
  "background": "背景故事",
  "attributes": {"body": 4, "athletics": 3, "dexterity": 2, "will": 2, "wit": 2},
  "transformItem": "变身道具名",
  "finisherMove": "必杀技名",
  "transformPhrase": "变身口号"
}
\`\`\`

## 当前已确认的角色信息
${Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考内容
${ruleContext || '暂无相关规则，请根据假面骑士TRPG通用规则引导'}

## ⚠️ 关于骑士系统/变身道具的说明
当玩家提到特定的骑士系统（如Faiz驱动器、Blade卡牌系统等）时：
1. 系统会自动检索规则书中相关的规则
2. 如果规则书中没有该系统的详细规则，请：
   - 诚实告知玩家"规则书中未找到该系统的详细规则"
   - 但**不要拒绝创建角色**，可以基于假面骑士系列的一般知识引导玩家
   - 让玩家提供变身道具名称、必杀技名称、变身口号等基本信息
   - 使用通用的骑士系统规则（变身形态、HP提升等）作为参考

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
