import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  searchRulebook, 
  searchScenarioModule,
  SCENARIO_MODULES 
} from '@/lib/rulebook-search';

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

    // 搜索所有剧本模组的内容
    const scenarioDetails: string[] = [];
    
    for (const module of SCENARIO_MODULES) {
      const result = await searchScenarioModule(module.name);
      if (result.found) {
        scenarioDetails.push(`### ${module.name}\n${result.content.substring(0, 500)}...`);
      }
    }
    
    // 搜索世界观设定用于原创剧本
    const worldResult = await searchRulebook('世界观 假面骑士 设定');

    // 角色信息
    const charactersInfo = characters?.map((c: { 
      name: string; 
      title?: string; 
      background?: string;
      race?: string;
    }) => 
      `【${c.name}】${c.title || ''}（${c.race || '人类'}）：${c.background || '无背景'}`
    ).join('\n') || '无角色信息';

    // 系统提示词
    const systemPrompt = `你是假面骑士TRPG游戏的剧本推荐助手。

## 规则书中的剧本模组
${scenarioDetails.length > 0 ? scenarioDetails.join('\n\n') : '正在检索规则书...'}

## 世界观设定（用于原创剧本）
${worldResult.found ? worldResult.content.substring(0, 1000) : '假面骑士通用世界观'}

## 玩家角色
${charactersInfo}

## 玩家偏好
${preferences || '无特殊偏好'}

## 已玩过的剧本
${previousScenarios?.join('、') || '无'}

## 任务
根据角色特点和玩家偏好，推荐3个适合的剧本：

1. **优先推荐规则书中的现有模组**：如果角色适合某个模组，优先推荐
2. **如果没有合适的模组**：可以基于世界观和角色原创剧本
3. **考虑因素**：
   - 角色种族和背景是否契合剧情
   - 玩家的偏好（如喜欢战斗/剧情/探索）
   - 难度是否适中

请用JSON格式返回：
{
  "scenarios": [
    {
      "name": "剧本名称",
      "description": "剧本描述（2-3句话）",
      "difficulty": "简单/普通/困难",
      "duration": "预计时长（如：2-3小时）",
      "reason": "推荐理由",
      "isOriginal": false,
      "source": "规则书模组/原创",
      "mainEnemy": "主要敌人/组织",
      "keyLocations": ["地点1", "地点2"]
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
      // 如果解析失败，使用默认剧本列表
      scenarios = SCENARIO_MODULES.slice(0, 3).map(m => ({
        name: m.name,
        description: '来自规则书的经典剧本模组',
        difficulty: '普通',
        duration: '2-3小时',
        reason: '规则书推荐剧本',
        isOriginal: false,
        source: '规则书模组'
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        scenarios,
        availableModules: SCENARIO_MODULES.map(m => m.name),
        rawResponse: response.content,
      },
    });
  } catch (error) {
    console.error('AI剧本推荐错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
