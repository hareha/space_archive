import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, StatusBar, Share,
    Dimensions, Animated, Platform, DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import NewsService, { type NewsArticle } from '@/services/NewsService';
import { addScrapContent, removeScrapContent, isContentScrapped } from '@/constants/scrapStore';
import { useAuth } from '@/components/AuthContext';
import { LANDING_SITES } from '@/constants/LandingSiteData';
import { LUNAR_FEATURES } from '@/constants/LunarFeatureData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = 550;

// ── 착륙지 + 주요 지형 키워드 매핑 (긴 이름 우선 매칭을 위해 길이순 정렬) ──
type LocationKeyword = {
    keyword: string;
    type: 'landing' | 'feature';
    name: string;
    lat: number;
    lng: number;
};

const LOCATION_KEYWORDS: LocationKeyword[] = (() => {
    const keywords: LocationKeyword[] = [];
    // 착륙지: nameKr, officialName
    for (const site of LANDING_SITES) {
        keywords.push({ keyword: site.nameKr, type: 'landing', name: site.nameKr, lat: site.lat, lng: site.lng });
        if (site.officialName !== site.nameKr) {
            keywords.push({ keyword: site.officialName, type: 'landing', name: site.nameKr, lat: site.lat, lng: site.lng });
        }
        // regionName도 추가 ("고요의 바다" 등 — 지형과 중복되면 지형 우선)
    }
    // 주요 지형: nameKr, nameEn
    for (const feat of LUNAR_FEATURES) {
        keywords.push({ keyword: feat.nameKr, type: 'feature', name: feat.nameKr, lat: feat.lat, lng: feat.lng });
        if (feat.nameEn !== feat.nameKr) {
            keywords.push({ keyword: feat.nameEn, type: 'feature', name: feat.nameKr, lat: feat.lat, lng: feat.lng });
        }
    }
    // 중복 제거 (같은 keyword → 첫 번째 우선)
    const seen = new Set<string>();
    const unique: LocationKeyword[] = [];
    for (const kw of keywords) {
        if (!seen.has(kw.keyword)) {
            seen.add(kw.keyword);
            unique.push(kw);
        }
    }
    // 긴 키워드 우선 매칭 (e.g. "아폴로 11호"가 "아폴로"보다 먼저)
    return unique.sort((a, b) => b.keyword.length - a.keyword.length);
})();

export default function NewsDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const insets = useSafeAreaInsets();
    const [isScrapped, setIsScrapped] = useState(false);
    const [newsItem, setNewsItem] = useState<NewsArticle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (id) {
            setIsLoading(true);
            NewsService.getById(id as string).then(news => {
                setNewsItem(news);
                setIsLoading(false);
                if (news) {
                    NewsService.incrementViewCount(news.id);
                }
            });
        }
    }, [id]);

    useEffect(() => {
        if (newsItem) {
            isContentScrapped(newsItem.id).then(setIsScrapped);
        }
    }, [newsItem?.id]);

    const toggleScrap = async () => {
        if (!newsItem) return;
        if (!isLoggedIn) { router.push('/auth/login'); return; }
        if (isScrapped) {
            await removeScrapContent(newsItem.id);
            setIsScrapped(false);
        } else {
            await addScrapContent({
                newsId: newsItem.id,
                title: newsItem.title,
                summary: newsItem.summary,
                savedAt: Date.now(),
            });
            setIsScrapped(true);
        }
    };

    // 히어로 이미지 패럴랙스: 스크롤하면 이미지가 느리게 올라감
    // 이미지는 완전 고정 — 패럴랙스 없음

    // ── 탐사모드 네비게이션 (이벤트 기반 — 스플래시 방지) ──
    const navigateToExploration = useCallback((lat: number, lng: number, name: string, type: 'landing' | 'feature') => {
        // 먼저 탭 전환 → 뉴스 상세가 슬라이드 아웃될 때 탐사모드가 이미 깔려있음
        DeviceEventEmitter.emit('navigateToExploration', { lat, lng, name, type });
        setTimeout(() => router.back(), 50);
    }, [router]);

    // ── 본문 텍스트에서 키워드 매칭 → 링크 렌더링 ──
    const renderLinkedParagraph = useCallback((paragraph: string, paragraphIndex: number) => {
        // 텍스트를 스캔하면서 매칭되는 키워드를 찾아 분할
        type Segment = { text: string; link?: LocationKeyword };
        const segments: Segment[] = [];
        let remaining = paragraph;
        let safetyCounter = 0;

        while (remaining.length > 0 && safetyCounter < 1000) {
            safetyCounter++;
            let earliestMatch: { index: number; kw: LocationKeyword } | null = null;

            for (const kw of LOCATION_KEYWORDS) {
                const idx = remaining.indexOf(kw.keyword);
                if (idx !== -1 && (earliestMatch === null || idx < earliestMatch.index)) {
                    earliestMatch = { index: idx, kw };
                    if (idx === 0) break; // 가장 앞이면 더 찾을 필요 없음
                }
            }

            if (earliestMatch === null) {
                // 남은 텍스트에 매칭 없음
                segments.push({ text: remaining });
                break;
            }

            // 매칭 앞의 일반 텍스트
            if (earliestMatch.index > 0) {
                segments.push({ text: remaining.substring(0, earliestMatch.index) });
            }

            // 매칭된 키워드 (링크)
            segments.push({
                text: earliestMatch.kw.keyword,
                link: earliestMatch.kw,
            });

            remaining = remaining.substring(earliestMatch.index + earliestMatch.kw.keyword.length);
        }

        // 링크가 없으면 단순 텍스트
        if (segments.every(s => !s.link)) {
            return (
                <Text key={paragraphIndex} style={styles.bodyParagraph}>
                    {paragraph}
                </Text>
            );
        }

        return (
            <Text key={paragraphIndex} style={styles.bodyParagraph}>
                {segments.map((seg, i) =>
                    seg.link ? (
                        <Text
                            key={`${paragraphIndex}-${i}`}
                            style={styles.linkedKeyword}
                            onPress={() => navigateToExploration(
                                seg.link!.lat,
                                seg.link!.lng,
                                seg.link!.name,
                                seg.link!.type,
                            )}
                        >
                            {seg.text}
                        </Text>
                    ) : (
                        <Text key={`${paragraphIndex}-${i}`}>{seg.text}</Text>
                    )
                )}
            </Text>
        );
    }, [navigateToExploration]);

    // 헤더 배경 불투명도: 스크롤이 히어로를 지나면 흰색으로
    const headerOpacity = scrollY.interpolate({
        inputRange: [0, HERO_HEIGHT - 200, HERO_HEIGHT - 100],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
    });

    // 로딩 중이거나 데이터 없을 때
    if (!newsItem) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} />
                <View style={styles.loadingHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
                        <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                </View>
                {isLoading ? (
                    <View style={styles.skeletonContainer}>
                        <View style={styles.skeletonHero} />
                        <View style={{ padding: 16, gap: 12 }}>
                            <View style={styles.skeletonLine80} />
                            <View style={styles.skeletonLine60} />
                            <View style={{ height: 20 }} />
                            <View style={styles.skeletonLineFull} />
                            <View style={styles.skeletonLineFull} />
                            <View style={styles.skeletonLine80} />
                            <View style={styles.skeletonLineFull} />
                            <View style={styles.skeletonLine60} />
                        </View>
                    </View>
                ) : (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>뉴스를 찾을 수 없습니다.</Text>
                    </View>
                )}
            </View>
        );
    }

    const handleExplore = () => {
        if (!newsItem.location) return;
        navigateToExploration(
            newsItem.location.lat,
            newsItem.location.lng,
            newsItem.location.name,
            'landing',
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* ═══ ① 히어로 이미지 — 상단 완전 고정 ═══ */}
            <View style={styles.heroFixed}>
                <Image
                    source={{ uri: newsItem.imageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={300}
                />
                {/* 상단 그라데이션: 검정→투명 (네비바 뒤) */}
                <LinearGradient
                    colors={['rgba(0,0,0,0.54)', 'rgba(0,0,0,0.23)', 'rgba(0,0,0,0)']}
                    locations={[0, 0.39, 1]}
                    style={styles.topGradient}
                />
                {/* 하단 그라데이션: 투명→검정 (제목 뒤) */}
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                    style={styles.bottomGradient}
                >
                    <View style={styles.heroContent}>
                        {/* 카테고리 */}
                        <Text style={styles.heroCategory}>{newsItem.category}</Text>
                        {/* 소스 + 날짜 */}
                        <View style={styles.heroMetaWrap}>
                            <Text style={styles.heroSource}>{newsItem.source}</Text>
                            <View style={styles.heroDateRow}>
                                <Text style={styles.heroDate}>{new Date(newsItem.publishDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</Text>
                            </View>
                        </View>
                        {/* 제목 */}
                        <Text style={styles.heroTitle} numberOfLines={3}>
                            {newsItem.title}
                        </Text>

                    </View>
                </LinearGradient>
            </View>

            {/* ═══ ② 스크롤 본문 — 이미지 위를 덮으며 올라감 ═══ */}
            <Animated.ScrollView
                style={StyleSheet.absoluteFill}
                contentContainerStyle={{ paddingTop: HERO_HEIGHT }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
            >
                {/* 바텀시트 */}
                <View style={styles.bottomSheet}>
                    {/* 본문 내용 */}
                    <View style={styles.bodyContainer}>
                        {newsItem.body.map((paragraph, index) =>
                            renderLinkedParagraph(paragraph, index)
                        )}
                    </View>

                    {/* 탐사 연결 버튼 */}
                    {newsItem.location && (
                        <TouchableOpacity
                            style={styles.exploreButton}
                            onPress={handleExplore}
                            activeOpacity={0.7}
                        >
                            <View style={styles.exploreInner}>
                                <Ionicons name="navigate" size={18} color="#2749F2" />
                                <Text style={styles.exploreText}>이 지점 탐사 하기</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={18} color="#2749F2" />
                        </TouchableOpacity>
                    )}

                    <View style={{ height: insets.bottom + 40 }} />
                </View>
            </Animated.ScrollView>

            {/* ═══ Share / Bookmark 버튼 (고정 위치, 바텀시트가 올라오면 가려짐) ═══ */}
            <Animated.View
                style={[
                    styles.btnClipContainer,
                    {
                        transform: [{
                            translateY: scrollY.interpolate({
                                inputRange: [0, HERO_HEIGHT],
                                outputRange: [0, -HERO_HEIGHT],
                                extrapolate: 'clamp',
                            }),
                        }],
                    },
                ]}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={[
                        styles.floatingActions,
                        {
                            transform: [{
                                translateY: scrollY.interpolate({
                                    inputRange: [0, HERO_HEIGHT],
                                    outputRange: [0, HERO_HEIGHT],
                                    extrapolate: 'clamp',
                                }),
                            }],
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.heroActionBtn}
                        onPress={async () => {
                            try {
                                const deepLink = Linking.createURL('/news', {
                                    queryParams: { id: newsItem.id.toString() },
                                });
                                await Share.share({
                                    message: `📰 ${newsItem.title}\n${newsItem.source} · ${newsItem.publishDate}\n\n${newsItem.summary}\n\n👉 Plus Ultra에서 보기:\n${deepLink}`,
                                });
                            } catch (e) { }
                        }}
                    >
                        <Svg width={16} height={13} viewBox="0 0 16 13" fill="none">
                            <Path d="M16 6.06667L9.77778 0V3.46667C3.55556 4.33333 0.888889 8.66667 0 13C2.22222 9.96667 5.33333 8.58 9.77778 8.58V12.1333L16 6.06667Z" fill="white" />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroActionBtn} onPress={toggleScrap}>
                        <Svg width={10} height={14} viewBox="0 0 10 14" fill="none">
                            <Path d="M9.5 0.5V13.2305L5.20312 11.3242L5 11.2344L4.79688 11.3242L0.5 13.2305V0.5H9.5Z" stroke={isScrapped ? '#E9BE3C' : 'white'} fill={isScrapped ? '#E9BE3C' : 'none'} />
                        </Svg>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
            {/* ═══ ③ 플로팅 뒤로가기 (투명 상태) ═══ */}
            <View style={[styles.floatingNav, { paddingTop: insets.top }]} pointerEvents="box-none">
                <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ═══ ④ 솔리드 헤더 (스크롤 후) ═══ */}
            <Animated.View
                style={[styles.solidNav, { paddingTop: insets.top, opacity: headerOpacity }]}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.navBackBtn}
                >
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },

    // ── ① 히어로 이미지 (상단 고정) ──
    heroFixed: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HERO_HEIGHT,
    },
    topGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 138,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 380,
        justifyContent: 'flex-end',
        paddingBottom: 80,
        paddingHorizontal: 16,
    },
    heroContent: {
    },
    heroCategory: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    heroMetaWrap: {
        gap: 2,
        marginBottom: 20,
    },
    heroSource: {
        fontSize: 14,
        fontWeight: '500',
        color: '#EAEAEA',
    },
    heroDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    heroDate: {
        fontSize: 12,
        fontWeight: '500',
        color: '#B2B2B2',
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '500',
        color: '#FFFFFF',
        lineHeight: 28.6,
    },
    heroActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    btnClipContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HERO_HEIGHT,
        overflow: 'hidden',
        zIndex: 10,
    },
    floatingActions: {
        position: 'absolute',
        left: 16,
        bottom: 16,
        flexDirection: 'row',
        gap: 16,
    },
    heroActionBtn: {
        width: 38,
        height: 38,
        borderRadius: 20,
        borderWidth: 0.8,
        borderColor: '#808080',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── ② 바텀시트 (핸들바 없음) ──
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: SCREEN_HEIGHT,
        paddingTop: 30,
        paddingHorizontal: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {},
        }),
    },
    bodyContainer: {
        gap: 16,
    },
    bodyParagraph: {
        fontSize: 16,
        fontWeight: '400',
        color: '#1A1A1A',
        lineHeight: 24,
    },
    linkedKeyword: {
        color: '#1A1A1A',
        fontWeight: '500',
        backgroundColor: 'rgba(114, 149, 254, 0.50)',
        borderRadius: 2,
    },

    // ── 탐사 버튼 ──
    exploreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F0F4FF',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 18,
        marginTop: 32,
        borderWidth: 1,
        borderColor: '#DDE4FF',
    },
    exploreInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    exploreText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2749F2',
    },

    // ── ③ 플로팅 네비 (투명) ──
    floatingNav: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 102,
        zIndex: 20,
    },
    navBackBtn: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── ④ 솔리드 네비 (스크롤 후) ──
    solidNav: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 102,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        zIndex: 21,
    },

    // ── 로딩/에러 ──
    loadingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#999',
        fontSize: 16,
    },

    // ── 스켈레톤 로딩 ──
    skeletonContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    skeletonHero: {
        width: '100%',
        height: 280,
        backgroundColor: '#F0F0F0',
    },
    skeletonLineFull: {
        width: '100%',
        height: 14,
        backgroundColor: '#F0F0F0',
        borderRadius: 4,
    },
    skeletonLine80: {
        width: '80%',
        height: 14,
        backgroundColor: '#F0F0F0',
        borderRadius: 4,
    },
    skeletonLine60: {
        width: '60%',
        height: 14,
        backgroundColor: '#F0F0F0',
        borderRadius: 4,
    },
});
