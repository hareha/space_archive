import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // 쿨다운 타이머
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (text: string, index: number) => {
    // 숫자만
    const digit = text.replace(/[^0-9]/g, '');
    
    // 붙여넣기 처리 (6자리 한번에)
    if (digit.length >= 8) {
      const digits = digit.slice(0, 8).split('');
      setCode(digits);
      inputRefs.current[7]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = digit.slice(-1);
    setCode(newCode);

    // 다음 칸으로 이동
    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const fullCode = code.join('');
  const canVerify = fullCode.length === 8;

  const handleVerify = async () => {
    if (!canVerify || !email) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'signup',
      });

      if (error) {
        let msg = '인증 실패';
        if (error.message.includes('expired')) {
          msg = '인증번호가 만료되었습니다. 재전송해주세요.';
        } else if (error.message.includes('invalid')) {
          msg = '잘못된 인증번호입니다. 다시 확인해주세요.';
        } else {
          msg = error.message;
        }
        Alert.alert('인증 실패', msg);
        setCode(['', '', '', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else if (data.session) {
        // 인증 성공 → 자동 로그인됨
        Alert.alert('인증 완료! 🎉', 'Plus Ultra에 오신 걸 환영합니다.', [
          { text: '시작하기', onPress: () => router.replace('/(tabs)/mypage') },
        ]);
      }
    } catch (e: any) {
      console.error('[Verify] error:', e);
      Alert.alert('오류', '네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        // 에러 메시지에서 남은 초 추출 (예: "...after 26 seconds")
        const secMatch = error.message.match(/(\d+)\s*second/i);
        if (secMatch) {
          const remaining = parseInt(secMatch[1], 10);
          setResendCooldown(remaining);
          Alert.alert('재전송 실패', `${remaining}초 후 재전송 가능합니다.`);
        } else {
          setResendCooldown(30);
          Alert.alert('재전송 실패', '잠시 후 다시 시도해주세요.');
        }
      } else {
        Alert.alert('재전송 완료', '새 인증번호가 발송되었습니다.');
        setResendCooldown(30);
        setCode(['', '', '', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      Alert.alert('오류', '네트워크 연결을 확인해주세요.');
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
        <Text style={s.headerTitle}>이메일 인증</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.content}>
          {/* 안내 텍스트 */}
          <View style={s.iconWrap}>
            <Ionicons name="mail-outline" size={48} color="#1A1A1A" />
          </View>
          <Text style={s.title}>인증번호를 입력해주세요</Text>
          <Text style={s.subtitle}>
            <Text style={s.emailHighlight}>{email}</Text>
            {'\n'}으로 전송된 8자리 인증번호를 입력해주세요.
          </Text>

          {/* OTP 입력 */}
          <View style={s.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref; }}
                style={[s.codeInput, digit && s.codeInputFilled]}
                value={digit}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={8}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          {/* 재전송 */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            style={s.resendBtn}
          >
            <Text style={[s.resendText, resendCooldown > 0 && s.resendDisabled]}>
              {resendCooldown > 0
                ? `재전송 (${resendCooldown}초)`
                : '인증번호 재전송'}
            </Text>
          </TouchableOpacity>

          {/* 인증 버튼 */}
          <TouchableOpacity
            style={[s.verifyBtn, !canVerify && s.verifyBtnDisabled]}
            onPress={handleVerify}
            disabled={loading || !canVerify}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.verifyBtnText}>인증하기</Text>
            )}
          </TouchableOpacity>
        </View>
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

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },

  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F7F7FA',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  emailHighlight: { color: '#1A1A1A', fontWeight: '600' },

  codeRow: {
    flexDirection: 'row', gap: 8, marginTop: 32, marginBottom: 16,
  },
  codeInput: {
    width: 40, height: 50, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#E5E5E5', backgroundColor: '#F7F7FA',
    textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#1A1A1A',
  },
  codeInputFilled: { borderColor: '#1A1A1A', backgroundColor: '#FFF' },

  resendBtn: { paddingVertical: 12 },
  resendText: { color: '#1A1A1A', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  resendDisabled: { color: '#BDBDBD', textDecorationLine: 'none' },

  verifyBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
    width: '100%',
  },
  verifyBtnDisabled: { opacity: 0.3 },
  verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
