'use client';

import { useEffect, useRef, useCallback } from 'react';

interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

interface UseWebSocketOptions {
  roomId: string;
  userId: string;
  characterName?: string;
  onMessage: (msg: WsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnect?: boolean;
}

export function useGameWebSocket({
  roomId,
  userId,
  characterName,
  onMessage,
  onOpen,
  onClose,
  reconnect = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualClose = useRef(false);
  
  // 使用 ref 保存回调，避免依赖变化导致重新连接
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  
  // 更新 ref
  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onMessage, onOpen, onClose]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' 
      ? 'wss:' 
      : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game-room`;

    console.log('[WebSocket] 正在连接:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] 已连接，发送加入房间消息');
      // 发送加入房间消息
      ws.send(JSON.stringify({
        type: 'room:join',
        payload: { roomId, userId, characterName },
      }));
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'pong') return;
        console.log('[WebSocket] 收到消息:', msg.type);
        onMessageRef.current(msg);
      } catch (error) {
        console.error('[WebSocket] 解析消息失败:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] 已断开');
      onCloseRef.current?.();
      
      // 自动重连
      if (reconnect && !isManualClose.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] 尝试重新连接...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
    };
  }, [roomId, userId, characterName, reconnect]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      // 发送离开房间消息
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'room:leave', payload: {} }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      console.log('[WebSocket] 发送消息:', msg.type);
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息');
    }
  }, []);

  // 只在 roomId 或 userId 变化时重新连接
  useEffect(() => {
    if (roomId && userId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [roomId, userId, connect, disconnect]);

  return { send, disconnect, reconnect: connect };
}
