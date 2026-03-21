import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { KnowledgeClient } from 'coze-coding-dev-sdk';

// AI帮助玩家创建角色卡 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { step, characterData, userMessage } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const knowledgeClient = new KnowledgeClient(config, customHeaders);

    // 搜索规则书中关于角色创建的内容
    let ruleContext = '';
    if (userMessage) {
      const searchResponse = await knowledgeClient.search(
        `角色创建 ${userMessage}`,
        ['kamen_rider_trpg_rulebook'],
        3,
        0.5
      );
      
      if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
        ruleContext = searchResponse.chunks
          .map(chunk => chunk.content)
          .join('\n\n');
      }
    }

    // 系统提示词
    const systemPrompt = `你是一位专业的假面骑士TRPG游戏主持人(DM)，正在帮助玩家创建他们的角色卡。

## 你的职责
1. 引导玩家逐步完成角色创建
2. 根据规则书内容提供专业建议
3. 帮助玩家设计合理的角色属性和背景
4. 确保角色符合假面骑士TRPG的世界观

## 角色创建流程
1. 确定角色名称和称号（假面骑士代号）
2. 设定背景故事
3. 分配基础属性（力量、敏捷、体质、智力、感知、魅力）
4. 选择技能
5. 设定假面骑士系统（变身道具、必杀技等）

## 当前状态
${characterData ? `已创建的角色信息：\n${JSON.stringify(characterData, null, 2)}` : '刚开始创建角色'}

## 规则书参考
${ruleContext || '暂无相关规则'}

## 回复要求
1. 用中文回复
2. 每次只问一个问题，引导玩家完成下一步
3. 根据玩家的回答，给出建议和确认
4. 保持友好、耐心的语气
5. 如果玩家的问题涉及到规则，请引用规则书内容`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage || '我想创建一个假面骑士角色，请帮助我' }
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.8,
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
