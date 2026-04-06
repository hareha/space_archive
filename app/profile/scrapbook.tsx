import React, { useState, useCallback, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    SafeAreaView, StatusBar, Image, DeviceEventEmitter,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
    getScrapAreas, getScrapContents,
    removeScrapArea, removeScrapContent,
    addScrapArea, addScrapContent,
    type ScrapArea, type ScrapContent,
} from '@/constants/scrapStore';
import NewsService, { type NewsArticle } from '@/services/NewsService';

type MainTab = 'area' | 'content';
type AreaFilter = 'all' | 'landing' | 'feature';
type SortOrder = 'recent' | 'name';

export default function ScrapbookScreen() {
    const router = useRouter();
    const [mainTab, setMainTab] = useState<MainTab>('area');
    const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('recent');

    const [areas, setAreas] = useState<ScrapArea[]>([]);
    const [contents, setContents] = useState<ScrapContent[]>([]);
    const [allNews, setAllNews] = useState<NewsArticle[]>([]);

    // 북마크 off 했지만 화면에 남아있는 id 추적
    const [removedAreaIds, setRemovedAreaIds] = useState<Set<string>>(new Set());
    const [removedContentIds, setRemovedContentIds] = useState<Set<string>>(new Set());

    // 화면 진입 시 데이터 로드 (나갔다 들어오면 삭제된 것 안보임)
    useFocusEffect(
        useCallback(() => {
            loadData();
            setRemovedAreaIds(new Set());
            setRemovedContentIds(new Set());
        }, [])
    );

    const loadData = async () => {
        const [a, c, news] = await Promise.all([
            getScrapAreas(),
            getScrapContents(),
            NewsService.getAllNews(),
        ]);
        setAreas(a);
        setContents(c);
        setAllNews(news);
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
    const getNewsImage = (newsId: string | number): string | null => {
        const found = allNews.find(n => n.id.toString() === newsId.toString());
        return found?.imageUrl || null;
    };

    // ─── 북마크 토글 (Area) ───
    const handleToggleArea = async (area: ScrapArea) => {
        const isRemoved = removedAreaIds.has(area.id);
        if (isRemoved) {
            // 다시 on → DB에 재추가
            await addScrapArea(area);
            setRemovedAreaIds(prev => {
                const next = new Set(prev);
                next.delete(area.id);
                return next;
            });
        } else {
            // off → DB에서 삭제, 화면에는 남김
            await removeScrapArea(area.id);
            setRemovedAreaIds(prev => new Set(prev).add(area.id));
        }
    };

    // ─── 북마크 토글 (Content) ───
    const handleToggleContent = async (content: ScrapContent) => {
        const key = content.newsId.toString();
        const isRemoved = removedContentIds.has(key);
        if (isRemoved) {
            // 다시 on → DB에 재추가
            await addScrapContent(content);
            setRemovedContentIds(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        } else {
            // off → DB에서 삭제, 화면에는 남김
            await removeScrapContent(content.newsId);
            setRemovedContentIds(prev => new Set(prev).add(key));
        }
    };

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={st.header}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>스크랩북</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* 메인 탭 (Area / Content) */}
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
                            ['all', '전체'],
                            ['landing', '착륙지'],
                            ['feature', '지형/크레이터'],
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

                    {/* 카운트 + 정렬 */}
                    <View style={st.sortRow}>
                        <Text style={st.countLabel}>{sortedAreas.length} Locations</Text>
                        <TouchableOpacity
                            style={st.sortBtn}
                            onPress={() => setSortOrder(sortOrder === 'recent' ? 'name' : 'recent')}
                        >
                            <Text style={st.sortText}>{sortOrder === 'recent' ? '최신순' : '이름순'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#999" />
                        </TouchableOpacity>
                    </View>

                    {/* 관심 영역 리스트 */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                        {sortedAreas.length === 0 ? (
                            <View style={st.emptyState}>
                                <Ionicons name="bookmark-outline" size={40} color="#D1D5DB" />
                                <Text style={st.emptyText}>스크랩한 관심 영역이 없습니다</Text>
                                <Text style={st.emptySubText}>지형이나 착륙지에서 스크랩하기를 눌러보세요</Text>
                            </View>
                        ) : (
                            sortedAreas.map(area => {
                                const isBookmarked = !removedAreaIds.has(area.id);
                                return (
                                    <TouchableOpacity
                                        key={area.id}
                                        style={st.areaCard}
                                        onPress={() => {
                                            DeviceEventEmitter.emit('navigateToExploration', {
                                                lat: area.lat,
                                                lng: area.lng,
                                                name: area.name,
                                                type: area.type,
                                            });
                                            setTimeout(() => router.back(), 50);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {/* 썸네일 */}
                                        <View style={st.areaThumb}>
                                            <Ionicons name="globe-outline" size={28} color="#999" />
                                        </View>
                                        {/* 정보 */}
                                        <View style={st.areaInfo}>
                                            <Text style={st.areaName} numberOfLines={1}>{area.name}</Text>
                                            <Text style={st.areaCoord}>
                                                {Math.abs(area.lat).toFixed(3)}°{area.lat >= 0 ? 'N' : 'S'}{' '}
                                                {Math.abs(area.lng).toFixed(3)}°{area.lng >= 0 ? 'E' : 'W'}
                                            </Text>
                                            <Text style={st.areaType}>
                                                {area.type === 'landing' ? 'Lander' : area.extra || 'Crater'}
                                            </Text>
                                        </View>
                                        {/* 북마크 토글 */}
                                        <TouchableOpacity
                                            style={st.bookmarkBtn}
                                            onPress={() => handleToggleArea(area)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons
                                                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                                                size={22}
                                                color={isBookmarked ? '#E9BE3C' : '#D1D5DB'}
                                            />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </>
            ) : (
                <>
                    {/* 카운트 + 정렬 */}
                    <View style={st.sortRow}>
                        <Text style={st.countLabel}>{sortedContents.length} Contents</Text>
                        <TouchableOpacity
                            style={st.sortBtn}
                            onPress={() => setSortOrder(sortOrder === 'recent' ? 'name' : 'recent')}
                        >
                            <Text style={st.sortText}>{sortOrder === 'recent' ? '최신순' : '제목순'}</Text>
                            <Ionicons name="chevron-down" size={16} color="#999" />
                        </TouchableOpacity>
                    </View>

                    {/* 콘텐츠 리스트 */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
                        {sortedContents.length === 0 ? (
                            <View style={st.emptyState}>
                                <Ionicons name="document-text-outline" size={40} color="#D1D5DB" />
                                <Text style={st.emptyText}>스크랩한 콘텐츠가 없습니다</Text>
                                <Text style={st.emptySubText}>인사이트 기사에서 스크랩해보세요</Text>
                            </View>
                        ) : (
                            sortedContents.map(content => {
                                const imgUrl = getNewsImage(content.newsId);
                                const key = content.newsId.toString();
                                const isBookmarked = !removedContentIds.has(key);
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
                                            <View style={st.contentThumbPlaceholder}>
                                                <Ionicons name="image-outline" size={22} color="#9CA3AF" />
                                            </View>
                                        )}
                                        <View style={st.contentInfo}>
                                            <Text style={st.contentTitle} numberOfLines={2}>{content.title}</Text>
                                        </View>
                                        {/* 북마크 토글 */}
                                        <TouchableOpacity
                                            style={st.bookmarkBtn}
                                            onPress={() => handleToggleContent(content)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Ionicons
                                                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                                                size={22}
                                                color={isBookmarked ? '#E9BE3C' : '#D1D5DB'}
                                            />
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

    // ── 헤더 ──
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },

    // ── 메인 탭 ──
    mainTabs: {
        flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EBECF1',
    },
    mainTab: {
        flex: 1, alignItems: 'center', paddingVertical: 14,
    },
    mainTabActive: { borderBottomWidth: 2, borderBottomColor: '#1A1A1A' },
    mainTabText: { fontSize: 16, fontWeight: '500', color: '#B2B2B2' },
    mainTabTextActive: { color: '#1A1A1A', fontWeight: '600' },

    // ── 서브 필터 칩 ──
    subFilters: {
        flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 0, gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18,
        borderWidth: 1, borderColor: '#EBECF1',
    },
    filterChipActive: { backgroundColor: '#3C57E9', borderColor: '#3C57E9' },
    filterChipText: { fontSize: 14, color: '#808080', fontWeight: '500' },
    filterChipTextActive: { color: '#FFFFFF' },

    // ── 카운트 + 정렬 ──
    sortRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    },
    countLabel: { fontSize: 14, fontWeight: '500', color: '#3C57E9' },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    sortText: { fontSize: 14, color: '#999999' },

    // ── 빈 상태 ──
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyText: { fontSize: 15, color: '#808080', fontWeight: '600' },
    emptySubText: { fontSize: 13, color: '#B2B2B2' },

    // ── 관심 영역 카드 (Figma: Location) ──
    areaCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 12,
    },
    areaThumb: {
        width: 68, height: 68, borderRadius: 3, backgroundColor: '#F2F2F2',
        justifyContent: 'center', alignItems: 'center',
    },
    areaInfo: { flex: 1, gap: 3, paddingTop: 5, paddingBottom: 11 },
    areaName: { fontSize: 16, fontWeight: '500', color: '#1A1A1A', lineHeight: 24 },
    areaCoord: { fontSize: 14, fontWeight: '400', color: '#999999', lineHeight: 21 },
    areaType: { fontSize: 12, fontWeight: '400', color: '#999999', lineHeight: 17 },

    // ── 콘텐츠 카드 (Figma: Content) ──
    contentCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 12,
    },
    contentThumbImg: {
        width: 68, height: 68, borderRadius: 3,
        backgroundColor: '#F2F2F2',
    },
    contentThumbPlaceholder: {
        width: 68, height: 68, borderRadius: 3, backgroundColor: '#F2F2F2',
        justifyContent: 'center', alignItems: 'center',
    },
    contentInfo: { flex: 1, justifyContent: 'center' },
    contentTitle: { fontSize: 16, fontWeight: '500', color: '#1A1A1A', lineHeight: 24 },

    // ── 북마크 버튼 ──
    bookmarkBtn: {
        width: 34, height: 34,
        justifyContent: 'center', alignItems: 'center',
    },
});
