import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
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
    // 主能力值
    body: 4,
    athletics: 3,
    dexterity: 1,
    will: 1,
    wit: 1,
    // 副能力值
    movement: 6,
    initiative: 1,
    // HP
    hp: 20,
    transformHP: 45,
  };
}

// 从对话中提取角色数据
function extractCharacterData(characterData: CharacterData, messages: Message[]): CharacterData {
  const data = { ...characterData };
  
  const recentMessages = messages.slice(-6);
  const text = recentMessages.map(m => m.content).join('\n');
  
  // 提取角色名
  const nameMatch = text.match(/(?:角色名|名字|名称|假面骑士称号)[：:]\s*([^\n，。！？]+)/);
  if (nameMatch) data.name = nameMatch[1].trim();
  
  // 提取玩家名
  const playerMatch = text.match(/(?:玩家名|玩家)[：:]\s*([^\n，。！？]+)/);
  if (playerMatch) data.playerName = playerMatch[1].trim();
  
  // 提取年龄
  const ageMatch = text.match(/(?:年龄|岁)[：:]?\s*(\d+)/);
  if (ageMatch) data.age = parseInt(ageMatch[1]);
  
  // 提取性别
  const genderMatch = text.match(/(?:性别)[：:]\s*(男|女|其他)/);
  if (genderMatch) data.gender = genderMatch[1];
  
  // 提取种族
  const raceMatch = text.match(/(?:种族)[：:]\s*([^\n，。！？]+)/);
  if (raceMatch) data.race = raceMatch[1].trim();
  
  // 提取职业
  const jobMatch = text.match(/(?:职业|工作)[：:]\s*([^\n，。！？]+)/);
  if (jobMatch) data.occupation = jobMatch[1].trim();
  
  // 提取背景
  const bgMatch = text.match(/(?:背景|故事)[：:]\s*([^\n]+(?:\n[^\n]+)*)/);
  if (bgMatch) data.background = bgMatch[1].trim();
  
  // 提取变身道具
  const transformMatch = text.match(/(?:变身道具|驱动器)[：:]\s*([^\n，。！？]+)/);
  if (transformMatch) data.transformItem = transformMatch[1].trim();
  
  // 提取必杀技
  const finisherMatch = text.match(/(?:必杀技|终结技)[：:]\s*([^\n，。！？]+)/);
  if (finisherMatch) data.finisherMove = finisherMatch[1].trim();
  
  // 提取变身口号
  const phraseMatch = text.match(/(?:变身口号|口号)[：:]\s*([^\n，。！？]+)/);
  if (phraseMatch) data.transformPhrase = phraseMatch[1].trim();
  
  return data;
}

// AI帮助玩家创建角色卡 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { 
      characterData = {},
      dialogHistory = [],
      userMessage,
      action = 'chat'
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 检索角色创建相关的规则书内容
    console.log('检索角色创建规则...');
    const raceParam = (characterData as CharacterData).race;
    const occupationParam = (characterData as CharacterData).occupation;
    const ruleResult = await searchCharacterCreationRules(raceParam, occupationParam);
    
    // 如果用户提到了特定内容，额外检索
    let additionalRules = '';
    if (userMessage) {
      // 检测用户是否询问特定内容
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

    // 系统提示词
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
3. 【基本信息】种族（人类/古朗基/奥菲以诺/Unknown等，根据规则书设定）
4. 【基本信息】职业
5. 【背景】简短的背景故事（2-3句话，结合假面骑士世界观）
6. 【属性】根据种族和职业分配初始属性（参考规则书）
7. 【骑士系统】变身道具名称（如：Faiz驱动器、Decade驱动器等）
8. 【骑士系统】必杀技名称
9. 【骑士系统】变身口号

## 回复格式
- 简洁友好，每次只问一个问题
- 收集到信息后，用【已记录】标记确认
- 引用规则书时使用【规则书】标记
- 当所有信息收集完毕，说"角色卡创建完成！"并总结

## 当前已确认的角色信息
${Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考内容
${ruleContext || '暂无相关规则，请根据假面骑士TRPG通用规则引导'}

## 重要提示
- 如果玩家选择的种族有特殊规则，必须告知
- 属性分配要符合规则书的数值范围
- 必杀技和变身系统要符合假面骑士世界观`;

    messages.push({ role: 'system', content: systemPrompt });

    // 添加对话历史
    const recentHistory = (dialogHistory as Message[]).slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // 添加当前用户消息
    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    // 如果没有历史，添加初始问候
    if (messages.length === 1) {
      messages.push({ 
        role: 'user', 
        content: '我想创建一个假面骑士角色，请引导我完成' 
      });
    }

    // 创建流式响应
    const encoder = new TextEncoder();
    let fullResponse = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.7,
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }

          // 从对话中提取更新的角色数据
          const allMessages = [...recentHistory, { role: 'assistant' as const, content: fullResponse }];
          const updatedData = extractCharacterData(characterData as CharacterData, allMessages);
          
          // 发送最终的角色数据
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
