import React, { useState } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

// ─── 탭 ───
const TABS = ['전체', '업데이트', '이벤트'] as const;
type TabKey = typeof TABS[number];

// ─── 카테고리 → 영문 표시 + 색상 ───
const CAT_MAP: Record<string, { label: string; color: string }> = {
    '업데이트': { label: '업데이트', color: '#7295FE' },
    '이벤트': { label: '이벤트', color: '#7295FE' },
};

interface Notice {
    id: string;
    category: '업데이트' | '이벤트';
    title: string;
    date: string;
    content?: string;
    changes?: string[];
}

const NOTICES: Notice[] = [
    {
        id: '1',
        category: '업데이트',
        title: '[v1.0.3 업데이트] AR 구역 탐색 기능 개선',
        date: '2026.01.23',
        content: '주요 변경 사항',
        changes: [
            'R 구역 탐색 — 카메라 인식 속도 40% 개선',
            '달 구역 그리드 오버레이 렌더링 안정화',
            'iOS 18 / Android 15 호환성 업데이트',
            '위성 마커 탭 시 상세 정보 로딩 실패 오류 수정',
        ],
    },
    {
        id: '2',
        category: '업데이트',
        title: '[v1.0.2 업데이트] 위성 궤도 실시간 데이터 연동',
        date: '2026.01.23',
        changes: [
            '위성 궤도 데이터 실시간 연동 기능 추가',
            '구역 개척 상태 업데이트 주기 개선',
            '지도 줌 레벨별 렌더링 최적화',
        ],
    },
    {
        id: '3',
        category: '이벤트',
        title: '신규 가입 프로모션: LUNA30 코드 배포',
        date: '2026.01.23',
        changes: [
            '신규 가입자 대상 프로모션 코드 LUNA30 배포',
            '코드 입력 시 30% 추가 ell 적립',
        ],
    },
    {
        id: '4',
        category: '업데이트',
        title: '[v1.0.1 업데이트] AI 구역 추천 정확도 개선',
        date: '2026.01.23',
        changes: [
            'AI 구역 추천 알고리즘 정확도 25% 향상',
            '스크랩 동기화 오류 수정',
        ],
    },
    {
        id: '5',
        category: '이벤트',
        title: '신규 가입 프로모션: LUNA30 코드 배포',
        date: '2026.01.23',
    },
    {
        id: '6',
        category: '이벤트',
        title: '신규 가입 프로모션: LUNA30 코드 배포',
        date: '2026.01.23',
    },
];

export default function NoticesScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabKey>('전체');
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

    const filtered = activeTab === '전체'
        ? NOTICES
        : NOTICES.filter(n => n.category === activeTab);

    // 이전/다음 공지
    const currentIdx = selectedNotice ? NOTICES.findIndex(n => n.id === selectedNotice.id) : -1;
    const prevNotice = currentIdx > 0 ? NOTICES[currentIdx - 1] : null;
    const nextNotice = currentIdx < NOTICES.length - 1 ? NOTICES[currentIdx + 1] : null;

    // ── 상세 화면 (Figma: 264:21648) ──
    if (selectedNotice) {
        const cat = CAT_MAP[selectedNotice.category];
        return (
            <SafeAreaView style={st.container}>
                <StatusBar barStyle="dark-content" />

                {/* 헤더 */}
                <View style={st.headerBar}>
                    <TouchableOpacity onPress={() => setSelectedNotice(null)} style={st.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text style={st.headerTitle}>{cat?.label || '공지'}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                    {/* 제목 영역 */}
                    <View style={st.detailHeader}>
                        <Text style={st.detailTitle}>{selectedNotice.title}</Text>
                        <Text style={st.detailDate}>{selectedNotice.date}</Text>
                    </View>

                    {/* 본문 */}
                    <View style={st.detailBody}>
                        {selectedNotice.content && (
                            <Text style={st.detailSectionTitle}>{selectedNotice.content}</Text>
                        )}
                        {selectedNotice.changes?.map((item, i) => (
                            <Text key={i} style={st.detailBullet}>{item}</Text>
                        ))}
                    </View>

                    <View style={{ flex: 1 }} />

                    {/* 이전/다음 */}
                    <View style={st.navFooter}>
                        {prevNotice ? (
                            <TouchableOpacity
                                style={st.navRow}
                                onPress={() => setSelectedNotice(prevNotice)}
                                activeOpacity={0.6}
                            >
                                <Text style={st.navLabel}>이전</Text>
                                <Text style={st.navTitle} numberOfLines={1}>{prevNotice.title}</Text>
                            </TouchableOpacity>
                        ) : null}
                        {nextNotice ? (
                            <TouchableOpacity
                                style={[st.navRow, st.navRowBorder]}
                                onPress={() => setSelectedNotice(nextNotice)}
                                activeOpacity={0.6}
                            >
                                <Text style={st.navLabel}>다음</Text>
                                <Text style={st.navTitle} numberOfLines={1}>{nextNotice.title}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── 리스트 화면 (Figma: 264:21616) ──
    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>공지사항</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* 탭 바 (Figma: Tabs) */}
            <View style={st.tabBar}>
                {TABS.map(tab => {
                    const isActive = tab === activeTab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={st.tabItem}
                            onPress={() => setActiveTab(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[st.tabText, isActive && st.tabTextActive]}>
                                {tab}
                            </Text>
                            <View style={[st.tabIndicator, isActive && st.tabIndicatorActive]} />
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* 리스트 */}
            <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
                {filtered.map((notice, idx) => {
                    const cat = CAT_MAP[notice.category];
                    return (
                        <View key={notice.id} style={st.listWrap}>
                            <TouchableOpacity
                                style={st.announcementRow}
                                onPress={() => setSelectedNotice(notice)}
                                activeOpacity={0.6}
                            >
                                {/* 카테고리 + 날짜 */}
                                <View style={st.annHeaderRow}>
                                    <Text style={[st.annCategory, { color: cat?.color || '#7295FE' }]}>
                                        {cat?.label}
                                    </Text>
                                    <Text style={st.annDate}>{notice.date}</Text>
                                </View>
                                {/* 제목 */}
                                <Text style={st.annTitle} numberOfLines={1}>{notice.title}</Text>
                            </TouchableOpacity>
                            {idx < filtered.length - 1 && <View style={st.listDivider} />}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // ── 헤더 (Figma: Navigation bar) ──
    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, height: 58,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: {
        fontSize: 18, fontWeight: '600', color: '#1A1A1A',
    },

    // ── 탭 바 (Figma: Tabs 264:21647) ──
    tabBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingLeft: 16, paddingRight: 16, paddingTop: 10,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    tabItem: {
        alignItems: 'center', marginRight: 27,
        paddingBottom: 0, minWidth: 30,
    },
    tabText: {
        fontSize: 16, fontWeight: '500', color: '#B2B2B2',
    },
    tabTextActive: {
        color: '#1A1A1A',
    },
    tabIndicator: {
        width: '110%', height: 3, borderRadius: 1.5,
        marginTop: 13, backgroundColor: 'transparent',
    },
    tabIndicatorActive: {
        backgroundColor: '#1A1A1A',
    },

    scrollContent: { paddingBottom: 40 },

    // ── 공지 리스트 (Figma: Announcement 264:21619) ──
    listWrap: { paddingHorizontal: 16 },
    announcementRow: {
        paddingTop: 24, paddingBottom: 16, gap: 6,
    },
    annHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    annCategory: {
        fontSize: 12, fontWeight: '500',
    },
    annDate: {
        fontSize: 14, fontWeight: '400', color: '#999999',
        lineHeight: 21,
    },
    annTitle: {
        fontSize: 16, fontWeight: '500', color: '#1A1A1A',
    },
    listDivider: {
        height: 1, backgroundColor: 'rgba(0,0,0,0.08)',
    },

    // ── 상세 (Figma: 264:21648) ──
    detailHeader: {
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    detailTitle: {
        fontSize: 16, fontWeight: '600', color: '#1A1A1A',
        lineHeight: 22, marginBottom: 6,
    },
    detailDate: {
        fontSize: 14, fontWeight: '400', color: '#999999',
        lineHeight: 21,
    },
    detailBody: {
        paddingHorizontal: 16, paddingTop: 24, gap: 10,
    },
    detailSectionTitle: {
        fontSize: 14, fontWeight: '600', color: '#1A1A1A',
        marginBottom: 4,
    },
    detailBullet: {
        fontSize: 14, fontWeight: '400', color: '#666666',
        lineHeight: 21,
    },

    // ── 이전/다음 네비 (Figma: 264:21659) ──
    navFooter: {
        borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)',
    },
    navRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, height: 54, gap: 20,
    },
    navRowBorder: {
        borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)',
    },
    navLabel: {
        fontSize: 16, fontWeight: '600', color: '#1A1A1A',
        width: 70,
    },
    navTitle: {
        flex: 1, fontSize: 14, fontWeight: '400', color: '#999999',
        lineHeight: 21,
    },
});
