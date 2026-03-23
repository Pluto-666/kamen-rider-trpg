'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useGameWebSocket } from '@/hooks/useWebSocket';
import { useAIStream, useTypewriter } from '@/hooks/useAIStream';
import { useMessagePolling, sendMessage } from '@/hooks/useMessagePolling';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Swords, 
  Shield, 
  Heart, 
  Sparkles, 
  Download,
  Eye 
} from 'lucide-react';

interface Character {
  id: string;
  name: string;
  title?: string;
  player_name?: string;
  race?: string;
  occupation?: string;
  age?: number;
  gender?: string;
  active_power?: number;
  attributes?: {
    body?: number;
    bodyNormal?: number;
    bodyTransform?: number;
    athletics?: number;
    athleticsNormal?: number;
    athleticsTransform?: number;
    dexterity?: number;
    dexterityNormal?: number;
    dexterityTransform?: number;
    will?: number;
    willNormal?: number;
    willTransform?: number;
    wit?: number;
    witNormal?: number;
    witTransform?: number;
    movementNormal?: number;
    movementTransform?: number;
    initiativeNormal?: number;
    initiativeTransform?: number;
    totalHP?: number;
    transformHP?: number;
  };
  rider_data?: {
    riderSystem?: string;
    transformationItem?: string;
    finisherMoves?: string[];
    transformationPhrase?: string;
  };
  background?: string;
  weapons?: Array<{ name: string; range?: string; hitTotal?: number; dpTotal?: number }>;
  other_equipment?: string;
}

interface RoomMember {
  id: string;
  user_id: string;
  character_id?: string;
  status: string;
  profiles?: {
    username: string;
    display_name?: string;
    avatar?: string;
  };
  characters?: Character;
}

interface Message {
  id: string;
  type: 'chat' | 'narrative' | 'roll' | 'system';
  content: string;
  senderId?: string;
  senderName?: string;
  characterName?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Scenario {
  name: string;
  description: string;
  difficulty: string;
  duration: string;
  reason?: string;
  isOriginal?: boolean;
  isStarter?: boolean;
  source?: string;
  mainEnemy?: string;
  keyLocations?: string[];
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const { user, profile, isAuthenticated, isLoading: authLoading, token } = useAuth();
  
  const [room, setRoom] = useState<{
    id: string;
    name: string;
    description?: string;
    host_id: string;
    status: string;
    members: RoomMember[];
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [characters, setCharacters] = useState<Array<{ id: string; name: string; title?: string }>>([]);
  const [showScenarioDialog, setShowScenarioDialog] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isFirstScenario, setIsFirstScenario] = useState(false);
  const [completedScenarios, setCompletedScenarios] = useState<string[]>([]);
  const [isRefreshingScenarios, setIsRefreshingScenarios] = useState(false);
  const [showCharacterDetail, setShowCharacterDetail] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);
  const [characterDetail, setCharacterDetail] = useState<Character | null>(null);
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);
  const [showRuleQuery, setShowRuleQuery] = useState(false);
  const [ruleQueryInput, setRuleQueryInput] = useState('');
  const [ruleQueryResult, setRuleQueryResult] = useState('');
  const [isQueryingRule, setIsQueryingRule] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmMessageRef = useRef(''); // 使用ref保存AI主持人的发言，避免闭包问题
  const messagesRef = useRef<Message[]>([]); // 使用ref保存消息列表，避免闭包问题
  const [sessionId, setSessionId] = useState<string>('');
  const [gameState, setGameState] = useState<Record<string, unknown>>({});
  const [currentScenarioName, setCurrentScenarioName] = useState<string>('');
  
  // 存档相关状态
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveList, setSaveList] = useState<Array<{
    id: string;
    save_name: string;
    created_at: string;
    room_id: string;
    current_scene?: { scenarioName?: string; gameState?: Record<string, unknown> };
    room_snapshot?: { name?: string; scenario?: string };
  }>>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [diceCount, setDiceCount] = useState('1'); // 骰子数量
  
  
  const { text: dmNarrative, appendText: appendNarrative, resetText: resetNarrative } = useTypewriter();
  const { stream: streamDM, isStreaming: isDMStreaming } = useAIStream({
    url: '/api/ai/dm',
    onData: (text) => {
      console.log('[DM] 收到数据块，长度:', text.length);
      appendNarrative(text);
      dmMessageRef.current += text; // 累积保存AI发言到ref
    },
    onComplete: async () => {
      // 使用ref.current获取完整消息
      const fullMessage = dmMessageRef.current;
      console.log('[DM] 流式传输完成，消息长度:', fullMessage?.length || 0);
      if (fullMessage) {
        // 通过 API 存储 AI 消息
        if (token) {
          await sendMessage(roomId, token, {
            type: 'narrative',
            content: fullMessage,
            characterName: 'AI主持人',
          });
        }
        
        const narrativeMessage = {
          id: Date.now().toString(),
          type: 'narrative' as const,
          content: fullMessage,
          senderName: 'AI主持人',
          timestamp: new Date().toISOString(),
        };
        console.log('[DM] 添加叙事消息到列表');
        setMessages(prev => {
          const updated = [...prev, narrativeMessage];
          console.log('[DM] 消息列表长度:', updated.length);
          return updated;
        });
        
        // 广播AI叙事给房间内其他玩家（WebSocket）
        wsSend({
          type: 'game:narrative',
          payload: {
            content: fullMessage,
            senderName: 'AI主持人',
          },
        });
      } else {
        console.log('[DM] 没有收到任何消息内容');
      }
      resetNarrative();
      dmMessageRef.current = ''; // 重置ref
    },
    onError: (error) => {
      console.error('[DM] AI响应错误:', error);
      toast.error(error);
    },
  });

  // WebSocket连接
  const currentMember = members.find(m => m.user_id === user?.id);
  const currentCharacter = characters.find(c => c.id === selectedCharacterId);
  const { send: wsSend } = useGameWebSocket({
    roomId,
    userId: user?.id || '',
    characterName: currentCharacter?.name || currentMember?.characters?.name,
    onMessage: (msg) => {
      switch (msg.type) {
        case 'room:chat':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'chat',
            content: (msg.payload as { content: string }).content,
            senderId: (msg.payload as { userId?: string }).userId,
            senderName: (msg.payload as { characterName?: string }).characterName || '玩家',
            timestamp: (msg.payload as { timestamp: string }).timestamp,
          }]);
          break;
        case 'game:narrative':
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'narrative',
            content: (msg.payload as { content: string }).content,
            senderName: 'DM',
            timestamp: new Date().toISOString(),
          }]);
          break;
        case 'game:roll_result':
          const rollPayload = msg.payload as {
            userId?: string;
            dice: string;
            result: number;
            rolls: number[];
            attribute?: string;
            difficulty?: number;
            total: number;
          };
          const rollMessage: Message = {
            id: Date.now().toString(),
            type: 'roll' as const,
            content: `掷骰 ${rollPayload.dice}: [${rollPayload.rolls.join(', ')}] = ${rollPayload.total}${rollPayload.difficulty ? ` (难度 ${rollPayload.difficulty})` : ''}`,
            senderId: rollPayload.userId,
            timestamp: new Date().toISOString(),
            metadata: { ...rollPayload },
          };
          setMessages(prev => [...prev, rollMessage]);
          
          // 如果是当前用户的掷骰且游戏进行中，自动触发AI判定
          if (rollPayload.userId === user?.id && selectedCharacterId && room?.status === 'playing') {
            const character = characters.find(c => c.id === selectedCharacterId);
            
            // 计算成功数（5和6为成功）
            const successes = rollPayload.rolls.filter(r => r >= 5).length;
            
            // 构建对话历史（使用 messagesRef 获取最新消息）
            const dialogHistory = [...messagesRef.current, rollMessage].map(m => ({
              role: m.type === 'narrative' ? 'assistant' as const : 'user' as const,
              content: m.type === 'narrative' ? m.content : `[${m.senderName || m.characterName || '玩家'}]: ${m.content}`,
              timestamp: m.timestamp,
            }));
            
            // 延迟调用 streamDM，确保状态已更新
            setTimeout(() => {
              streamDM({
                roomId,
                sessionId,
                gameState,
                dialogHistory,
                characters: members.map(m => m.characters).filter(Boolean),
                playerAction: `[${character?.name || '玩家'}]: 掷骰检定结果 - ${rollMessage.content}\n成功数: ${successes}\n请根据检定结果继续剧情。`,
                scenarioName: currentScenarioName,
              });
            }, 100);
          }
          break;
        case 'user:joined':
          fetchRoomData();
          // 添加系统消息
          const joinedPayload = msg.payload as { userId?: string; characterName?: string };
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'system',
            content: `${joinedPayload.characterName || '玩家'} 进入了房间`,
            timestamp: new Date().toISOString(),
          }]);
          break;
        case 'user:left':
          fetchRoomData();
          // 添加系统消息
          const leftPayload = msg.payload as { userId?: string; characterName?: string };
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'system',
            content: `${leftPayload.characterName || '玩家'} 离开了房间`,
            timestamp: new Date().toISOString(),
          }]);
          break;
      }
    },
    onOpen: () => {
      toast.success('已连接到房间');
    },
    onClose: () => {
      toast.warning('与房间的连接已断开');
    },
  });

  // 消息轮询（作为 WebSocket 的备选方案，适用于 Vercel 等不支持 WebSocket 的环境）
  const { poll: pollMessages } = useMessagePolling({
    roomId,
    token: token || undefined,
    enabled: true, // 始终启用轮询作为备选
    interval: 1500, // 1.5秒轮询一次
    onMessage: (newMessages) => {
      // 处理新消息
      newMessages.forEach((msg) => {
        // 检查消息是否已存在（避免重复）
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          if (exists) return prev;
          
          // 添加新消息
          const formattedMsg: Message = {
            id: msg.id,
            type: msg.type,
            content: msg.content,
            senderId: msg.user_id,
            senderName: msg.character_name || '玩家',
            characterName: msg.character_name,
            timestamp: msg.created_at,
            metadata: msg.metadata,
          };
          return [...prev, formattedMsg];
        });
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && token && roomId) {
      fetchRoomData();
      fetchCharacters();
      
      // 定期刷新房间数据（检测新玩家加入）
      const interval = setInterval(() => {
        fetchRoomData();
      }, 3000); // 每3秒刷新一次
      
      // 页面卸载时离开房间
      const handleBeforeUnload = async () => {
        // 使用 fetch 的 keepalive 选项确保请求被发送
        try {
          await fetch(`/api/rooms/${roomId}/join`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            keepalive: true,
          });
        } catch (e) {
          // 忽略错误
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isAuthenticated, token, roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // 同步更新 messagesRef
    messagesRef.current = messages;
  }, [messages]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRoom(data.data);
        setMembers(data.data.members || []);
        
        // 检查用户是否已选择角色
        const myMember = data.data.members?.find(
          (m: RoomMember) => m.user_id === user?.id
        );
        if (myMember?.character_id) {
          setSelectedCharacterId(myMember.character_id);
        }
      } else {
        toast.error('房间不存在');
        router.push('/lobby');
      }
    } catch (error) {
      console.error('获取房间信息失败:', error);
      toast.error('获取房间信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCharacters = async () => {
    try {
      const response = await fetch(`/api/characters?userId=${user?.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
      }
    } catch (error) {
      console.error('获取角色卡失败:', error);
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    try {
      // 调用 API 保存角色选择到数据库
      const response = await fetch(`/api/rooms/${roomId}/member`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ characterId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedCharacterId(characterId);
        
        // 更新本地 members 状态
        setMembers(prev => prev.map(m => 
          m.user_id === user?.id 
            ? { ...m, character_id: characterId, characters: data.data.character }
            : m
        ));
        
        toast.success('角色已选择');
      } else {
        toast.error('选择角色失败');
      }
    } catch (error) {
      console.error('选择角色失败:', error);
      toast.error('选择角色失败');
    }
  };

  const handleViewCharacter = async (member: RoomMember) => {
    // 检查是否有角色数据
    if (!member.character_id && !member.characters) {
      toast.error('该成员未选择角色');
      return;
    }

    // 如果已经有角色数据，直接显示
    if (member.characters) {
      setCharacterDetail(member.characters as Character);
      setSelectedMember(member);
      setShowCharacterDetail(true);
      return;
    }

    // 否则从API获取角色数据
    if (!member.character_id) {
      toast.error('角色ID不存在');
      return;
    }

    setIsLoadingCharacter(true);
    setSelectedMember(member);
    setShowCharacterDetail(true);

    try {
      const response = await fetch(`/api/characters/${member.character_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCharacterDetail(data.character);
      } else {
        toast.error('获取角色信息失败');
      }
    } catch (error) {
      console.error('获取角色详情失败:', error);
      toast.error('获取角色信息失败');
    } finally {
      setIsLoadingCharacter(false);
    }
  };

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

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const character = characters.find(c => c.id === selectedCharacterId);
    const messageContent = chatInput;
    
    // 检测是否艾特了AI主持人
    const isMentioningDM = messageContent.includes('@AI主持人') || messageContent.includes('@DM') || messageContent.includes('@主持人');
    
    // 通过 API 发送消息（存储到数据库，其他玩家可以通过轮询获取）
    if (token) {
      await sendMessage(roomId, token, {
        type: 'chat',
        content: messageContent,
        characterName: character?.name || profile?.username,
        characterId: selectedCharacterId,
      });
    }
    
    // 立即添加消息到本地消息列表
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'chat',
      content: messageContent,
      senderId: user?.id,
      senderName: character?.name || profile?.username || '玩家',
      characterName: character?.name,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // 同时发送到 WebSocket（如果支持的话）
    wsSend({
      type: 'room:chat',
      payload: {
        content: messageContent,
        characterId: selectedCharacterId,
        characterName: character?.name || profile?.username,
      },
    });

    setChatInput('');
    
    // 如果艾特了AI主持人且游戏未开始，触发AI响应
    if (isMentioningDM && !isInGame) {
      console.log('[handleSendMessage] 检测到@AI主持人，触发响应');
      
      // 构建对话历史
      const dialogHistory = [...messages, newMessage].map(m => ({
        role: m.type === 'narrative' ? 'assistant' as const : 'user' as const,
        content: m.type === 'narrative' ? m.content : `[${m.senderName || m.characterName || '玩家'}]: ${m.content}`,
        timestamp: m.timestamp,
      }));
      
      // 延迟调用AI响应
      setTimeout(() => {
        streamDM({
          roomId,
          sessionId: sessionId || 'pre-game',
          gameState: {},
          dialogHistory,
          characters: members.map(m => m.characters).filter(Boolean),
          playerAction: `[${character?.name || profile?.username || '玩家'}]: ${messageContent}`,
          scenarioName: '',
        });
      }, 100);
    }
  };

  const handleRollDice = (dice: string = '1d20') => {
    wsSend({
      type: 'game:roll',
      payload: { dice },
    });
  };

  // 保存游戏进度
  const handleSaveGame = async () => {
    if (!isInGame) {
      toast.error('游戏未开始，无法保存');
      return;
    }

    if (!token) {
      toast.error('未登录，无法保存');
      return;
    }

    try {
      const saveNameValue = saveName || `存档 ${new Date().toLocaleString('zh-CN')}`;
      
      const response = await fetch('/api/saves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          saveName: saveNameValue,
          messages,
          currentScene: { scenarioName: currentScenarioName, gameState },
          characterStates: members.reduce((acc, m) => {
            if (m.character_id && m.characters) {
              acc[m.character_id] = m.characters;
            }
            return acc;
          }, {} as Record<string, unknown>),
          metadata: {
            sessionId,
            savedAt: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        toast.success('游戏进度已保存');
        setSaveName('');
        setShowSaveDialog(false);
      } else {
        const data = await response.json();
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存进度错误:', error);
      toast.error('保存失败');
    }
  };

  // 加载存档列表
  const loadSaveList = async () => {
    if (!token) {
      toast.error('未登录，无法获取存档');
      return;
    }
    
    setIsLoadingSaves(true);
    try {
      // 获取所有存档，不限制房间
      const response = await fetch('/api/saves', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSaveList(data.data || []);
      } else {
        toast.error('获取存档列表失败');
      }
    } catch (error) {
      console.error('获取存档列表错误:', error);
      toast.error('获取存档列表失败');
    } finally {
      setIsLoadingSaves(false);
    }
  };

  // 读取存档
  const handleLoadSave = async (saveId: string) => {
    if (!token) {
      toast.error('未登录，无法读取存档');
      return;
    }
    
    try {
      const response = await fetch(`/api/saves/${saveId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const save = data.data;
        
        // 恢复消息
        if (save.messages && Array.isArray(save.messages)) {
          setMessages(save.messages);
        }
        
        // 恢复游戏状态
        if (save.current_scene) {
          setGameState(save.current_scene.gameState || {});
          setCurrentScenarioName(save.current_scene.scenarioName || '');
        }
        
        // 恢复会话ID
        if (save.metadata?.sessionId) {
          setSessionId(save.metadata.sessionId);
        }
        
        toast.success('存档已加载');
        setShowLoadDialog(false);
      } else {
        toast.error('读取存档失败');
      }
    } catch (error) {
      console.error('读取存档错误:', error);
      toast.error('读取存档失败');
    }
  };

  // 删除存档
  const handleDeleteSave = async (saveId: string) => {
    if (!confirm('确定要删除这个存档吗？')) return;
    
    if (!token) {
      toast.error('未登录，无法删除存档');
      return;
    }
    
    try {
      const response = await fetch(`/api/saves/${saveId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setSaveList(prev => prev.filter(s => s.id !== saveId));
        toast.success('存档已删除');
      } else {
        toast.error('删除存档失败');
      }
    } catch (error) {
      console.error('删除存档错误:', error);
      toast.error('删除存档失败');
    }
  };

  // 退出房间
  const handleLeaveRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('已离开房间');
        router.push('/lobby');
      } else {
        const error = await response.json();
        toast.error(error.error || '离开房间失败');
      }
    } catch (error) {
      console.error('离开房间失败:', error);
      toast.error('离开房间失败');
    }
  };

  // 规则查询
  const handleRuleQuery = async () => {
    if (!ruleQueryInput.trim()) return;
    
    setIsQueryingRule(true);
    setRuleQueryResult('');

    try {
      const response = await fetch('/api/ai/rule-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: ruleQueryInput }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        let result = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  result += parsed.content;
                  setRuleQueryResult(result);
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
        toast.error('查询失败');
      }
    } catch (error) {
      console.error('规则查询失败:', error);
      toast.error('查询失败');
    } finally {
      setIsQueryingRule(false);
    }
  };

  // @成员
  const handleMentionMember = (memberName: string) => {
    setChatInput(prev => prev + `@${memberName} `);
  };

  // 查看自己的角色卡
  const handleViewMyCharacter = async () => {
    // 先检查用户是否有角色卡
    if (characters.length === 0) {
      toast.error('您还没有创建角色卡，请先到"我的角色"页面创建');
      return;
    }
    
    // 检查是否已在房间选择角色
    const myMember = members.find(m => m.user_id === user?.id);
    
    if (myMember && myMember.character_id) {
      // 已选择角色，直接查看
      handleViewCharacter(myMember);
    } else if (selectedCharacterId) {
      // 已在下拉框选择但还没确认，使用下拉框选择的角色
      const character = characters.find(c => c.id === selectedCharacterId);
      if (character) {
        // 创建一个临时成员对象来查看角色卡
        handleViewCharacter({
          ...myMember,
          character_id: selectedCharacterId,
          characters: character,
        } as RoomMember);
      }
    } else {
      // 提示用户选择角色
      toast.error('请先在左侧"选择角色"下拉框中选择一个角色');
    }
  };

  const handleStartGame = async () => {
    if (!selectedCharacterId) {
      toast.error('请先选择一个角色');
      return;
    }

    setIsStartingGame(true);
    
    try {
      // 获取剧本推荐 - 首次固定生成《被扭曲的世界》
      const response = await fetch('/api/ai/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characters: members.map(m => m.characters).filter(Boolean),
          isFirstScenario: true, // 首次生成
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScenarios(data.data.scenarios || []);
        setIsFirstScenario(data.data.isFirstScenario);
        setCompletedScenarios(data.data.completedScenarios || []);
        setSelectedScenario(''); // 重置选择
        setShowScenarioDialog(true);
      }
    } catch (error) {
      console.error('获取剧本失败:', error);
      toast.error('获取剧本失败');
    } finally {
      setIsStartingGame(false);
    }
  };

  // 刷新剧本选项
  const handleRefreshScenarios = async () => {
    setIsRefreshingScenarios(true);
    setSelectedScenario(''); // 重置选择
    
    try {
      const response = await fetch('/api/ai/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characters: members.map(m => m.characters).filter(Boolean),
          isFirstScenario: false,
          refresh: true, // 刷新请求
          previousScenarios: completedScenarios,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScenarios(data.data.scenarios || []);
        setIsFirstScenario(data.data.isFirstScenario);
        setCompletedScenarios(data.data.completedScenarios || []);
        
        if (data.data.allModulesCompleted) {
          toast.success('恭喜！所有预设剧本已通关，AI为您创作了全新剧本！');
        }
      }
    } catch (error) {
      console.error('刷新剧本失败:', error);
      toast.error('刷新剧本失败');
    } finally {
      setIsRefreshingScenarios(false);
    }
  };

  const handleSelectScenario = async () => {
    if (!selectedScenario) {
      toast.error('请选择一个剧本');
      return;
    }

    setShowScenarioDialog(false);
    setCurrentScenarioName(selectedScenario); // 保存当前剧本名称

    // 创建游戏会话
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          scenarioName: selectedScenario,
          participants: members.map(m => ({
            userId: m.user_id,
            characterId: m.character_id,
            characterName: m.characters?.name,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.data.id);
        setGameState(data.data.game_state);
        
        // 更新本地房间状态为游戏中
        setRoom(prev => prev ? { ...prev, status: 'playing' } : null);
        
        // 开始AI叙事
        streamDM({
          roomId,
          sessionId: data.data.id,
          gameState: data.data.game_state,
          characters: members.map(m => m.characters).filter(Boolean),
          scenarioName: selectedScenario,
          playerAction: '开始游戏',
          dialogHistory: [],
        });
      }
    } catch (error) {
      console.error('开始游戏失败:', error);
      toast.error('开始游戏失败');
    }
  };

  const handlePlayerAction = async () => {
    if (!chatInput.trim()) {
      console.log('[handlePlayerAction] 输入为空，跳过');
      return;
    }
    
    if (isDMStreaming) {
      console.log('[handlePlayerAction] AI正在响应中，跳过');
      return;
    }

    const character = characters.find(c => c.id === selectedCharacterId);
    const playerMessage = chatInput;
    
    console.log('[handlePlayerAction] 发送消息:', {
      playerMessage,
      character: character?.name,
      sessionId,
      isInGame,
    });
    
    // 通过 API 发送消息（存储到数据库）
    if (token) {
      await sendMessage(roomId, token, {
        type: 'chat',
        content: playerMessage,
        characterName: character?.name || profile?.username,
        characterId: selectedCharacterId,
      });
    }
    
    // 先添加玩家消息到消息列表
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'chat',
      content: playerMessage,
      senderId: user?.id,
      senderName: character?.name || profile?.username || '玩家',
      characterName: character?.name,
      timestamp: new Date().toISOString(),
    };
    
    console.log('[handlePlayerAction] 添加消息到列表:', newMessage);
    setMessages(prev => {
      const updated = [...prev, newMessage];
      console.log('[handlePlayerAction] 消息列表长度:', updated.length);
      return updated;
    });
    
    // 发送玩家行动到WebSocket广播给其他玩家
    wsSend({
      type: 'room:chat',
      payload: {
        content: playerMessage,
        characterId: selectedCharacterId,
        characterName: character?.name || profile?.username,
      },
    });

    // 获取AI响应 - 使用更新后的消息列表
    const dialogHistory = [...messages, newMessage].map(m => ({
      role: m.type === 'narrative' ? 'assistant' as const : 'user' as const,
      content: m.type === 'narrative' ? m.content : `[${m.senderName || m.characterName || '玩家'}]: ${m.content}`,
      timestamp: m.timestamp,
    }));
    
    console.log('[handlePlayerAction] 对话历史长度:', dialogHistory.length);
    
    streamDM({
      roomId,
      sessionId,
      gameState,
      dialogHistory,
      characters: members.map(m => m.characters).filter(Boolean),
      playerAction: `[${character?.name || '玩家'}]: ${playerMessage}`,
      scenarioName: currentScenarioName,
    });

    setChatInput('');
  };

  const isHost = room?.host_id === user?.id;
  const isInGame = room?.status === 'playing';

  // 调试信息
  useEffect(() => {
    if (room && user) {
      console.log('房间状态调试:', {
        hostId: room.host_id,
        userId: user.id,
        isHost,
        status: room.status,
        isInGame,
        messagesCount: messages.length,
        sessionId,
        showStartButton: isHost && room.status === 'waiting'
      });
    }
  }, [room, user, isHost, isInGame, messages.length, sessionId]);

  // 监听消息变化
  useEffect(() => {
    console.log('[Messages] 消息列表更新，长度:', messages.length);
    messages.forEach((msg, i) => {
      console.log(`[Messages] ${i}: [${msg.type}] ${msg.senderName}: ${msg.content.substring(0, 50)}...`);
    });
  }, [messages]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-texture">
      {/* Header - 假面骑士风格 */}
      <header className="border-b border-border/50 bg-gradient-to-r from-[#12121a] via-[#1a1a25] to-[#12121a]">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleLeaveRoom} className="text-muted-foreground hover:text-primary hover:bg-primary/10">
              ← 退出房间
            </Button>
            <div className="relative">
              <h1 className="text-xl font-bold font-display text-gradient-rider tracking-wider">{room?.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Badge className={`${room?.status === 'waiting' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'} text-xs font-display`}>
                  {room?.status === 'waiting' ? '⏳ 等待中' : '⚔️ 游戏中'}
                </Badge>
                <span className="text-xs">{members.length}人在线</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isHost && room?.status === 'waiting' && (
              <Button 
                onClick={handleStartGame} 
                disabled={isStartingGame}
                className="kamen-btn-primary px-6 py-2 rounded"
              >
                {isStartingGame ? '⏳ 准备中...' : '⚡ 开始游戏'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Sidebar - Members */}
          <div className="col-span-2">
            <Card className="h-full kamen-card rounded-lg">
              <CardHeader className="py-3 border-b border-border/30">
                <CardTitle className="text-sm font-display text-accent tracking-wider">👥 房间成员</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {/* AI主持人 - 始终显示 */}
                  <div
                    className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 cursor-pointer hover:from-primary/30 hover:to-primary/10 transition-all duration-300"
                    onClick={() => handleMentionMember('AI主持人')}
                    title="点击@AI主持人"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8 bg-primary/30 border border-primary/50">
                        <AvatarFallback className="bg-transparent text-primary text-lg">
                          🎭
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full status-playing"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary font-display">
                        AI主持人
                      </div>
                      <div className="text-xs text-muted-foreground">
                        游戏主持人
                      </div>
                    </div>
                    <Badge className="text-xs bg-primary/80 text-white font-display">DM</Badge>
                  </div>
                  
                  {/* 玩家成员 */}
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-accent/30 transition-all duration-300 cursor-pointer"
                      onClick={() => handleMentionMember(member.characters?.name || member.profiles?.username || '玩家')}
                      title="点击@该成员"
                    >
                      <Avatar className="h-8 w-8 avatar-frame">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {(member.characters?.name || member.profiles?.username)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground">
                          {member.characters?.name || member.profiles?.username}
                        </div>
                        {member.characters?.title && (
                          <div className="text-xs text-muted-foreground truncate">
                            {member.characters.title}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {member.character_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-accent hover:bg-accent/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewCharacter(member);
                            }}
                            title="查看角色卡"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        {member.user_id === room?.host_id && (
                          <Badge variant="outline" className="text-xs text-accent border-accent/50 font-display">房主</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Character Selection */}
                {room?.status === 'waiting' && characters.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <label className="text-sm font-medium">选择角色</label>
                      <Select value={selectedCharacterId} onValueChange={handleSelectCharacter}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色卡" />
                        </SelectTrigger>
                        <SelectContent>
                          {characters.map((char) => (
                            <SelectItem key={char.id} value={char.id}>
                              {char.name} {char.title && `(${char.title})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="col-span-8">
            <Card className="h-full flex flex-col kamen-card rounded-lg overflow-hidden">
              <CardContent className="flex-1 p-0 bg-gradient-to-b from-[#0d0d12] to-[#12121a]">
                <ScrollArea className="h-[calc(100vh-200px)] p-4">
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg transition-all duration-300 ${
                          msg.type === 'narrative' ? 'message-dm p-4' : ''
                        } ${
                          msg.type === 'chat' ? 'message-player p-3' : ''
                        } ${
                          msg.type === 'roll' ? 'message-roll p-3' : ''
                        } ${
                          msg.type === 'system' ? 'message-system p-2 text-center' : ''
                        }`}
                      >
                        {msg.type === 'system' && (
                          <div className="text-sm text-muted-foreground/80 italic">
                            {msg.content}
                          </div>
                        )}
                        {msg.type === 'narrative' && (
                          <div className="flex items-center gap-2 text-xs text-accent mb-2 font-display tracking-wider">
                            <span className="text-lg">🎭</span>
                            <span>DM 叙事</span>
                          </div>
                        )}
                        {msg.type === 'roll' && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground">{msg.senderName || '玩家'}</span>
                            <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-display">🎲 掷骰</Badge>
                          </div>
                        )}
                        {msg.type === 'chat' && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium text-sm shrink-0 text-primary font-display">
                              {msg.senderName || '玩家'}:
                            </span>
                            <span className="text-sm flex-1 text-foreground/90">{msg.content}</span>
                          </div>
                        )}
                        {msg.type === 'narrative' && (
                          <div className="text-sm prose prose-sm dark:prose-invert whitespace-pre-wrap text-foreground/90 leading-relaxed">
                            {msg.content}
                          </div>
                        )}
                        {msg.type === 'roll' && (
                          <div className="text-sm mt-1 text-yellow-300 font-mono">{msg.content}</div>
                        )}
                        <div className="text-xs text-muted-foreground/50 mt-2">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    {dmNarrative && (
                      <div className="message-dm p-4 rounded-lg border border-accent/20 animate-pulse">
                        <div className="flex items-center gap-2 text-xs text-accent mb-2 font-display tracking-wider">
                          <span className="text-lg">🎭</span>
                          <span>DM 叙事</span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap text-foreground/90 leading-relaxed">
                          {dmNarrative}
                          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1"></span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Input Area */}
              <div className="border-t border-border/30 p-4 bg-[#0d0d12]">
                <div className="flex gap-3">
                  <Input
                    placeholder={isInGame ? "⚔️ 输入你的行动..." : "💬 输入消息..."}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (isInGame) {
                          handlePlayerAction();
                        } else {
                          handleSendMessage();
                        }
                      }
                    }}
                    disabled={isDMStreaming}
                    className="kamen-input rounded-lg"
                  />
                  <Button
                    onClick={isInGame ? handlePlayerAction : handleSendMessage}
                    disabled={isDMStreaming || !chatInput.trim()}
                    className="kamen-btn-primary rounded-lg px-6"
                  >
                    {isDMStreaming ? '⏳' : '🚀'} 发送
                  </Button>
                </div>

                {/* Dice Roll Buttons */}
                {isInGame && (
                  <div className="space-y-2 mt-3 p-3 bg-muted/20 rounded-lg border border-border/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground whitespace-nowrap font-display tracking-wide">🎲 投掷</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={diceCount}
                        onChange={(e) => setDiceCount(e.target.value)}
                        className="w-16 px-2 py-1 text-center border border-accent/30 rounded-md text-sm bg-muted/30 text-accent focus:border-accent focus:ring-1 focus:ring-accent/50"
                        placeholder="数量"
                      />
                      <span className="text-sm text-muted-foreground">个</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRollDice(`${diceCount || '1'}d4`)}
                        className="dice-btn min-w-[60px] rounded-md"
                      >
                        {diceCount || '1'}d4
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRollDice(`${diceCount || '1'}d6`)}
                        className="dice-btn min-w-[60px] rounded-md"
                      >
                        {diceCount || '1'}d6
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRollDice(`${diceCount || '1'}d8`)}
                        className="dice-btn min-w-[60px] rounded-md"
                      >
                        {diceCount || '1'}d8
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRollDice(`${diceCount || '1'}d20`)}
                        className="dice-btn min-w-[60px] rounded-md"
                      >
                        {diceCount || '1'}d20
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRollDice(`${diceCount || '1'}d100`)}
                        className="dice-btn min-w-[60px] rounded-md"
                      >
                        {diceCount || '1'}d100
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Game Info */}
          <div className="col-span-2">
            <Card className="h-full kamen-card rounded-lg overflow-hidden">
              <CardHeader className="py-3 bg-gradient-to-r from-secondary/5 to-transparent border-b border-border/30">
                <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                  <span className="text-base">📊</span> 游戏信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4 text-sm">
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/20">
                    <div className="text-muted-foreground text-xs font-display tracking-wide">剧本</div>
                    <div className="font-medium text-secondary mt-1">{selectedScenario || '未开始'}</div>
                  </div>
                  
                  <Separator className="opacity-30" />
                  
                  <div>
                    <div className="text-muted-foreground text-xs mb-2 font-display tracking-wide">快捷操作</div>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start rounded-md border-border/30 hover:border-accent/50 hover:bg-accent/5" 
                        size="sm"
                        onClick={handleViewMyCharacter}
                      >
                        📋 查看角色卡
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start rounded-md border-border/30 hover:border-primary/50 hover:bg-primary/5" 
                        size="sm"
                        onClick={() => setShowRuleQuery(true)}
                      >
                        📖 规则查询
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start rounded-md border-border/30 hover:border-secondary/50 hover:bg-secondary/5" 
                        size="sm"
                        onClick={() => setShowSaveDialog(true)}
                        disabled={!isInGame}
                      >
                        💾 保存进度
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start rounded-md border-border/30 hover:border-primary/50 hover:bg-primary/5" 
                        size="sm"
                        onClick={() => {
                          loadSaveList();
                          setShowLoadDialog(true);
                        }}
                      >
                        📂 读取进度
                      </Button>
                    </div>
                  </div>
                  
                  <Separator className="opacity-30" />
                  
                  <div>
                    <Button 
                      variant="destructive" 
                      className="w-full rounded-md" 
                      size="sm"
                      onClick={handleLeaveRoom}
                    >
                      🚪 退出房间
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Scenario Selection Dialog */}
      <Dialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
        <DialogContent className="sm:max-w-lg kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8f0]">选择剧本</DialogTitle>
            <DialogDescription className="text-[#9a9aaa]">
              {isFirstScenario 
                ? '推荐您从入门剧本开始游戏' 
                : completedScenarios.length > 0 
                  ? `已通关: ${completedScenarios.join('、')}` 
                  : 'AI为您推荐了以下剧本'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {scenarios.map((scenario, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors bg-[#151520] border-[#c41e3a]/20 ${
                  selectedScenario === scenario.name ? 'ring-2 ring-[#c41e3a]/50 bg-[#c41e3a]/10' : 'hover:bg-[#c41e3a]/5'
                }`}
                onClick={() => setSelectedScenario(scenario.name)}
              >
                <CardContent className="py-4">
                  <div className="font-medium flex items-center gap-2 text-lg text-[#e8e8f0]">
                    {scenario.name}
                    {scenario.isStarter && (
                      <Badge className="text-xs bg-[#c41e3a]/25 text-[#e8e8f0] border-[#c41e3a]/40">新手推荐</Badge>
                    )}
                    {scenario.isOriginal && (
                      <Badge variant="secondary" className="text-xs bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40">原创</Badge>
                    )}
                  </div>
                  
                  {/* 剧本简介 - 突出显示 */}
                  <div className="mt-3 p-3 bg-[#1e1e28] rounded-md border-l-4 border-[#c41e3a]/50">
                    <p className="text-sm leading-relaxed text-[#c0c0c8]">
                      {scenario.description}
                    </p>
                  </div>
                  
                  {/* 标签信息 */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs border-[#c41e3a]/30 text-[#c0c0c8]">
                      {scenario.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-[#c41e3a]/30 text-[#c0c0c8]">
                      {scenario.duration}
                    </Badge>
                    {scenario.mainEnemy && (
                      <Badge variant="destructive" className="text-xs bg-[#dc2626]/80">
                        敌人: {scenario.mainEnemy}
                      </Badge>
                    )}
                  </div>
                  
                  {/* 推荐理由 */}
                  {scenario.reason && (
                    <div className="text-xs text-[#9a9aaa] mt-2 italic flex items-center gap-1">
                      <span>💡</span>
                      {scenario.reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-2">
            {!isFirstScenario && (
              <Button 
                variant="outline" 
                onClick={handleRefreshScenarios}
                disabled={isRefreshingScenarios}
                className="flex-1 border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]"
              >
                {isRefreshingScenarios ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    刷新中...
                  </>
                ) : (
                  <>刷新选项</>
                )}
              </Button>
            )}
            <Button 
              onClick={handleSelectScenario} 
              disabled={!selectedScenario || isRefreshingScenarios} 
              className="flex-1 kamen-btn-primary"
            >
              开始游戏
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Detail Dialog */}
      <Dialog open={showCharacterDetail} onOpenChange={setShowCharacterDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
          {isLoadingCharacter ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c41e3a]"></div>
            </div>
          ) : characterDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[#e8e8f0]">
                  <Avatar className="h-10 w-10 bg-[#c41e3a]/20 border border-[#c41e3a]/40">
                    <AvatarFallback className="text-[#c41e3a]">{characterDetail.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {characterDetail.name}
                </DialogTitle>
                <DialogDescription className="text-[#9a9aaa]">
                  {characterDetail.player_name && `玩家: ${characterDetail.player_name}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-[#e8e8f0]">
                    <User className="h-4 w-4 text-[#c41e3a]" />
                    基本信息
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {characterDetail.race && (
                      <Badge className="bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40">种族: {characterDetail.race}</Badge>
                    )}
                    {characterDetail.occupation && (
                      <Badge variant="outline" className="border-[#c41e3a]/30 text-[#c0c0c8]">职业: {characterDetail.occupation}</Badge>
                    )}
                    {characterDetail.age && (
                      <Badge variant="outline" className="border-[#c41e3a]/30 text-[#c0c0c8]">{characterDetail.age}岁</Badge>
                    )}
                    {characterDetail.gender && (
                      <Badge variant="outline" className="border-[#c41e3a]/30 text-[#c0c0c8]">{characterDetail.gender}</Badge>
                    )}
                    {characterDetail.active_power && (
                      <Badge className="bg-[#c41e3a]/25 text-[#e8e8f0] border-[#c41e3a]/40">活跃力: {characterDetail.active_power}</Badge>
                    )}
                  </div>
                </div>

                {/* Attributes */}
                {characterDetail.attributes && (
                  <div>
                    <h4 className="font-semibold mb-2 text-[#e8e8f0]">能力值（通常 / 变身后）</h4>
                    <div className="grid grid-cols-5 gap-2 text-center text-sm">
                      {[
                        { name: '肉体', normal: characterDetail.attributes.bodyNormal, transform: characterDetail.attributes.bodyTransform },
                        { name: '运动', normal: characterDetail.attributes.athleticsNormal, transform: characterDetail.attributes.athleticsTransform },
                        { name: '器用', normal: characterDetail.attributes.dexterityNormal, transform: characterDetail.attributes.dexterityTransform },
                        { name: '意志', normal: characterDetail.attributes.willNormal, transform: characterDetail.attributes.willTransform },
                        { name: '机知', normal: characterDetail.attributes.witNormal, transform: characterDetail.attributes.witTransform },
                      ].map((attr) => (
                        <div key={attr.name} className="p-2 bg-[#151520] rounded border border-[#c41e3a]/20">
                          <div className="text-[#9a9aaa]">{attr.name}</div>
                          <div className="font-bold text-[#e8e8f0]">{attr.normal || 0}</div>
                          <div className="text-xs text-[#c41e3a]">变身: {attr.transform || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secondary Attributes */}
                {characterDetail.attributes && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 text-[#e8e8f0]">移动力</h4>
                      <div className="text-sm text-[#c0c0c8]">
                        通常: {characterDetail.attributes.movementNormal || 0} / 
                        变身: {characterDetail.attributes.movementTransform || 0}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 text-[#e8e8f0]">先制力</h4>
                      <div className="text-sm text-[#c0c0c8]">
                        通常: {characterDetail.attributes.initiativeNormal || 0} / 
                        变身: {characterDetail.attributes.initiativeTransform || 0}
                      </div>
                    </div>
                  </div>
                )}

                {/* HP */}
                {characterDetail.attributes && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-[#e8e8f0]">
                      <Heart className="h-4 w-4 text-[#ef4444]" />
                      HP
                    </h4>
                    <div className="text-sm text-[#c0c0c8]">
                      通常: {characterDetail.attributes.totalHP || 0} / 
                      变身: {characterDetail.attributes.transformHP || 0}
                    </div>
                  </div>
                )}

                {/* Rider Data */}
                {characterDetail.rider_data && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-[#e8e8f0]">
                      <Swords className="h-4 w-4 text-[#c41e3a]" />
                      骑士系统
                    </h4>
                    <div className="space-y-1 text-sm text-[#c0c0c8]">
                      {characterDetail.rider_data.riderSystem && (
                        <div>系统: {characterDetail.rider_data.riderSystem}</div>
                      )}
                      {characterDetail.rider_data.transformationItem && (
                        <div>变身道具: {characterDetail.rider_data.transformationItem}</div>
                      )}
                      {characterDetail.rider_data.transformationPhrase && (
                        <div>变身口号: {characterDetail.rider_data.transformationPhrase}</div>
                      )}
                      {characterDetail.rider_data.finisherMoves && characterDetail.rider_data.finisherMoves.length > 0 && (
                        <div>必杀技: {characterDetail.rider_data.finisherMoves.join(', ')}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Background */}
                {characterDetail.background && (
                  <div>
                    <h4 className="font-semibold mb-2 text-[#e8e8f0]">背景故事</h4>
                    <p className="text-sm text-[#9a9aaa] whitespace-pre-wrap">
                      {characterDetail.background}
                    </p>
                  </div>
                )}

                {/* Weapons */}
                {characterDetail.weapons && characterDetail.weapons.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-[#e8e8f0]">
                      <Swords className="h-4 w-4 text-[#c41e3a]" />
                      武器
                    </h4>
                    <div className="space-y-2">
                      {characterDetail.weapons.map((weapon, idx) => (
                        <div key={idx} className="p-2 bg-[#151520] rounded text-sm border border-[#c41e3a]/20">
                          <div className="font-medium text-[#e8e8f0]">{weapon.name}</div>
                          <div className="text-[#9a9aaa]">
                            射程: {weapon.range} | 命中: {weapon.hitTotal} | DP: {weapon.dpTotal}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Equipment */}
                {characterDetail.other_equipment && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-[#e8e8f0]">
                      <Shield className="h-4 w-4 text-[#c41e3a]" />
                      其他装备
                    </h4>
                    <p className="text-sm text-[#9a9aaa]">{characterDetail.other_equipment}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCharacterDetail(false)} className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]">
                  关闭
                </Button>
                <Button onClick={() => {
                  handleExportCharacter(characterDetail.id);
                }} className="kamen-btn-primary">
                  <Download className="mr-2 h-4 w-4" />
                  导出xlsx
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="text-center py-12 text-[#9a9aaa]">
              未找到角色信息
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rule Query Dialog */}
      <Dialog open={showRuleQuery} onOpenChange={setShowRuleQuery}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8f0]">📖 规则查询</DialogTitle>
            <DialogDescription className="text-[#9a9aaa]">
              查询假面骑士TRPG规则书中的内容
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="输入你想查询的规则，如：变身、必杀技、战斗..."
                value={ruleQueryInput}
                onChange={(e) => setRuleQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRuleQuery();
                  }
                }}
                className="bg-[#151520] border-[#c41e3a]/30 text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:border-[#c41e3a]/60"
              />
              <Button onClick={handleRuleQuery} disabled={isQueryingRule || !ruleQueryInput.trim()} className="kamen-btn-primary">
                {isQueryingRule ? '查询中...' : '查询'}
              </Button>
            </div>
            
            {ruleQueryResult && (
              <ScrollArea className="h-[400px] w-full rounded border border-[#c41e3a]/20 p-4 bg-[#151520]">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-[#c0c0c8]">
                  {ruleQueryResult}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRuleQuery(false);
              setRuleQueryResult('');
              setRuleQueryInput('');
            }} className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Game Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8f0]">💾 保存游戏进度</DialogTitle>
            <DialogDescription className="text-[#9a9aaa]">
              保存当前游戏状态，包括所有消息记录和角色状态
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#c0c0c8]">存档名称</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-[#c41e3a]/30 rounded-md bg-[#151520] text-[#e8e8f0] placeholder:text-[#6a6a7a] focus:outline-none focus:border-[#c41e3a]/60"
                placeholder={`存档 ${new Date().toLocaleString('zh-CN')}`}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
            <div className="text-sm text-[#9a9aaa]">
              <p>当前场景: {currentScenarioName || '未知'}</p>
              <p>消息数量: {messages.length}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]">
              取消
            </Button>
            <Button onClick={handleSaveGame} className="kamen-btn-primary">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Game Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-lg kamen-dialog bg-[#1e1e28]/95 backdrop-blur-sm border-[#c41e3a]/35">
          <DialogHeader>
            <DialogTitle className="text-[#e8e8f0] flex items-center gap-2">📂 读取游戏进度</DialogTitle>
            <DialogDescription className="text-[#9a9aaa]">
              选择一个存档继续游戏
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {isLoadingSaves ? (
              <div className="text-center text-[#9a9aaa] py-8">
                加载中...
              </div>
            ) : saveList.length === 0 ? (
              <div className="text-center text-[#9a9aaa] py-8">
                暂无存档
              </div>
            ) : (
              saveList.map((save) => (
                <div
                  key={save.id}
                  className={`flex items-center justify-between p-4 border border-[#c41e3a]/20 rounded-lg hover:bg-[#c41e3a]/10 transition-colors bg-[#151520] ${
                    save.room_id === roomId ? 'ring-2 ring-[#c41e3a]/50 bg-[#c41e3a]/10' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-[#e8e8f0]">{save.save_name}</h4>
                      {save.room_id === roomId && (
                        <Badge className="text-xs bg-[#c41e3a]/25 text-[#e8e8f0] border-[#c41e3a]/40">当前房间</Badge>
                      )}
                    </div>
                    <p className="text-sm text-[#9a9aaa]">
                      {new Date(save.created_at).toLocaleString('zh-CN')}
                    </p>
                    {save.current_scene?.scenarioName && (
                      <p className="text-sm text-[#00d4ff]">
                        剧本: {save.current_scene.scenarioName}
                      </p>
                    )}
                    {save.room_snapshot?.name && (
                      <p className="text-xs text-[#c0c0c8]">
                        房间: {save.room_snapshot.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleLoadSave(save.id)}
                      className="kamen-btn-primary"
                    >
                      读取
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSave(save.id)}
                      className="bg-[#dc2626]/80 hover:bg-[#dc2626]"
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)} className="border-[#c41e3a]/30 text-[#c0c0c8] hover:border-[#c41e3a] hover:text-[#e8e8f0]">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
