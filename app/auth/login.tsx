import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithSNS } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      router.replace('/(tabs)/mypage');
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0F172A' }]} />

      {/* 배경 장식 */}
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <View style={s.bgCircle3} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* 닫기 버튼 */}
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#9CA3AF" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 로고 영역 */}
            <View style={s.logoSection}>
              <View style={s.logoGlow}>
                <Text style={s.logoEmoji}>🌙</Text>
              </View>
              <Text style={s.logoTitle}>Plus Ultra</Text>
              <Text style={s.logoSubtitle}>달의 새로운 가능성을 탐험하세요</Text>
            </View>

            {/* 빠른 회원가입 배너 */}
            <TouchableOpacity
              style={s.quickBanner}
              onPress={() => router.push('/auth/signup')}
              activeOpacity={0.8}
            >
              <Text style={s.quickBannerIcon}>✨</Text>
              <Text style={s.quickBannerText}>3초만에 빠른 회원가입</Text>
              <Ionicons name="chevron-forward" size={16} color="#FBBF24" />
            </TouchableOpacity>

            {/* SNS 로그인 */}
            <View style={s.snsSection}>
              {/* 카카오 */}
              <TouchableOpacity
                style={[s.snsBtn, { backgroundColor: '#FEE500' }]}
                onPress={() => loginWithSNS('kakao')}
                activeOpacity={0.85}
              >
                <Text style={[s.snsBtnText, { color: '#391B1B' }]}>TALK  카카오톡으로 계속하기</Text>
              </TouchableOpacity>

              {/* Apple */}
              <TouchableOpacity
                style={[s.snsBtn, { backgroundColor: '#FFFFFF' }]}
                onPress={() => loginWithSNS('apple')}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-apple" size={20} color="#000" style={{ marginRight: 8 }} />
                <Text style={[s.snsBtnText, { color: '#000' }]}>Apple로 계속하기</Text>
              </TouchableOpacity>

              {/* 네이버 & 페이스북 작은 버튼 */}
              <View style={s.snsSmallRow}>
                <TouchableOpacity
                  style={[s.snsSmallBtn, { backgroundColor: '#03C75A' }]}
                  onPress={() => loginWithSNS('naver')}
                  activeOpacity={0.85}
                >
                  <Text style={s.snsSmallText}>N</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.snsSmallBtn, { backgroundColor: '#1877F2' }]}
                  onPress={() => loginWithSNS('facebook')}
                  activeOpacity={0.85}
                >
                  <Text style={s.snsSmallText}>f</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 구분선 */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>또는</Text>
              <View style={s.dividerLine} />
            </View>

            {/* 이메일 로그인 */}
            {!showEmailForm ? (
              <View style={s.emailLinks}>
                <TouchableOpacity onPress={() => setShowEmailForm(true)}>
                  <Text style={s.emailLinkText}>이메일로 로그인</Text>
                </TouchableOpacity>
                <View style={s.emailLinkDot} />
                <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                  <Text style={s.emailLinkText}>이메일로 회원가입</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.emailForm}>
                <View style={s.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color="#6B7280" style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="이메일 주소"
                    placeholderTextColor="#6B7280"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={s.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="비밀번호"
                    placeholderTextColor="#6B7280"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.loginBtn, (!email.trim() || !password.trim()) && s.loginBtnDisabled]}
                  onPress={handleEmailLogin}
                  disabled={loading || !email.trim() || !password.trim()}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.loginBtnText}>로그인</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 하단 */}
            <TouchableOpacity style={s.helpLink}>
              <Text style={s.helpLinkText}>로그인에 문제가 있으신가요?</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bgCircle1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(59,130,246,0.06)', top: -80, right: -80,
  },
  bgCircle2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(139,92,246,0.05)', bottom: 100, left: -60,
  },
  bgCircle3: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(236,72,153,0.04)', top: height * 0.4, right: -30,
  },
  closeBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1, paddingHorizontal: 32, paddingTop: 80, paddingBottom: 40,
    justifyContent: 'center',
  },

  // 로고
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoGlow: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 36 },
  logoTitle: {
    fontSize: 32, fontWeight: '800', color: '#F9FAFB',
    letterSpacing: 1, marginBottom: 8,
  },
  logoSubtitle: {
    fontSize: 14, color: '#9CA3AF', letterSpacing: 0.5,
  },

  // 빠른 회원가입
  quickBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 20, marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    gap: 6,
  },
  quickBannerIcon: { fontSize: 14 },
  quickBannerText: { color: '#FBBF24', fontSize: 14, fontWeight: '600' },

  // SNS
  snsSection: { gap: 10, marginBottom: 20 },
  snsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 16, gap: 4,
  },
  snsBtnText: { fontSize: 15, fontWeight: '700' },
  snsSmallRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4,
  },
  snsSmallBtn: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  snsSmallText: { fontSize: 22, fontWeight: '800', color: '#fff' },

  // 구분선
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: '#6B7280', fontSize: 12 },

  // 이메일 링크
  emailLinks: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  emailLinkText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
  emailLinkDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#4B5563' },

  // 이메일 폼
  emailForm: { gap: 12 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: '#F9FAFB', fontSize: 15,
  },
  loginBtn: {
    backgroundColor: '#3B82F6', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  loginBtnDisabled: { opacity: 0.4 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // 하단
  helpLink: { alignItems: 'center', marginTop: 24 },
  helpLinkText: { color: '#6B7280', fontSize: 13 },
});
