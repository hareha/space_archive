import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';

interface AgreementItem {
  key: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [agreements, setAgreements] = useState<AgreementItem[]>([
    { key: 'terms', label: '이용약관 동의', required: true, checked: false },
    { key: 'privacy', label: '개인정보 처리방침 동의', required: true, checked: false },
    { key: 'age', label: '만 14세 이상입니다', required: true, checked: false },
    { key: 'marketing', label: '마케팅 정보 수신 동의 (이메일, 푸시)', required: false, checked: false },
  ]);

  const allChecked = agreements.every(a => a.checked);
  const requiredChecked = agreements.filter(a => a.required).every(a => a.checked);

  const toggleAll = () => {
    const newVal = !allChecked;
    setAgreements(prev => prev.map(a => ({ ...a, checked: newVal })));
  };

  const toggleItem = (key: string) => {
    setAgreements(prev => prev.map(a => a.key === key ? { ...a, checked: !a.checked } : a));
  };

  // 유효성 검사
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;
  const passwordMatch = password === passwordConfirm;
  const nicknameValid = nickname.length >= 2 && nickname.length <= 10;
  const canSubmit = emailValid && passwordValid && passwordMatch && nicknameValid && requiredChecked;

  const handleSignup = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const marketingConsent = agreements.find(a => a.key === 'marketing')?.checked ?? false;
    const success = await signup(email, password, nickname, marketingConsent);
    setLoading(false);
    if (success) {
      router.replace({ pathname: '/auth/verify', params: { email: email.trim().toLowerCase() } });
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>회원가입</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 이메일 */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>이메일</Text>
              <Text style={s.requiredStar}>✱</Text>
            </View>
            <View style={[s.inputBox, email && !emailValid && s.inputError]}>
              <TextInput
                style={s.inputText}
                placeholder="example@email.com"
                placeholderTextColor="#B2B2B2"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {email && !emailValid && (
              <View style={s.errorRow}>
                <Text style={s.errorText}>올바른 이메일 형식을 입력해주세요</Text>
              </View>
            )}
          </View>

          {/* 비밀번호 */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>비밀번호</Text>
              <Text style={s.requiredStar}>✱</Text>
            </View>
            <View style={[s.inputBox, password && !passwordValid && s.inputError]}>
              <TextInput
                style={s.inputText}
                placeholder="8자 이상 영문·숫자·특수문자 포함"
                placeholderTextColor="#B2B2B2"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#B2B2B2" />
              </TouchableOpacity>
            </View>
            {password && !passwordValid && (
              <View style={s.errorRow}>
                <Text style={s.errorText}>영문, 숫자, 특수문자 포함 8자 이상</Text>
              </View>
            )}
          </View>

          {/* 비밀번호 확인 */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>비밀번호 확인</Text>
              <Text style={s.requiredStar}>✱</Text>
            </View>
            <View style={[s.inputBox, passwordConfirm && !passwordMatch && s.inputError]}>
              <TextInput
                style={s.inputText}
                placeholder="비밀번호를 다시 입력하세요"
                placeholderTextColor="#B2B2B2"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={s.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={20} color="#B2B2B2" />
              </TouchableOpacity>
            </View>
            {passwordConfirm && !passwordMatch && (
              <View style={s.errorRow}>
                <Text style={s.errorText}>비밀번호가 일치하지 않습니다</Text>
              </View>
            )}
          </View>

          {/* 닉네임 */}
          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>닉네임</Text>
            </View>
            <View style={[s.inputBox, nickname && !nicknameValid && s.inputError]}>
              <TextInput
                style={s.inputText}
                placeholder="2-10자 이내로 입력하세요"
                placeholderTextColor="#B2B2B2"
                value={nickname}
                onChangeText={setNickname}
                maxLength={10}
              />
            </View>
          </View>

          {/* 약관 동의 */}
          <View style={s.agreementSection}>
            {/* 전체 동의 */}
            <TouchableOpacity style={s.agreeAllRow} onPress={toggleAll} activeOpacity={0.7}>
              <View style={[s.checkbox, allChecked && s.checkboxChecked]}>
                {allChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.agreeAllText}>전체 동의</Text>
            </TouchableOpacity>

            {/* 개별 항목 */}
            <View style={s.agreeItems}>
              {agreements.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={s.agreeRow}
                  onPress={() => toggleItem(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, item.checked && s.checkboxChecked]}>
                    {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={s.agreeText}>
                    <Text style={item.required ? s.requiredTag : s.optionalTag}>
                      {item.required ? '[필수]' : '[선택]'}
                    </Text>
                    {' '}{item.label}
                  </Text>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-forward" size={18} color="#B2B2B2" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 가입 버튼 */}
          <View style={s.submitSection}>
            <TouchableOpacity
              style={[s.submitBtn, (!canSubmit || loading) && s.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={loading || !canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.submitBtnText}>인증번호 발송 중...</Text>
                </View>
              ) : (
                <Text style={s.submitBtnText}>가입하기</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 58, paddingTop: 14, paddingBottom: 14,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // 필드 그룹 — 에러 없을 때도 간격 확보
  fieldGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#808080', fontFamily: 'Pretendard' },
  requiredStar: { fontSize: 8, color: '#FF1900', marginTop: -4 },

  // Input
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
    height: 46, paddingHorizontal: 16,
  },
  inputText: {
    flex: 1, fontSize: 14, fontWeight: '500', color: '#000', fontFamily: 'Pretendard',
  },
  inputError: { borderColor: '#FF0000' },
  eyeBtn: { padding: 4 },
  errorRow: { alignItems: 'flex-end', marginTop: 6 },
  errorText: { color: '#FF1900', fontSize: 12, fontFamily: 'Pretendard' },

  // 약관
  agreementSection: { marginTop: 28, gap: 12 },
  agreeAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EAECF6', borderRadius: 5,
    height: 46, paddingHorizontal: 10,
  },
  agreeAllText: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard' },
  agreeItems: { paddingHorizontal: 10, gap: 11 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agreeText: { flex: 1, fontSize: 12, color: '#808080', lineHeight: 17, fontFamily: 'Pretendard' },
  requiredTag: { color: '#3C57E9', fontWeight: '400' },
  optionalTag: { color: '#999', fontWeight: '400' },

  checkbox: {
    width: 20, height: 20, borderRadius: 3, borderWidth: 1.5, borderColor: '#B2B2B2',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#3C57E9', borderColor: '#3C57E9' },

  // 가입 버튼
  submitSection: { marginTop: 46, paddingHorizontal: 0 },
  submitBtn: {
    backgroundColor: '#3C57E9', borderRadius: 5,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.3 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: 'Pretendard' },
});
