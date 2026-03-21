import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取房间列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'waiting';
    
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const supabase = getSupabaseClient(token);

    // 获取房间列表
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('获取房间列表错误:', error);
      return NextResponse.json({ error: '获取房间列表失败' }, { status: 500 });
    }

    // 获取所有房主的ID
    const hostIds = [...new Set(rooms?.map(r => r.host_id) || [])];
    
    // 获取房主信息
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .in('id', hostIds);

    // 获取每个房间的成员数量
    const roomIds = rooms?.map(r => r.id) || [];
    const { data: members } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds);

    // 组装数据
    const profileMap = new Map(profiles?.map(p => [p.id, p]));
    const memberCountMap = new Map<string, number>();
    members?.forEach(m => {
      memberCountMap.set(m.room_id, (memberCountMap.get(m.room_id) || 0) + 1);
    });

    const roomsWithDetails = rooms?.map(room => ({
      ...room,
      profiles: profileMap.get(room.host_id),
      _memberCount: memberCountMap.get(room.id) || 0,
    }));

    return NextResponse.json({ success: true, data: roomsWithDetails });
  } catch (error) {
    console.error('获取房间列表错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建房间
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

    const roomData = await request.json();

    // 创建房间
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        host_id: user.id,
        ...roomData,
      })
      .select()
      .single();

    if (error) {
      console.error('创建房间错误:', error);
      return NextResponse.json({ error: '创建房间失败' }, { status: 500 });
    }

    // 将房主添加到房间成员
    await supabase
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        status: 'ready',
      });

    return NextResponse.json({ success: true, data: room });
  } catch (error) {
    console.error('创建房间错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
