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
import { useEll } from '@/components/EllContext';
import { supabase } from '@/services/supabase';

interface ActivityRecord {
    id: number;
    type: string;       // 'mag_claim' | 'subscription' | etc.
    description: string;
    ell_cost: number;
    mag_count: number;
    created_at: string;
}

export default function ActivityHistoryScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { ellBalance } = useEll();
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState<ActivityRecord[]>([]);
    const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
    const [showSortModal, setShowSortModal] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            (async () => {
                setLoading(true);
                try {
                    // purchases 테이블에서 MAG 점유 기록 가져오기
                    const { data: purchaseData, error: purchaseErr } = await supabase
                        .from('purchases')
                        .select('id, cost, created_at, cell_count, batch_id')
                        .eq('user_id', user.id)
                        .eq('status', 'completed')
                        .order('created_at', { ascending: false });

                    if (purchaseErr) {
                        console.warn('[ActivityHistory] purchase load error:', purchaseErr.message);
                    }

                    // activity_logs 테이블에서 기타 활동 기록 가져오기
                    const { data: logData, error: logErr } = await supabase
                        .from('activity_logs')
                        .select('id, type, description, ell_amount, mag_count, created_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (logErr) {
                        // 테이블이 아직 없으면 무시
                        console.warn('[ActivityHistory] activity_logs load error:', logErr.message);
                    }

                    const results: ActivityRecord[] = [];

                    // purchases → batch_id 기반 묶음 그룹핑
                    if (purchaseData && purchaseData.length > 0) {
                        const groups = new Map<string, any[]>();
                        let soloIdx = 0;
                        for (const p of purchaseData as any[]) {
                            const key = p.batch_id || `_solo_${soloIdx++}`;
                            if (!groups.has(key)) groups.set(key, []);
                            groups.get(key)!.push(p);
                        }
                        for (const [, g] of groups) {
                            const totalMag = g.reduce((s: number, p: any) => s + (p.cost || 1), 0);
                            const totalEll = totalMag * 25;
                            const isBulk = g.length > 1;
                            results.push({
                                id: g[0].id,
                                type: 'mag_claim',
                                description: isBulk
                                    ? `MAG ${totalMag}개 묶음 개척`
                                    : `MAG 개척`,
                                ell_cost: totalEll,
                                mag_count: totalMag,
                                created_at: g[g.length - 1].created_at,
                            });
                        }
                    }

                    // activity_logs → activity 변환
                    if (logData) {
                        for (const l of logData as any[]) {
                            results.push({
                                id: l.id + 100000, // ID 중복 방지
                                type: l.type,
                                description: l.description || l.type,
                                ell_cost: l.ell_amount || 0,
                                mag_count: l.mag_count || 0,
                                created_at: l.created_at,
                            });
                        }
                    }

                    setActivities(results);
                } catch (e) {
                    console.warn('[ActivityHistory] load error:', e);
                } finally {
                    setLoading(false);
                }
            })();
        }, [user?.id])
    );

    const sorted = [...activities].sort((a, b) => {
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

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'mag_claim': return 'MAG 개척';
            case 'subscription': return '이용권 구매';
            case 'ai_recommend': return 'AI 추천';
            default: return type;
        }
    };

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>활동 내역</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ══ 보유 ELL 카드 ══ */}
                <View style={st.balanceCard}>
                    <Text style={st.balanceLabel}>보유 ELL</Text>
                    <View style={st.balanceRow}>
                        <Text style={st.balanceValue}>{ellBalance.toLocaleString()}</Text>
                        <Text style={st.balanceUnit}>ELL</Text>
                    </View>
                </View>

                {/* ═══ 정렬 & 리스트 ═══ */}
                <View style={st.listSection}>
                    <TouchableOpacity
                        style={st.sortBtn}
                        onPress={() => setShowSortModal(true)}
                    >
                        <Text style={st.sortBtnText}>
                            {sortOrder === 'latest' ? '최신순' : '오래된순'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#808080" />
                    </TouchableOpacity>

                    {loading ? (
                        <View style={st.loadingWrap}>
                            <ActivityIndicator size="small" color="#3C57E9" />
                        </View>
                    ) : sorted.length === 0 ? (
                        <View style={st.emptyWrap}>
                            <Text style={st.emptyText}>활동 내역이 없습니다</Text>
                        </View>
                    ) : (
                        sorted.map((act) => (
                            <View key={act.id} style={st.actRow}>
                                <View style={st.actLeft}>
                                    <Text style={st.actType}>{getTypeLabel(act.type)}</Text>
                                    <Text style={st.actDesc}>{act.mag_count} MAG</Text>
                                    <Text style={st.actDate}>{formatDate(act.created_at)}</Text>
                                </View>
                                <Text style={st.actEll}>-{act.ell_cost.toLocaleString()} ELL</Text>
                            </View>
                        ))
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

    // ─ 보유 ELL 카드 ─
    balanceCard: {
        backgroundColor: '#EAECF6', borderRadius: 8,
        paddingHorizontal: 20, paddingVertical: 20,
        marginTop: 10, marginBottom: 24,
    },
    balanceLabel: {
        fontSize: 14, fontWeight: '400', color: '#808080', fontFamily: 'Pretendard',
        marginBottom: 10,
    },
    balanceRow: {
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end',
    },
    balanceValue: {
        fontSize: 38, fontWeight: '500', color: '#1A1A1A', fontFamily: 'Pretendard',
    },
    balanceUnit: {
        fontSize: 16, fontWeight: '500', color: '#808080', fontFamily: 'Pretendard',
        marginLeft: 8,
    },

    // ─ 정렬 & 리스트 ─
    listSection: { marginBottom: 24 },
    sortBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        marginBottom: 8,
    },
    sortBtnText: { fontSize: 14, fontWeight: '400', color: '#808080', fontFamily: 'Pretendard' },

    // 활동 행
    actRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
    },
    actLeft: { flex: 1, gap: 2 },
    actType: { fontSize: 13, fontWeight: '500', color: '#3C57E9', fontFamily: 'Pretendard' },
    actDesc: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', fontFamily: 'Pretendard' },
    actDate: { fontSize: 13, fontWeight: '400', color: '#999999', fontFamily: 'Pretendard' },
    actEll: { fontSize: 16, fontWeight: '500', color: '#1A1A1A', fontFamily: 'Pretendard' },

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
