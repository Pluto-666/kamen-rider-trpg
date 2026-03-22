import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 刷新 Token API
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: '缺少 refresh token' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Token刷新错误:', error);
      return NextResponse.json(
        { error: 'Token刷新失败，请重新登录' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        session: data.session,
        user: data.user,
      },
    });
  } catch (error) {
    console.error('Token刷新错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
