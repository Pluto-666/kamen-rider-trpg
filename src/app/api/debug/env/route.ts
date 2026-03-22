import { NextResponse } from 'next/server';

export async function GET() {
  // 检查环境变量配置情况
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      value: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
        process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET',
    },
    DEEPSEEK_API_KEY: {
      exists: !!process.env.DEEPSEEK_API_KEY,
      value: process.env.DEEPSEEK_API_KEY ? 
        process.env.DEEPSEEK_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    },
    // Node.js 环境
    nodeEnv: process.env.NODE_ENV,
    // Vercel 环境
    vercelEnv: process.env.VERCEL_ENV,
  };

  // 测试 Supabase 连接
  let supabaseTest = 'not tested';
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      supabaseTest = 'missing credentials';
    } else {
      const supabase = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      
      // 简单的健康检查
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        supabaseTest = `connection error: ${error.message}`;
      } else {
        supabaseTest = 'ok';
      }
    }
  } catch (err) {
    supabaseTest = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    env: envCheck,
    supabaseTest,
    timestamp: new Date().toISOString(),
  });
}
