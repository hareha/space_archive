import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, View, Text, TextInput, Dimensions,
    NativeSyntheticEvent, NativeScrollEvent, Animated, RefreshControl, Modal
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import NewsService, { type NewsArticle, type SourceType } from '@/services/NewsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BREAKING_CARD_WIDTH = SCREEN_WIDTH;
const BREAKING_HEIGHT = SCREEN_WIDTH; // 정사각형
const SOURCE_TYPES = ['전체', '코스모스', '생성형'] as const;

// ── 스켈레톤 shimmer 컴포넌트 ──
function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: any }) {
    const shimmer = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
    return (
        <Animated.View style={[{
            width: width as any, height, borderRadius: 6,
            backgroundColor: '#E8E8E8', opacity,
        }, style]} />
    );
}

function SkeletonLoading() {
    return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {/* Breaking 스켈레톤 */}
            <SkeletonBox width={SCREEN_WIDTH} height={420} style={{ borderRadius: 0 }} />
            {/* 탭 스켈레톤 */}
            <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
                <SkeletonBox width={60} height={28} />
                <SkeletonBox width={60} height={28} />
                <SkeletonBox width={60} height={28} />
            </View>
            {/* 리스트 스켈레톤 */}
            {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 14 }}>
                    <SkeletonBox width={72} height={72} />
                    <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
                        <SkeletonBox width="40%" height={12} />
                        <SkeletonBox width="90%" height={14} />
                        <SkeletonBox width="30%" height={10} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export default function InsightScreen() {
    const { search } = useLocalSearchParams<{ search?: string }>();
    const [selectedSourceType, setSelectedSourceType] = useState<SourceType>('전체');
    const [selectedCategory, setSelectedCategory] = useState<string>('전체');
    const [searchText, setSearchText] = useState('');
    const [sortOrder, setSortOrder] = useState<'최신순' | '과거순' | '인기순'>('최신순');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [breakingIndex, setBreakingIndex] = useState(0);
    const breakingScrollRef = useRef<ScrollView>(null);
    const [isLoading, setIsLoading] = useState(true);

    // DB-ready: 비동기 데이터 로딩
    const [allNews, setAllNews] = useState<NewsArticle[]>([]);
    const [breakingNews, setBreakingNews] = useState<NewsArticle[]>([]);

    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        const [all, breaking] = await Promise.all([
            NewsService.getAllNews(),
            NewsService.getBreakingNews(4),
        ]);
        setAllNews(all);
        setBreakingNews(breaking);
    }, []);

    useEffect(() => {
        (async () => {
            await loadData();
            setIsLoading(false);
        })();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        NewsService.invalidateCache();
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    useEffect(() => {
        if (search) setSearchText(search);
    }, [search]);

    // 소스타입 필터 비활성화 (UI 제거, DB 유지)
    const sourceFilteredNews = allNews;

    // 세부 카테고리 목록 동적 생성
    const availableCategories = useMemo(() =>
        ['전체', ...Array.from(new Set(sourceFilteredNews.map(item => item.category)))],
        [sourceFilteredNews]
    );

    const filteredNews = useMemo(() => {
        let result = sourceFilteredNews.filter(item => {
            const matchesCategory = selectedCategory === '전체' || item.category === selectedCategory;
            const matchesSearch = searchText === '' ||
                item.title.includes(searchText) ||
                item.summary.includes(searchText);
            return matchesCategory && matchesSearch;
        });

        // 정렬 적용
        result.sort((a, b) => {
            if (sortOrder === '인기순') {
                const countDiff = (b.viewCount || 0) - (a.viewCount || 0);
                if (countDiff !== 0) return countDiff;
                return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
            } else if (sortOrder === '과거순') {
                return new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime();
            } else {
                return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
            }
        });
        return result;
    }, [sourceFilteredNews, selectedCategory, searchText, sortOrder]);

    const insets = useSafeAreaInsets();

    // Breaking 스크롤 인디케이터 (실시간)
    const handleBreakingScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (idx !== breakingIndex) setBreakingIndex(idx);
    }, [breakingIndex]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {/* StatusBar 영역 배경 채우기 (전환 시 검은 공간 방지) */}
            <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} />

            {isLoading ? (
                <SkeletonLoading />
            ) : (
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[2]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#3C57E9"
                    />
                }
            >
                {/* ═══ ⓪ 검색창 (스크롤과 함께 올라감) ═══ */}
                <View style={styles.searchBarWrap}>
                    <View style={styles.searchBar}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="키워드 검색"
                            placeholderTextColor="#ACACAC"
                            value={searchText}
                            onChangeText={setSearchText}
                            returnKeyType="search"
                        />
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                            <Circle cx={10.9995} cy={10.7888} r={8.0385} stroke="#999" strokeWidth={1.5} strokeLinecap="square" />
                            <Path d="M16.4863 16.7083L21.0398 21.25" stroke="#999" strokeWidth={1.5} strokeLinecap="square" />
                        </Svg>
                    </View>
                </View>

                {/* ═══ ① Breaking 뉴스 슬라이더 ═══ */}
                <View style={styles.breakingSection}>
                    {/* 풀와이드 Breaking 슬라이더 */}
                    <ScrollView
                        ref={breakingScrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleBreakingScroll}
                        scrollEventThrottle={16}
                        decelerationRate="fast"
                    >
                        {breakingNews.map((news) => (
                            <TouchableOpacity
                                key={news.id}
                                style={styles.breakingCard}
                                activeOpacity={0.95}
                                onPress={() => router.push(`/news/${news.id}`)}
                            >
                                <Image
                                    source={{ uri: news.imageUrl }}
                                    style={styles.breakingImage}
                                    contentFit="cover"
                                    transition={300}
                                />
                                <View style={styles.breakingOverlay}>
                                    {/* 상단 그라데이션: 검정→투명 */}
                                    <LinearGradient
                                        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
                                        style={styles.breakingTopGrad}
                                    >

                                    </LinearGradient>
                                    {/* 하단 그라데이션: 투명→검정 */}
                                    <LinearGradient
                                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
                                        style={styles.breakingBottomGrad}
                                    >
                                        <Text style={styles.breakingCardTitle} numberOfLines={2}>
                                            {news.title}
                                        </Text>
                                        <Text style={styles.breakingCardSummary} numberOfLines={2}>
                                            {news.summary}
                                        </Text>
                                    </LinearGradient>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {/* 인디케이터 (고정, 카드와 독립) */}
                    <View style={styles.indicatorRow}>
                        {breakingNews.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.indicatorDot,
                                    breakingIndex === i && styles.indicatorDotActive,
                                ]}
                            />
                        ))}
                    </View>
                </View>

                {/* ═══ ② 소스타입 + 카테고리 탭 (라인형, sticky) ═══ */}
                <View style={styles.stickyHeader}>
                    {/* 카테고리 탭 */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryRowContent}
                    >
                        {availableCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryTab,
                                    selectedCategory === cat && styles.categoryTabActive,
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.categoryTabText,
                                    selectedCategory === cat && styles.categoryTabTextActive,
                                ]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ═══ 정렬 ═══ */}
                <View style={[styles.sortRow, { zIndex: 100 }]}>
                    <TouchableOpacity
                        style={styles.sortBtn}
                        onPress={() => setShowSortMenu(!showSortMenu)}
                    >
                        <Text style={styles.sortText}>{sortOrder}</Text>
                        <Ionicons name="chevron-down" size={14} color="#999" />
                    </TouchableOpacity>

                    {/* 정렬 메뉴 드롭다운 (절대위치) */}
                    {showSortMenu && (
                        <View style={styles.sortMenuDropdown}>
                            <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortOrder('최신순'); setShowSortMenu(false); }}>
                                <View style={styles.sortMenuIconWrap}>
                                    {sortOrder === '최신순' && <Ionicons name="checkmark" size={18} color="#1A1A1A" />}
                                </View>
                                <Text style={[styles.sortMenuItemText, sortOrder === '최신순' && { color: '#1A1A1A' }]}>최신순</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortOrder('과거순'); setShowSortMenu(false); }}>
                                <View style={styles.sortMenuIconWrap}>
                                    {sortOrder === '과거순' && <Ionicons name="checkmark" size={18} color="#1A1A1A" />}
                                </View>
                                <Text style={[styles.sortMenuItemText, sortOrder === '과거순' && { color: '#1A1A1A' }]}>과거순</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sortMenuItem} onPress={() => { setSortOrder('인기순'); setShowSortMenu(false); }}>
                                <View style={styles.sortMenuIconWrap}>
                                    {sortOrder === '인기순' && <Ionicons name="checkmark" size={18} color="#1A1A1A" />}
                                </View>
                                <Text style={[styles.sortMenuItemText, sortOrder === '인기순' && { color: '#1A1A1A' }]}>인기순</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ═══ ③ 뉴스 리스트 (리스트형) ═══ */}
                {filteredNews.map((news) => (
                    <TouchableOpacity
                        key={news.id}
                        style={styles.listItem}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/news/${news.id}`)}
                    >
                        <Image
                            source={{ uri: news.imageUrl }}
                            style={styles.listThumb}
                            contentFit="cover"
                            transition={200}
                        />
                        <View style={styles.listContent}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Text style={styles.listCategory}>{news.category}</Text>
                            </View>
                            <Text style={styles.listTitle} numberOfLines={2}>
                                {news.title}
                            </Text>
                            <Text style={styles.listDate}>{new Date(news.publishDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {filteredNews.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={48} color="#CCC" />
                        <Text style={styles.emptyText}>해당 카테고리의 기사가 없습니다.</Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 20,
    },

    // ═══ 검색창 ═══
    searchBarWrap: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBECF1',
        borderRadius: 3,
        paddingHorizontal: 18,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1A1A1A',
        paddingVertical: 0,
    },

    // ═══ Breaking 뉴스 ═══
    breakingSection: {
        height: BREAKING_HEIGHT,
    },
    breakingCard: {
        width: SCREEN_WIDTH,
        height: BREAKING_HEIGHT,
        overflow: 'hidden',
    },
    breakingImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
    },
    breakingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    breakingTopGrad: {
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    breakingBottomGrad: {
        paddingHorizontal: 16,
        paddingBottom: 50,
        paddingTop: 50,
    },
    breakingLabel: {
        color: '#B2B2B2',
        fontSize: 18,
        fontWeight: '300',
        letterSpacing: 2.52,
        textTransform: 'uppercase',
    },
    breakingCardTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '600',
        lineHeight: 30,
        marginBottom: 12,
    },
    breakingCardSummary: {
        color: '#EBECF1',
        fontSize: 14,
        fontWeight: '200',
        lineHeight: 21,
        letterSpacing: 0.28,
        height: 42,
        overflow: 'hidden',
    },
    indicatorRow: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 16,
    },
    indicatorDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    indicatorDotActive: {
        backgroundColor: '#FFFFFF',
        width: 24,
        height: 4,
        borderRadius: 2,
    },

    // ═══ 탭 (Figma: 단일 줄 탭, 밑줄 인디케이터) ═══
    stickyHeader: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    sourceTypeRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    sourceTypeTab: {
        paddingHorizontal: 14,
        paddingTop: 11,
        paddingBottom: 14,
    },
    sourceTypeTabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#1A1A1A',
    },
    sourceTypeTabText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#B2B2B2',
    },
    sourceTypeTabTextActive: {
        color: '#1A1A1A',
    },
    // ═══ 카테고리 탭 ═══
    categoryRowContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    categoryTab: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: -1,
    },
    categoryTabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#3C57E9',
        borderRadius: 2,
    },
    categoryTabText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#B2B2B2',
    },
    categoryTabTextActive: {
        color: '#1A1A1A',
        fontWeight: '700',
    },

    // ═══ 정렬 ═══
    sortRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sortText: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.5)',
        fontWeight: '500',
    },
    // ═══ 정렬 메뉴 드롭다운 ═══
    sortMenuDropdown: {
        position: 'absolute',
        top: 36, // 버튼 바로 아래
        left: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingVertical: 8,
        width: 140,
        // 그림자
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    sortMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    sortMenuIconWrap: {
        width: 24, // 체크마크 공간 고정
        alignItems: 'center',
        justifyContent: 'center',
    },
    sortMenuItemText: {
        fontSize: 16,
        color: '#808080',
        fontWeight: '500',
    },

    // ═══ 뉴스 리스트 (Figma: 104px 정방형 통, gap 28) ═══
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 0,
        marginBottom: 28,
        gap: 14,
        backgroundColor: '#FFFFFF',
    },
    listThumb: {
        width: 104,
        height: 104,
        borderRadius: 3,
        backgroundColor: '#E5E5E5',
    },
    listContent: {
        flex: 1,
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        height: 104,
    },
    sourceTypeBadge: {
        fontSize: 9,
        fontWeight: '700',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 2,
        overflow: 'hidden',
    },
    cosmosBadge: {
        backgroundColor: '#E8F0FE',
        color: '#1967D2',
    },
    generativeBadge: {
        backgroundColor: '#F3E8FD',
        color: '#8E24AA',
    },
    listCategory: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7295FE',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1A1A1A',
        lineHeight: 22,
        height: 44,
    },
    listDate: {
        fontSize: 12,
        color: '#666',
        lineHeight: 16.8,
    },

    // ═══ 빈 상태 ═══
    emptyState: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        color: '#999',
        fontSize: 14,
    },
});
