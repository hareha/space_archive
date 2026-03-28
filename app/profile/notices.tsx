import React, { useState } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

// ─── 목데이터 ───
const CATEGORIES = ['전체', '업데이트', '이벤트'];

interface Notice {
    id: string;
    category: '업데이트' | '이벤트';
    title: string;
    date: string;
    changes?: string[];
}

const NOTICES: Notice[] = [
    {
        id: '1',
        category: '업데이트',
        title: 'v1.0.3 업데이트 안내 — AR 구역 탐색 기능 개선',
        date: '2024.11.12',
        changes: [
            'AR 구역 탐색 — 카메라 인식 속도 40% 개선',
            '달 구역 그리드 오버레이 렌더링 엔진 업데이트',
            'iOS 18 / Android 15 호환성 강화',
            '리전 마커 탭 시 상세 팝업 표시 오류 수정',
        ],
    },
    {
        id: '2',
        category: '업데이트',
        title: 'v1.0.2 업데이트 — 위성 궤도 실시간 데이터 연동',
        date: '2024.11.01',
        changes: [
            '위성 궤도 데이터 실시간 연동 기능 추가',
            '구역 개척 상태 업데이트 주기 개선 (5분 → 실시간)',
            '지도 줌 레벨별 렌더링 최적화',
        ],
    },
    {
        id: '3',
        category: '이벤트',
        title: '신규 가입 프로모션 코드 LUNA30 배포 안내',
        date: '2024.10.28',
        changes: [
            '신규 가입자 대상 프로모션 코드 LUNA30 배포',
            '코드 입력 시 30% 추가 ell 적립',
            '이벤트 기간: 2024.10.28 ~ 2024.11.30',
        ],
    },
    {
        id: '4',
        category: '업데이트',
        title: 'v1.0.1 — AI 구역 추천 정확도 개선 및 버그 수정',
        date: '2024.09.10',
        changes: [
            'AI 구역 추천 알고리즘 정확도 25% 향상',
            '스크랩 동기화 오류 수정',
            '마이페이지 로딩 속도 개선',
        ],
    },
];

// ─── 카테고리 배지 색상 ───
function categoryColor(cat: string) {
    return cat === '업데이트' ? '#4A90D9' : '#E67E22';
}

export default function NoticesScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('전체');
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

    const filtered = activeTab === '전체'
        ? NOTICES
        : NOTICES.filter(n => n.category === activeTab);

    // ── 상세 화면 ──
    if (selectedNotice) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={() => setSelectedNotice(null)} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>공지사항</Text>
                    <View style={{ width: 38 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailSection}>
                        <View style={[styles.catBadge, { backgroundColor: categoryColor(selectedNotice.category) + '18' }]}>
                            <Text style={[styles.catBadgeText, { color: categoryColor(selectedNotice.category) }]}>
                                {selectedNotice.category}
                            </Text>
                        </View>
                        <Text style={styles.detailTitle}>{selectedNotice.title}</Text>
                        <Text style={styles.detailDate}>{selectedNotice.date}</Text>
                    </View>

                    {/* 주요 변경 사항 */}
                    {selectedNotice.changes && (
                        <View style={styles.changesSection}>
                            <Text style={styles.changesHeader}>주요 변경 사항</Text>
                            {selectedNotice.changes.map((item, i) => (
                                <View key={i} style={styles.changeRow}>
                                    <Text style={styles.changeBullet}>•</Text>
                                    <Text style={styles.changeText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    )}


                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── 리스트 화면 ──
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>공지사항</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* 탭 필터 */}
            <View style={styles.tabBar}>
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.tab, activeTab === cat && styles.tabActive]}
                        onPress={() => setActiveTab(cat)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.tabText, activeTab === cat && styles.tabTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* 리스트 */}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {filtered.map(notice => (
                    <TouchableOpacity
                        key={notice.id}
                        style={styles.noticeRow}
                        onPress={() => setSelectedNotice(notice)}
                        activeOpacity={0.6}
                    >
                        <View style={{ flex: 1 }}>
                            <View style={[styles.catBadgeSmall, { backgroundColor: categoryColor(notice.category) + '18' }]}>
                                <Text style={[styles.catBadgeSmallText, { color: categoryColor(notice.category) }]}>
                                    {notice.category}
                                </Text>
                            </View>
                            <Text style={styles.noticeTitle} numberOfLines={2}>{notice.title}</Text>
                            <Text style={styles.noticeDate}>{notice.date}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#BDBDBD" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
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

    // 탭
    tabBar: {
        flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    tab: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 4 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#1A1A1A' },
    tabText: { fontSize: 14, fontWeight: '500', color: '#BDBDBD' },
    tabTextActive: { color: '#1A1A1A', fontWeight: '700' },

    // 리스트
    noticeRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 18,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    catBadgeSmall: {
        alignSelf: 'flex-start', borderRadius: 4,
        paddingVertical: 3, paddingHorizontal: 8, marginBottom: 6,
    },
    catBadgeSmallText: { fontSize: 11, fontWeight: '700' },
    noticeTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20, marginBottom: 4 },
    noticeDate: { fontSize: 12, color: '#BDBDBD' },

    // 상세
    detailSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    catBadge: {
        alignSelf: 'flex-start', borderRadius: 4,
        paddingVertical: 4, paddingHorizontal: 10, marginBottom: 12,
    },
    catBadgeText: { fontSize: 12, fontWeight: '700' },
    detailTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', lineHeight: 28, marginBottom: 8 },
    detailDate: { fontSize: 13, color: '#9E9E9E' },

    changesSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    changesHeader: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
    changeRow: { flexDirection: 'row', marginBottom: 10
    },
    changeBullet: { fontSize: 14, color: '#9E9E9E', marginRight: 8, marginTop: 1 },
    changeText: { fontSize: 14, color: '#333', flex: 1, lineHeight: 20 },


});
