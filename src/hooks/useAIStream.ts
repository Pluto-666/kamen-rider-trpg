'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAIStreamOptions {
  url: string;
  onData: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function useAIStream({ url, onData, onComplete, onError }: UseAIStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (body: Record<string, unknown>) => {
    if (isStreaming) return;

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is null');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onData(parsed.content);
              }
              if (parsed.error) {
                onError(parsed.error);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [url, isStreaming, onData, onComplete, onError]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { stream, abort, isStreaming };
}

// 简单的打字机效果hook
export function useTypewriter() {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const appendText = useCallback((chunk: string) => {
    setText((prev) => prev + chunk);
  }, []);

  const resetText = useCallback(() => {
    setText('');
  }, []);

  useEffect(() => {
    if (text.length > 0) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 500);
      return () => clearTimeout(timer);
    }
  }, [text]);

  return { text, isTyping, appendText, resetText, setText };
}
