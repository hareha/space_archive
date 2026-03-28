import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    SafeAreaView, StatusBar, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
    getScrapAreas, getScrapContents,
    removeScrapArea, removeScrapContent,
    type ScrapArea, type ScrapContent,
} from '@/constants/scrapStore';
import { NEWS_DATA, COSMOS_NEWS_DATA, type NewsItem } from '@/constants/MockData';

type MainTab = 'area' | 'content';
type AreaFilter = 'all' | 'landing' | 'feature';
type SortOrder = 'recent' | 'name';

export default function ScrapbookScreen() {
    const router = useRouter();
    const [mainTab, setMainTab] = useState<MainTab>('area');
    const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const [areas, setAreas] = useState<ScrapArea[]>([]);
    const [contents, setContents] = useState<ScrapContent[]>([]);

    // 화면 진입 시 데이터 로드
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        const [a, c] = await Promise.all([getScrapAreas(), getScrapContents()]);
        setAreas(a);
        setContents(c);
    };

    // ─── 필터링 ───
    const filteredAreas = areas.filter(a => {
        if (areaFilter === 'landing') return a.type === 'landing';
        if (areaFilter === 'feature') return a.type === 'feature';
        return true;
    });

    const sortedAreas = [...filteredAreas].sort((a, b) => {
        if (sortOrder === 'name') return a.name.localeCompare(b.name);
        return b.savedAt - a.savedAt;
    });

    const sortedContents = [...contents].sort((a, b) => {
        if (sortOrder === 'name') return a.title.localeCompare(b.title);
        return b.savedAt - a.savedAt;
    });

    const landingCount = areas.filter(a => a.type === 'landing').length;
    const featureCount = areas.filter(a => a.type === 'feature').length;

    // 뉴스 데이터에서 이미지 조회
    const allNews = [...COSMOS_NEWS_DATA, ...NEWS_DATA];
    const getNewsImage = (newsId: string): string | null => {
        const found = allNews.find(n => n.id.toString() === newsId);
        return found?.imageUrl || null;
    };

    // ─── 삭제 ───
    const handleDeleteArea = async (id: string) => {
        await removeScrapArea(id);
        setAreas(prev => prev.filter(a => a.id !== id));
    };

    const handleDeleteContent = async (newsId: string) => {
        await removeScrapContent(newsId);
        setContents(prev => prev.filter(c => c.newsId !== newsId));
    };

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.header}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>스크랩북</Text>
                <View style={{ width: 32 }} />
            </View>

            {/* 메인 탭 */}
            <View style={st.mainTabs}>
                <TouchableOpacity
                    style={[st.mainTab, mainTab === 'area' && st.mainTabActive]}
                    onPress={() => setMainTab('area')}
                >
                    <Text style={[st.mainTabText, mainTab === 'area' && st.mainTabTextActive]}>관심 영역</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[st.mainTab, mainTab === 'content' && st.mainTabActive]}
                    onPress={() => setMainTab('content')}
                >
                    <Text style={[st.mainTabText, mainTab === 'content' && st.mainTabTextActive]}>콘텐츠 보관함</Text>
                </TouchableOpacity>
            </View>

            {mainTab === 'area' ? (
                <>
                    {/* 서브 필터 */}
                    <View style={st.subFilters}>
                        {([
                            ['all', `전체(${areas.length})`],
                            ['landing', `착륙지(${landingCount})`],
                            ['feature', `지형(${featureCount})`],
                        ] as [AreaFilter, string][]).map(([key, label]) => (
                            <TouchableOpacity
                                key={key}
                                style={[st.filterChip, areaFilter === key && st.filterChipActive]}
                                onPress={() => setAreaFilter(key)}
                            >
                                <Text style={[st.filterChipText, areaFilter === key && st.filterChipTextActive]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* 정렬 */}
                    <View style={st.sortRow}>
                        <TouchableOpacity
                            style={st.sortBtn}
                            onPress={() => setShowSortMenu(!showSortMenu)}
                        >
                            <Text style={st.sortText}>{sortOrder === 'recent' ? '최신순' : '이름순'} ▾</Text>
                        </TouchableOpacity>
                    </View>
                    {showSortMenu && (
                        <View style={st.sortMenu}>
                            <TouchableOpacity style={st.sortMenuItem} onPress={() => { setSortOrder('recent'); setShowSortMenu(false); }}>
                                <Text style={[st.sortMenuText, sortOrder === 'recent' && st.sortMenuTextActive]}>최신순 {sortOrder === 'recent' ? '✓' : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={st.sortMenuItem} onPress={() => { setSortOrder('name'); setShowSortMenu(false); }}>
                                <Text style={[st.sortMenuText, sortOrder === 'name' && st.sortMenuTextActive]}>이름순 {sortOrder === 'name' ? '✓' : ''}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* 관심 영역 리스트 */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                        {sortedAreas.length === 0 ? (
                            <View style={st.emptyState}>
                                <Ionicons name="bookmark-outline" size={40} color="#D1D5DB" />
                                <Text style={st.emptyText}>스크랩한 관심 영역이 없습니다</Text>
                                <Text style={st.emptySubText}>지형이나 착륙지에서 스크랩하기를 눌러보세요</Text>
                            </View>
                        ) : (
                            sortedAreas.map(area => (
                                <TouchableOpacity
                                    key={area.id}
                                    style={st.areaCard}
                                    onPress={() => {
                                        // 탐사모드로 이동 + 해당 지점 선택
                                        router.push({
                                            pathname: '/(tabs)',
                                            params: {
                                                highlightLat: String(area.lat),
                                                highlightLng: String(area.lng),
                                                highlightName: area.name,
                                                scrapType: area.type,
                                                scrapName: area.name,
                                            }
                                        });
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={st.areaInfo}>
                                        <Text style={st.areaName}>{area.name}</Text>
                                        <Text style={st.areaCoord}>
                                            {Math.abs(area.lat).toFixed(3)}°{area.lat >= 0 ? 'N' : 'S'}{' '}
                                            {Math.abs(area.lng).toFixed(3)}°{area.lng >= 0 ? 'E' : 'W'}
                                        </Text>
                                        <Text style={st.areaType}>
                                            {area.type === 'landing' ? '착륙선' : area.extra || '지형'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={st.deleteBtn}
                                        onPress={() => handleDeleteArea(area.id)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </>
            ) : (
                <>
                    {/* 콘텐츠 서브탭 */}
                    <View style={st.subFilters}>
                        <TouchableOpacity style={[st.filterChip, st.filterChipActive]}>
                            <Text style={[st.filterChipText, st.filterChipTextActive]}>전체({contents.length})</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 정렬 */}
                    <View style={st.sortRow}>
                        <TouchableOpacity
                            style={st.sortBtn}
                            onPress={() => setSortOrder(sortOrder === 'recent' ? 'name' : 'recent')}
                        >
                            <Text style={st.sortText}>{sortOrder === 'recent' ? '최신순' : '제목순'} ▾</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 콘텐츠 리스트 */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                        {sortedContents.length === 0 ? (
                            <View style={st.emptyState}>
                                <Ionicons name="document-text-outline" size={40} color="#D1D5DB" />
                                <Text style={st.emptyText}>스크랩한 콘텐츠가 없습니다</Text>
                                <Text style={st.emptySubText}>인사이트 기사에서 스크랩해보세요</Text>
                            </View>
                        ) : (
                            sortedContents.map(content => {
                                const imgUrl = getNewsImage(content.newsId);
                                return (
                                <TouchableOpacity
                                    key={content.newsId}
                                    style={st.contentCard}
                                    onPress={() => {
                                        router.push(`/news/${content.newsId}`);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    {imgUrl ? (
                                        <Image
                                            source={{ uri: imgUrl }}
                                            style={st.contentThumbImg}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={st.contentThumb}>
                                            <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                                        </View>
                                    )}
                                    <View style={st.contentInfo}>
                                        <Text style={st.contentTitle} numberOfLines={2}>{content.title}</Text>
                                        <Text style={st.contentSummary} numberOfLines={1}>{content.summary}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={st.deleteBtn}
                                        onPress={() => handleDeleteContent(content.newsId)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </>
            )}
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // 헤더
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

    // 메인 탭
    mainTabs: {
        flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    mainTab: {
        flex: 1, alignItems: 'center', paddingVertical: 14,
    },
    mainTabActive: { borderBottomWidth: 2, borderBottomColor: '#1A1A1A' },
    mainTabText: { fontSize: 15, fontWeight: '500', color: '#9CA3AF' },
    mainTabTextActive: { color: '#1A1A1A', fontWeight: '700' },

    // 서브 필터
    subFilters: {
        flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
        backgroundColor: '#F5F5F5',
    },
    filterChipActive: { backgroundColor: '#1A1A1A' },
    filterChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    filterChipTextActive: { color: '#FFFFFF' },

    // 정렬
    sortRow: {
        flexDirection: 'row', justifyContent: 'flex-end',
        paddingHorizontal: 20, paddingVertical: 8,
    },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sortText: { fontSize: 13, color: '#9CA3AF' },
    sortMenu: {
        position: 'absolute', right: 20, top: 180, zIndex: 20,
        backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
        overflow: 'hidden', minWidth: 100,
    },
    sortMenuItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    sortMenuText: { fontSize: 13, color: '#6B7280' },
    sortMenuTextActive: { color: '#1A1A1A', fontWeight: '700' },

    // 빈 상태
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
    emptySubText: { fontSize: 13, color: '#9CA3AF' },

    // 관심 영역 카드
    areaCard: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    areaThumb: {
        width: 56, height: 56, borderRadius: 8, backgroundColor: '#F5F5F5',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    areaInfo: { flex: 1 },
    areaName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    areaCoord: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
    areaType: { fontSize: 12, color: '#6B7280' },
    deleteBtn: { padding: 8 },

    // 콘텐츠 카드
    contentCard: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    contentThumb: {
        width: 80, height: 60, borderRadius: 8, backgroundColor: '#F5F5F5',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    contentInfo: { flex: 1 },
    contentTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, lineHeight: 22 },
    contentSummary: { fontSize: 12, color: '#9CA3AF' },
    contentThumbImg: {
        width: 80, height: 60, borderRadius: 8, marginRight: 14,
        backgroundColor: '#F5F5F5',
    },
});
