import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';

// 规则查询 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: '请输入查询内容' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const knowledgeClient = new KnowledgeClient(config, customHeaders);
    const llmClient = new LLMClient(config, customHeaders);

    // 搜索规则书中相关内容
    let ruleContext = '';
    const searchQueries = [query, '假面骑士TRPG规则'];
    
    for (const q of searchQueries) {
      const searchResponse = await knowledgeClient.search(
        q,
        ['kamen_rider_trpg_rulebook'],
        5,
        0.3
      );
      
      if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
        ruleContext += searchResponse.chunks
          .map(chunk => chunk.content)
          .join('\n\n') + '\n\n';
      }
    }

    // 构建消息
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content: `你是假面骑士TRPG规则书助手。你的任务是帮助玩家理解和查询游戏规则。

## 核心要求
1. 基于规则书内容回答问题，不要编造规则
2. 如果规则书中没有相关内容，诚实告知玩家
3. 引用具体的规则章节和页码（如果有）
4. 用简洁清晰的语言解释规则
5. 如果有示例，可以提供示例帮助理解

## 当前规则书内容
${ruleContext || '抱歉，没有找到相关的规则内容。'}`,
      },
      {
        role: 'user',
        content: query,
      },
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.3, // 低温度以保持准确性
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
          console.error('规则查询流式输出错误:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '查询失败' })}\n\n`));
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
    console.error('规则查询错误:', error);
    return new Response(JSON.stringify({ error: '查询失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
