import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';
import fs from 'fs';
import path from 'path';

// 从规则书文件中搜索相关内容（备用方案）
function searchInRulebookFile(query: string, maxChunks: number = 3): string {
  try {
    const rulebookPath = path.join(process.cwd(), 'assets', '规则书.txt');
    if (!fs.existsSync(rulebookPath)) {
      return '';
    }
    
    const content = fs.readFileSync(rulebookPath, 'utf-8');
    const lines = content.split('\n');
    const results: string[] = [];
    
    // 关键词匹配 - 更宽松的匹配策略
    const keywords = query.toLowerCase()
      .replace(/[？?！!，。、]/g, ' ') // 移除标点
      .split(/\s+/)
      .filter(k => k.length > 1);
    
    // 额外拆分长关键词
    const expandedKeywords: string[] = [];
    for (const k of keywords) {
      expandedKeywords.push(k);
      // 对于长关键词，也添加子串
      if (k.length >= 3) {
        for (let i = 0; i <= k.length - 2; i++) {
          expandedKeywords.push(k.substring(i, i + 2));
        }
      }
    }
    
    for (let i = 0; i < lines.length && results.length < maxChunks; i++) {
      const line = lines[i].toLowerCase();
      // 只要有任何关键词匹配就算命中
      const hasMatch = expandedKeywords.some(k => line.includes(k));
      
      if (hasMatch) {
        // 获取上下文（前后各30行）
        const start = Math.max(0, i - 30);
        const end = Math.min(lines.length, i + 30);
        const chunk = lines.slice(start, end).join('\n');
        
        // 避免重复
        const chunkPreview = chunk.substring(0, 100);
        if (!results.some(r => r.includes(chunkPreview))) {
          results.push(chunk);
        }
        i += 30; // 跳过已添加的行
      }
    }
    
    return results.join('\n\n---\n\n');
  } catch (error) {
    console.error('文件搜索错误:', error);
    return '';
  }
}

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
    
    // 首先尝试知识库搜索
    try {
      const searchResponse = await knowledgeClient.search(
        query,
        undefined, // 不指定数据集，搜索所有知识库
        10,        // 返回更多结果
        0.2        // 降低相似度阈值以获取更多相关内容
      );
      
      if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
        ruleContext = searchResponse.chunks
          .map(chunk => chunk.content)
          .join('\n\n');
        console.log(`知识库搜索找到 ${searchResponse.chunks.length} 个相关片段`);
      }
    } catch (error) {
      console.error('知识库搜索错误:', error);
    }
    
    // 如果知识库没有结果，使用文件搜索作为备用
    if (!ruleContext) {
      console.log('知识库无结果，使用文件搜索备用方案');
      ruleContext = searchInRulebookFile(query, 3);
      if (ruleContext) {
        console.log('文件搜索找到相关内容，长度:', ruleContext.length);
        console.log('内容预览:', ruleContext.substring(0, 200));
      } else {
        console.log('文件搜索未找到相关内容');
      }
    } else {
      console.log('知识库搜索成功，内容长度:', ruleContext.length);
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
${ruleContext || '抱歉，没有找到相关的规则内容。请尝试使用更具体的关键词搜索。'}`,
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
