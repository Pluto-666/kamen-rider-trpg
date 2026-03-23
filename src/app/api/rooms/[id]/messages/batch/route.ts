import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 批量导入消息（用于存档恢复）
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

    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息列表为空' }, { status: 400 });
    }

    // 先清空房间现有消息（可选，根据需求决定）
    // const { error: deleteError } = await supabase
    //   .from('room_messages')
    //   .delete()
    //   .eq('room_id', roomId);
    // 
    // if (deleteError) {
    //   console.error('清空消息错误:', deleteError);
    // }

    // 转换消息格式并批量插入
    const messagesToInsert = messages.map((msg: any, index: number) => ({
      room_id: roomId,
      user_id: msg.senderId || msg.user_id || user.id,
      type: msg.type || 'chat',
      content: msg.content,
      character_name: msg.senderName || msg.character_name || '玩家',
      character_id: msg.characterId || msg.character_id,
      metadata: msg.metadata || {},
      created_at: msg.timestamp || msg.created_at || new Date(Date.now() + index * 1000).toISOString(),
    }));

    const { data: insertedMessages, error } = await supabase
      .from('room_messages')
      .insert(messagesToInsert)
      .select();

    if (error) {
      console.error('批量导入消息错误:', error);
      return NextResponse.json({ error: '导入消息失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: insertedMessages,
      count: insertedMessages.length 
    });
  } catch (error) {
    console.error('批量导入消息错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
