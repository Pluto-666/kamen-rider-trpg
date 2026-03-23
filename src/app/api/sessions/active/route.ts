import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取房间当前活跃的游戏会话
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json({ error: '房间ID不能为空' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const supabase = getSupabaseClient(token);

    // 获取房间当前活跃的会话
    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = 没有找到记录
      console.error('获取会话错误:', error);
      return NextResponse.json({ error: '获取会话失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: session || null 
    });
  } catch (error) {
    console.error('获取会话错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
