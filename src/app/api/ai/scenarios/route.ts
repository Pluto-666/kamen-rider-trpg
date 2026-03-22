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
// 首次推荐剧本数量
const INITIAL_SCENARIO_COUNT = 4;

// 从规则书搜索剧本详细信息
async function getScenarioDetails(scenarioName: string): Promise<{
  description: string;
  difficulty: string;
  mainEnemy: string;
  keyLocations: string[];
  storyOutline: string;
}> {
  const result = await searchScenarioModule(scenarioName);
  
  const defaultInfo = {
    description: '来自规则书的经典剧本模组',
    difficulty: '普通',
    mainEnemy: '未知',
    keyLocations: ['城市'],
    storyOutline: ''
  };
  
  if (!result.found || !result.content) {
    return defaultInfo;
  }
  
  // 从搜索结果中提取信息
  const content = result.content;
  
  // 提取故事概述
  let storyOutline = '';
  const storyMatch = content.match(/故事概述[■\s]*([\s\S]*?)(?=■|PC列表|■舞台|$)/i);
  if (storyMatch) {
    storyOutline = storyMatch[1].trim().substring(0, 300);
  }
  
  // 提取舞台信息
  let keyLocations: string[] = [];
  const stageMatch = content.match(/舞台[：:]\s*([^\n■]+)/i);
  if (stageMatch) {
    keyLocations = stageMatch[1].split(/[，、\s]+/).filter((s: string) => s.length > 0);
  }
  
  // 提取话数作为难度参考
  let difficulty = '普通';
  const chapterMatch = content.match(/话数[：:]\s*全(\d+)话/i);
  if (chapterMatch) {
    const chapters = parseInt(chapterMatch[1]);
    if (chapters <= 2) difficulty = '简单';
    else if (chapters >= 4) difficulty = '困难';
  }
  
  // 提取敌人信息
  let mainEnemy = '未知';
  const enemyPatterns = [
    /phantom/i,
    /Roidmude/i,
    /Undead/i,
    /怪人/i,
    /镜怪兽/i,
    /魔化魍/i,
  ];
  for (const pattern of enemyPatterns) {
    if (pattern.test(content)) {
      mainEnemy = content.match(pattern)?.[0] || '未知';
      break;
    }
  }
  
  return {
    description: storyOutline || `来自规则书的${scenarioName}模组`,
    difficulty,
    mainEnemy,
    keyLocations: keyLocations.length > 0 ? keyLocations : ['城市'],
    storyOutline
  };
}

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

    // 过滤已通关的剧本，获取可用模组
    const availableModules = SCENARIO_MODULES.filter(
      m => !allPlayedScenarios.includes(m.name)
    );

    // 如果是第一次生成剧本，返回4个规则书剧本（固定包含《被扭曲的世界》）
    if (isFirstScenario && !refresh) {
      const firstScenarios = [];
      
      // 确保第一个是《被扭曲的世界》
      const firstModule = SCENARIO_MODULES.find(m => m.name === FIRST_SCENARIO);
      if (firstModule && !allPlayedScenarios.includes(firstModule.name)) {
        const details = await getScenarioDetails(firstModule.name);
        firstScenarios.push({
          name: firstModule.name,
          description: details.storyOutline || details.description,
          difficulty: details.difficulty,
          duration: '2-3小时',
          reason: '推荐新手玩家首先体验此剧本，了解游戏基本规则和玩法',
          isOriginal: false,
          source: '规则书模组',
          mainEnemy: details.mainEnemy,
          keyLocations: details.keyLocations,
          isStarter: true
        });
      }
      
      // 添加其他可用剧本，直到凑够4个
      for (const module of availableModules) {
        if (module.name === FIRST_SCENARIO) continue; // 跳过已添加的
        if (firstScenarios.length >= INITIAL_SCENARIO_COUNT) break;
        
        const details = await getScenarioDetails(module.name);
        firstScenarios.push({
          name: module.name,
          description: details.storyOutline || details.description,
          difficulty: details.difficulty,
          duration: '2-3小时',
          reason: module.isStarter ? '适合新手入门的剧本' : '来自规则书的经典模组',
          isOriginal: false,
          source: '规则书模组',
          mainEnemy: details.mainEnemy,
          keyLocations: details.keyLocations,
          isStarter: module.isStarter || false
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          scenarios: firstScenarios,
          availableModules: SCENARIO_MODULES.map(m => m.name),
          isFirstScenario: true,
          completedScenarios: allPlayedScenarios,
        },
      });
    }

    // 非首次生成或刷新请求：返回3个新剧本

    // 如果所有预设剧本都通关了，生成原创剧本
    const needsOriginalScenario = availableModules.length === 0;

    // 如果还有预设剧本，直接返回规则书模组
    if (!needsOriginalScenario) {
      const scenarios = [];
      const count = Math.min(3, availableModules.length);
      
      for (let i = 0; i < count; i++) {
        const module = availableModules[i];
        const details = await getScenarioDetails(module.name);
        scenarios.push({
          name: module.name,
          description: details.storyOutline || details.description,
          difficulty: details.difficulty,
          duration: '2-3小时',
          reason: '来自规则书的经典模组',
          isOriginal: false,
          source: '规则书模组',
          mainEnemy: details.mainEnemy,
          keyLocations: details.keyLocations
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          scenarios,
          availableModules: availableModules.map(m => m.name),
          isFirstScenario: false,
          completedScenarios: allPlayedScenarios,
        },
      });
    }

    // 所有预设剧本已通关，创作原创剧本
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
    const systemPrompt = `你是假面骑士TRPG游戏的剧本创作助手。

## 所有预设剧本已通关！
玩家已经完成了所有规则书中的预设剧本。请根据世界观和角色特点，创作全新的原创剧本。

## 世界观设定
${worldResult.found ? worldResult.content.substring(0, 1500) : '假面骑士通用世界观'}

## 玩家角色
${charactersInfo}

## 玩家偏好
${preferences || '无特殊偏好'}

## 已通关的剧本（不要重复）
${allPlayedScenarios.join('、')}

## 任务
创作3个全新的原创剧本，确保：
1. 剧情新颖有趣，与之前的剧本不重复
2. 符合假面骑士世界观
3. 适合当前角色组合
4. 难度适中或略高（玩家已有经验）
5. 每个剧本应该有明确的故事背景、主要敌人和关键地点

请用JSON格式返回：
{
  "scenarios": [
    {
      "name": "剧本名称",
      "description": "剧本描述（2-3句话，包含故事背景）",
      "difficulty": "简单/普通/困难",
      "duration": "预计时长（如：2-3小时）",
      "reason": "推荐理由",
      "isOriginal": true,
      "source": "原创",
      "mainEnemy": "主要敌人/组织",
      "keyLocations": ["地点1", "地点2"]
    }
  ]
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: '请为我们创作全新的剧本' }
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
        availableModules: [],
        isFirstScenario: false,
        completedScenarios: allPlayedScenarios,
        allModulesCompleted: true,
      },
    });
  } catch (error) {
    console.error('AI剧本推荐错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
