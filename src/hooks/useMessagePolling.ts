'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  type: 'chat' | 'narrative' | 'roll' | 'system';
  content: string;
  user_id?: string;
  character_name?: string;
  character_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface UseMessagePollingOptions {
  roomId: string;
  token?: string;
  enabled?: boolean;
  interval?: number; // 轮询间隔，默认2000ms
  onMessage: (messages: Message[]) => void;
  onUserJoined?: (data: { userId: string; characterName: string }) => void;
  onUserLeft?: (data: { userId: string; characterName: string }) => void;
}

export function useMessagePolling({
  roomId,
  token,
  enabled = true,
  interval = 2000,
  onMessage,
}: UseMessagePollingOptions) {
  const lastTimestampRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMessageRef = useRef(onMessage);

  // 更新 ref
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const poll = useCallback(async () => {
    if (!token || !roomId) return;

    try {
      const url = `/api/rooms/${roomId}/messages${lastTimestampRef.current ? `?since=${encodeURIComponent(lastTimestampRef.current)}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          // 更新最后时间戳
          const lastMsg = data.data[data.data.length - 1];
          lastTimestampRef.current = lastMsg.created_at;
          
          // 转换消息格式
          const messages: Message[] = data.data.map((msg: any) => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            user_id: msg.user_id,
            character_name: msg.character_name,
            character_id: msg.character_id,
            metadata: msg.metadata,
            created_at: msg.created_at,
          }));

          onMessageRef.current(messages);
        }
      }
    } catch (error) {
      console.error('[轮询] 获取消息失败:', error);
    }
  }, [roomId, token]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // 立即拉取一次
    poll();
    
    // 定时轮询
    intervalRef.current = setInterval(poll, interval);
    console.log('[轮询] 开始轮询消息，间隔:', interval);
  }, [poll, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[轮询] 停止轮询');
    }
  }, []);

  useEffect(() => {
    if (enabled && token && roomId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, token, roomId, startPolling, stopPolling]);

  return { startPolling, stopPolling, poll };
}

// 发送消息的辅助函数
export async function sendMessage(
  roomId: string,
  token: string,
  data: {
    type: 'chat' | 'narrative' | 'roll' | 'system';
    content: string;
    characterName?: string;
    characterId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return response.ok;
  } catch (error) {
    console.error('[发送消息] 失败:', error);
    return false;
  }
}
