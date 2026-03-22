import { NextRequest, NextResponse } from 'next/server';
import { deepSeekStream } from '@/lib/deepseek-client';
import { 
  searchCharacterCreationRules,
  searchRulebook 
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

    const ruleContext = (ruleResult.found ? ruleResult.content : '') + '\n\n' + additionalRules;

    // 构建消息历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。

## 核心职责（必须遵守！）
1. **严格遵守规则书**：所有角色创建相关的规则、属性计算必须基于规则书内容
2. **逐一收集信息**：按照顺序收集信息，每次只问一个问题
3. **记住已提供的信息**：玩家提供的信息后，要确认并记录
4. **主动引导下一步**：确认后，问下一个需要的信息
5. **引用规则书**：当玩家询问规则时，引用规则书原文或准确概述

## 角色创建流程（按顺序引导）
1. 【基本信息】角色名称 + 假面骑士称号
2. 【基本信息】年龄、性别
3. 【基本信息】种族（人类/古朗基/奥菲以诺/Unknown等）
4. 【基本信息】职业
5. 【背景】简短的背景故事（2-3句话）
6. 【属性】根据种族和职业分配初始属性
7. 【骑士系统】变身道具名称
8. 【骑士系统】必杀技名称
9. 【骑士系统】变身口号

## 重要：当玩家一次性提供大量信息时
如果玩家一次提供了多个信息，你要：
1. 确认收到的所有信息
2. 根据提供的信息计算属性值（参考规则书）
3. 补充缺失的信息（可以假设合理的默认值）
4. 在回复的最后，输出完整的角色卡数据

## 输出角色卡数据格式
当信息收集完成后，在回复最后必须输出以下格式的JSON数据：
\`\`\`json
{
  "name": "角色名称",
  "playerName": "玩家名",
  "age": 年龄数字,
  "gender": "性别",
  "race": "种族",
  "occupation": "职业",
  "background": "完整的背景故事，2-3句话",
  "attributes": {
    "body": 体力值,
    "athletics": 运动值,
    "dexterity": 器用值,
    "will": 意志值,
    "wit": 机知值,
    "hp": 生命值
  },
  "riderSystem": "假面骑士系统名称",
  "transformItem": "变身道具/驱动器名称",
  "transformPhrase": "变身口号",
  "finisherMove": "必杀技名称"
}
\`\`\`

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
