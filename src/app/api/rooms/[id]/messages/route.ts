import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取房间消息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // 获取此时间戳之后的消息
    
    const supabase = getSupabaseClient();

    let query = supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (since) {
      query = query.gt('created_at', since);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('获取消息错误:', error);
      return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: messages || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取消息错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 发送消息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
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

    const { type, content, characterName, characterId, metadata } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 存储消息到数据库
    const { data: message, error } = await supabase
      .from('room_messages')
      .insert({
        room_id: roomId,
        user_id: user.id,
        type: type || 'chat',
        content: content.trim(),
        character_name: characterName,
        character_id: characterId,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('存储消息错误:', error);
      return NextResponse.json({ error: '发送消息失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    console.error('发送消息错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
