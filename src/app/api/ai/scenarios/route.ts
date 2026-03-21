import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';

// AI推荐剧本
export async function POST(request: NextRequest) {
  try {
    const { 
      characters,     // 玩家角色信息
      preferences,    // 玩家偏好
      previousScenarios // 之前玩过的剧本
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const knowledgeClient = new KnowledgeClient(config, customHeaders);

    // 搜索规则书中的模组剧情
    const searchResponse = await knowledgeClient.search(
      '模组 剧本 剧情 任务',
      ['kamen_rider_trpg_rulebook'],
      5,
      0.5
    );
    
    let scenarioContext = '';
    if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
      scenarioContext = searchResponse.chunks
        .map(chunk => chunk.content)
        .join('\n\n');
    }

    // 角色信息
    const charactersInfo = characters?.map((c: { name: string; title?: string; background?: string }) => 
      `【${c.name}】${c.title || ''}：${c.background || '无背景'}`
    ).join('\n') || '无角色信息';

    // 系统提示词
    const systemPrompt = `你是假面骑士TRPG游戏的剧本推荐助手。

## 可选剧本（来自规则书）
${scenarioContext || '请根据假面骑士世界观原创剧本'}

## 玩家角色
${charactersInfo}

## 玩家偏好
${preferences || '无特殊偏好'}

## 已玩过的剧本
${previousScenarios?.join('、') || '无'}

## 任务
推荐3个适合当前玩家的剧本，每个剧本包含：
1. 剧本名称
2. 简要描述（2-3句话）
3. 难度等级（简单/普通/困难）
4. 预计时长
5. 推荐理由

优先推荐规则书中的现有模组，如果没有合适的，可以根据假面骑士世界观和玩家角色原创剧本。

请用JSON格式返回：
{
  "scenarios": [
    {
      "name": "剧本名称",
      "description": "剧本描述",
      "difficulty": "难度",
      "duration": "预计时长",
      "reason": "推荐理由",
      "isOriginal": false
    }
  ]
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请推荐适合我们的剧本' }
    ];

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.9,
    });

    // 解析AI返回的JSON
    let scenarios = [];
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scenarios = parsed.scenarios || [];
      }
    } catch {
      console.error('解析剧本JSON失败');
    }

    return NextResponse.json({
      success: true,
      data: {
        scenarios,
        rawResponse: response.content,
      },
    });
  } catch (error) {
    console.error('AI剧本推荐错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
