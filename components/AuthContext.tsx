/**
 * 인증 컨텍스트 — Supabase Auth 기반
 * 
 * - 이메일/비밀번호 회원가입·로그인
 * - Supabase Auth 세션 자동 관리
 * - 회원가입 시 handle_new_user() 트리거로 public.users 자동 생성
 */
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;          // uuid (auth.users.id = public.users.id)
  email: string;
  nickname: string;
  avatarColor: string;
  avatarUrl: string | null;
  ellBalance: number;
  totalOccupied: number;
  joinDate: string;    // created_at ISO
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, nickname: string, marketingConsent?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  loginWithSNS: (provider: 'kakao' | 'apple' | 'naver') => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
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

// ── public.users row → AuthUser 변환 ──
function toAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email || '',
    nickname: row.nickname || '탐험가',
    avatarColor: row.avatar_color || '#3B82F6',
    avatarUrl: row.avatar_url || null,
    ellBalance: row.ell_balance ?? 0,
    totalOccupied: row.total_occupied ?? 0,
    joinDate: row.created_at || new Date().toISOString(),
  };
}

// ── public.users에서 프로필 로드 ──
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] fetchProfile error:', error.message);
    return null;
  }
  return data ? toAuthUser(data) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── 세션 변경 감지 ──
  useEffect(() => {
    let mounted = true;

    // 1) 현재 세션 가져오기
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user.id);
        if (mounted) setUser(profile);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });

    // 2) 세션 변경 리스너 (INITIAL_SESSION 무시 — getSession에서 이미 처리)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return; // 중복 방지
        console.log('[Auth] onAuthStateChange:', event);
        setSession(s);
        if (s?.user) {
          // login()에서 이미 user를 설정했으면 중복 로드 건너뛰기
          if (event === 'SIGNED_IN' && user) return;
          const profile = await fetchProfile(s.user.id);
          if (mounted) setUser(profile);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── 로그인 ──
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // 15초 타임아웃 래핑
      const loginPromise = supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );

      const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

      if (error) {
        let msg = '로그인 실패';
        if (error.message.includes('Invalid login credentials')) {
          msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (error.message.includes('Email not confirmed')) {
          msg = '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          msg = '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해주세요.';
        } else {
          msg = error.message;
        }
        Alert.alert('로그인 실패', msg);
        return false;
      }

      if (!data.session) {
        Alert.alert('로그인 실패', '세션을 생성하지 못했습니다. 다시 시도해주세요.');
        return false;
      }

      // 세션 즉시 설정
      setSession(data.session);

      // 프로필을 직접 로드 (onAuthStateChange에 의존하지 않음)
      try {
        const profilePromise = fetchProfile(data.session.user.id);
        const profileTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 8000)
        );
        const profile = await Promise.race([profilePromise, profileTimeout]);

        if (profile) {
          setUser(profile);
        } else {
          // 프로필 로드 실패해도 세션은 유효 → 기본 유저 정보 세팅
          console.warn('[Auth] Profile load timed out, using session user data');
          setUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            nickname: data.session.user.user_metadata?.full_name || '탐험가',
            avatarColor: '#3B82F6',
            avatarUrl: null,
            ellBalance: 0,
            totalOccupied: 0,
            joinDate: data.session.user.created_at || new Date().toISOString(),
          });
        }
      } catch (profileErr) {
        console.warn('[Auth] Profile fetch failed:', profileErr);
        // 프로필 실패해도 로그인 자체는 성공 처리
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || '',
          nickname: data.session.user.user_metadata?.full_name || '탐험가',
          avatarColor: '#3B82F6',
          avatarUrl: null,
          ellBalance: 0,
          totalOccupied: 0,
          joinDate: data.session.user.created_at || new Date().toISOString(),
        });
      }

      return true;
    } catch (e: any) {
      console.error('[Auth] Login error:', e);
      if (e.message === 'TIMEOUT') {
        Alert.alert(
          '응답 지연',
          '서버 응답이 너무 오래 걸립니다.\n네트워크 상태를 확인 후 다시 시도해주세요.',
        );
      } else {
        Alert.alert('오류', `로그인 중 문제가 발생했습니다.\n(${e.message || '알 수 없는 오류'})`);
      }
      return false;
    }
  }, []);

  // ── 회원가입 ──
  const signup = useCallback(async (email: string, password: string, nickname: string, marketingConsent: boolean = false): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: nickname,  // handle_new_user() 트리거에서 이 값 사용
            name: nickname,
            marketing_consent: marketingConsent,
          },
        },
      });

      if (error) {
        let msg = '회원가입 실패';
        if (error.message.includes('already registered')) {
          msg = '이미 가입된 이메일입니다.';
        } else if (error.message.includes('Password should be')) {
          msg = '비밀번호가 너무 짧습니다. 6자 이상 입력해주세요.';
        } else {
          msg = error.message;
        }
        Alert.alert('회원가입 실패', msg);
        return false;
      }

      // 이미 가입된 이메일 감지 (Supabase는 보안상 에러 대신 빈 identities 반환)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        Alert.alert('회원가입 실패', '이미 가입된 이메일입니다.');
        return false;
      }

      // Supabase 이메일 확인이 비활성화되어있으면 바로 세션 생성됨
      if (data.session) {
        return true;
      }

      // 이메일 확인 활성화 시 → signup.tsx에서 verify 화면으로 이동
      if (data.user && !data.session) {
        return true;  // 가입 자체는 성공, 인증 대기
      }

      return !!data.user;
    } catch (e: any) {
      console.error('[Auth] Signup error:', e);
      Alert.alert('오류', '네트워크 연결을 확인해주세요.');
      return false;
    }
  }, []);

  // ── 로그아웃 ──
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  // ── SNS 로그인 (추후 구현) ──
  const loginWithSNS = useCallback(async (provider: 'kakao' | 'apple' | 'naver') => {
    // TODO: Supabase OAuth 또는 네이티브 SDK 연동
    Alert.alert('준비 중', `${provider} 로그인은 곧 지원될 예정입니다.`);
  }, []);

  // ── 유저 정보 새로고침 ──
  const refreshUser = useCallback(async () => {
    if (!session?.user) return;
    const profile = await fetchProfile(session.user.id);
    if (profile) setUser(profile);
  }, [session]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
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
