import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 从存档恢复游戏
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
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

    // 获取存档信息
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '存档不存在' }, { status: 404 });
    }

    // 验证用户是否参与过这个游戏
    const myParticipant = session.participants?.find(
      (p: { userId: string }) => p.userId === user.id
    );
    if (!myParticipant) {
      return NextResponse.json({ error: '你没有权限恢复这个存档' }, { status: 403 });
    }

    // 创建新房间
    const { data: newRoom, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name: `${session.scenario_name} (恢复)`,
        description: '从存档恢复的游戏',
        host_id: user.id,
        status: 'playing', // 直接设为游戏中状态
      })
      .select()
      .single();

    if (roomError || !newRoom) {
      console.error('创建房间错误:', roomError);
      return NextResponse.json({ error: '创建房间失败' }, { status: 500 });
    }

    // 将当前用户加入房间
    const { error: memberError } = await supabase
      .from('room_members')
      .insert({
        room_id: newRoom.id,
        user_id: user.id,
        character_id: myParticipant.characterId,
        status: 'playing',
      });

    if (memberError) {
      console.error('加入房间错误:', memberError);
    }

    // 更新存档，关联到新房间
    await supabase
      .from('game_sessions')
      .update({ room_id: newRoom.id })
      .eq('id', sessionId);

    console.log(`存档 ${sessionId} 已恢复到新房间 ${newRoom.id}`);

    return NextResponse.json({
      success: true,
      data: {
        roomId: newRoom.id,
        sessionId: sessionId,
        gameState: session.game_state,
        scenarioName: session.scenario_name,
        chapter: session.chapter,
      },
    });
  } catch (error) {
    console.error('恢复存档错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
