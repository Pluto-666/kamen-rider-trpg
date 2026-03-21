import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 加入房间
export async function POST(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const { characterId, password } = await request.json();

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    }

    // 检查房间状态
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: '房间已经开始游戏，无法加入' }, { status: 400 });
    }

    // 检查密码
    if (room.is_private && room.password !== password) {
      return NextResponse.json({ error: '房间密码错误' }, { status: 403 });
    }

    // 检查是否已经在房间中
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: '你已经在这个房间中' }, { status: 400 });
    }

    // 检查房间人数
    const { count } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', id);

    if (count && count >= room.max_players) {
      return NextResponse.json({ error: '房间已满' }, { status: 400 });
    }

    // 加入房间
    const { data: member, error } = await supabase
      .from('room_members')
      .insert({
        room_id: id,
        user_id: user.id,
        character_id: characterId,
        status: 'ready',
      })
      .select()
      .single();

    if (error) {
      console.error('加入房间错误:', error);
      return NextResponse.json({ error: '加入房间失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error('加入房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 离开房间
export async function DELETE(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取房间信息
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', id)
      .single();

    // 如果是房主离开，解散房间
    if (room && room.host_id === user.id) {
      await supabase.from('room_members').delete().eq('room_id', id);
      await supabase.from('rooms').delete().eq('id', id);
      return NextResponse.json({ success: true, message: '房间已解散' });
    }

    // 普通成员离开
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('离开房间错误:', error);
      return NextResponse.json({ error: '离开房间失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('离开房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
