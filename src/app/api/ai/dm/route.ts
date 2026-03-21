import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';

// AI主持人 - 流式输出
export async function POST(request: NextRequest) {
  try {
    const { 
      roomId, 
      sessionId,
      gameState,
      dialogHistory,
      playerAction,
      characters,
      scenarioName 
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const knowledgeClient = new KnowledgeClient(config, customHeaders);

    // 搜索规则书中相关内容
    let ruleContext = '';
    const searchQueries = [
      playerAction,
      scenarioName,
      '假面骑士TRPG规则',
    ];

    for (const query of searchQueries) {
      if (query) {
        const searchResponse = await knowledgeClient.search(
          query,
          ['kamen_rider_trpg_rulebook'],
          3,
          0.5
        );
        
        if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
          ruleContext += searchResponse.chunks
            .map(chunk => chunk.content)
            .join('\n\n') + '\n\n';
        }
      }
    }

    // 构建角色信息
    const charactersInfo = characters?.map((c: { name: string; title?: string; attributes?: Record<string, number> }) => {
      return `【${c.name}】${c.title || ''}
属性：${c.attributes ? JSON.stringify(c.attributes) : '未设置'}`;
    }).join('\n') || '无角色信息';

    // 系统提示词
    const systemPrompt = `你是假面骑士TRPG游戏的主持人(DM/地下城主)。

## 核心职责
1. 讲述故事、描述场景，营造假面骑士的氛围
2. 扮演所有NPC（友好的盟友、邪恶的反派、中立的旁观者）
3. 根据玩家行动推进剧情
4. 在需要时要求玩家进行骰子检定
5. 公正地裁决结果，同时保持游戏的趣味性

## 当前游戏状态
剧本：${scenarioName || '未设定'}
${gameState ? `场景：${JSON.stringify(gameState, null, 2)}` : ''}

## 玩家角色
${charactersInfo}

## 对话历史
${dialogHistory?.slice(-10).map((m: { role: string; content: string }) => 
  `${m.role === 'user' ? '玩家' : 'DM'}: ${m.content}`
).join('\n') || '无历史对话'}

## 规则书参考
${ruleContext || '暂无相关规则'}

## 行为准则
1. **严格遵守规则书**：在进行判定、描述世界观时，必须基于规则书内容
2. **叙事生动**：用生动的语言描述场景，让玩家身临其境
3. **鼓励互动**：给予玩家选择和行动的空间
4. **公平判定**：需要骰子检定时，明确告知玩家需要检定的属性和难度
5. **保持节奏**：不要一次输出太多内容，给玩家回应的机会

## 输出格式
- 描述场景时使用【场景】标记
- NPC对话使用【NPC名】标记
- 需要检定时使用【检定】标记，格式为：【检定】需要进行XX检定，难度X
- 推进剧情时自然过渡`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: playerAction || '请开始游戏' }
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = llmClient.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.9,
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
    console.error('AI主持人错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
