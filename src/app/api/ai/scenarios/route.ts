import { NextRequest, NextResponse } from 'next/server';
import { deepSeekChat } from '@/lib/deepseek-client';
import { 
  searchRulebook, 
  searchScenarioModule,
  SCENARIO_MODULES 
} from '@/lib/rulebook-search';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const FIRST_SCENARIO = '被扭曲的世界';
const INITIAL_SCENARIO_COUNT = 4;

async function getScenarioDetails(scenarioName: string): Promise<{
  description: string;
  difficulty: string;
  mainEnemy: string;
  keyLocations: string[];
  storyOutline: string;
}> {
  const predefinedModule = SCENARIO_MODULES.find(m => m.name === scenarioName);
  
  if (predefinedModule && predefinedModule.description) {
    return {
      description: predefinedModule.description,
      difficulty: predefinedModule.difficulty || '普通',
      mainEnemy: predefinedModule.mainEnemy || '未知',
      keyLocations: ['城市'],
      storyOutline: predefinedModule.description
    };
  }
  
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
  
  const content = result.content;
  
  let storyOutline = '';
  const storyMatch = content.match(/故事概述[■\s]*([\s\S]*?)(?=■|PC列表|■舞台|$)/i);
  if (storyMatch) {
    storyOutline = storyMatch[1].trim().substring(0, 300);
  }
  
  let keyLocations: string[] = [];
  const stageMatch = content.match(/舞台[：:]\s*([^\n■]+)/i);
  if (stageMatch) {
    keyLocations = stageMatch[1].split(/[，、\s]+/).filter((s: string) => s.length > 0);
  }
  
  let difficulty = '普通';
  const chapterMatch = content.match(/话数[：:]\s*全(\d+)话/i);
  if (chapterMatch) {
    const chapters = parseInt(chapterMatch[1]);
    if (chapters <= 2) difficulty = '简单';
    else if (chapters >= 4) difficulty = '困难';
  }
  
  let mainEnemy = '未知';
  const enemyPatterns = [/phantom/i, /Roidmude/i, /Undead/i, /怪人/i, /镜怪兽/i, /魔化魍/i];
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

// AI推荐剧本 (使用 DeepSeek API)
export async function POST(request: NextRequest) {
  try {
    const { 
      characters,
      preferences,
      previousScenarios,
      isFirstScenario,
      refresh = false
    } = await request.json();
    
    const supabase = getSupabaseClient();

    const { data: completedSessions } = await supabase
      .from('game_sessions')
      .select('scenario_name')
      .eq('status', 'completed');
    
    const completedScenarios = completedSessions
      ?.map((s: { scenario_name: string }) => s.scenario_name)
      .filter(Boolean) || [];
    
    const allPlayedScenarios = [...new Set([
      ...(previousScenarios || []),
      ...completedScenarios
    ])];

    const availableModules = SCENARIO_MODULES.filter(
      m => !allPlayedScenarios.includes(m.name)
    );

    if (isFirstScenario && !refresh) {
      const firstScenarios = [];
      
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
      
      for (const module of availableModules) {
        if (module.name === FIRST_SCENARIO) continue;
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

    const needsOriginalScenario = availableModules.length === 0;

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

    const charactersInfo = characters?.map((c: { 
      name: string; 
      title?: string; 
      background?: string;
      race?: string;
    }) => 
      `【${c.name}】${c.title || ''}（${c.race || '人类'}）：${c.background || '无背景'}`
    ).join('\n') || '无角色信息';

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

    const response = await deepSeekChat(messages, {
      model: 'deepseek-chat',
      temperature: 0.9,
    });

    let scenarios = [];
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
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
