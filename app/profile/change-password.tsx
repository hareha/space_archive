import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';

export default function ChangePasswordScreen() {
    const router = useRouter();
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [loading, setLoading] = useState(false);

    const isValid = currentPw.length >= 8 && newPw.length >= 8 && newPw === confirmPw;

    const handleChangePassword = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) {
                Alert.alert('오류', '사용자 정보를 가져올 수 없습니다.');
                return;
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPw,
            });

            if (signInError) {
                Alert.alert('비밀번호 변경 실패', '현재 비밀번호가 올바르지 않습니다.');
                setLoading(false);
                return;
            }

            const { error } = await supabase.auth.updateUser({
                password: newPw,
            });

            if (error) {
                let msg = error.message;
                if (error.message.includes('same')) {
                    msg = '현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.';
                }
                Alert.alert('비밀번호 변경 실패', msg);
            } else {
                Alert.alert('비밀번호 변경 완료', '새 비밀번호로 변경되었습니다.', [
                    { text: '확인', onPress: () => router.back() },
                ]);
            }
        } catch (e: any) {
            Alert.alert('오류', '네트워크 연결을 확인해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>비밀번호 변경</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.fieldsSection}>
                    {/* 현재 비밀번호 */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>현재 비밀번호</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                value={currentPw}
                                onChangeText={setCurrentPw}
                                placeholder="현재 비밀번호를 입력하세요"
                                placeholderTextColor="#B2B2B2"
                                secureTextEntry={!showCurrentPw}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.eyeBtn}>
                                <Ionicons name={showCurrentPw ? 'eye' : 'eye-off'} size={20} color="#8A8A8A" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 새 비밀번호 */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>새 비밀번호</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                value={newPw}
                                onChangeText={setNewPw}
                                placeholder="새 비밀번호를 입력하세요"
                                placeholderTextColor="#B2B2B2"
                                secureTextEntry={!showNewPw}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeBtn}>
                                <Ionicons name={showNewPw ? 'eye' : 'eye-off'} size={20} color="#8A8A8A" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 새 비밀번호 확인 */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>새 비밀번호 확인</Text>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.textInput}
                                value={confirmPw}
                                onChangeText={setConfirmPw}
                                placeholder="새 비밀번호를 다시 입력하세요"
                                placeholderTextColor="#B2B2B2"
                                secureTextEntry={!showConfirmPw}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
                                <Ionicons name={showConfirmPw ? 'eye' : 'eye-off'} size={20} color="#8A8A8A" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 불일치 경고 */}
                    {confirmPw.length > 0 && newPw !== confirmPw && (
                        <Text style={styles.errorText}>새 비밀번호가 일치하지 않습니다.</Text>
                    )}

                    {/* 안내 */}
                    <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={20} color="#666666" />
                        <Text style={styles.infoText}>
                            비밀번호는 8자 이상이어야 하며, 숫자와 특수 문자를 포함해야 합니다.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* 저장 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
                    onPress={handleChangePassword}
                    disabled={!isValid || loading}
                    activeOpacity={0.7}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.saveBtnText, !isValid && styles.saveBtnTextDisabled]}>
                            비밀번호 변경하기
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 120 },

    // 입력 필드
    fieldsSection: {
        paddingTop: 20, gap: 3,
    },
    fieldGroup: {
        paddingHorizontal: 16, gap: 10,
    },
    fieldLabel: { fontSize: 14, fontWeight: '500', color: '#808080' },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
        height: 46, paddingHorizontal: 16,
    },
    textInput: {
        flex: 1, fontSize: 14, fontWeight: '500', color: '#000000',
    },
    eyeBtn: { padding: 4 },

    errorText: { color: '#E53935', fontSize: 12, marginLeft: 16, marginTop: 4 },

    // 안내
    infoRow: {
        flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1, fontSize: 14, color: '#666666', lineHeight: 21,
    },

    // 하단
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 36,
        backgroundColor: '#fff',
    },
    saveBtn: {
        borderWidth: 1.5, borderColor: '#1A1A1A', borderRadius: 5,
        height: 56, alignItems: 'center', justifyContent: 'center',
    },
    saveBtnDisabled: { borderColor: '#B2B2B2' },
    saveBtnText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
    saveBtnTextDisabled: { color: '#B2B2B2' },
});
