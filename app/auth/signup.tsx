import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
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
    const success = await signup(email, password, nickname);
    setLoading(false);
    if (success) {
      Alert.alert('가입 완료! 🎉', 'Plus Ultra에 오신 걸 환영합니다.', [
        { text: '시작하기', onPress: () => router.replace('/(tabs)/mypage') },
      ]);
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
          <Text style={s.label}>이메일</Text>
          <TextInput
            style={[s.input, email && !emailValid && s.inputError]}
            placeholder="example@email.com"
            placeholderTextColor="#BDBDBD"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {email && !emailValid && <Text style={s.errorText}>올바른 이메일 형식을 입력해주세요</Text>}

          {/* 비밀번호 */}
          <Text style={s.label}>비밀번호</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.inputFlex, password && !passwordValid && s.inputError]}
              placeholder="8자 이상 영문·숫자·특수문자 포함"
              placeholderTextColor="#BDBDBD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9E9E9E" />
            </TouchableOpacity>
          </View>
          {password && !passwordValid && <Text style={s.errorText}>영문, 숫자, 특수문자 포함 8자 이상</Text>}

          {/* 비밀번호 확인 */}
          <Text style={s.label}>비밀번호 확인</Text>
          <TextInput
            style={[s.input, passwordConfirm && !passwordMatch && s.inputError]}
            placeholder="비밀번호를 다시 입력하세요"
            placeholderTextColor="#BDBDBD"
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          {passwordConfirm && !passwordMatch && <Text style={s.errorText}>비밀번호가 일치하지 않습니다</Text>}

          {/* 닉네임 */}
          <Text style={s.label}>닉네임</Text>
          <TextInput
            style={[s.input, nickname && !nicknameValid && s.inputError]}
            placeholder="2-10자 이내로 입력하세요"
            placeholderTextColor="#BDBDBD"
            value={nickname}
            onChangeText={setNickname}
            maxLength={10}
          />
          <Text style={s.hintText}>공백 없이 한글, 영문, 숫자만 사용 가능</Text>

          {/* 약관 동의 */}
          <View style={s.agreementSection}>
            <Text style={s.agreementTitle}>약관 동의</Text>

            {/* 전체 동의 */}
            <TouchableOpacity style={s.agreementAllRow} onPress={toggleAll} activeOpacity={0.7}>
              <View style={[s.checkbox, allChecked && s.checkboxChecked]}>
                {allChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={s.agreementAllText}>전체 동의</Text>
            </TouchableOpacity>

            <View style={s.agreementDivider} />

            {/* 개별 항목 */}
            {agreements.map(item => (
              <TouchableOpacity
                key={item.key}
                style={s.agreementRow}
                onPress={() => toggleItem(item.key)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, item.checked && s.checkboxChecked]}>
                  {item.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[s.requiredBadge, !item.required && s.optionalBadge]}>
                    <Text style={[s.requiredBadgeText, !item.required && s.optionalBadgeText]}>
                      {item.required ? '필수' : '선택'}
                    </Text>
                  </View>
                  <Text style={s.agreementText}>{item.label}</Text>
                </View>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.viewLink}>보기 ›</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          {/* 가입 버튼 */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSignup}
            disabled={loading || !canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>가입하기</Text>
            )}
          </TouchableOpacity>

          {/* 이미 계정이 있으신가요? */}
          <View style={s.loginRow}>
            <Text style={s.loginRowText}>이미 계정이 있으신가요?</Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={s.loginRowLink}>  로그인</Text>
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
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },

  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#F7F7FA', borderRadius: 10, borderWidth: 1, borderColor: '#E5E5E5',
    paddingHorizontal: 14, height: 48, fontSize: 15, color: '#1A1A1A',
  },
  inputError: { borderColor: '#EF4444' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7F7FA', borderRadius: 10, borderWidth: 1, borderColor: '#E5E5E5',
    paddingHorizontal: 14, height: 48,
  },
  inputFlex: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  eyeBtn: { padding: 4 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 },
  hintText: { color: '#BDBDBD', fontSize: 12, marginTop: 4, marginLeft: 4 },

  // 약관
  agreementSection: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  agreementTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  agreementAllRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  agreementAllText: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  agreementDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 6 },
  agreementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  agreementText: { fontSize: 14, color: '#555', flex: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  requiredBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  requiredBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  optionalBadge: { backgroundColor: '#F0F0F0' },
  optionalBadgeText: { color: '#9E9E9E' },
  viewLink: { color: '#BDBDBD', fontSize: 13 },

  // 가입 버튼
  submitBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.3 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // 로그인 권유
  loginRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  loginRowText: { color: '#9E9E9E', fontSize: 14 },
  loginRowLink: { color: '#1A1A1A', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});
