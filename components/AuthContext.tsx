/**
 * 인증 컨텍스트 — 로그인/회원가입/로그아웃 상태 관리
 * 
 * TODO: TEMP_AUTH - 임시 로그인 로직 (아무 이메일/비번 → 주인공 계정)
 * 실제 연동 시 login() 내부의 임시 코드를 삭제하고 실제 API 호출로 교체하세요.
 */
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { initDatabase, getUserByEmail, createUser, getUser, DBUser } from '@/services/database';
import { HERO_USER } from '@/constants/dummyUsers';

const AUTH_SESSION_KEY = '@auth_session';

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatarColor: string;
  magBalance: number;
  totalOccupied: number;
  joinDate: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loginWithSNS: (provider: 'kakao' | 'apple' | 'naver' | 'facebook') => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isLoading: true,
  login: async () => false,
  signup: async () => false,
  logout: async () => {},
  loginWithSNS: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function dbUserToAuthUser(dbUser: DBUser): AuthUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    nickname: dbUser.nickname,
    avatarColor: dbUser.avatarColor,
    magBalance: dbUser.magBalance,
    totalOccupied: dbUser.totalOccupied,
    joinDate: dbUser.joinDate,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 시작 시 DB 초기화 + 세션 복원
  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        const sessionRaw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
        if (sessionRaw) {
          const session = JSON.parse(sessionRaw);
          const dbUser = await getUser(session.userId);
          if (dbUser) {
            setUser(dbUserToAuthUser(dbUser));
          }
        }
      } catch (e) {
        console.error('[Auth] Init error:', e);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // 로그인
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // =============================================
      // TODO: TEMP_AUTH - 실제 연동 시 아래 블록 삭제
      // 아무 이메일/비번으로 로그인하면 주인공 계정으로 로그인
      // =============================================
      const heroUser = await getUser(HERO_USER.id);
      if (heroUser) {
        const authUser = dbUserToAuthUser(heroUser);
        setUser(authUser);
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: heroUser.id }));
        return true;
      }
      // =============================================
      // TODO: TEMP_AUTH 끝 — 여기 아래에 실제 인증 로직 추가
      // =============================================

      // 실제 로직 (현재는 TEMP_AUTH로 인해 도달하지 않음)
      const dbUser = await getUserByEmail(email);
      if (!dbUser || dbUser.password !== password) {
        Alert.alert('로그인 실패', '이메일 또는 비밀번호가 올바르지 않습니다.');
        return false;
      }

      const authUser = dbUserToAuthUser(dbUser);
      setUser(authUser);
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: dbUser.id }));
      return true;
    } catch (e) {
      console.error('[Auth] Login error:', e);
      return false;
    }
  }, []);

  // 회원가입
  const signup = useCallback(async (email: string, password: string, nickname: string): Promise<boolean> => {
    try {
      const newUser = await createUser({ email, password, nickname });
      const authUser = dbUserToAuthUser(newUser);
      setUser(authUser);
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: newUser.id }));
      return true;
    } catch (e: any) {
      Alert.alert('회원가입 실패', e.message || '오류가 발생했습니다.');
      return false;
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
  }, []);

  // SNS 로그인 (임시: 모든 SNS 버튼 → 주인공 계정 로그인)
  const loginWithSNS = useCallback(async (provider: 'kakao' | 'apple' | 'naver' | 'facebook') => {
    // TODO: SNS_AUTH - 실제 SNS SDK 연동 시 구현
    try {
      const heroUser = await getUser(HERO_USER.id);
      if (heroUser) {
        const authUser = dbUserToAuthUser(heroUser);
        setUser(authUser);
        await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ userId: heroUser.id }));
      }
    } catch (e) {
      console.error('[Auth] SNS login error:', e);
    }
  }, []);

  // 유저 정보 새로고침
  const refreshUser = useCallback(async () => {
    if (!user) return;
    const dbUser = await getUser(user.id);
    if (dbUser) {
      setUser(dbUserToAuthUser(dbUser));
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoggedIn: !!user,
      isLoading,
      login,
      signup,
      logout,
      loginWithSNS,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
