import { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, View, Text, TextInput, Dimensions,
    NativeSyntheticEvent, NativeScrollEvent, Animated
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { NEWS_DATA, COSMOS_NEWS_DATA } from '@/constants/MockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BREAKING_CARD_WIDTH = SCREEN_WIDTH;
const SOURCE_TYPES = ['전체', '코스모스', '생성형'] as const;
const ALL_NEWS = [...COSMOS_NEWS_DATA, ...NEWS_DATA];

export default function InsightScreen() {
    const { search } = useLocalSearchParams<{ search?: string }>();
    const [selectedSourceType, setSelectedSourceType] = useState<string>('전체');
    const [selectedCategory, setSelectedCategory] = useState<string>('전체');
    const [searchText, setSearchText] = useState('');
    const [sortOrder, setSortOrder] = useState<'최신순' | '인기순'>('최신순');
    const [breakingIndex, setBreakingIndex] = useState(0);
    const breakingScrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (search) setSearchText(search);
    }, [search]);

    // 소스타입에 따른 기사 풀
    const sourceFilteredNews = selectedSourceType === '전체'
        ? ALL_NEWS
        : ALL_NEWS.filter(item => item.sourceType === selectedSourceType);

    // 세부 카테고리 목록 동적 생성
    const availableCategories = ['전체', ...Array.from(new Set(sourceFilteredNews.map(item => item.category)))];

    // Breaking 뉴스 (코스모스 기사 우선)
    const breakingNews = COSMOS_NEWS_DATA.slice(0, 3);

    const filteredNews = sourceFilteredNews.filter(item => {
        const matchesCategory = selectedCategory === '전체' || item.category === selectedCategory;
        const matchesSearch = searchText === '' ||
            item.title.includes(searchText) ||
            item.summary.includes(searchText);
        return matchesCategory && matchesSearch;
    });

    const insets = useSafeAreaInsets();

    // Breaking 스크롤 인디케이터
    const handleBreakingScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setBreakingIndex(idx);
    }, []);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[2]}
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
                        <Ionicons name="search" size={18} color="#ACACAC" />
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
                        onMomentumScrollEnd={handleBreakingScroll}
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
                                    <Text style={styles.breakingLabel}>BREAKING</Text>
                                    <View>
                                        <Text style={styles.breakingCardTitle} numberOfLines={2}>
                                            {news.title}
                                        </Text>
                                        <Text style={styles.breakingCardSummary} numberOfLines={2}>
                                            {news.summary}
                                        </Text>
                                        {/* 인디케이터 바 (카드 안) */}
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
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ═══ ② 소스타입 + 카테고리 탭 (라인형, sticky) ═══ */}
                <View style={styles.stickyHeader}>
                    {/* 상위 소스타입 탭 */}
                    <View style={styles.sourceTypeRow}>
                        {SOURCE_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.sourceTypeTab,
                                    selectedSourceType === type && styles.sourceTypeTabActive,
                                ]}
                                onPress={() => {
                                    setSelectedSourceType(type);
                                    setSelectedCategory('전체');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.sourceTypeTabText,
                                    selectedSourceType === type && styles.sourceTypeTabTextActive,
                                ]}>{type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {/* 세부 카테고리 탭 */}
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
                <View style={styles.sortRow}>
                    <TouchableOpacity
                        style={styles.sortBtn}
                        onPress={() => setSortOrder(sortOrder === '최신순' ? '인기순' : '최신순')}
                    >
                        <Text style={styles.sortText}>{sortOrder}</Text>
                        <Ionicons name="chevron-down" size={14} color="#999" />
                    </TouchableOpacity>
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
                                <Text style={[
                                    styles.sourceTypeBadge,
                                    news.sourceType === '코스모스' ? styles.cosmosBadge : styles.generativeBadge,
                                ]}>{news.sourceType}</Text>
                                <Text style={styles.listCategory}>{news.category}</Text>
                            </View>
                            <Text style={styles.listTitle} numberOfLines={2}>
                                {news.title}
                            </Text>
                            <Text style={styles.listDate}>{news.date}</Text>
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
        paddingTop: 8,
        paddingBottom: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F5',
        borderRadius: 2,
        paddingHorizontal: 14,
        height: 42,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1A1A1A',
        paddingVertical: 0,
    },

    // ═══ Breaking 뉴스 ═══
    breakingSection: {
        paddingBottom: 8,
    },
    breakingCard: {
        width: SCREEN_WIDTH,
        height: 420,
        overflow: 'hidden',
    },
    breakingImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#DDD',
    },
    breakingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 24,
        paddingBottom: 28,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    breakingLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 3,
        alignSelf: 'flex-start',
    },
    breakingCardTitle: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '800',
        lineHeight: 34,
        marginBottom: 8,
    },
    breakingCardSummary: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        lineHeight: 19,
    },
    indicatorRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: 24,
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

    // ═══ 소스타입 탭 ═══
    stickyHeader: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#ECECEC',
    },
    sourceTypeRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sourceTypeTab: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    sourceTypeTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#1A1A1A',
    },
    sourceTypeTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ACACAC',
    },
    sourceTypeTabTextActive: {
        color: '#1A1A1A',
        fontWeight: '700',
    },
    // ═══ 카테고리 탭 ═══
    categoryRowContent: {
        paddingHorizontal: 16,
    },
    categoryTab: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    categoryTabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#4A6CF7',
    },
    categoryTabText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#ACACAC',
    },
    categoryTabTextActive: {
        color: '#4A6CF7',
        fontWeight: '700',
    },

    // ═══ 정렬 ═══
    sortRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        marginBottom: 4,
        marginTop: 12,
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    sortText: {
        fontSize: 13,
        color: '#999',
        fontWeight: '500',
    },

    // ═══ 뉴스 리스트 ═══
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
        backgroundColor: '#FFFFFF',
    },
    listThumb: {
        width: 72,
        height: 72,
        borderRadius: 2,
        backgroundColor: '#E5E5E5',
    },
    listContent: {
        flex: 1,
        justifyContent: 'center',
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
        fontSize: 11,
        fontWeight: '700',
        color: '#4A6CF7',
    },
    listTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        lineHeight: 20,
        marginBottom: 4,
    },
    listDate: {
        fontSize: 11,
        color: '#ACACAC',
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
