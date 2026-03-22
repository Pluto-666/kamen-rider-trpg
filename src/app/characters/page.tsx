'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Trash2, 
  MoreVertical, 
  Save, 
  User, 
  Swords, 
  Shield,
  Heart,
  Sparkles,
} from 'lucide-react';

// 角色卡类型定义（与数据库返回字段一致，使用snake_case）
interface Character {
  id: string;
  user_id: string;
  name: string;
  title?: string;
  player_name?: string;
  image_url?: string;
  race: string;
  occupation?: string;
  age?: number;
  gender?: string;
  active_power: number;
  attributes: {
    // 主能力值
    body: number;
    bodyRace: number;
    bodyJob: number;
    bodyNormal: number;
    bodyTransform: number;
    athletics: number;
    athleticsRace: number;
    athleticsJob: number;
    athleticsNormal: number;
    athleticsTransform: number;
    dexterity: number;
    dexterityRace: number;
    dexterityJob: number;
    dexterityNormal: number;
    dexterityTransform: number;
    will: number;
    willRace: number;
    willJob: number;
    willNormal: number;
    willTransform: number;
    wit: number;
    witRace: number;
    witJob: number;
    witNormal: number;
    witTransform: number;
    // 副能力值
    movement: number;
    movementRace: number;
    movementJob: number;
    movementNormal: number;
    movementTransform: number;
    movementBonus: number;
    initiative: number;
    initiativeRace: number;
    initiativeJob: number;
    initiativeNormal: number;
    initiativeTransform: number;
    initiativeBonus: number;
    // HP
    additionalHP: number;
    bodyHP: number;
    totalHP: number;
    transformHP: number;
  };
  fate_points?: {
    points: number;
    history: string[];
  };
  weapons?: Array<{
    name: string;
    range: string;
    hit: number;
    hitBonus: number;
    hitTotal: number;
    dp: number;
    dpBonus: number;
    dpTotal: number;
    attribute: string;
    uses: number;
    note: string;
  }>;
  armors?: Array<{
    name: string;
    dodge: number;
    dodgeBonus: number;
    dodgeTotal: number;
    parry: number;
    parryBonus: number;
    parryTotal: number;
    additionalHP: number;
    fixed: boolean;
    note: string;
  }>;
  other_equipment?: string;
  vehicle?: {
    name: string;
    movement: number;
    hp: number;
    passengers: number;
    dodge: number;
    parry: number;
    fate_points: number;
  };
  configs?: Array<{
    category: string;
    name: string;
    level: number;
    reference: string;
  }>;
  background?: string;
  rider_data?: {
    riderSystem: string;
    transformationItem: string;
    finisherMoves: string[];
    specialAbilities: string[];
    transformationPhrase?: string;
  };
  action_cards?: Array<{
    type: string;
    category: string;
    name: string;
    cards: number;
    used: boolean;
    description: string;
  }>;
  episodes?: Array<{
    episode: number;
    title: string;
    summary: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 清理提取的文本，去除表格格式和多余字符
function cleanExtractedText(text: string | undefined, maxLength: number = 50): string | undefined {
  if (!text) return undefined;
  
  let cleaned = text
    // 去除表格分隔符和管道符
    .replace(/\|/g, '')
    // 去除多余空格
    .replace(/\s+/g, ' ')
    // 去除首尾空格
    .trim()
    // 限制长度
    .slice(0, maxLength);
  
  return cleaned || undefined;
}

// 从对话中提取角色数据
function extractCharacterFromChat(chatHistory: ChatMessage[]): Partial<Character> {
  const allText = chatHistory.map(m => m.content).join('\n');
  
  const character: Partial<Character> = {};
  
  // 提取角色名 - 更宽松的匹配
  const namePatterns = [
    /(?:角色名[：:]?\s*|名字[：:]?\s*|名称[：:]?\s*|我叫[：:]?\s*|名字是[：:]?\s*)([^\n，。！？]+)/,
    /【已记录】[^】]*?[姓名][：:]\s*([^\n，。！？【】]+)/,
    /好的[，,]?\s*(?:我记住了|记住)[：:]?\s*([^\n，。！？的]+?)(?:的|名字)/,
    /(?:姓名|名称)[：:]\s*([^\n，。！？]+)/,
  ];
  for (const pattern of namePatterns) {
    const match = allText.match(pattern);
    if (match && match[1].trim().length > 0 && match[1].trim().length < 20) {
      character.name = cleanExtractedText(match[1], 50);
      break;
    }
  }
  
  // 提取玩家名
  const playerMatch = allText.match(/(?:玩家名[：:]?\s*|玩家[：:]?\s*)([^\n，。！？|]+)/);
  if (playerMatch) character.player_name = cleanExtractedText(playerMatch[1], 50);
  
  // 提取年龄
  const ageMatch = allText.match(/(?:年龄[：:]?\s*|岁[：:]?\s*|今年[：:]?\s*)(\d+)/);
  if (ageMatch) character.age = parseInt(ageMatch[1]);
  
  // 提取性别
  const genderMatch = allText.match(/(?:性别[：:]?\s*)(男|女|其他)/);
  if (genderMatch) character.gender = genderMatch[1];
  
  // 提取种族
  const raceMatch = allText.match(/(?:种族[：:]?\s*)([^\n，。！？|]+)/);
  if (raceMatch) character.race = cleanExtractedText(raceMatch[1], 50) || '人类';
  
  // 提取职业
  const jobMatch = allText.match(/(?:职业[：:]?\s*|工作[：:]?\s*)([^\n，。！？|]+)/);
  if (jobMatch) character.occupation = cleanExtractedText(jobMatch[1], 50);
  
  // 提取背景故事
  const bgMatch = allText.match(/(?:背景[：:]?\s*|故事[：:]?\s*|背景故事[：:]?\s*)([^\n]+(?:\n[^\n]+)*)/);
  if (bgMatch) character.background = cleanExtractedText(bgMatch[1], 500);
  
  // 提取骑士系统
  const riderMatch = allText.match(/(?:骑士系统[：:]?\s*|变身道具[：:]?\s*|骑士称号[：:]?\s*)([^\n，。！？|]+)/);
  if (riderMatch) {
    const riderSystem = cleanExtractedText(riderMatch[1], 50);
    if (riderSystem) {
      character.rider_data = {
        riderSystem,
        transformationItem: '',
        finisherMoves: [],
        specialAbilities: [],
      };
    }
  }
  
  // 提取必杀技
  const finisherMatch = allText.match(/(?:必杀技[：:]?\s*)([^\n，。！？|]+)/);
  if (finisherMatch && character.rider_data) {
    const finisher = cleanExtractedText(finisherMatch[1], 100);
    if (finisher) {
      character.rider_data.finisherMoves = [finisher];
    }
  }
  
  return character;
}

export default function CharactersPage() {
  const router = useRouter();
  const { user, profile, logout, isAuthenticated, isLoading: authLoading, token, refreshToken } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentCharacterData, setCurrentCharacterData] = useState<Partial<Character>>({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingCharacterData, setPendingCharacterData] = useState<Partial<Character>>({});
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveRetryCountRef = useRef(0);
  const fetchRetryCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 获取角色卡列表
  const fetchCharacters = useCallback(async () => {
    console.log('=== fetchCharacters 开始 ===');
    console.log('user?.id:', user?.id);
    console.log('token:', token ? '存在' : '不存在');
    
    if (!user?.id) {
      console.log('No user ID, skipping fetch');
      setIsLoading(false);
      return;
    }
    
    try {
      const url = `/api/characters?user_id=${user.id}`;
      console.log('请求URL:', url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      console.log('响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('获取到的角色卡数量:', data.characters?.length);
        console.log('角色卡数据:', data.characters);
        setCharacters(data.characters || []);
        fetchRetryCountRef.current = 0; // 重置重试计数
      } else {
        const errorText = await response.text();
        console.error('获取失败:', response.status, errorText);
        
        // 检查是否是 JWT 过期错误
        if ((errorText.includes('JWT') || errorText.includes('expired') || response.status === 401) 
            && fetchRetryCountRef.current < 1 && refreshToken) {
          console.log('Token过期，尝试刷新...');
          fetchRetryCountRef.current++;
          const refreshed = await refreshToken();
          if (refreshed) {
            // 刷新成功，重试获取
            setTimeout(() => fetchCharacters(), 100);
            return;
          } else {
            toast.error('登录已过期，请重新登录');
            router.push('/');
            return;
          }
        }
        
        toast.error('获取角色卡失败');
        fetchRetryCountRef.current = 0; // 重置重试计数
      }
    } catch (error) {
      console.error('获取角色卡异常:', error);
      toast.error('获取角色卡失败');
      fetchRetryCountRef.current = 0; // 重置重试计数
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, token, refreshToken, router]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token && user?.id) {
      fetchCharacters();
    }
  }, [isAuthenticated, token, user?.id, fetchCharacters]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, currentResponse]);

  const handleStartCreation = () => {
    setCreateDialogOpen(true);
    setCurrentCharacterData({});
    setUserInput('');
    setChatHistory([]);
    setCurrentResponse('');
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isStreaming) return;

    const userMessage = userInput.trim();
    setUserInput('');
    
    const newUserHistory = [...chatHistory, { role: 'user' as const, content: userMessage }];
    setChatHistory(newUserHistory);
    setIsStreaming(true);
    setCurrentResponse('');

    try {
      const response = await fetch('/api/ai/create-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          characterData: currentCharacterData,
          dialogHistory: newUserHistory,
          userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('AI响应失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setCurrentResponse(fullResponse);
              }
              if (parsed.type === 'character_data') {
                setCurrentCharacterData(parsed.data);
              }
              if (parsed.error) {
                toast.error(parsed.error);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (fullResponse) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      }
      
      setCurrentResponse('');
    } catch (error) {
      console.error('AI角色创建失败:', error);
      toast.error('AI响应失败，请重试');
    } finally {
      setIsStreaming(false);
    }
  };

  // 打开保存确认对话框
  const openSaveConfirm = () => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    
    const extractedData = extractCharacterFromChat(chatHistory);
    
    const characterToSave = {
      ...currentCharacterData,
      ...extractedData,
      user_id: user.id,
    };
    
    console.log('准备保存的角色数据:', characterToSave);
    setPendingCharacterData(characterToSave);
    setEditingName(characterToSave.name || '未命名角色');
    setCreateDialogOpen(false); // 先关闭创建对话框
    setConfirmSaveOpen(true);   // 再打开确认对话框
  };

  // 确认保存角色卡
  const confirmSaveCharacter = async () => {
    if (!editingName.trim()) {
      toast.error('请输入角色名称');
      return;
    }
    
    if (!user?.id) {
      toast.error('请先登录');
      setConfirmSaveOpen(false);
      return;
    }
    
    if (isSaving) return; // 防止重复点击
    
    const characterToSave = {
      ...pendingCharacterData,
      name: editingName.trim(),
      user_id: user.id,
    };
    
    console.log('正在保存角色:', characterToSave);
    setIsSaving(true);

    try {
      const currentToken = token; // 使用当前 token
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(characterToSave),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('=== 保存成功 ===');
        console.log('返回的角色数据:', data.character);
        console.log('当前用户ID:', user?.id);
        toast.success('角色卡保存成功！');
        setConfirmSaveOpen(false);
        setCreateDialogOpen(false);
        setChatHistory([]);
        setCurrentCharacterData({});
        saveRetryCountRef.current = 0; // 重置重试计数
        // 延迟刷新确保状态更新完成
        setTimeout(() => {
          console.log('开始刷新角色卡列表...');
          fetchCharacters();
        }, 100);
      } else {
        const error = await response.json();
        
        // 检查是否是 JWT 过期错误
        if ((error.error?.includes('JWT') || error.error?.includes('expired') || response.status === 401) 
            && saveRetryCountRef.current < 1 && refreshToken) {
          console.log('Token过期，尝试刷新...');
          toast.info('登录已过期，正在刷新...');
          
          saveRetryCountRef.current++;
          const refreshed = await refreshToken();
          if (refreshed) {
            // 刷新成功，重试保存（需要等待状态更新）
            setIsSaving(false);
            setTimeout(() => confirmSaveCharacter(), 100);
            return;
          } else {
            toast.error('登录已过期，请重新登录');
            setConfirmSaveOpen(false);
            router.push('/');
            return;
          }
        }
        
        toast.error(error.error || '保存失败');
        saveRetryCountRef.current = 0; // 重置重试计数
      }
    } catch (error) {
      console.error('保存角色卡失败:', error);
      toast.error('保存角色卡失败');
      saveRetryCountRef.current = 0; // 重置重试计数
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('确定要删除这个角色卡吗？')) return;

    try {
      const response = await fetch(`/api/characters/${characterId}?user_id=${user?.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('角色卡已删除');
        fetchCharacters();
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      console.error('删除角色卡失败:', error);
      toast.error('删除失败');
    }
  };

  // 导出角色卡为xlsx
  const handleExportCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `character_sheet.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('角色卡导出成功！');
    } catch (error) {
      console.error('导出角色卡失败:', error);
      toast.error('导出失败');
    }
  };

  const handleViewCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setDetailDialogOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getAttributeDisplay = (value: number) => {
    const modifier = Math.floor((value - 10) / 2);
    return `${value} (${modifier >= 0 ? '+' : ''}${modifier})`;
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* 背景图 */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: 'url(/kamen-rider-bg-2.jpeg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-card" />
        
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* 背景图 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
        style={{ backgroundImage: 'url(/kamen-rider-bg-2.jpeg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      
      {/* Header */}
      <header className="border-b border-primary/20 bg-card/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/lobby" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-wide group-hover:text-primary transition-colors cursor-pointer">
                假面骑士 <span className="text-accent">TRPG</span>
              </h1>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/lobby">
              <Button variant="outline" className="border-primary/30 text-foreground hover:border-primary hover:text-card-foreground hover:bg-primary/10">
                返回大厅
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary/10">
                  <Avatar className="h-8 w-8 border-2 border-primary/30">
                    <AvatarImage src={profile?.avatar} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-foreground">{profile?.username || profile?.display_name || '用户'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-muted border-primary/20">
                <DropdownMenuLabel className="text-foreground">我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-primary/10" />
                <DropdownMenuItem onClick={handleLogout} className="text-foreground hover:text-card-foreground hover:bg-primary/10 focus:bg-primary/10">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold font-display tracking-wide text-card-foreground">
              我的角色卡
            </h2>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              管理你的假面骑士角色
            </p>
          </div>

          <Button onClick={handleStartCreation} size="lg" className="kamen-btn-primary">
            <Sparkles className="mr-2 h-4 w-4" />
            创建新角色
          </Button>
        </div>

        {/* Character List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">加载角色卡...</p>
          </div>
        ) : characters.length === 0 ? (
          <Card className="text-center py-12 kamen-card backdrop-blur-sm bg-card/95">
            <CardContent className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-primary" />
              </div>
              <p className="text-foreground mb-2 text-lg">你还没有创建任何角色卡</p>
              <p className="text-muted-foreground text-sm mb-6">创建你的第一个假面骑士角色，开始你的冒险之旅</p>
              <Button onClick={handleStartCreation} className="kamen-btn-primary">
                <Sparkles className="mr-2 h-4 w-4" />
                创建第一个角色
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <Card 
                key={character.id} 
                className="kamen-card backdrop-blur-sm bg-card/95 hover:shadow-[0_0_30px_rgba(196,30,58,0.25)] transition-all cursor-pointer group border-primary/15 hover:border-primary/35"
                onClick={() => handleViewCharacter(character)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-primary/30 group-hover:border-primary transition-colors">
                        <AvatarImage src={character.image_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-primary">
                          {character.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-xl text-card-foreground group-hover:text-primary transition-colors">{character.name}</CardTitle>
                        {character.player_name && (
                          <CardDescription className="text-sm text-muted-foreground">
                            玩家: {character.player_name}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-card-foreground hover:bg-primary/10">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-muted border-primary/20">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleExportCharacter(character.id);
                        }} className="text-foreground hover:text-card-foreground hover:bg-primary/10">
                          <Download className="mr-2 h-4 w-4" />
                          导出xlsx
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-primary/10" />
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCharacter(character.id);
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 focus:bg-red-400/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除角色
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Basic Info */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {character.race && (
                      <Badge className="bg-primary/20 text-card-foreground border-primary/30">{character.race}</Badge>
                    )}
                    {character.occupation && (
                      <Badge variant="outline" className="border-accent/30 text-accent">{character.occupation}</Badge>
                    )}
                    {character.age && (
                      <Badge variant="outline" className="border-border/30 text-foreground">{character.age}岁</Badge>
                    )}
                    {character.gender && (
                      <Badge variant="outline" className="border-border/30 text-foreground">{character.gender}</Badge>
                    )}
                  </div>

                  {/* Attributes Summary */}
                  <div className="grid grid-cols-5 gap-1 mb-4 text-xs">
                    {[
                      { name: '肉体', value: character.attributes?.bodyNormal || 0 },
                      { name: '运动', value: character.attributes?.athleticsNormal || 0 },
                      { name: '器用', value: character.attributes?.dexterityNormal || 0 },
                      { name: '意志', value: character.attributes?.willNormal || 0 },
                      { name: '机知', value: character.attributes?.witNormal || 0 },
                    ].map((attr) => (
                      <div key={attr.name} className="text-center p-1.5 bg-muted rounded border border-primary/10">
                        <div className="text-muted-foreground">{attr.name}</div>
                        <div className="font-bold text-sm text-accent">{attr.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* HP */}
                  <div className="flex items-center gap-2 text-sm">
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="text-foreground">HP: <span className="text-primary font-bold">{character.attributes?.totalHP || 0}</span></span>
                    {character.active_power && (
                      <>
                        <Separator orientation="vertical" className="h-4 bg-primary/20" />
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-foreground">活跃力: <span className="text-amber-500 font-bold">{character.active_power}</span></span>
                      </>
                    )}
                  </div>

                  {/* Rider System */}
                  {character.rider_data?.riderSystem && (
                    <div className="mt-3 text-sm text-muted-foreground flex items-center gap-1">
                      <Swords className="h-4 w-4 text-primary" />
                      {character.rider_data.riderSystem}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* AI Character Creation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col kamen-dialog bg-card/95 backdrop-blur-sm border-primary/35">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-card-foreground">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              AI角色创建助手
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              和AI一起创建你的假面骑士角色，AI会记住你说的所有信息
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Chat History */}
            <ScrollArea className="flex-1 min-h-0 max-h-[50vh] p-4 bg-background/50 rounded-lg mb-3 border border-primary/10" ref={scrollRef}>
              <div className="space-y-4">
                {chatHistory.length === 0 && !currentResponse && (
                  <div className="text-center text-muted-foreground py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 mb-4">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-lg mb-2 text-card-foreground">欢迎来到角色创建！</p>
                    <p className="text-muted-foreground">请告诉我你想创建什么样的假面骑士角色？</p>
                    <p className="text-sm mt-2 text-muted-foreground">例如：我想创建一个假面骑士，名字叫...</p>
                  </div>
                )}
                
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-primary/70 text-white'
                          : 'bg-muted border border-accent/20 text-card-foreground'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="text-xs text-accent mb-1 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          DM
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
                
                {currentResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg bg-muted border border-accent/20 text-card-foreground">
                      <div className="text-xs text-accent mb-1 font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        DM
                      </div>
                      <div className="whitespace-pre-wrap text-sm">
                        {currentResponse}
                        <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Current Character Data - Compact */}
            {Object.keys(currentCharacterData).length > 0 && (
              <div className="flex-shrink-0 mb-3 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <div className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  已记录信息
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentCharacterData.name && (
                    <Badge className="text-xs bg-primary/20 text-card-foreground border-primary/30">姓名: {currentCharacterData.name}</Badge>
                  )}
                  {currentCharacterData.age && (
                    <Badge variant="outline" className="text-xs border-accent/30 text-accent">{currentCharacterData.age}岁</Badge>
                  )}
                  {currentCharacterData.gender && (
                    <Badge variant="outline" className="text-xs border-border/30 text-foreground">{currentCharacterData.gender}</Badge>
                  )}
                  {currentCharacterData.race && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">{currentCharacterData.race}</Badge>
                  )}
                  {currentCharacterData.occupation && (
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">{currentCharacterData.occupation}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 space-y-2">
              <Textarea
                placeholder="输入你的想法...（按Enter发送，Shift+Enter换行）"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isStreaming}
                className="min-h-[60px] max-h-[120px] resize-none text-sm bg-background/80 border-primary/20 text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/30"
              />
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  告诉AI角色名称、年龄、性别、背景等
                </p>
                <div className="flex gap-2 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => setCreateDialogOpen(false)} className="text-muted-foreground hover:text-card-foreground hover:bg-primary/10">
                    取消
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={openSaveConfirm}
                    disabled={isStreaming || chatHistory.length < 2}
                    className="border-accent/30 text-accent hover:bg-accent/10 hover:border-accent"
                  >
                    <Save className="mr-1 h-3 w-3" />
                    保存
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSendMessage} 
                    disabled={isStreaming || !userInput.trim()}
                    className="kamen-btn-primary"
                  >
                    {isStreaming ? '思考中...' : '发送'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col kamen-dialog bg-card/95 backdrop-blur-sm border-primary/35">
          {selectedCharacter && (
            <>
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2 text-card-foreground">
                  <Avatar className="h-10 w-10 border-2 border-primary/30">
                    <AvatarImage src={selectedCharacter.image_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-primary">{selectedCharacter.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {selectedCharacter.name}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selectedCharacter.player_name && `玩家: ${selectedCharacter.player_name}`}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4 pr-4">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm text-card-foreground">
                      <User className="h-4 w-4 text-primary" />
                      基本信息
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCharacter.race && (
                        <Badge className="text-xs bg-primary/20 text-card-foreground border-primary/30">种族: {selectedCharacter.race}</Badge>
                      )}
                      {selectedCharacter.occupation && (
                        <Badge variant="outline" className="text-xs border-accent/30 text-accent">职业: {selectedCharacter.occupation}</Badge>
                      )}
                      {selectedCharacter.age && (
                        <Badge variant="outline" className="text-xs border-border/30 text-foreground">{selectedCharacter.age}岁</Badge>
                      )}
                      {selectedCharacter.gender && (
                        <Badge variant="outline" className="text-xs border-border/30 text-foreground">{selectedCharacter.gender}</Badge>
                      )}
                      {selectedCharacter.active_power && (
                        <Badge className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30">活跃力: {selectedCharacter.active_power}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Attributes */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm text-card-foreground">能力值（通常 / 变身后）</h4>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      {[
                        { name: '肉体', normal: selectedCharacter.attributes?.bodyNormal, transform: selectedCharacter.attributes?.bodyTransform },
                        { name: '运动', normal: selectedCharacter.attributes?.athleticsNormal, transform: selectedCharacter.attributes?.athleticsTransform },
                        { name: '器用', normal: selectedCharacter.attributes?.dexterityNormal, transform: selectedCharacter.attributes?.dexterityTransform },
                        { name: '意志', normal: selectedCharacter.attributes?.willNormal, transform: selectedCharacter.attributes?.willTransform },
                        { name: '机知', normal: selectedCharacter.attributes?.witNormal, transform: selectedCharacter.attributes?.witTransform },
                      ].map((attr) => (
                        <div key={attr.name} className="p-2 bg-muted rounded border border-primary/10">
                          <div className="text-muted-foreground">{attr.name}</div>
                          <div className="font-bold text-card-foreground">{attr.normal || 0}</div>
                          <div className="text-primary">变身: {attr.transform || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Attributes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-1 text-sm text-card-foreground">移动力</h4>
                      <div className="text-xs text-foreground">
                        通常: <span className="text-card-foreground">{selectedCharacter.attributes?.movementNormal || 0}</span> / 
                        变身: <span className="text-accent">{selectedCharacter.attributes?.movementTransform || 0}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1 text-sm text-card-foreground">先制力</h4>
                      <div className="text-xs text-foreground">
                        通常: <span className="text-card-foreground">{selectedCharacter.attributes?.initiativeNormal || 0}</span> / 
                        变身: <span className="text-accent">{selectedCharacter.attributes?.initiativeTransform || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* HP */}
                  <div>
                    <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm text-card-foreground">
                      <Heart className="h-4 w-4 text-primary" />
                      HP
                    </h4>
                    <div className="text-xs text-foreground">
                      通常: <span className="text-primary font-bold">{selectedCharacter.attributes?.totalHP || 0}</span> / 
                      变身: <span className="text-primary font-bold">{selectedCharacter.attributes?.transformHP || 0}</span>
                    </div>
                  </div>

                  {/* Rider Data */}
                  {selectedCharacter.rider_data && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm text-card-foreground">
                        <Swords className="h-4 w-4 text-primary" />
                        骑士系统
                      </h4>
                      <div className="space-y-1 text-xs text-foreground">
                        {selectedCharacter.rider_data.riderSystem && (
                          <div>系统: {selectedCharacter.rider_data.riderSystem}</div>
                        )}
                        {selectedCharacter.rider_data.transformationItem && (
                          <div>变身道具: {selectedCharacter.rider_data.transformationItem}</div>
                        )}
                        {selectedCharacter.rider_data.transformationPhrase && (
                          <div>变身口号: {selectedCharacter.rider_data.transformationPhrase}</div>
                        )}
                        {selectedCharacter.rider_data.finisherMoves && selectedCharacter.rider_data.finisherMoves.length > 0 && (
                          <div>必杀技: {selectedCharacter.rider_data.finisherMoves.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Background */}
                  {selectedCharacter.background && (
                    <div>
                      <h4 className="font-semibold mb-1 text-sm">背景故事</h4>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedCharacter.background}
                      </p>
                    </div>
                  )}

                  {/* Weapons */}
                  {selectedCharacter.weapons && selectedCharacter.weapons.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Swords className="h-4 w-4" />
                        武器
                      </h4>
                      <div className="space-y-1">
                        {selectedCharacter.weapons.map((weapon, idx) => (
                          <div key={idx} className="p-2 bg-muted rounded text-xs">
                            <div className="font-medium">{weapon.name}</div>
                            <div className="text-muted-foreground">
                              射程: {weapon.range} | 命中: {weapon.hitTotal} | DP: {weapon.dpTotal}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Equipment */}
                  {selectedCharacter.other_equipment && (
                    <div>
                      <h4 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4" />
                        其他装备
                      </h4>
                      <p className="text-xs text-muted-foreground">{selectedCharacter.other_equipment}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setDetailDialogOpen(false)}>
                  关闭
                </Button>
                <Button size="sm" onClick={() => {
                  handleExportCharacter(selectedCharacter.id);
                  setDetailDialogOpen(false);
                }}>
                  <Download className="mr-1 h-3 w-3" />
                  导出xlsx
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 保存确认对话框 - 使用更高的z-index确保显示在创建对话框之上 */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle>保存角色卡</DialogTitle>
            <DialogDescription>
              确认角色信息并保存
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">角色名称 *</label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="输入角色名称"
                autoFocus
              />
            </div>
            
            {pendingCharacterData.race && (
              <div className="text-sm">
                <span className="text-muted-foreground">种族:</span> {pendingCharacterData.race}
              </div>
            )}
            
            {pendingCharacterData.age && (
              <div className="text-sm">
                <span className="text-muted-foreground">年龄:</span> {pendingCharacterData.age}
              </div>
            )}
            
            {pendingCharacterData.gender && (
              <div className="text-sm">
                <span className="text-muted-foreground">性别:</span> {pendingCharacterData.gender}
              </div>
            )}
            
            {pendingCharacterData.occupation && (
              <div className="text-sm">
                <span className="text-muted-foreground">职业:</span> {pendingCharacterData.occupation}
              </div>
            )}
            
            {pendingCharacterData.background && (
              <div className="text-sm">
                <span className="text-muted-foreground">背景:</span> {pendingCharacterData.background}
              </div>
            )}
            
            {pendingCharacterData.rider_data?.riderSystem && (
              <div className="text-sm">
                <span className="text-muted-foreground">骑士系统:</span> {pendingCharacterData.rider_data.riderSystem}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmSaveOpen(false);
              setCreateDialogOpen(true); // 取消时重新打开创建对话框
            }} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={confirmSaveCharacter} disabled={isSaving}>
              {isSaving ? (
                <>
                  <span className="mr-1 h-3 w-3 animate-spin">⏳</span>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-1 h-3 w-3" />
                  确认保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
