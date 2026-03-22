import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取游戏会话列表（用户存档列表）
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取用户参与的游戏会话
    const { data: sessions, error } = await supabase
      .from('game_sessions')
      .select('*')
      .contains('participants', [{ userId: user.id }])
      .order('last_saved_at', { ascending: false });

    if (error) {
      console.error('获取游戏会话错误:', error);
      return NextResponse.json({ error: '获取游戏会话失败' }, { status: 500 });
    }

    // 处理存档数据，添加可读信息
    const savedGames = sessions?.map(session => {
      // participants 是 JSON 数组，提取用户角色信息
      const myParticipant = session.participants?.find(
        (p: { userId: string }) => p.userId === user.id
      );
      
      return {
        id: session.id,
        scenarioName: session.scenario_name,
        chapter: session.chapter,
        status: session.status,
        lastSavedAt: session.last_saved_at,
        startedAt: session.started_at,
        myCharacterName: myParticipant?.characterName || '未知角色',
        gameState: session.game_state,
        // 原房间可能已删除，保留 room_id 用于恢复
        roomId: session.room_id,
      };
    }) || [];

    return NextResponse.json({ success: true, data: savedGames });
  } catch (error) {
    console.error('获取游戏会话错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建新游戏会话
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const { roomId, scenarioName, participants } = await request.json();

    // 创建游戏会话
    const { data: session, error } = await supabase
      .from('game_sessions')
      .insert({
        room_id: roomId,
        scenario_name: scenarioName,
        participants,
        game_state: {
          currentScene: '开场',
          npcs: {},
          events: [],
          aiContext: '',
        },
      })
      .select()
      .single();

    if (error) {
      console.error('创建游戏会话错误:', error);
      return NextResponse.json({ error: '创建游戏会话失败' }, { status: 500 });
    }

    // 更新房间状态
    await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('创建游戏会话错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
