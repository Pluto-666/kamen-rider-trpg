'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar?: string;
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<{ needsEmailConfirmation?: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token 过期检查（Supabase JWT 默认 1 小时过期）
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // 转换为毫秒
    // 提前 5 分钟认为过期，给刷新留出时间
    return Date.now() >= exp - 5 * 60 * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查本地存储的token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    
    if (storedToken) {
      // 检查 token 是否过期
      if (isTokenExpired(storedToken)) {
        // Token 已过期，尝试刷新
        if (storedRefreshToken) {
          setRefreshTokenValue(storedRefreshToken);
          refreshTokenInternal(storedRefreshToken).then((success) => {
            if (!success) {
              // 刷新失败，清除状态
              clearAuthState();
            }
            setIsLoading(false);
          });
        } else {
          // 没有 refresh token，清除状态
          clearAuthState();
          setIsLoading(false);
        }
      } else {
        // Token 未过期，获取用户数据
        setToken(storedToken);
        setRefreshTokenValue(storedRefreshToken);
        fetchUserData(storedToken).finally(() => setIsLoading(false));
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
    setToken(null);
    setRefreshTokenValue(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  };

  const fetchUserData = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
        setProfile(data.data.profile);
      } else {
        // Token无效，尝试刷新
        const storedRefreshToken = localStorage.getItem('refresh_token');
        if (storedRefreshToken) {
          const success = await refreshTokenInternal(storedRefreshToken);
          if (!success) {
            clearAuthState();
          }
        } else {
          clearAuthState();
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      clearAuthState();
    }
  };

  // 内部刷新 token 函数
  const refreshTokenInternal = async (refreshToken: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data.session) {
          setToken(data.data.session.access_token);
          setRefreshTokenValue(data.data.session.refresh_token);
          setUser(data.data.user);
          localStorage.setItem('auth_token', data.data.session.access_token);
          localStorage.setItem('refresh_token', data.data.session.refresh_token);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Token刷新失败:', error);
      return false;
    }
  };

  // 公开的刷新 token 函数
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = refreshTokenValue || localStorage.getItem('refresh_token');
    if (!storedRefreshToken) {
      clearAuthState();
      return false;
    }
    return refreshTokenInternal(storedRefreshToken);
  }, [refreshTokenValue]);

  const login = async (email: string, password: string) => {
    let response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
    } catch (fetchError) {
      console.error('登录请求失败:', fetchError);
      throw new Error('网络连接失败，请检查网络后重试');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data = await response.json();
    setUser(data.data.user);
    setProfile(data.data.profile);
    setToken(data.data.session.access_token);
    setRefreshTokenValue(data.data.session.refresh_token);
    localStorage.setItem('auth_token', data.data.session.access_token);
    localStorage.setItem('refresh_token', data.data.session.refresh_token);
  };

  const register = async (email: string, password: string, username: string): Promise<{ needsEmailConfirmation?: boolean; message?: string }> => {
    let response;
    try {
      response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username }),
      });
    } catch (fetchError) {
      console.error('注册请求失败:', fetchError);
      throw new Error('网络连接失败，请检查网络后重试');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '注册失败');
    }

    // 如果需要邮箱验证，返回提示信息
    if (data.needsEmailConfirmation) {
      return { 
        needsEmailConfirmation: true, 
        message: data.message || '注册成功！请检查邮箱完成验证后登录' 
      };
    }

    // 如果有 session，直接登录
    if (data.data?.session) {
      setUser(data.data.user);
      setToken(data.data.session.access_token);
      setRefreshTokenValue(data.data.session.refresh_token);
      localStorage.setItem('auth_token', data.data.session.access_token);
      localStorage.setItem('refresh_token', data.data.session.refresh_token);
    }

    return { needsEmailConfirmation: false };
  };

  const logout = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      clearAuthState();
    }
  };

  // 定期检查 token 是否即将过期，自动刷新
  useEffect(() => {
    if (!token) return;

    const checkAndRefresh = () => {
      if (isTokenExpired(token)) {
        refreshToken();
      }
    };

    // 每 5 分钟检查一次
    const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [token, refreshToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
