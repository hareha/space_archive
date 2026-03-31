import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NEWS_DATA, SCRAPPED_NEWS, COSMOS_NEWS_DATA, NewsItem } from '@/constants/MockData';
import { addScrapContent, removeScrapContent, isContentScrapped } from '@/constants/scrapStore';
import { useAuth } from '@/components/AuthContext';

export default function NewsDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const [isScrapped, setIsScrapped] = useState(false);

    const newsItem: NewsItem | undefined =
        NEWS_DATA.find(item => item.id.toString() === id) ||
        COSMOS_NEWS_DATA.find(item => item.id.toString() === id) ||
        SCRAPPED_NEWS.find(item => item.id.toString() === id);

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

    if (!newsItem) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>뉴스를 찾을 수 없습니다.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleExplore = () => {
        if (!newsItem.location) return;
        router.push({
            pathname: '/moon',
            params: {
                flyToLat: newsItem.location.lat.toString(),
                flyToLng: newsItem.location.lng.toString(),
                flyToName: newsItem.location.name,
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" />

            {/* ── 헤더 ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>인사이트</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={toggleScrap}>
                        <Ionicons name={isScrapped ? 'bookmark' : 'bookmark-outline'} size={22} color={isScrapped ? '#3B82F6' : '#1A1A1A'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={async () => {
                        if (!newsItem) return;
                        try {
                            const deepLink = Linking.createURL('/news', { queryParams: { id: newsItem.id.toString() } });
                            await Share.share({
                                message: `📰 ${newsItem.title}\n${newsItem.source} · ${newsItem.publishDate}\n\n${newsItem.summary}\n\n👉 Plus Ultra에서 보기:\n${deepLink}`,
                            });
                        } catch (e) { }
                    }}>
                        <Ionicons name="share-outline" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ① 제목 */}
                <Text style={styles.title}>{newsItem.title}</Text>

                {/* 출처 · 날짜 */}
                <View style={styles.metaRow}>
                    <Text style={styles.source}>{newsItem.source}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.publishDate}>{newsItem.publishDate}</Text>
                </View>

                {/* 대표 이미지 */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: newsItem.imageUrl }}
                        style={styles.image}
                        contentFit="cover"
                        transition={300}
                    />
                </View>

                {/* 본문 */}
                <View style={styles.bodyContainer}>
                    {newsItem.body.map((paragraph, index) => (
                        <Text key={index} style={styles.bodyParagraph}>
                            {paragraph}
                        </Text>
                    ))}
                </View>

                {/* ② 탐사 연결 액션 */}
                {newsItem.location && (
                    <TouchableOpacity style={styles.exploreButton} onPress={handleExplore} activeOpacity={0.7}>
                        <Text style={styles.exploreText}>이 지점 탐사 하기</Text>
                        <Ionicons name="arrow-forward" size={18} color="#1A1A1A" />
                    </TouchableOpacity>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    // ── 헤더 ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        padding: 4,
    },

    // ── 에러 ──
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#999',
        fontSize: 16,
    },

    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },

    // ── 제목 ──
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 32,
        marginBottom: 12,
    },

    // ── 출처 · 날짜 ──
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    source: {
        fontSize: 13,
        color: '#999',
    },
    metaDot: {
        fontSize: 13,
        color: '#CCC',
        marginHorizontal: 8,
    },
    publishDate: {
        fontSize: 13,
        color: '#999',
    },

    // ── 이미지 ──
    imageContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
    },
    image: {
        width: '100%',
        height: 220,
        backgroundColor: '#E5E5E5',
    },

    // ── 본문 ──
    bodyContainer: {
        marginBottom: 24,
    },
    bodyParagraph: {
        fontSize: 15,
        color: '#333',
        lineHeight: 26,
        marginBottom: 16,
        letterSpacing: -0.2,
    },

    // ── 탐사 연결 버튼 ──
    exploreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    exploreText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
});
