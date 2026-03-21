import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// AI帮助玩家创建角色卡 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { 
      characterData,      // 当前已确认的角色数据
      dialogHistory = [], // 完整的对话历史
      userMessage 
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

    // 系统提示词
    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。你需要记住玩家说的所有信息！

## 核心要求（非常重要！）
1. **记住所有信息**：玩家提供的所有信息（名字、年龄、背景、属性等）都要记住，并在后续对话中使用
2. **不要重复询问**：如果玩家已经提供了某项信息，不要再次询问
3. **主动确认**：在玩家提供信息后，确认你已记录下来
4. **引导下一步**：确认后，主动询问下一项需要的信息

## 角色创建流程（按顺序进行）
1. 角色名称 + 假面骑士称号（如：假面骑士Zero-One）
2. 年龄、性别
3. 背景故事
4. 基础属性（力量、敏捷、体质、智力、感知、魅力，每项初始10点）
5. 技能选择
6. 假面骑士系统（变身道具、必杀技、特殊能力）

## 当前已确认的角色信息
${characterData && Object.keys(characterData).length > 0 
  ? JSON.stringify(characterData, null, 2) 
  : '暂无，等待玩家提供'}

## 规则书参考
${ruleContext || '暂无相关规则'}

## 回复格式要求
1. 如果玩家提供了新信息：
   - 首先确认："好的，我记住了：[重复玩家说的内容]"
   - 然后问下一个问题
2. 如果玩家提问：
   - 根据规则书回答
   - 然后继续引导角色创建
3. 保持友好、专业的语气`;

    // 构建消息历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加对话历史（最近10轮）
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
        content: '我想创建一个假面骑士角色，请一步一步引导我完成' 
      });
    }

    // 创建流式响应
    const encoder = new TextEncoder();
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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }

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
