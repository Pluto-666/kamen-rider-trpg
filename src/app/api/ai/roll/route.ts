import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils, KnowledgeClient } from 'coze-coding-dev-sdk';

// AI判定 - 骰子检定和结果判定
export async function POST(request: NextRequest) {
  try {
    const { 
      rollType,      // 检定类型：attribute, skill, combat
      attribute,     // 检定属性
      difficulty,    // 难度等级
      character,     // 角色信息
      context,       // 上下文描述
      scenario       // 场景信息
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const knowledgeClient = new KnowledgeClient(config, customHeaders);

    // 搜索规则书中关于检定的内容
    const searchResponse = await knowledgeClient.search(
      `${rollType}检定 ${attribute} 难度${difficulty}`,
      ['kamen_rider_trpg_rulebook'],
      3,
      0.5
    );
    
    let ruleContext = '';
    if (searchResponse.code === 0 && searchResponse.chunks.length > 0) {
      ruleContext = searchResponse.chunks
        .map(chunk => chunk.content)
        .join('\n\n');
    }

    // 模拟骰子检定（实际应该由前端执行）
    const d20Result = Math.floor(Math.random() * 20) + 1;
    const attributeValue = character?.attributes?.[attribute] || 10;
    const total = d20Result + Math.floor((attributeValue - 10) / 2);

    // 判定成功与否
    const success = total >= difficulty;
    const criticalHit = d20Result === 20;
    const criticalFail = d20Result === 1;

    // 系统提示词
    const systemPrompt = `你是假面骑士TRPG游戏的判定助手。

## 检定结果
- 检定类型：${rollType}
- 检定属性：${attribute}
- 骰子结果：${d20Result}（${criticalHit ? '大成功！' : criticalFail ? '大失败！' : ''}）
- 属性加值：${Math.floor((attributeValue - 10) / 2)}
- 总计：${total}
- 难度：${difficulty}
- 结果：${success ? '成功' : '失败'}

## 角色信息
${character ? JSON.stringify(character, null, 2) : '未知角色'}

## 场景上下文
${context || '无上下文'}

## 规则书参考
${ruleContext || '暂无相关规则'}

## 任务
根据检定结果，生动地描述这次行动的结果：
1. 如果成功，描述成功的精彩场面
2. 如果失败，描述失败的原因和后果
3. 如果是大成功/大失败，进行特别描述
4. 保持假面骑士的战斗风格和氛围`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请描述这次检定的结果' }
    ];

    // 获取AI描述
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.8,
    });

    return NextResponse.json({
      success: true,
      data: {
        roll: {
          dice: '1d20',
          result: d20Result,
          modifier: Math.floor((attributeValue - 10) / 2),
          total,
          difficulty,
          success,
          criticalHit,
          criticalFail,
        },
        description: response.content,
      },
    });
  } catch (error) {
    console.error('AI判定错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
