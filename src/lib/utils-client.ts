import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── 骰子相关工具函数 ────────────────────────────────────────────────────────
export function rollDice(dice: string): { result: number; rolls: number[] } {
  const match = dice.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) throw new Error(`Invalid dice notation: ${dice}`);
  
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  
  const result = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { result, rolls };
}

// ─── 格式化工具函数 ────────────────────────────────────────────────────────
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ─── ID 生成工具函数 ────────────────────────────────────────────────────────
export function generateId(): string {
  return crypto.randomUUID();
}

// ─── 延迟工具函数 ────────────────────────────────────────────────────────
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 验证工具函数 ────────────────────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
  return usernameRegex.test(username);
}

// ─── 本地存储工具函数 ────────────────────────────────────────────────────────
export function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}
