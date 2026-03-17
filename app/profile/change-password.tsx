import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

export default function ChangePasswordScreen() {
    const router = useRouter();
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);

    const isValid = currentPw.length >= 8 && newPw.length >= 8 && newPw === confirmPw;

    const handleChangePassword = () => {
        if (!isValid) return;
        // TODO: 비밀번호 변경 로직
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>비밀번호 변경</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 현재 비밀번호 */}
                <View style={styles.section}>
                    <Text style={styles.fieldLabel}>현재 비밀번호</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={styles.passwordInput}
                            value={currentPw}
                            onChangeText={setCurrentPw}
                            placeholder="현재 비밀번호를 입력하세요"
                            placeholderTextColor="#BDBDBD"
                            secureTextEntry={!showCurrentPw}
                        />
                        <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)} style={styles.eyeBtn}>
                            <Ionicons name={showCurrentPw ? 'eye' : 'eye-off'} size={20} color="#BDBDBD" />
                        </TouchableOpacity>
                    </View>

                    {/* 새 비밀번호 */}
                    <Text style={styles.fieldLabel}>새 비밀번호</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={styles.passwordInput}
                            value={newPw}
                            onChangeText={setNewPw}
                            placeholder="새 비밀번호를 입력하세요"
                            placeholderTextColor="#BDBDBD"
                            secureTextEntry={!showNewPw}
                        />
                        <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={styles.eyeBtn}>
                            <Ionicons name={showNewPw ? 'eye' : 'eye-off'} size={20} color="#BDBDBD" />
                        </TouchableOpacity>
                    </View>

                    {/* 새 비밀번호 확인 */}
                    <Text style={styles.fieldLabel}>새 비밀번호 확인</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={styles.passwordInput}
                            value={confirmPw}
                            onChangeText={setConfirmPw}
                            placeholder="새 비밀번호를 다시 입력하세요"
                            placeholderTextColor="#BDBDBD"
                            secureTextEntry={!showConfirmPw}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)} style={styles.eyeBtn}>
                            <Ionicons name={showConfirmPw ? 'eye' : 'eye-off'} size={20} color="#BDBDBD" />
                        </TouchableOpacity>
                    </View>

                    {/* 불일치 경고 */}
                    {confirmPw.length > 0 && newPw !== confirmPw && (
                        <Text style={styles.errorText}>새 비밀번호가 일치하지 않습니다.</Text>
                    )}

                    {/* 안내 박스 */}
                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={18} color="#4A90D9" style={{ marginRight: 8, marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoTitle}>비밀번호 설정 안내</Text>
                            <Text style={styles.infoDesc}>
                                비밀번호는 8자 이상이어야 하며, 숫자와 특수 문자를 포함해야 합니다.
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* 변경하기 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.changeBtn, !isValid && styles.changeBtnDisabled]}
                    onPress={handleChangePassword}
                    disabled={!isValid}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.changeBtnText, !isValid && styles.changeBtnTextDisabled]}>
                        비밀번호 변경하기
                    </Text>
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
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 120 },

    section: { paddingHorizontal: 20, paddingTop: 28 },

    fieldLabel: { fontSize: 12, color: '#9E9E9E', fontWeight: '500', marginBottom: 8, marginTop: 20 },
    passwordRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F7F7FA', borderRadius: 10,
        borderWidth: 1, borderColor: '#EFEFEF',
    },
    passwordInput: {
        flex: 1, paddingVertical: 14, paddingHorizontal: 16,
        fontSize: 15, color: '#1A1A1A',
    },
    eyeBtn: { padding: 14 },

    errorText: { color: '#E53935', fontSize: 12, marginTop: 6 },

    infoBox: {
        flexDirection: 'row', backgroundColor: '#EBF3FC', borderRadius: 10,
        paddingVertical: 14, paddingHorizontal: 16, marginTop: 28,
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 4 },
    infoDesc: { fontSize: 12, color: '#666', lineHeight: 18 },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 36,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    changeBtn: {
        backgroundColor: '#4A90D9', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
    },
    changeBtnDisabled: { backgroundColor: '#E0E0E0' },
    changeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    changeBtnTextDisabled: { color: '#BDBDBD' },
});
