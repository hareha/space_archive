import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/services/supabase';

const CHECKLIST = [
    '보유 ell 및 탐사 이력 삭제에 동의합니다.',
    '개척 구역 즉시 해제에 동의합니다.',
    '탈퇴 후 계정 복구가 불가함을 확인합니다.',
];

const REASONS = [
    '서비스 이용 불편',
    '자산 가치 부족',
    '단순 변심',
    '기타',
];

export default function WithdrawScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [checks, setChecks] = useState<boolean[]>([false, false, false]);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [otherReason, setOtherReason] = useState('');
    const [loading, setLoading] = useState(false);

    const allChecked = checks.every(Boolean);
    const canWithdraw = allChecked && selectedReason !== null;

    const toggleCheck = (index: number) => {
        const newChecks = [...checks];
        newChecks[index] = !newChecks[index];
        setChecks(newChecks);
    };

    const handleWithdraw = () => {
        if (!canWithdraw) return;
        Alert.alert(
            '정말 탈퇴하시겠습니까?',
            '이 작업은 되돌릴 수 없습니다.\n모든 데이터가 영구 삭제됩니다.',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '탈퇴',
                    style: 'destructive',
                    onPress: executeWithdraw,
                },
            ],
        );
    };

    const executeWithdraw = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('id', user.id);

            if (deleteError) {
                console.error('[Withdraw] delete user error:', deleteError);
            }

            await logout();

            Alert.alert('탈퇴 완료', 'Plus Ultra를 이용해주셔서 감사했습니다.', [
                { text: '확인', onPress: () => router.replace('/(tabs)/mypage') },
            ]);
        } catch (e: any) {
            console.error('[Withdraw] error:', e);
            Alert.alert('오류', '탈퇴 처리 중 문제가 발생했습니다. 다시 시도해주세요.');
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
                <Text style={styles.headerTitle}>회원 탈퇴</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 경고 박스 */}
                <View style={styles.warningWrapper}>
                    <View style={styles.warningBox}>
                        <View style={styles.warningIconRow}>
                            <Ionicons name="warning" size={42} color="#E53935" />
                        </View>
                        <Text style={styles.warningTitle}>탈퇴 전 꼭 확인하세요</Text>
                        <Text style={styles.warningItem}>• 보유 중인 ell 및 탐사 이력이 모두 삭제됩니다.</Text>
                        <Text style={styles.warningItem}>• 개척 중인 구역은 즉시 해제되며 복구 불가합니다.</Text>
                        <Text style={styles.warningItem}>• 동일 이메일로 재가입 시 30일 대기 기간이 적용됩니다.</Text>
                    </View>
                </View>

                {/* 확인 체크박스 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitleLg}>
                        탈퇴 전 확인 사항에 동의해 주세요 <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={styles.agreementList}>
                        {CHECKLIST.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.checkRow}
                                onPress={() => toggleCheck(index)}
                                activeOpacity={0.6}
                            >
                                <View style={[styles.checkBox, checks[index] && styles.checkBoxChecked]}>
                                    {checks[index] && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                                <Text style={styles.checkLabel}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 구분선 */}
                <View style={styles.divider} />

                {/* 탈퇴 사유 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitleMd}>
                        탈퇴 사유 <Text style={styles.optionalLabel}>(선택)</Text>
                    </Text>
                    <View style={styles.radioList}>
                        {REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                style={styles.radioRow}
                                onPress={() => setSelectedReason(reason)}
                                activeOpacity={0.6}
                            >
                                <View style={[styles.radioOuter, selectedReason === reason && styles.radioOuterSelected]}>
                                    {selectedReason === reason && <View style={styles.radioInner} />}
                                </View>
                                <Text style={styles.radioLabel}>{reason}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {selectedReason === '기타' && (
                        <TextInput
                            style={styles.otherInput}
                            value={otherReason}
                            onChangeText={setOtherReason}
                            placeholder="탈퇴 사유를 입력해 주세요"
                            placeholderTextColor="#B2B2B2"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    )}
                </View>
            </ScrollView>

            {/* 탈퇴 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.withdrawBtn, canWithdraw && styles.withdrawBtnActive]}
                    onPress={handleWithdraw}
                    disabled={!canWithdraw || loading}
                    activeOpacity={0.7}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.withdrawBtnText, canWithdraw && styles.withdrawBtnTextActive]}>
                            회원 탈퇴
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

    // 경고 박스
    warningWrapper: {
        paddingHorizontal: 16, paddingTop: 20,
    },
    warningBox: {
        backgroundColor: '#EAECF6',
        paddingTop: 14, paddingBottom: 24, paddingHorizontal: 16,
        gap: 10,
    },
    warningIconRow: {
        alignItems: 'center', gap: 8,
    },
    warningTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    warningItem: { fontSize: 14, color: '#666666', lineHeight: 21 },

    // 섹션
    section: { paddingHorizontal: 32, paddingTop: 40, paddingBottom: 30 },
    sectionTitleLg: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
    sectionTitleMd: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
    requiredStar: { color: '#FF0000' },
    optionalLabel: { color: '#808080', fontWeight: '400' },

    // 구분선
    divider: {
        height: 1, backgroundColor: '#EBECF1',
    },

    // 체크박스
    agreementList: { gap: 13 },
    checkRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    },
    checkBox: {
        width: 20, height: 20, borderRadius: 3,
        borderWidth: 1.5, borderColor: '#B2B2B2',
        justifyContent: 'center', alignItems: 'center',
    },
    checkBoxChecked: {
        backgroundColor: '#3C57E9', borderColor: '#3C57E9',
    },
    checkLabel: { flex: 1, fontSize: 14, color: '#808080', lineHeight: 21 },

    // 라디오
    radioList: { gap: 13, paddingBottom: 6 },
    radioRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    radioOuter: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 1.5, borderColor: '#808080',
        justifyContent: 'center', alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: '#3C57E9',
    },
    radioInner: {
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#3C57E9',
    },
    radioLabel: { fontSize: 14, color: '#808080', lineHeight: 21 },
    otherInput: {
        borderWidth: 1, borderColor: '#B2B2B2', borderRadius: 5,
        paddingVertical: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
        marginTop: 12, minHeight: 80,
    },

    // 하단 버튼
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36,
        backgroundColor: '#fff',
    },
    withdrawBtn: {
        borderWidth: 1.5, borderColor: '#B2B2B2', borderRadius: 5,
        height: 56, alignItems: 'center', justifyContent: 'center',
    },
    withdrawBtnActive: {
        borderColor: '#E53935', backgroundColor: '#E53935',
    },
    withdrawBtnText: { color: '#B2B2B2', fontSize: 16, fontWeight: '600' },
    withdrawBtnTextActive: { color: '#FFFFFF' },
});
