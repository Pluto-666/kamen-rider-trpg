'use client';

import { useState, useRef, useCallback } from 'react';

interface UseAIStreamOptions {
  url: string;
  onData: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function useAIStream({ url, onData, onComplete, onError }: UseAIStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>(''); // 用于处理跨 chunk 的数据

  const stream = useCallback(async (body: Record<string, unknown>) => {
    if (isStreaming) {
      console.log('[useAIStream] 已经在流式传输中，跳过');
      return;
    }

    console.log('[useAIStream] 开始流式请求:', url);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    bufferRef.current = '';

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

      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        
        if (done) break;

        const chunk = decoder.decode(result.value, { stream: true });
        bufferRef.current += chunk;

        // 按行分割处理
        const lines = bufferRef.current.split('\n');
        
        // 保留最后一个可能不完整的行
        bufferRef.current = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim();
            
            if (data === '[DONE]') {
              console.log('[useAIStream] 收到 [DONE] 信号');
              onComplete();
              // 设置 done 为 true 来退出循环
              done = true;
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onData(parsed.content);
              }
              if (parsed.error) {
                console.error('[useAIStream] 收到错误:', parsed.error);
                onError(parsed.error);
              }
            } catch (parseError) {
              // JSON 解析失败，可能是不完整的数据
              console.warn('[useAIStream] JSON 解析失败:', data.substring(0, 100));
            }
          }
        }
      }

      console.log('[useAIStream] 流式传输完成');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[useAIStream] 流被中止');
      } else {
        console.error('[useAIStream] 流式传输错误:', error);
        onError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      bufferRef.current = '';
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

  const appendText = useCallback((chunk: string) => {
    setText((prev) => prev + chunk);
  }, []);

  const resetText = useCallback(() => {
    setText('');
  }, []);

  return { text, appendText, resetText, setText };
}
