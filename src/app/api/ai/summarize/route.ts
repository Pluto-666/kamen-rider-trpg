import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { deepSeekStream } from '@/lib/deepseek-client';

/**
 * 剧情摘要生成 API
 * 每10轮对话后调用，生成后台摘要存储到数据库
 * 不显示给玩家，仅用于AI记忆
 */

interface SummaryRequest {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  currentScene?: {
    location: string;
    time: string;
    scenarioName: string;
  };
  roundNumber: number;
}

interface StorySummary {
  round: number;
  scene: string;
  time: string;
  completedEvents: string[];
  importantNPCs: Array<{ name: string; description: string }>;
  playerStatus: {
    name: string;
    hp: string;
    transformed: boolean;
  };
  currentGoal: string;
  unresolvedMysteries: string[];
  keyItems: string[];
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SummaryRequest = await request.json();
    const { sessionId, messages, currentScene, roundNumber } = body;

    if (!sessionId || !messages || messages.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    // 验证会话存在
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id, game_state')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 生成摘要
    const summary = await generateSummary(messages, currentScene, roundNumber);

    // 存储摘要到 game_state
    const gameState = session.game_state || {};
    const existingSummaries: StorySummary[] = (gameState as Record<string, unknown>).storySummaries as StorySummary[] || [];
    
    const updatedGameState = {
      ...gameState,
      storySummaries: [...existingSummaries, summary],
    };

    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({
        game_state: updatedGameState,
        last_saved_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('存储摘要失败:', updateError);
      return NextResponse.json({ error: '存储摘要失败' }, { status: 500 });
    }

    console.log(`[摘要生成] 第${roundNumber}轮摘要已生成并存储`);

    return NextResponse.json({
      success: true,
      summary,
      totalSummaries: existingSummaries.length + 1,
    });
  } catch (error) {
    console.error('摘要生成错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * 使用AI生成结构化摘要
 */
async function generateSummary(
  messages: SummaryRequest['messages'],
  currentScene: SummaryRequest['currentScene'],
  roundNumber: number
): Promise<StorySummary> {
  const systemPrompt = `你是TRPG游戏的摘要生成器。你的任务是将最近的对话压缩成结构化的摘要。

请严格按照以下JSON格式输出，不要输出任何其他内容：
{
  "round": ${roundNumber},
  "scene": "当前场景地点",
  "time": "游戏内时间",
  "completedEvents": ["已完成的事件1", "已完成的事件2"],
  "importantNPCs": [{"name": "NPC名称", "description": "简短描述"}],
  "playerStatus": {
    "name": "玩家角色名",
    "hp": "HP状态如：30/45",
    "transformed": false
  },
  "currentGoal": "当前玩家正在追求的目标",
  "unresolvedMysteries": ["未解决的悬念1", "未解决的悬念2"],
  "keyItems": ["获得的关键物品1", "获得的关键物品2"],
  "timestamp": "${new Date().toISOString()}"
}

摘要要点：
1. 场景：记录具体地点，如"废弃工厂内部"、"新宿中央公园入口"
2. 事件：只记录重要事件，忽略日常对话
3. NPC：只记录有名字或重要的NPC
4. 目标：玩家当前正在做什么或应该做什么
5. 悬念：需要记住但未解决的问题`;

  const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请为以下对话生成摘要：

当前场景信息：
- 地点：${currentScene?.location || '未知'}
- 时间：${currentScene?.time || '未知'}
- 剧本：${currentScene?.scenarioName || '未知'}

最近对话：
${messages.slice(-20).map(m => `${m.role === 'user' ? '玩家' : 'DM'}: ${m.content.substring(0, 500)}`).join('\n\n')}

请生成JSON格式的摘要：` },
  ];

  // 调用AI生成摘要
  let summaryText = '';
  try {
    for await (const chunk of deepSeekStream(conversationMessages, {
      model: 'deepseek-chat',
      temperature: 0.3, // 低温度保证格式稳定
    })) {
      summaryText += chunk;
    }
  } catch (error) {
    console.error('AI生成摘要失败:', error);
    // 返回基础摘要
    return {
      round: roundNumber,
      scene: currentScene?.location || '未知',
      time: currentScene?.time || '未知',
      completedEvents: [],
      importantNPCs: [],
      playerStatus: { name: '未知', hp: '未知', transformed: false },
      currentGoal: '未知',
      unresolvedMysteries: [],
      keyItems: [],
      timestamp: new Date().toISOString(),
    };
  }

  // 解析JSON
  try {
    // 提取JSON部分
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        round: roundNumber,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (parseError) {
    console.error('解析摘要JSON失败:', parseError);
  }

  // 返回基础摘要
  return {
    round: roundNumber,
    scene: currentScene?.location || '未知',
    time: currentScene?.time || '未知',
    completedEvents: [],
    importantNPCs: [],
    playerStatus: { name: '未知', hp: '未知', transformed: false },
    currentGoal: '未知',
    unresolvedMysteries: [],
    keyItems: [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * 获取会话的所有摘要
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: '缺少sessionId' }, { status: 400 });
    }

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseClient(token);

    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('game_state')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const gameState = session.game_state as Record<string, unknown>;
    const summaries: StorySummary[] = (gameState?.storySummaries as StorySummary[]) || [];

    return NextResponse.json({
      success: true,
      summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('获取摘要错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
