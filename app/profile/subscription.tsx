import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, TextInput, Modal, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/components/AuthContext';
import SubscriptionService, { PLAN_META, type ActiveSubscription } from '@/services/SubscriptionService';

// ─── BI 패턴 배경 컴포넌트 (바둑판식 로고 반복) ───
const LOGO = require('@/assets/images/plusultra_icon.png');

const BgPattern = () => {
    const rows = [
        { offset: 0, count: 5 },
        { offset: 37, count: 5 },
        { offset: 18, count: 5 },
        { offset: 0, count: 5 },
    ];
    return (
        <View style={st.bgPattern}>
            {rows.map((row, ri) => (
                <View key={ri} style={[st.bgPatternRow, { paddingLeft: row.offset }]}>
                    {Array.from({ length: row.count }).map((_, ci) => (
                        <Image
                            key={ci}
                            source={LOGO}
                            style={st.bgPatternLogo}
                            resizeMode="contain"
                        />
                    ))}
                </View>
            ))}
        </View>
    );
};

// ─── 플랜 데이터 ───
const PLANS = [
    {
        id: 'basic',
        name: 'Basic 1개월 탐사권',
        price: '6',
        currency: 'USD',
        benefits: ['500 ell 즉시 지급', 'AI 추천(5회)'],
        headerColor: '#7295FE',  // Primary/5
    },
    {
        id: 'pro',
        name: 'PRO 12개월 탐사권',
        price: '60',
        currency: 'USD',
        benefits: ['6,000 ell 즉시 지급', 'AI 추천(무제한)'],
        headerColor: '#3B4576',  // Primary/4
    },
];

export default function SubscriptionScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [purchasedPlan, setPurchasedPlan] = useState<typeof PLANS[0] | null>(null);

    // ── DB 연동 상태 ──
    const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [remainingAi, setRemainingAi] = useState<number>(0);

    // IAP 초기화 + 현재 구독 조회
    useFocusEffect(
        useCallback(() => {
            const init = async () => {
                setLoading(true);
                try {
                    await SubscriptionService.init();
                    if (user?.id) {
                        const sub = await SubscriptionService.getActiveSubscription(user.id);
                        setActiveSub(sub);
                        const remaining = await SubscriptionService.getRemainingAiCount(user.id);
                        setRemainingAi(remaining);
                    }
                } catch (e) {
                    console.warn('[Subscription] init error:', e);
                } finally {
                    setLoading(false);
                }
            };
            init();

            return () => {
                SubscriptionService.cleanup();
            };
        }, [user?.id])
    );

    const handlePurchase = async () => {
        if (!selectedPlan || !user?.id) return;
        const plan = PLANS.find(p => p.id === selectedPlan);
        if (!plan) return;

        setPurchasing(true);
        try {
            // 인앱결제 → DB 활성화
            const result = await SubscriptionService.activateSubscription(user.id, selectedPlan);
            if (result) {
                setPurchasedPlan(plan);
                setActiveSub(result);
                setShowPurchaseModal(true);
            } else {
                Alert.alert('오류', '구독 활성화에 실패했습니다.');
            }
        } catch (e) {
            Alert.alert('오류', '결제 처리 중 오류가 발생했습니다.');
        } finally {
            setPurchasing(false);
        }
    };

    const handlePromoApply = () => {
        if (!promoCode.trim()) return;
        // TODO: 프로모션 코드 적용 로직
    };

    // 구독에서 플랜 메타데이터 가져오기
    const activePassMeta = activeSub ? PLAN_META[activeSub.plan_id] : null;
    const formatDate = (d: string) => new Date(d).toISOString().slice(0, 10).replace(/-/g, '.');

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>이용권 및 프로모션</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ══ 보유 이용권 ══ */}
                <View style={st.section}>
                    <Text style={st.sectionLabel}>보유 이용권</Text>
                    {loading ? (
                        <View style={st.loadingWrap}>
                            <ActivityIndicator size="small" color="#3C57E9" />
                        </View>
                    ) : activeSub && activePassMeta ? (
                        <View style={st.passCard}>
                            <View style={[st.passCardHeader, { backgroundColor: '#10478F' }]}>
                                <Text style={st.passCardHeaderTitle}>{activePassMeta.name}</Text>
                                <View style={st.activeBadge}>
                                    <View style={st.activeDot} />
                                    <Text style={st.activeBadgeText}>사용 중</Text>
                                </View>
                            </View>
                            <View style={st.passCardBody}>
                                <BgPattern />
                                <View style={st.passCardContent}>
                                    <View style={st.infoGroup}>
                                        <Text style={st.infoLabel}>유효 기간</Text>
                                        <Text style={st.infoValue}>
                                            {formatDate(activeSub.start_date)} ~ {formatDate(activeSub.end_date)}
                                        </Text>
                                    </View>
                                    <View style={st.infoGroup}>
                                        <Text style={st.infoLabel}>혜택</Text>
                                        <View style={st.benefitRow}>
                                            <View style={st.benefitDot} />
                                            <Text style={st.benefitText}>
                                                AI 추천({remainingAi === -1 ? '무제한' : `${remainingAi}회 남음`})
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={st.emptyPassWrap}>
                            <Text style={st.emptyPassText}>보유 중인 이용권이 없습니다</Text>
                        </View>
                    )}
                </View>

                {/* ══ 이용 기간 선택 ══ */}
                <View style={st.section}>
                    <Text style={st.sectionLabel}>이용 기간 선택</Text>
                    {PLANS.map((plan) => (
                        <TouchableOpacity
                            key={plan.id}
                            style={[
                                st.passCard,
                                selectedPlan === plan.id && st.passCardSelected,
                            ]}
                            onPress={() => setSelectedPlan(plan.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[st.passCardHeader, { backgroundColor: plan.headerColor }]}>
                                <Text style={st.passCardHeaderTitle}>{plan.name}</Text>
                            </View>
                            <View style={st.passCardBody}>
                                <BgPattern />
                                <View style={st.passCardContent}>
                                    <View style={st.infoGroup}>
                                        <Text style={st.infoLabel}>혜택</Text>
                                        {plan.benefits.map((b, i) => (
                                            <View key={i} style={st.benefitRow}>
                                                <View style={st.benefitDot} />
                                                <Text style={st.benefitText}>{b}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <View style={st.priceRow}>
                                        <Text style={st.priceValue}>{plan.price}</Text>
                                        <Text style={st.priceCurrency}>{plan.currency}</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {selectedPlan && (
                        <TouchableOpacity
                            style={[st.purchaseBtn, purchasing && st.purchaseBtnDisabled]}
                            onPress={handlePurchase}
                            disabled={purchasing}
                            activeOpacity={0.7}
                        >
                            {purchasing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={st.purchaseBtnText}>구매하기</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* ══ 프로모션 코드 ══ */}
                <View style={st.section}>
                    <Text style={st.sectionLabel}>프로모션 코드</Text>
                    <View style={st.promoRow}>
                        <TextInput
                            style={st.promoInput}
                            value={promoCode}
                            onChangeText={setPromoCode}
                            placeholder="코드를 입력하세요"
                            placeholderTextColor="#BDBDBD"
                        />
                        <TouchableOpacity
                            style={[st.promoApplyBtn, !promoCode.trim() && st.promoApplyBtnDisabled]}
                            onPress={handlePromoApply}
                            disabled={!promoCode.trim()}
                            activeOpacity={0.7}
                        >
                            <Text style={st.promoApplyText}>적용</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ══ 진행 중인 프로모션 ══ */}
                <View style={st.section}>
                    <Text style={st.sectionLabel}>진행 중인 프로모션</Text>
                    <View style={st.promoCard}>
                        {/* 상단: 이미지 + 날짜 */}
                        <View style={st.promoCardTop}>
                            <View style={st.promoIconBox}>
                                <Ionicons name="gift-outline" size={48} color="#7C6AC7" />
                            </View>
                            <Text style={st.promoExpiry}>~ 2025.03.31</Text>
                        </View>
                        {/* 하단: 제목 + 설명 (중앙 정렬) */}
                        <View style={st.promoCardBottom}>
                            <Text style={st.promoCardTitle}>첫 구매 시 2배 포인트 적립</Text>
                            <Text style={st.promoCardDesc}>첫 ell 구매 시 포인트가 2배로 적립됩니다.</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>

            {/* ── 구매 완료 (Figma: Purchase Completed) ── */}
            <Modal visible={showPurchaseModal} transparent animationType="fade" onRequestClose={() => setShowPurchaseModal(false)}>
                <View style={st.modalOverlay}>
                    <SafeAreaView style={st.modalSafe}>
                        <View style={st.modalContent}>
                            {/* X 닫기 버튼 */}
                            <View style={st.modalNav}>
                                <TouchableOpacity onPress={() => setShowPurchaseModal(false)} style={st.modalCloseBtn}>
                                    <Ionicons name="close" size={24} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            {/* Body */}
                            <View style={st.modalBody}>
                                {/* 성공 메시지 */}
                                <View style={st.modalMsgBlock}>
                                    <View style={st.modalSuccessRow}>
                                        <Ionicons name="checkmark-circle" size={24} color="#3C57E9" />
                                        <Text style={st.modalSuccessText}>구매가 완료됐어요!</Text>
                                    </View>
                                    <Text style={st.modalSubtitle}>
                                        {purchasedPlan?.name || 'Basic 30일'} 이용권이 바로 적용됩니다.
                                    </Text>
                                </View>

                                {/* 구매 상세 카드 */}
                                <View style={st.modalDetailCard}>
                                    <Text style={st.modalDetailTitle}>구매 상세</Text>
                                    <View style={st.modalDetailRows}>
                                        <View style={st.modalDetailRow}>
                                            <Text style={st.dLabel}>이용권</Text>
                                            <Text style={st.dValue}>Basic 30일 이용권</Text>
                                        </View>
                                        <View style={st.modalDetailRow}>
                                            <Text style={st.dLabel}>결제 금액</Text>
                                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                                <Text style={st.dValueRight}>₩6,930</Text>
                                                <Text style={st.dValueRight}>(첫 달 30% 할인)</Text>
                                            </View>
                                        </View>
                                        <View style={st.modalDetailRow}>
                                            <Text style={st.dLabel}>결제 수단</Text>
                                            <Text style={st.dValue}>신용카드  ****-1234</Text>
                                        </View>
                                        <View style={st.modalDetailRow}>
                                            <Text style={st.dLabel}>결제일</Text>
                                            <Text style={st.dValue}>2025.03.09</Text>
                                        </View>
                                        <View style={st.modalDetailRow}>
                                            <Text style={st.dLabel}>이용 만료일</Text>
                                            <Text style={st.dValue}>2025.04.09 (30일)</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* 하단 CTA */}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity
                                style={st.modalCta}
                                onPress={() => setShowPurchaseModal(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={st.modalCtaText}>확인</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // ── 헤더 ──
    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, height: 58,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 40 },

    // ── 섹션 ──
    section: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: { fontSize: 14, fontWeight: '500', color: '#3C57E9', marginBottom: 14 },

    // ══ Pass 카드 (공통) ══
    passCard: {
        borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#EAECF6', marginBottom: 20,
    },
    passCardSelected: {
        borderWidth: 2, borderColor: '#3C57E9',
    },
    passCardHeader: {
        height: 52, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 16, overflow: 'hidden',
    },
    passCardHeaderTitle: {
        fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1,
    },
    activeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: 'rgba(199,217,238,0.25)',
        borderRadius: 15, paddingHorizontal: 14, paddingVertical: 7,
    },
    activeDot: {
        width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80',
    },
    activeBadgeText: {
        fontSize: 12, fontWeight: '600', color: '#EBECF1', letterSpacing: -0.24,
    },
    passCardBody: {
        position: 'relative', overflow: 'hidden',
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 30,
    },
    passCardContent: {
        gap: 13, zIndex: 1,
    },

    // BI 로고 패턴 배경
    bgPattern: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        flexDirection: 'column', gap: 7, justifyContent: 'center', alignItems: 'center',
        opacity: 0.28,
    },
    bgPatternRow: {
        flexDirection: 'row', gap: 43,
    },
    bgPatternLogo: {
        width: 30, height: 44, opacity: 0.35,
        tintColor: '#B0B8D4',
    },

    // ── 공통 info ──
    infoGroup: { gap: 4 },
    infoLabel: { fontSize: 12, fontWeight: '400', color: '#999999', letterSpacing: -0.24 },
    infoValue: { fontSize: 14, fontWeight: '400', color: '#1A1A1A', lineHeight: 21 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    benefitDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#3B4576' },
    benefitText: { fontSize: 14, fontWeight: '400', color: '#3B4576', lineHeight: 21 },

    // ── 가격 ──
    priceRow: {
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6,
    },
    priceValue: { fontSize: 26, fontWeight: '500', color: '#1A1A1A' },
    priceCurrency: { fontSize: 14, fontWeight: '500', color: '#808080', lineHeight: 21, paddingBottom: 2 },

    // ══ 프로모션 코드 ══
    promoRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    promoInput: {
        flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8,
        paddingVertical: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
        borderWidth: 1, borderColor: '#EBECF1',
    },
    promoApplyBtn: {
        backgroundColor: '#3C57E9', borderRadius: 8,
        width: 120, justifyContent: 'center', alignItems: 'center',
    },
    promoApplyBtnDisabled: { backgroundColor: '#B2B2B2' },
    promoApplyText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

    // ══ 진행 중인 프로모션 카드 (rounded 26, 그라데이션) ══
    promoCard: {
        borderRadius: 26, overflow: 'hidden',
        paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30,
        marginBottom: 20,
        // 그라데이션: linear-gradient(167deg, #EAECF6 8%, #C3CBF1 86%)
        backgroundColor: '#E0E4F4',
    },
    promoCardTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    promoIconBox: {
        width: 121, height: 121, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    promoExpiry: {
        fontSize: 12, fontWeight: '400', color: '#666666', lineHeight: 16.8,
        paddingTop: 16,
    },
    promoCardBottom: {
        alignItems: 'center', gap: 9,
    },
    promoCardTitle: {
        fontSize: 18, fontWeight: '600', color: '#000000', textAlign: 'center',
    },
    promoCardDesc: {
        fontSize: 14, fontWeight: '400', color: '#666666', lineHeight: 21, textAlign: 'center',
    },

    // ══ 구매 완료 모달 (Figma: 264:21550) ══
    modalOverlay: { flex: 1, backgroundColor: '#FFFFFF' },
    modalSafe: { flex: 1 },
    modalContent: { flex: 1, paddingHorizontal: 16 },
    modalNav: {
        height: 56, justifyContent: 'flex-end', paddingBottom: 14,
    },
    modalCloseBtn: { padding: 4, marginLeft: -4 },
    modalBody: {
        gap: 40,
    },
    modalMsgBlock: {
        gap: 8, paddingTop: 2,
    },
    modalSuccessRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    modalSuccessText: {
        fontSize: 18, fontWeight: '600', color: '#1A1A1A',
        fontFamily: 'Pretendard',
    },
    modalSubtitle: {
        fontSize: 14, fontWeight: '400', color: '#666666',
        lineHeight: 21, fontFamily: 'Pretendard',
    },
    modalDetailCard: {
        backgroundColor: '#EAECF6', borderRadius: 6,
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18,
        gap: 14,
    },
    modalDetailTitle: {
        fontSize: 14, fontWeight: '500', color: '#707070',
        fontFamily: 'Pretendard',
    },
    modalDetailRows: { gap: 10 },
    modalDetailRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 24, minHeight: 20,
    },
    dLabel: {
        fontSize: 14, fontWeight: '400', color: '#999999',
        fontFamily: 'Pretendard',
    },
    dValue: {
        fontSize: 14, fontWeight: '500', color: '#1A1A1A',
        textAlign: 'right', fontFamily: 'Pretendard', flex: 1,
        lineHeight: 21,
    },
    dValueRight: {
        fontSize: 14, fontWeight: '500', color: '#1A1A1A',
        textAlign: 'right', fontFamily: 'Pretendard',
        lineHeight: 21,
    },
    modalCta: {
        backgroundColor: '#3C57E9', borderRadius: 5,
        height: 56, justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
    },
    modalCtaText: {
        fontSize: 16, fontWeight: '600', color: '#FFFFFF',
        fontFamily: 'Pretendard',
    },

    // ── 추가 상태 스타일 ──
    loadingWrap: {
        paddingVertical: 40, alignItems: 'center',
    },
    emptyPassWrap: {
        backgroundColor: '#EAECF6', borderRadius: 8,
        paddingVertical: 32, alignItems: 'center', marginBottom: 20,
    },
    emptyPassText: {
        fontSize: 14, fontWeight: '400', color: '#999999',
    },
    purchaseBtn: {
        backgroundColor: '#3C57E9', borderRadius: 8,
        height: 52, justifyContent: 'center', alignItems: 'center',
        marginBottom: 10,
    },
    purchaseBtnDisabled: { opacity: 0.6 },
    purchaseBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
