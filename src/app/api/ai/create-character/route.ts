import { NextRequest, NextResponse } from 'next/server';
import { deepSeekStream } from '@/lib/deepseek-client';
import { 
  searchCharacterCreationRules,
  searchRulebook,
  searchRaceAbilityRules,
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
  
  // 首先尝试从最新的 AI 回复中提取 JSON 数据
  const lastAssistantMsg = [...recentMessages].reverse().find(m => m.role === 'assistant');
  if (lastAssistantMsg) {
    const jsonData = extractJsonFromResponse(lastAssistantMsg.content);
    if (jsonData) {
      // JSON 数据优先级最高，直接合并
      console.log('从 JSON 提取到角色数据:', jsonData);
      return { ...data, ...jsonData };
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
  
  const bgMatch = text.match(/(?:背景|故事)[：:]\s*([^\n]+(?:\n[^\n]+)*)/);
  if (bgMatch) data.background = bgMatch[1].trim();
  
  const transformMatch = text.match(/(?:变身道具|驱动器)[：:]\s*([^\n，。！？]+)/);
  if (transformMatch) data.transformItem = transformMatch[1].trim();
  
  const finisherMatch = text.match(/(?:必杀技|终结技)[：:]\s*([^\n，。！？]+)/);
  if (finisherMatch) data.finisherMove = finisherMatch[1].trim();
  
  const phraseMatch = text.match(/(?:变身口号|口号)[：:]\s*([^\n，。！？]+)/);
  if (phraseMatch) data.transformPhrase = phraseMatch[1].trim();
  
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

    // 检索角色创建相关的规则书内容
    console.log('检索角色创建规则...');
    const raceParam = (characterData as CharacterData).race;
    const occupationParam = (characterData as CharacterData).occupation;
    
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
    }

    // 合并规则内容，种族能力值规则优先
    const ruleContext = (raceAbilityResult.found ? raceAbilityResult.content : '') + '\n\n' + 
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

## 回复规范
1. 当玩家选择种族后，必须明确说明该种族的能力值分配点数（引用规则书）
2. 帮助玩家分配点数时，要说明初始值和分配规则
3. 当玩家质疑规则时，优先查阅规则书内容，承认错误并更正

## 当前已确认的角色信息
${Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考内容
${ruleContext || '暂无相关规则，请根据假面骑士TRPG通用规则引导'}`;

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
