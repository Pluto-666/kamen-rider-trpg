import { NextRequest, NextResponse } from 'next/server';
import { deepSeekChat } from '@/lib/deepseek-client';
import { 
  searchRulebook, 
  searchScenarioModule,
  SCENARIO_MODULES 
} from '@/lib/rulebook-search';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const FIRST_SCENARIO = '被扭曲的世界';

// 获取剧本详情
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

// AI生成原创剧本
async function generateOriginalScenarios(
  characters: Array<{ name: string; title?: string; background?: string; race?: string }>,
  completedScenarios: string[],
  count: number = 2
): Promise<Array<{
  name: string;
  description: string;
  difficulty: string;
  duration: string;
  reason: string;
  isOriginal: boolean;
  source: string;
  mainEnemy: string;
  keyLocations: string[];
}>> {
  const worldResult = await searchRulebook('世界观 假面骑士 设定');

  const charactersInfo = characters?.map((c) => 
    `【${c.name}】${c.title || ''}（${c.race || '人类'}）：${c.background || '无背景'}`
  ).join('\n') || '无角色信息';

  const systemPrompt = `你是假面骑士TRPG游戏的剧本创作助手。

## 任务
根据世界观和角色信息，创作${count}个全新的原创剧本。

## 世界观设定
${worldResult.found ? worldResult.content.substring(0, 1500) : '假面骑士通用世界观'}

## 玩家角色
${charactersInfo}

## 已通关的剧本（不要重复）
${completedScenarios.join('、') || '无'}

## 要求
1. 剧情新颖有趣，与之前的剧本不重复
2. 符合假面骑士世界观
3. 适合当前角色组合
4. 每个剧本应该有明确的故事背景、主要敌人和关键地点
5. 难度可以有所不同（简单/普通/困难）

请用JSON格式返回：
{
  "scenarios": [
    {
      "name": "剧本名称",
      "description": "剧本描述（2-3句话，包含故事背景）",
      "difficulty": "简单/普通/困难",
      "duration": "预计时长（如：2-3小时）",
      "reason": "推荐理由",
      "mainEnemy": "主要敌人/组织",
      "keyLocations": ["地点1", "地点2"]
    }
  ]
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请为我们创作${count}个全新的原创剧本` }
  ];

  try {
    const response = await deepSeekChat(messages, {
      model: 'deepseek-chat',
      temperature: 0.9,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.scenarios || []).map((s: Record<string, unknown>) => ({
        ...s,
        isOriginal: true,
        source: 'AI创作',
      }));
    }
  } catch (error) {
    console.error('AI生成剧本失败:', error);
  }

  // 返回默认原创剧本
  return Array(count).fill(null).map((_, i) => ({
    name: `原创剧本 ${i + 1}`,
    description: 'AI为您量身定制的全新冒险故事',
    difficulty: '普通',
    duration: '2-3小时',
    reason: '根据您的角色特点定制',
    isOriginal: true,
    source: 'AI创作',
    mainEnemy: '未知敌人',
    keyLocations: ['城市'],
  }));
}

// AI推荐剧本
export async function POST(request: NextRequest) {
  try {
    const { 
      characters,
      preferences,
      previousScenarios,
      refresh = false
    } = await request.json();
    
    const supabase = getSupabaseClient();

    // 获取已通关的剧本
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

    // 检查《被扭曲的世界》是否通关
    const firstScenarioCompleted = allPlayedScenarios.includes(FIRST_SCENARIO);

    // 获取未通关的规则书模组
    const availableModules = SCENARIO_MODULES.filter(
      m => !allPlayedScenarios.includes(m.name)
    );

    // 检查是否所有规则书模组都已通关
    const allModulesCompleted = availableModules.length === 0;

    const scenarios: Array<{
      name: string;
      description: string;
      difficulty: string;
      duration: string;
      reason: string;
      isOriginal: boolean;
      source: string;
      mainEnemy: string;
      keyLocations: string[];
      isStarter?: boolean;
    }> = [];

    // === 生成四个剧本 ===

    if (allModulesCompleted) {
      // 情况3：所有规则书模组都已通关，全部由AI生成
      const aiScenarios = await generateOriginalScenarios(
        characters,
        allPlayedScenarios,
        4
      );
      scenarios.push(...aiScenarios);
    } else {
      // 情况1和2：规则书模组未全部通关

      // 剧本1：如果《被扭曲的世界》未通关，固定放第一个
      if (!firstScenarioCompleted) {
        const firstModule = SCENARIO_MODULES.find(m => m.name === FIRST_SCENARIO);
        if (firstModule) {
          const details = await getScenarioDetails(firstModule.name);
          scenarios.push({
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
      } else {
        // 《被扭曲的世界》已通关，随机选择一个未通关的规则书模组
        if (availableModules.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableModules.length);
          const randomModule = availableModules[randomIndex];
          const details = await getScenarioDetails(randomModule.name);
          scenarios.push({
            name: randomModule.name,
            description: details.storyOutline || details.description,
            difficulty: details.difficulty,
            duration: '2-3小时',
            reason: randomModule.isStarter ? '适合入门的规则书模组' : '来自规则书的经典模组',
            isOriginal: false,
            source: '规则书模组',
            mainEnemy: details.mainEnemy,
            keyLocations: details.keyLocations,
            isStarter: randomModule.isStarter || false
          });
        }
      }

      // 剧本2：从剩余未通关的规则书模组中随机选择
      const remainingModules = availableModules.filter(
        m => m.name !== scenarios[0]?.name && !(scenarios[0]?.name === FIRST_SCENARIO && m.name === FIRST_SCENARIO)
      );
      
      if (remainingModules.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingModules.length);
        const randomModule = remainingModules[randomIndex];
        const details = await getScenarioDetails(randomModule.name);
        scenarios.push({
          name: randomModule.name,
          description: details.storyOutline || details.description,
          difficulty: details.difficulty,
          duration: '2-3小时',
          reason: '来自规则书的经典模组',
          isOriginal: false,
          source: '规则书模组',
          mainEnemy: details.mainEnemy,
          keyLocations: details.keyLocations,
          isStarter: randomModule.isStarter || false
        });
      } else if (scenarios.length === 1) {
        // 如果没有其他规则书模组了，用AI生成
        const aiScenarios = await generateOriginalScenarios(
          characters,
          allPlayedScenarios,
          1
        );
        scenarios.push(...aiScenarios);
      }

      // 剧本3和4：由AI生成
      const aiScenarios = await generateOriginalScenarios(
        characters,
        allPlayedScenarios,
        2
      );
      scenarios.push(...aiScenarios);
    }

    return NextResponse.json({
      success: true,
      data: {
        scenarios,
        availableModules: availableModules.map(m => m.name),
        isFirstScenario: !firstScenarioCompleted,
        completedScenarios: allPlayedScenarios,
        allModulesCompleted,
      },
    });
  } catch (error) {
    console.error('AI剧本推荐错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
