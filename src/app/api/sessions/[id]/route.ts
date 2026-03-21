import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取单个游戏会话
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const supabase = getSupabaseClient(token);

    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: '游戏会话不存在' }, { status: 404 });
    }

    // 获取游戏日志
    const { data: logs } = await supabase
      .from('game_logs')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })
      .limit(100);

    return NextResponse.json({
      success: true,
      data: {
        ...session,
        logs: logs || [],
      },
    });
  } catch (error) {
    console.error('获取游戏会话错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新游戏会话（保存进度）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    const updateData = await request.json();

    const { data: session, error } = await supabase
      .from('game_sessions')
      .update({
        ...updateData,
        last_saved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新游戏会话错误:', error);
      return NextResponse.json({ error: '更新游戏会话失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('更新游戏会话错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
