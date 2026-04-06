import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithSNS } = useAuth();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      router.dismiss();
    }
  };

  const handleSNSLogin = async (provider: 'kakao' | 'apple' | 'naver') => {
    await loginWithSNS(provider);
    router.dismiss();
  };

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 로고 영역 */}
            <View style={s.logoSection}>
              <Text style={s.logoTitle}>Welcome!</Text>
              <Text style={s.logoSubtitle}>
                달의 새로운 가능성을 탐험하세요.{'\n'}우주 개척의 첫 걸음을 함께 시작합니다.
              </Text>
            </View>

            {/* SNS 로그인 버튼들 */}
            <View style={s.snsSection}>
              {/* 카카오 */}
              <TouchableOpacity
                style={[s.snsBtn, { backgroundColor: '#FEE500' }]}
                onPress={() => handleSNSLogin('kakao')}
                activeOpacity={0.85}
              >
                <Text style={[s.snsBtnText, { color: '#000' }]}>카카오톡으로 계속하기</Text>
              </TouchableOpacity>

              {/* 네이버 */}
              <TouchableOpacity
                style={[s.snsBtn, { backgroundColor: '#03C75A' }]}
                onPress={() => handleSNSLogin('naver')}
                activeOpacity={0.85}
              >
                <Text style={[s.snsBtnText, { color: '#fff' }]}>네이버로 계속하기</Text>
              </TouchableOpacity>

              {/* Apple (iOS 전용) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[s.snsBtn, { backgroundColor: '#000' }]}
                  onPress={() => handleSNSLogin('apple')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-apple" size={20} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={[s.snsBtnText, { color: '#fff' }]}>Apple로 계속하기</Text>
                </TouchableOpacity>
              )}


              {/* 이메일 로그인 */}
              {!showEmailForm ? (
                <TouchableOpacity
                  style={[s.snsBtn, { backgroundColor: '#EAECF6' }]}
                  onPress={() => { setShowEmailForm(true); scrollToEnd(); }}
                  activeOpacity={0.85}
                >
                  <Text style={[s.snsBtnText, { color: '#1A1A1A' }]}>이메일로 로그인</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.emailForm}>
                  <TextInput
                    style={s.input}
                    placeholder="이메일 주소"
                    placeholderTextColor="#B2B2B2"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={scrollToEnd}
                    returnKeyType="next"
                  />
                  <View style={s.passwordRow}>
                    <TextInput
                      style={s.passwordInput}
                      placeholder="비밀번호"
                      placeholderTextColor="#B2B2B2"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onFocus={scrollToEnd}
                      returnKeyType="done"
                      onSubmitEditing={handleEmailLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#B2B2B2" />
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
            </View>

            {/* 하단 링크 */}
            <View style={s.bottomLinks}>
              <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text style={s.bottomLinkText}>이메일로 회원가입</Text>
              </TouchableOpacity>
              <View style={s.bottomDivider} />
              <TouchableOpacity>
                <Text style={s.troubleBtn}>로그인에 문제가 있으신가요?</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    flexGrow: 1, paddingHorizontal: 16, justifyContent: 'center', paddingBottom: 34,
  },

  // 로고
  logoSection: { alignItems: 'center', paddingTop: 30, marginBottom: 40 },
  logoTitle: {
    fontSize: 26, fontWeight: '500', color: '#333', fontFamily: 'Pretendard',
    marginBottom: 10,
  },
  logoSubtitle: {
    fontSize: 16, color: '#B2B2B2', lineHeight: 24, textAlign: 'center',
    fontFamily: 'Pretendard',
  },

  // SNS
  snsSection: { gap: 12 },
  snsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, height: 56,
  },
  snsBtnText: { fontSize: 16, fontWeight: '600', fontFamily: 'Pretendard' },

  // 이메일 폼
  emailForm: { gap: 10, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
    height: 46, paddingHorizontal: 16,
    fontSize: 14, fontWeight: '500', color: '#000', fontFamily: 'Pretendard',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
    height: 46, paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1, fontSize: 14, fontWeight: '500', color: '#000', fontFamily: 'Pretendard',
  },
  eyeBtn: { padding: 4 },
  loginBtn: {
    backgroundColor: '#3C57E9', borderRadius: 5,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  loginBtnDisabled: { opacity: 0.4 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: 'Pretendard' },

  // 하단
  bottomLinks: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 36, paddingBottom: 46,
  },
  bottomLinkText: {
    fontSize: 16, color: '#808080', fontWeight: '600',
    textDecorationLine: 'underline', fontFamily: 'Pretendard',
  },
  bottomDivider: {
    width: 1, height: 23, backgroundColor: '#808080', marginHorizontal: 11,
  },
  troubleBtn: {
    fontSize: 14, color: '#808080', backgroundColor: '#EAECF6',
    borderRadius: 15, paddingVertical: 5, paddingHorizontal: 23,
    overflow: 'hidden', fontFamily: 'Pretendard',
  },
});
