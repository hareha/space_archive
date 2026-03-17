import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

const CHECKLIST = [
    '보유 ell 및 탐사 이력 삭제에 동의합니다.',
    '점유 구역 즉시 해제에 동의합니다.',
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
    const [checks, setChecks] = useState<boolean[]>([false, false, false]);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [otherReason, setOtherReason] = useState('');

    const allChecked = checks.every(Boolean);
    const canWithdraw = allChecked && selectedReason !== null;

    const toggleCheck = (index: number) => {
        const newChecks = [...checks];
        newChecks[index] = !newChecks[index];
        setChecks(newChecks);
    };

    const handleWithdraw = () => {
        if (!canWithdraw) return;
        // TODO: 회원 탈퇴 처리
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>회원 탈퇴</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 경고 박스 */}
                <View style={styles.warningBox}>
                    <Text style={styles.warningIcon}>⚠</Text>
                    <Text style={styles.warningTitle}> 탈퇴 전 꼭 확인하세요</Text>
                    <View style={styles.warningList}>
                        <Text style={styles.warningItem}>• 보유 중인 ell 및 탐사 이력이 모두 삭제됩니다.</Text>
                        <Text style={styles.warningItem}>• 점유 중인 구역은 즉시 해제되며 복구 불가합니다.</Text>
                    </View>
                </View>

                {/* 확인 체크박스 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>탈퇴 전 확인 사항에 동의해 주세요</Text>
                    {CHECKLIST.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.checkRow}
                            onPress={() => toggleCheck(index)}
                            activeOpacity={0.6}
                        >
                            <Ionicons
                                name={checks[index] ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={checks[index] ? '#4A90D9' : '#BDBDBD'}
                                style={{ marginRight: 12 }}
                            />
                            <Text style={styles.checkLabel}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 탈퇴 사유 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>탈퇴 사유 (선택)</Text>
                    {REASONS.map((reason) => (
                        <TouchableOpacity
                            key={reason}
                            style={styles.radioRow}
                            onPress={() => setSelectedReason(reason)}
                            activeOpacity={0.6}
                        >
                            <Ionicons
                                name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'}
                                size={22}
                                color={selectedReason === reason ? '#E53935' : '#BDBDBD'}
                                style={{ marginRight: 12 }}
                            />
                            <Text style={styles.radioLabel}>{reason}</Text>
                        </TouchableOpacity>
                    ))}
                    {selectedReason === '기타' && (
                        <TextInput
                            style={styles.otherInput}
                            value={otherReason}
                            onChangeText={setOtherReason}
                            placeholder="탈퇴 사유를 입력해 주세요"
                            placeholderTextColor="#BDBDBD"
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
                    style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
                    onPress={handleWithdraw}
                    disabled={!canWithdraw}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.withdrawBtnText, !canWithdraw && styles.withdrawBtnTextDisabled]}>
                        회원 탈퇴
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

    // 경고 박스
    warningBox: {
        marginHorizontal: 20, marginTop: 20,
        backgroundColor: '#FFEBEE', borderRadius: 12,
        paddingVertical: 16, paddingHorizontal: 18,
    },
    warningIcon: { fontSize: 16 },
    warningTitle: { fontSize: 14, fontWeight: '700', color: '#C62828', marginBottom: 10 },
    warningList: { marginLeft: 4 },
    warningItem: { fontSize: 13, color: '#C62828', lineHeight: 22 },

    // 섹션
    section: { paddingHorizontal: 20, paddingTop: 28 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },

    checkRow: {
        flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
    },
    checkLabel: { fontSize: 14, color: '#333', flex: 1, lineHeight: 20 },

    radioRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    },
    radioLabel: { fontSize: 14, color: '#333' },
    otherInput: {
        backgroundColor: '#F7F7FA', borderRadius: 10, borderWidth: 1, borderColor: '#EFEFEF',
        paddingVertical: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
        marginTop: 8, marginLeft: 34, minHeight: 80,
    },

    // 하단 버튼
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 36,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    withdrawBtn: {
        backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
    },
    withdrawBtnDisabled: { backgroundColor: '#E0E0E0' },
    withdrawBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    withdrawBtnTextDisabled: { color: '#BDBDBD' },
});
