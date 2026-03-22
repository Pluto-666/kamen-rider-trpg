import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  searchRulebook, 
  searchScenarioModule,
  SCENARIO_MODULES 
} from '@/lib/rulebook-search';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 首个剧本固定为《被扭曲的世界》
const FIRST_SCENARIO = '被扭曲的世界';

// AI推荐剧本
export async function POST(request: NextRequest) {
  try {
    const { 
      characters,     // 玩家角色信息
      preferences,    // 玩家偏好
      previousScenarios, // 之前玩过的剧本
      isFirstScenario, // 是否是第一次生成剧本
      refresh = false  // 是否是刷新请求
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const supabase = getSupabaseClient();

    // 获取已通关的剧本列表
    const { data: completedSessions } = await supabase
      .from('game_sessions')
      .select('scenario_name')
      .eq('status', 'completed');
    
    const completedScenarios = completedSessions
      ?.map((s: { scenario_name: string }) => s.scenario_name)
      .filter(Boolean) || [];
    
    // 合并之前玩过的剧本和已通关的剧本
    const allPlayedScenarios = [...new Set([
      ...(previousScenarios || []),
      ...completedScenarios
    ])];

    // 如果是第一次生成剧本，固定返回《被扭曲的世界》
    if (isFirstScenario && !refresh) {
      const firstScenarioResult = await searchScenarioModule(FIRST_SCENARIO);
      
      const firstScenario = {
        name: FIRST_SCENARIO,
        description: firstScenarioResult.found 
          ? '来自规则书的入门剧本，适合新手玩家体验假面骑士TRPG的核心玩法。'
          : '假面骑士TRPG的入门剧本，玩家将面对被扭曲的现实，寻找真相并拯救世界。',
        difficulty: '普通',
        duration: '2-3小时',
        reason: '推荐新手玩家首先体验此剧本，了解游戏基本规则和玩法',
        isOriginal: false,
        source: '规则书模组',
        mainEnemy: '未知',
        keyLocations: ['城市', '神秘遗迹']
      };

      return NextResponse.json({
        success: true,
        data: {
          scenarios: [firstScenario],
          availableModules: SCENARIO_MODULES.map(m => m.name),
          isFirstScenario: true,
          completedScenarios: allPlayedScenarios,
        },
      });
    }

    // 过滤已通关的剧本
    const availableModules = SCENARIO_MODULES.filter(
      m => !allPlayedScenarios.includes(m.name)
    );

    // 如果所有预设剧本都通关了，生成原创剧本
    const needsOriginalScenario = availableModules.length === 0;

    // 搜索可用剧本模组的内容
    const scenarioDetails: string[] = [];
    
    if (!needsOriginalScenario) {
      for (const module of availableModules.slice(0, 3)) {
        const result = await searchScenarioModule(module.name);
        if (result.found) {
          scenarioDetails.push(`### ${module.name}\n${result.content.substring(0, 500)}...`);
        }
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

${needsOriginalScenario ? `
## 所有预设剧本已通关！
玩家已经完成了所有规则书中的预设剧本。请根据世界观和角色特点，创作全新的原创剧本。
` : `
## 可选的规则书剧本模组（已过滤已通关的剧本）
${scenarioDetails.length > 0 ? scenarioDetails.join('\n\n') : '正在检索规则书...'}
`}

## 世界观设定（用于剧本创作）
${worldResult.found ? worldResult.content.substring(0, 1000) : '假面骑士通用世界观'}

## 玩家角色
${charactersInfo}

## 玩家偏好
${preferences || '无特殊偏好'}

## 已通关的剧本（不要推荐）
${allPlayedScenarios.join('、') || '无'}

## 任务
根据角色特点和玩家偏好，推荐3个适合的剧本：

${needsOriginalScenario ? `
由于所有预设剧本都已通关，请创作3个全新的原创剧本，确保：
1. 剧情新颖有趣，与之前的剧本不重复
2. 符合假面骑士世界观
3. 适合当前角色组合
4. 难度适中或略高（玩家已有经验）
` : `
1. 优先从可选的规则书剧本模组中推荐
2. 如果没有合适的模组，可以创作原创剧本
3. 考虑角色种族和背景是否契合剧情
4. 注意难度平衡
`}

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
      { role: 'user' as const, content: refresh ? '请重新推荐剧本（刷新）' : '请推荐适合我们的剧本' }
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
      // 如果解析失败，使用剩余的默认剧本列表
      scenarios = availableModules.slice(0, 3).map(m => ({
        name: m.name,
        description: '来自规则书的经典剧本模组',
        difficulty: '普通',
        duration: '2-3小时',
        reason: '规则书推荐剧本',
        isOriginal: false,
        source: '规则书模组'
      }));
    }

    // 再次过滤确保不包含已通关剧本
    scenarios = scenarios.filter((s: { name: string }) => 
      !allPlayedScenarios.includes(s.name)
    );

    return NextResponse.json({
      success: true,
      data: {
        scenarios,
        availableModules: availableModules.map(m => m.name),
        isFirstScenario: false,
        completedScenarios: allPlayedScenarios,
        allModulesCompleted: needsOriginalScenario,
        rawResponse: response.content,
      },
    });
  } catch (error) {
    console.error('AI剧本推荐错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
