import OpenAI from 'openai';

// DeepSeek API 客户端封装
// DeepSeek API 兼容 OpenAI 格式

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// 支持的模型
export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

// 消息类型
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 创建 DeepSeek 客户端
export function createDeepSeekClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  
  if (!key) {
    throw new Error('DeepSeek API Key 未配置。请设置 DEEPSEEK_API_KEY 环境变量');
  }
  
  return new OpenAI({
    apiKey: key,
    baseURL: DEEPSEEK_BASE_URL,
  });
}

// 非流式调用
export async function deepSeekChat(
  messages: ChatMessage[],
  options?: {
    model?: DeepSeekModel;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const client = createDeepSeekClient();
  
  const model = options?.model || 'deepseek-chat';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens || 4096;
  
  const response = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
  });
  
  return response.choices[0]?.message?.content || '';
}

// 流式调用 - 返回 AsyncIterable
export async function* deepSeekStream(
  messages: ChatMessage[],
  options?: {
    model?: DeepSeekModel;
    temperature?: number;
    maxTokens?: number;
  }
): AsyncGenerator<string> {
  const client = createDeepSeekClient();
  
  const model = options?.model || 'deepseek-chat';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens || 4096;
  
  const stream = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

// 将流式输出转换为 ReadableStream（用于 Response）
export function deepSeekStreamToResponse(
  messages: ChatMessage[],
  options?: {
    model?: DeepSeekModel;
    temperature?: number;
    maxTokens?: number;
  }
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of deepSeekStream(messages, options)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// 默认导出
export default {
  createClient: createDeepSeekClient,
  chat: deepSeekChat,
  stream: deepSeekStream,
  streamToResponse: deepSeekStreamToResponse,
};
