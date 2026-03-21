import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取游戏会话列表
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
      .select(`
        *,
        rooms(id, name)
      `)
      .contains('participants', [{ userId: user.id }])
      .order('last_saved_at', { ascending: false });

    if (error) {
      console.error('获取游戏会话错误:', error);
      return NextResponse.json({ error: '获取游戏会话失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: sessions });
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
