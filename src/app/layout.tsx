import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: {
    default: '假面骑士TRPG | 在线跑团平台',
    template: '%s | 假面骑士TRPG',
  },
  description:
    '一个基于AI大模型的假面骑士TRPG在线跑团平台。与朋友一起创建角色、加入房间，让AI主持人带你体验精彩的假面骑士世界。',
  keywords: [
    '假面骑士',
    'Kamen Rider',
    'TRPG',
    '桌游',
    '角色扮演',
    '在线跑团',
    'AI主持人',
  ],
  authors: [{ name: 'Coze Code' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased bg-background text-foreground">
        {isDev && <Inspector />}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
