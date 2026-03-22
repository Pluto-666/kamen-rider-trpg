import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  searchRulebook, 
  searchCombatRules, 
  searchCheckRules,
  searchScenarioModule,
  searchWorldSetting,
  SCENARIO_MODULES
} from '@/lib/rulebook-search';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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
      scenarioName,
      currentScene,
      needsMap
    } = await request.json();
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    // 根据不同情况检索规则书
    let ruleContext = '';
    
    // 1. 如果是游戏开始，检索剧本模组
    if (playerAction?.includes('开始游戏') || playerAction?.includes('选择剧本')) {
      console.log('游戏开始，检索剧本模组...');
      const scenarioResult = await searchScenarioModule(scenarioName || '');
      if (scenarioResult.found) {
        ruleContext += '【剧本模组内容】\n' + scenarioResult.content + '\n\n';
      }
    }
    
    // 2. 检测是否需要战斗规则
    const combatKeywords = ['战斗', '攻击', '防御', '伤害', 'HP', '必杀技'];
    const needsCombatRules = combatKeywords.some(k => playerAction?.includes(k)) || 
                             currentScene?.type === 'combat';
    if (needsCombatRules) {
      console.log('检索战斗规则...');
      const combatResult = await searchCombatRules(playerAction);
      if (combatResult.found) {
        ruleContext += '【战斗规则】\n' + combatResult.content + '\n\n';
      }
    }
    
    // 3. 检测是否需要检定规则
    const checkKeywords = ['检定', '判定', '骰子', '难度', '成功', '失败'];
    const needsCheckRules = checkKeywords.some(k => playerAction?.includes(k));
    if (needsCheckRules) {
      console.log('检索检定规则...');
      const checkResult = await searchCheckRules();
      if (checkResult.found) {
        ruleContext += '【检定规则】\n' + checkResult.content + '\n\n';
      }
    }
    
    // 4. 根据当前场景类型检索相关规则
    if (currentScene?.location) {
      const locationResult = await searchRulebook(currentScene.location);
      if (locationResult.found) {
        ruleContext += '【场景信息】\n' + locationResult.content + '\n\n';
      }
    }
    
    // 5. 检索世界观设定（如果有相关关键词）
    const worldKeywords = ['古朗基', '奥菲以诺', 'Unknown', '林多', '世界', '组织'];
    for (const keyword of worldKeywords) {
      if (playerAction?.includes(keyword)) {
        const worldResult = await searchWorldSetting(keyword);
        if (worldResult.found) {
          ruleContext += `【${keyword}相关信息】\n${worldResult.content}\n\n`;
        }
        break;
      }
    }
    
    // 6. 如果玩家有异议，额外检索相关内容
    if (playerAction?.includes('为什么') || playerAction?.includes('不对') || playerAction?.includes('规则')) {
      const specificResult = await searchRulebook(playerAction);
      if (specificResult.found) {
        ruleContext += '【规则书原文】\n' + specificResult.content + '\n\n';
      }
    }
    
    // 7. 检索长期记忆 - 玩家可能提及之前的内容
    let memoryContext = '';
    if (sessionId && playerAction) {
      // 检测玩家是否在提及之前的内容
      const memoryKeywords = ['之前', '刚才', '那个', '上次', '记得', '说过', '提到'];
      const needsMemoryRetrieval = memoryKeywords.some(k => playerAction.includes(k));
      
      if (needsMemoryRetrieval) {
        console.log('检索长期记忆...');
        const supabase = getSupabaseClient();
        const { data: logs } = await supabase
          .from('session_logs')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (logs && logs.length > 0) {
          // 使用AI筛选相关记忆
          const logText = logs.slice(0, 30)
            .map((log: { role: string; content: string; created_at: string }) => 
              `${log.role}: ${log.content}`
            )
            .join('\n');
          
          // 简单的关键词匹配
          const playerKeywords = playerAction.split(/\s+/).filter((k: string) => k.length > 1);
          const relevantLogs = logs.filter((log: { content: string }) => 
            playerKeywords.some((k: string) => log.content?.includes(k))
          ).slice(0, 5);
          
          if (relevantLogs.length > 0) {
            memoryContext = '【相关历史记录】\n' + relevantLogs
              .map((log: { role: string; content: string; created_at: string }) => 
                `${log.role}: ${log.content}`
              ).join('\n\n');
          }
        }
      }
    }

    // 构建角色信息
    const charactersInfo = characters?.map((c: { 
      name: string; 
      title?: string; 
      attributes?: Record<string, number>;
      hp?: number;
      transformHP?: number;
    }) => {
      return `【${c.name}】${c.title || ''}
属性：${c.attributes ? JSON.stringify(c.attributes) : '未设置'}
HP：${c.hp || '?'}/${c.transformHP || '?'}`;
    }).join('\n') || '无角色信息';

    // 可选的剧本模组列表
    const availableScenarios = SCENARIO_MODULES.map(s => `- ${s.name}`).join('\n');

    // 系统提示词
    const systemPrompt = `你是假面骑士TRPG游戏的主持人(DM/地下城主)。

## 核心职责（必须严格遵守！）
1. **严格遵守规则书**：所有判定、属性计算、世界观描述必须基于规则书内容
2. **公正裁决**：当玩家有异议时，引用规则书原文进行解释
3. **叙事生动**：用生动的语言描述场景，营造假面骑士的氛围
4. **鼓励互动**：给予玩家选择和行动的空间
5. **保持连贯**：记住之前的对话内容，保持剧情连贯性

## 当前游戏状态
剧本：${scenarioName || '未设定'}
场景：${currentScene?.location || '未设定'}
${gameState ? `详细状态：${JSON.stringify(gameState, null, 2)}` : ''}

## 玩家角色
${charactersInfo}

## 对话历史（最近10条）
${dialogHistory?.slice(-10).map((m: { role: string; content: string }) => 
  `${m.role === 'user' ? '玩家' : 'DM'}: ${m.content}`
).join('\n') || '无历史对话'}

## 规则书参考内容
${ruleContext || '暂无相关规则'}

## 相关历史记录（长期记忆）
${memoryContext || '暂无相关历史'}

## 可选的剧本模组
${availableScenarios}

## 行为准则
1. **判定规则**：需要检定时，必须：
   - 明确告知检定类型和难度
   - 格式：【检定】需要进行【XX】检定，难度X，请投掷X面骰
   - 根据结果给出合理的剧情发展

2. **战斗规则**：战斗场景必须：
   - 按规则书计算伤害和HP
   - 描述战斗动作要生动
   - 给玩家反击或回避的机会

3. **规则引用**：玩家质疑时必须：
   - 使用【规则书原文】标记引用
   - 清晰解释规则如何适用
   - 如有歧义，可以与玩家讨论

4. **地图生成**：需要时使用【地图】标记生成描述：
   - 2D地图：用ASCII字符绘制
   - 立体地图：用文字描述空间关系

## 输出格式标记
- 【场景】场景描述
- 【NPC名】NPC对话
- 【检定】需要检定的内容
- 【规则书原文】引用规则
- 【地图】地图描述
- 【战斗】战斗相关`;

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
