import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// 默认属性值
function getDefaultAttributes() {
  return {
    // 主能力值
    body: 4, bodyRace: 0, bodyJob: 0, bodyNormal: 4, bodyTransform: 9,
    athletics: 3, athleticsRace: 0, athleticsJob: 0, athleticsNormal: 3, athleticsTransform: 8,
    dexterity: 1, dexterityRace: 0, dexterityJob: 0, dexterityNormal: 1, dexterityTransform: 6,
    will: 1, willRace: 0, willJob: 0, willNormal: 1, willTransform: 6,
    wit: 1, witRace: 0, witJob: 0, witNormal: 1, witTransform: 6,
    // 副能力值
    movement: 6, movementRace: 0, movementJob: 0, movementNormal: 6, movementTransform: 11, movementBonus: 0,
    initiative: 1, initiativeRace: 0, initiativeJob: 0, initiativeNormal: 1, initiativeTransform: 6, initiativeBonus: 0,
    // HP
    additionalHP: 0,
    bodyHP: 20,
    totalHP: 20,
    transformHP: 45,
  };
}

// 从对话中提取角色数据
function extractCharacterData(characterData: Record<string, unknown>, messages: Message[]): Record<string, unknown> {
  const data = { ...characterData };
  
  // 从最近的对话中提取信息
  const recentMessages = messages.slice(-6);
  const text = recentMessages.map(m => m.content).join('\n');
  
  // 提取角色名
  const nameMatch = text.match(/(?:角色名|名字|名称)[：:]\s*([^\n，。！？]+)/);
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
  
  return data;
}

// AI帮助玩家创建角色卡 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { 
      characterData = {},      // 当前已确认的角色数据
      dialogHistory = [],      // 完整的对话历史
      userMessage,
      action = 'chat'          // chat | save | export
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const knowledgeClient = new KnowledgeClient(config, customHeaders);

    // 搜索规则书中关于角色创建的内容
    let ruleContext = '';
    const searchQueries = ['角色创建 属性', '假面骑士 变身', '技能 特殊能力'];
    
    for (const query of searchQueries) {
      const searchResponse = await knowledgeClient.search(
        query,
        ['kamen_rider_trpg_rulebook'],
        2,
        0.4
      );
      
      if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
        ruleContext += searchResponse.chunks.map(chunk => chunk.content).join('\n\n') + '\n\n';
      }
    }

    // 构建消息历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // 系统提示词
    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。

## 核心要求（非常重要！）
1. **逐一收集信息**：按照顺序收集以下信息，每次只问一个问题
2. **记住已提供的信息**：玩家提供的信息后，要确认并记录
3. **主动引导下一步**：确认后，问下一个需要的信息

## 角色创建流程（按顺序引导）
1. 【基本信息】角色名称 + 假面骑士称号
2. 【基本信息】年龄、性别
3. 【基本信息】种族（默认：人类）
4. 【基本信息】职业
5. 【背景】简短的背景故事（2-3句话）
6. 【属性】力量/敏捷/体质/智力/感知/魅力（默认各10点）
7. 【骑士系统】变身道具名称
8. 【骑士系统】必杀技名称
9. 【骑士系统】变身口号

## 回复格式
- 简洁友好，每次只问一个问题
- 收集到信息后，用【已记录】标记确认
- 当所有信息收集完毕，说"角色卡创建完成！"并总结

## 当前已确认的角色信息
${Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考
${ruleContext || '暂无相关规则'}`;

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
          const updatedData = extractCharacterData(characterData, allMessages);
          
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
