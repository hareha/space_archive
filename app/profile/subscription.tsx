import React, { useState } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

// ─── 플랜 데이터 ───
const PLANS = [
    {
        id: 'basic',
        name: 'Basic 1개월 탐사권',
        price: '5 USD',
        ell: '500 ell 즉시 지급',
        ai: 'AI 추천(5회)',
    },
    {
        id: 'pro',
        name: 'PRO 12개월 탐사권',
        price: '60 USD',
        ell: '6,000 ell 즉시 지급',
        ai: 'AI 추천(무제한)',
    },
];

export default function SubscriptionScreen() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [purchasedPlan, setPurchasedPlan] = useState<typeof PLANS[0] | null>(null);

    const handlePurchase = () => {
        const plan = PLANS.find(p => p.id === selectedPlan);
        if (!plan) return;
        setPurchasedPlan(plan);
        setShowPurchaseModal(true);
    };

    const handlePromoApply = () => {
        if (!promoCode.trim()) return;
        // TODO: 프로모션 코드 적용 로직
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>이용권 및 프로모션</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── 보유 이용권 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>보유 이용권</Text>
                    <View style={styles.currentPlanCard}>
                        <View style={styles.currentPlanTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.currentPlanName}>Basic 1개월 탐사권</Text>
                                <Text style={styles.currentPlanPeriod}>2025.03.09 ~ 2025.04.09</Text>
                            </View>
                            <Text style={styles.currentPlanAi}>AI 추천(5회)</Text>
                        </View>
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>사용 중</Text>
                        </View>
                    </View>
                </View>

                {/* ── 이용 기간 선택 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>이용 기간 선택</Text>
                    {PLANS.map((plan) => (
                        <TouchableOpacity
                            key={plan.id}
                            style={[
                                styles.planCard,
                                selectedPlan === plan.id && styles.planCardSelected,
                            ]}
                            onPress={() => setSelectedPlan(plan.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.planCardLeft}>
                                <Text style={styles.planName}>{plan.name}</Text>
                                <Text style={styles.planEll}>{plan.ell}</Text>
                            </View>
                            <View style={styles.planCardRight}>
                                <Text style={styles.planPrice}>{plan.price}</Text>
                                <Text style={styles.planAi}>{plan.ai}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {selectedPlan && (
                        <TouchableOpacity style={styles.purchaseBtn} onPress={handlePurchase} activeOpacity={0.7}>
                            <Text style={styles.purchaseBtnText}>구매하기</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── 프로모션 코드 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>프로모션 코드</Text>
                    <View style={styles.promoRow}>
                        <TextInput
                            style={styles.promoInput}
                            value={promoCode}
                            onChangeText={setPromoCode}
                            placeholder="코드를 입력하세요"
                            placeholderTextColor="#BDBDBD"
                        />
                        <TouchableOpacity
                            style={[styles.promoApplyBtn, !promoCode.trim() && styles.promoApplyBtnDisabled]}
                            onPress={handlePromoApply}
                            disabled={!promoCode.trim()}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.promoApplyText, !promoCode.trim() && styles.promoApplyTextDisabled]}>
                                적용
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>


            </ScrollView>

            {/* ── 구매 완료 모달 ── */}
            <Modal visible={showPurchaseModal} transparent animationType="fade" onRequestClose={() => setShowPurchaseModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* 닫기 */}
                        <TouchableOpacity style={styles.modalClose} onPress={() => setShowPurchaseModal(false)}>
                            <Ionicons name="close" size={24} color="#999" />
                        </TouchableOpacity>

                        {/* 상단 */}
                        <View style={styles.modalCheckCircle}>
                            <Ionicons name="checkmark" size={36} color="#4A90D9" />
                        </View>
                        <Text style={styles.modalTitle}>구매가 완료됐어요!</Text>
                        <Text style={styles.modalSubtitle}>
                            {purchasedPlan?.name || 'Basic 30일'} 이용권이 바로 적용됩니다
                        </Text>

                        {/* 구매 상세 */}
                        <View style={styles.modalDetail}>
                            <Text style={styles.modalDetailHeader}>구매 상세</Text>
                            <View style={styles.modalDetailRow}>
                                <Text style={styles.detailLabel}>이용권</Text>
                                <Text style={styles.detailValue}>Basic 30일 이용권</Text>
                            </View>
                            <View style={styles.modalDetailRow}>
                                <Text style={styles.detailLabel}>결제 금액</Text>
                                <Text style={styles.detailValue}>6,900원 (첫 달 30% 할인)</Text>
                            </View>
                            <View style={styles.modalDetailRow}>
                                <Text style={styles.detailLabel}>결제 수단</Text>
                                <Text style={styles.detailValue}>삼성카드 ****-1234</Text>
                            </View>
                            <View style={styles.modalDetailRow}>
                                <Text style={styles.detailLabel}>결제일</Text>
                                <Text style={styles.detailValue}>2025.03.09</Text>
                            </View>
                            <View style={styles.modalDetailRow}>
                                <Text style={styles.detailLabel}>이용 만료일</Text>
                                <Text style={styles.detailValue}>2025.04.09 (30일)</Text>
                            </View>
                        </View>


                    </View>
                </View>
            </Modal>
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
    scrollContent: { paddingBottom: 40 },

    // 섹션
    section: {
        paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: '#9E9E9E', marginBottom: 14 },

    // ── 보유 이용권 ──
    currentPlanCard: {
        backgroundColor: '#F7F7FA', borderRadius: 12,
        paddingVertical: 16, paddingHorizontal: 18, marginBottom: 8,
    },
    currentPlanTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 10,
    },
    currentPlanName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    currentPlanPeriod: { fontSize: 12, color: '#9E9E9E' },
    currentPlanAi: { fontSize: 12, color: '#9E9E9E' },
    activeBadge: {
        alignSelf: 'flex-start', backgroundColor: '#1A1A1A',
        borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10,
    },
    activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

    // ── 이용 기간 선택 ──
    planCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#F7F7FA', borderRadius: 12,
        paddingVertical: 18, paddingHorizontal: 18, marginBottom: 10,
        borderWidth: 1.5, borderColor: '#F0F0F0',
    },
    planCardSelected: { borderColor: '#4A90D9', backgroundColor: '#F0F6FF' },
    planCardLeft: { flex: 1 },
    planName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    planEll: { fontSize: 12, color: '#9E9E9E' },
    planCardRight: { alignItems: 'flex-end' },
    planPrice: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
    planAi: { fontSize: 12, color: '#9E9E9E' },

    purchaseBtn: {
        backgroundColor: '#4A90D9', borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 6, marginBottom: 8,
    },
    purchaseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // ── 프로모션 코드 ──
    promoRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    promoInput: {
        flex: 1, backgroundColor: '#F7F7FA', borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
        borderWidth: 1, borderColor: '#EFEFEF',
    },
    promoApplyBtn: {
        backgroundColor: '#1A1A1A', borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'center',
    },
    promoApplyBtnDisabled: { backgroundColor: '#E0E0E0' },
    promoApplyText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    promoApplyTextDisabled: { color: '#BDBDBD' },

    promoSubLabel: { fontSize: 12, color: '#9E9E9E', marginBottom: 10 },
    promoCard: {
        backgroundColor: '#F7F7FA', borderRadius: 12,
        paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12,
        borderLeftWidth: 3, borderLeftColor: '#4A90D9',
    },
    promoCardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    promoCardDesc: { fontSize: 13, color: '#555', marginBottom: 6, lineHeight: 18 },
    promoCardExpiry: { fontSize: 11, color: '#BDBDBD' },

    // ── 링크 ──
    linkRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, gap: 6,
    },
    linkText: { fontSize: 14, fontWeight: '600', color: '#4A90D9' },

    // ── 모달 ──
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 20, width: '100%',
        paddingTop: 36, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center',
    },
    modalClose: { position: 'absolute', top: 14, right: 14, padding: 4 },
    modalCheckCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#EBF3FC', justifyContent: 'center', alignItems: 'center',
        marginBottom: 18,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
    modalSubtitle: { fontSize: 13, color: '#9E9E9E', marginBottom: 24, textAlign: 'center' },

    modalDetail: {
        width: '100%', backgroundColor: '#F7F7FA', borderRadius: 12,
        paddingVertical: 16, paddingHorizontal: 18, marginBottom: 20,
    },
    modalDetailHeader: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
    modalDetailRow: {
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    },
    detailLabel: { fontSize: 13, color: '#9E9E9E' },
    detailValue: { fontSize: 13, fontWeight: '600', color: '#333' },

    modalCta: {
        width: '100%', paddingVertical: 14, alignItems: 'center',
    },
    modalCtaText: { fontSize: 14, fontWeight: '700', color: '#4A90D9' },
});
