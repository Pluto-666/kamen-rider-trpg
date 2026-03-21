import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取用户的所有角色卡
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

    const { data: characters, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取角色卡错误:', error);
      return NextResponse.json({ error: '获取角色卡失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: characters });
  } catch (error) {
    console.error('获取角色卡错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建新角色卡
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

    const characterData = await request.json();

    const { data: character, error } = await supabase
      .from('characters')
      .insert({
        user_id: user.id,
        ...characterData,
      })
      .select()
      .single();

    if (error) {
      console.error('创建角色卡错误:', error);
      return NextResponse.json({ error: '创建角色卡失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: character });
  } catch (error) {
    console.error('创建角色卡错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
