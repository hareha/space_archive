import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput, Alert, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/services/supabase';

export default function PersonalInfoScreen() {
    const router = useRouter();
    const { user, refreshUser } = useAuth();
    const [nickname, setNickname] = useState(user?.nickname || '');
    const [email] = useState(user?.email || '');
    const [isModified, setIsModified] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleNicknameChange = (text: string) => {
        setNickname(text);
        setIsModified(text !== (user?.nickname || ''));
    };

    const handleSave = async () => {
        if (!isModified) return;
        if (!user) {
            Alert.alert('오류', '로그인이 필요합니다.');
            return;
        }
        if (nickname.trim().length < 2 || nickname.trim().length > 10) {
            Alert.alert('오류', '닉네임은 2~10자 이내로 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ nickname: nickname.trim(), updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (error) {
                console.error('[PersonalInfo] DB update error:', error);
                setLoading(false);
                Alert.alert('저장 실패', error.message);
                return;
            }

            // DB 업데이트 성공 → 즉시 로딩 해제 + 피드백
            setIsModified(false);
            setLoading(false);
            Alert.alert('저장 완료', '프로필이 업데이트되었습니다.', [
                { text: '확인', onPress: () => router.back() }
            ]);

            // 전역 상태 갱신 (백그라운드, UI 블로킹 X)
            refreshUser().catch(() => {});
        } catch (e: any) {
            console.error('[PersonalInfo] save error:', e);
            setLoading(false);
            Alert.alert('오류', '네트워크 연결을 확인해주세요.');
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
                <Text style={styles.headerTitle}>개인정보 설정</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 설명 */}
                <View style={styles.descSection}>
                    <Text style={styles.descTitle}>기본 프로필</Text>
                    <Text style={styles.descSub}>계정 상세 정보 및 연락처를 업데이트하세요.</Text>
                </View>

                {/* 입력 필드들 */}
                <View style={styles.fieldsSection}>
                    {/* 닉네임 */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>닉네임</Text>
                        <View style={[styles.inputWrapper, isModified && styles.inputWrapperFocused]}>
                            <TextInput
                                style={styles.textInput}
                                value={nickname}
                                onChangeText={handleNicknameChange}
                                placeholder="닉네임을 입력하세요"
                                placeholderTextColor="#B2B2B2"
                                maxLength={10}
                            />
                        </View>
                    </View>

                    {/* 이메일 */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>이메일</Text>
                        <View style={[styles.inputWrapper, styles.inputWrapperReadonly]}>
                            <Text style={styles.readOnlyText}>{email}</Text>
                        </View>
                    </View>

                </View>
            </ScrollView>

            {/* 저장 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.saveBtn, isModified ? styles.saveBtnActive : styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isModified || loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color={isModified ? '#fff' : '#B2B2B2'} />
                    ) : (
                        <Text style={[styles.saveBtnText, isModified ? styles.saveBtnTextActive : styles.saveBtnTextDisabled]}>
                            변경사항 저장
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

    // 설명
    descSection: {
        paddingHorizontal: 16, paddingTop: 20, gap: 8,
    },
    descTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    descSub: { fontSize: 14, color: '#666666', lineHeight: 21 },

    // 입력 필드
    fieldsSection: {
        paddingTop: 40, gap: 18,
    },
    fieldGroup: {
        paddingHorizontal: 16, gap: 10,
    },
    fieldLabel: { fontSize: 14, fontWeight: '500', color: '#808080' },
    inputWrapper: {
        borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
        height: 46, paddingHorizontal: 16, justifyContent: 'center',
    },
    inputWrapperFocused: {
        borderColor: '#3C57E9',
    },
    inputWrapperReadonly: {
        backgroundColor: '#F7F7FA', borderColor: '#E8E8E8',
    },
    textInput: {
        fontSize: 14, fontWeight: '500', color: '#000000',
    },
    readOnlyText: { fontSize: 14, fontWeight: '500', color: '#808080' },

    // 하단
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 36,
        backgroundColor: '#fff',
    },
    saveBtn: {
        borderRadius: 5, height: 56,
        alignItems: 'center', justifyContent: 'center',
    },
    saveBtnActive: {
        backgroundColor: '#3C57E9',
    },
    saveBtnDisabled: {
        backgroundColor: '#F0F0F0',
    },
    saveBtnText: {
        fontSize: 16, fontWeight: '600',
    },
    saveBtnTextActive: {
        color: '#FFFFFF',
    },
    saveBtnTextDisabled: {
        color: '#B2B2B2',
    },
});
