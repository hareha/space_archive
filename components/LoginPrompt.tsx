/**
 * 로그인 유도 컴포넌트 — 비로그인 사용자에게 표시
 * 
 * 기획서 이미지 참고: 아이콘 + "로그인이 필요한 서비스입니다." + 버튼 2개
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface LoginPromptProps {
  onClose?: () => void;
  message?: string;
}

export default function LoginPrompt({ onClose, message }: LoginPromptProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      {/* 닫기 버튼 */}
      {onClose && (
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#9E9E9E" />
        </TouchableOpacity>
      )}

      <View style={s.content}>
        {/* 아이콘 */}
        <View style={s.iconContainer}>
          <View style={s.iconOuter}>
            <Ionicons name="person-outline" size={48} color="#9E9E9E" />
          </View>
        </View>

        {/* 메시지 */}
        <Text style={s.title}>
          {message || '로그인이 필요한 서비스입니다.'}
        </Text>
        <Text style={s.subtitle}>Plus Ultra 계정으로 로그인하고{'\n'}달의 새로운 가능성을 탐험하세요</Text>

        {/* 버튼 */}
        <View style={s.btnSection}>
          <TouchableOpacity
            style={s.loginBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <Text style={s.loginBtnText}>로그인하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.signupBtn}
            onPress={() => router.push('/auth/signup')}
            activeOpacity={0.85}
          >
            <Text style={s.signupBtnText}>회원가입</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    position: 'absolute', top: 60, right: 20, zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: { marginBottom: 28 },
  iconOuter: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: '#E5E5E5',
    justifyContent: 'center', alignItems: 'center',
  },
  title: {
    fontSize: 20, fontWeight: '700', color: '#1A1A1A',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: '#9E9E9E', textAlign: 'center',
    lineHeight: 20, marginBottom: 36,
  },
  btnSection: { width: '100%', gap: 10 },
  loginBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signupBtn: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5E5',
  },
  signupBtnText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
});
