'use client';

import { useEffect, useRef, useCallback } from 'react';

interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}

interface UseWebSocketOptions {
  roomId: string;
  userId: string;
  onMessage: (msg: WsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnect?: boolean;
}

export function useGameWebSocket({
  roomId,
  userId,
  onMessage,
  onOpen,
  onClose,
  reconnect = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualClose = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' 
      ? 'wss:' 
      : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game-room`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket 已连接');
      // 发送加入房间消息
      ws.send(JSON.stringify({
        type: 'room:join',
        payload: { roomId, userId },
      }));
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === 'pong') return;
        onMessage(msg);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket 已断开');
      onClose?.();
      
      // 自动重连
      if (reconnect && !isManualClose.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('尝试重新连接...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  }, [roomId, userId, onMessage, onOpen, onClose, reconnect]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }, []);

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
