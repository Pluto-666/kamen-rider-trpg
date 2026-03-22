import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取存档列表
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    let query = supabase
      .from('game_saves')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    const { data: saves, error } = await query;

    if (error) {
      console.error('获取存档列表错误:', error);
      return NextResponse.json({ error: '获取存档列表失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: saves || [] });
  } catch (error) {
    console.error('获取存档列表错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建新存档
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseClient(token);

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, saveName, messages, currentScene, characterStates, metadata } = body;

    if (!roomId) {
      return NextResponse.json({ error: '房间ID不能为空' }, { status: 400 });
    }

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    }

    // 创建存档
    const { data: save, error } = await supabase
      .from('game_saves')
      .insert({
        user_id: user.id,
        room_id: roomId,
        save_name: saveName || `存档 ${new Date().toLocaleString('zh-CN')}`,
        messages: messages || [],
        current_scene: currentScene || null,
        character_states: characterStates || {},
        metadata: metadata || {},
        room_snapshot: room,
      })
      .select()
      .single();

    if (error) {
      console.error('创建存档错误:', error);
      return NextResponse.json({ error: '创建存档失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: save });
  } catch (error) {
    console.error('创建存档错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
