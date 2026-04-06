import React, { useState, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/services/supabase';
import { PLAN_META } from '@/services/SubscriptionService';

// ── 플랜별 가격 매핑 ──
const PLAN_PRICE: Record<string, { ell: number; price: string }> = {
    basic: { ell: 500, price: '₩6,930' },
    pro: { ell: 6000, price: '₩69,300' },
};

interface TransactionRecord {
    id: number;
    plan_id: string;
    start_date: string;
    created_at: string;
    status: string;
}

export default function TransactionHistoryScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
    const [showSortModal, setShowSortModal] = useState(false);
    const [activeSub, setActiveSub] = useState<TransactionRecord | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            (async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('subscriptions')
                        .select('id, plan_id, start_date, created_at, status')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (!error && data) {
                        setTransactions(data);
                        // 현재 활성 구독
                        const active = data.find(s => s.status === 'active');
                        setActiveSub(active || null);
                    }
                } catch (e) {
                    console.warn('[TransactionHistory] load error:', e);
                } finally {
                    setLoading(false);
                }
            })();
        }, [user?.id])
    );

    const sorted = [...transactions].sort((a, b) => {
        if (sortOrder === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const formatDate = (d: string) => {
        const dt = new Date(d);
        const y = dt.getFullYear();
        const m = dt.getMonth() + 1;
        const day = dt.getDate();
        return `${y}년 ${m}월 ${day}일`;
    };

    const activePassMeta = activeSub ? PLAN_META[activeSub.plan_id] : null;

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>거래 내역</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ══ 현재 이용권 카드 ══ */}
                <View style={st.passCard}>
                    <Text style={st.passTitle}>
                        {activePassMeta ? activePassMeta.name : '보유 이용권 없음'}
                    </Text>
                    <Text style={st.passSubtitle}>
                        {activePassMeta ? '일회 결제' : '이용권을 구매해주세요'}
                    </Text>
                    {activePassMeta && (
                        <View style={st.passBtnRow}>
                            <TouchableOpacity style={st.cancelPlanBtn}>
                                <Text style={st.cancelPlanText}>해지하기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={st.changePlanBtn}
                                onPress={() => router.push('/profile/subscription')}
                            >
                                <Text style={st.changePlanText}>변경하기</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ══ 결제 수단 ══ */}
                <View style={st.section}>
                    <Text style={st.sectionLabel}>결제 수단</Text>
                    <View style={st.paymentRow}>
                        <View style={st.paymentIconBox}>
                            <Ionicons name="card-outline" size={20} color="#3C57E9" />
                        </View>
                        <Text style={st.paymentText}>카드 •••• 1234</Text>
                        <TouchableOpacity style={st.updateBtn}>
                            <Text style={st.updateBtnText}>변경</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ══ 거래 내역 리스트 ══ */}
                <View style={st.section}>
                    <View style={st.historyHeader}>
                        <Text style={st.sectionLabel}>거래 내역</Text>
                        <TouchableOpacity
                            style={st.sortBtn}
                            onPress={() => setShowSortModal(true)}
                        >
                            <Text style={st.sortBtnText}>
                                {sortOrder === 'latest' ? '최신순' : '오래된순'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#808080" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={st.loadingWrap}>
                            <ActivityIndicator size="small" color="#3C57E9" />
                        </View>
                    ) : sorted.length === 0 ? (
                        <View style={st.emptyWrap}>
                            <Text style={st.emptyText}>거래 내역이 없습니다</Text>
                        </View>
                    ) : (
                        sorted.map((tx) => {
                            const planPrice = PLAN_PRICE[tx.plan_id] || { ell: 0, price: '₩0' };
                            const meta = PLAN_META[tx.plan_id];
                            return (
                                <View key={tx.id} style={st.txRow}>
                                    <View style={st.txLeft}>
                                        <Text style={st.txEll}>{planPrice.ell.toLocaleString()} ELL</Text>
                                        <Text style={st.txDate}>{formatDate(tx.created_at)}</Text>
                                    </View>
                                    <Text style={st.txPrice}>{planPrice.price}</Text>
                                </View>
                            );
                        })
                    )}
                </View>

            </ScrollView>

            {/* ── 정렬 팝업 ── */}
            <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
                <TouchableOpacity style={st.sortOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
                    <View style={st.sortDropdown}>
                        <TouchableOpacity
                            style={st.sortOption}
                            onPress={() => { setSortOrder('latest'); setShowSortModal(false); }}
                        >
                            {sortOrder === 'latest' && <Ionicons name="checkmark" size={18} color="#1A1A1A" />}
                            <Text style={[st.sortOptionText, sortOrder === 'latest' && st.sortOptionActive]}>최신순</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={st.sortOption}
                            onPress={() => { setSortOrder('oldest'); setShowSortModal(false); }}
                        >
                            {sortOrder === 'oldest' && <Ionicons name="checkmark" size={18} color="#1A1A1A" />}
                            <Text style={[st.sortOptionText, sortOrder === 'oldest' && st.sortOptionActive]}>오래된순</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // 헤더
    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, height: 58,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard' },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

    // 이용권 카드
    passCard: {
        borderWidth: 1, borderColor: '#EBECF1', borderRadius: 8,
        paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
        marginTop: 10, marginBottom: 24,
    },
    passTitle: {
        fontSize: 18, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard',
        marginBottom: 4,
    },
    passSubtitle: {
        fontSize: 14, fontWeight: '400', color: '#999999', fontFamily: 'Pretendard',
        marginBottom: 16,
    },
    passBtnRow: {
        flexDirection: 'row', gap: 12,
    },
    cancelPlanBtn: {
        flex: 1, borderWidth: 1, borderColor: '#EBECF1', borderRadius: 6,
        height: 44, alignItems: 'center', justifyContent: 'center',
    },
    cancelPlanText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard' },
    changePlanBtn: {
        flex: 1, backgroundColor: '#3C57E9', borderRadius: 6,
        height: 44, alignItems: 'center', justifyContent: 'center',
    },
    changePlanText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Pretendard' },

    // 섹션
    section: { marginBottom: 24 },
    sectionLabel: { fontSize: 14, fontWeight: '500', color: '#3C57E9', marginBottom: 14, fontFamily: 'Pretendard' },

    // 결제 수단
    paymentRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    paymentIconBox: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#EAECF6', alignItems: 'center', justifyContent: 'center',
    },
    paymentText: {
        flex: 1, fontSize: 16, fontWeight: '400', color: '#1A1A1A', fontFamily: 'Pretendard',
    },
    updateBtn: {
        borderWidth: 1, borderColor: '#EBECF1', borderRadius: 6,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    updateBtnText: { fontSize: 14, fontWeight: '500', color: '#1A1A1A', fontFamily: 'Pretendard' },

    // 거래 내역 헤더
    historyHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
    },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sortBtnText: { fontSize: 14, fontWeight: '400', color: '#808080', fontFamily: 'Pretendard' },

    // 거래 행
    txRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
    },
    txLeft: { gap: 4 },
    txEll: { fontSize: 16, fontWeight: '500', color: '#3C57E9', fontFamily: 'Pretendard' },
    txDate: { fontSize: 13, fontWeight: '400', color: '#999999', fontFamily: 'Pretendard' },
    txPrice: { fontSize: 18, fontWeight: '500', color: '#1A1A1A', fontFamily: 'Pretendard' },

    // 빈 상태
    loadingWrap: { paddingVertical: 60, alignItems: 'center' },
    emptyWrap: { paddingVertical: 80, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '400', color: '#BDBDBD', fontFamily: 'Pretendard' },

    // 정렬 모달
    sortOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center', alignItems: 'center',
    },
    sortDropdown: {
        backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8,
        width: 160,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
        elevation: 8,
    },
    sortOption: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 14,
    },
    sortOptionText: { fontSize: 16, fontWeight: '400', color: '#808080', fontFamily: 'Pretendard' },
    sortOptionActive: { fontWeight: '600', color: '#1A1A1A' },
});
