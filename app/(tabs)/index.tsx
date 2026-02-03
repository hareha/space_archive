import { useState } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar, View as RNView, Text as RNText } from 'react-native';
import { Image } from 'expo-image';
import { Text, View } from '@/components/Themed';
import NewsCard from '@/components/NewsCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NEWS_DATA } from '@/constants/MockData';

export default function TabOneScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [selectedCategory, setSelectedCategory] = useState<string>('최신');
    const [showBanner, setShowBanner] = useState(true);

    const filteredNews = selectedCategory === '최신'
        ? NEWS_DATA
        : NEWS_DATA.filter(item => item.category === selectedCategory);

    const handleBannerPress = () => {
        router.push('/moon'); // Go to Moon tab
    };

    const handleCloseBanner = () => {
        setShowBanner(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>코스믹 인사이트</Text>
                    <View style={styles.headerSub}>
                        <Text style={styles.headerDate}>일일 브리핑</Text>
                    </View>
                    <TouchableOpacity style={styles.searchButton}>
                        <FontAwesome name="search" size={20} color="#ddd" />
                    </TouchableOpacity>
                </View>

                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
                    {['최신', '탐사', '산업', '과학', '기술'].map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                selectedCategory === cat ? styles.categoryChipActive : styles.categoryChipInactive
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <RNView style={styles.chipContent}>
                                {selectedCategory === cat && cat === '최신' && <FontAwesome name="bolt" size={12} color="#fff" style={{ marginRight: 6 }} />}
                                {selectedCategory === cat && cat !== '최신' && <FontAwesome name="circle" size={8} color="#fff" style={{ marginRight: 6 }} />}
                                <RNText style={[
                                    styles.categoryText,
                                    selectedCategory === cat ? { color: '#fff' } : { color: '#888' }
                                ]}>{cat}</RNText>
                            </RNView>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Main Banner */}
                {selectedCategory === '최신' && showBanner && (
                    <View style={styles.bannerContainer}>
                        <View style={styles.bannerHeader}>
                            <View style={styles.bannerLabel}>
                                <FontAwesome name="star" size={10} color="#3B82F6" style={{ marginRight: 4 }} />
                                <Text style={styles.bannerLabelText}>Journey Never Ends</Text>
                            </View>
                            <TouchableOpacity onPress={handleCloseBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <FontAwesome name="close" size={16} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.bannerContentCentered}>
                            <Text style={styles.bannerTitle}>달 표면 위에 새기는{'\n'}우주의 영혼 좌표</Text>
                            <Text style={styles.bannerDesc}>외로움, 시간, 경면, 기억을 가진 최소의 존재단위로{'\n'}당신의 영혼이 머무를 단 하나의 좌표를 새기세요.</Text>

                            <View style={styles.moonImageContainer}>
                                <Image
                                    source={{ uri: 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?q=80&w=600&auto=format&fit=crop' }}
                                    style={styles.moonImage}
                                    contentFit="cover"
                                />
                                <View style={styles.moonGlow} />
                            </View>

                            <TouchableOpacity
                                style={[styles.bannerButton, { backgroundColor: '#2563EB' }]}
                                onPress={handleBannerPress}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.bannerButtonText}>우주 정보 구독 & 좌표 새기기</Text>
                                <Text style={styles.bannerButtonSubText}>3개월 구독 / 10 m2 cell</Text>
                            </TouchableOpacity>

                            <Text style={styles.bannerFooterText}>QiHomeworld 기업, 2026년 3월</Text>
                        </View>
                    </View>
                )}

                {/* Recent Updates Section */}
                <View style={[styles.sectionHeader, selectedCategory !== '최신' && { marginTop: 0 }]}>
                    <FontAwesome name="rss-square" size={18} color="#3B82F6" style={{ marginRight: 8 }} />
                    <Text style={styles.sectionTitle}>
                        {selectedCategory === '최신' ? '최신 업데이트' : `${selectedCategory} 뉴스`}
                    </Text>
                </View>

                {/* Filtered News List */}
                {filteredNews.map((news) => (
                    <TouchableOpacity key={news.id} onPress={() => router.push(`/news/${news.id}`)}>
                        <NewsCard
                            category={news.category}
                            title={news.title}
                            summary={news.summary}
                            date={news.date}
                            imageUrl={news.imageUrl}
                        />
                    </TouchableOpacity>
                ))}

                {filteredNews.length === 0 && (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#666' }}>해당 카테고리의 기사가 없습니다.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0B15' }, // Darker background
    scrollContent: { padding: 20 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
        marginTop: 10,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    headerSub: { marginLeft: 10, justifyContent: 'center' },
    headerDate: { color: '#666', fontSize: 12 },
    headerSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
    searchButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 },
    categories: { marginBottom: 24, maxHeight: 50 },
    categoryChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25,
        borderWidth: 1, borderColor: 'transparent', marginRight: 10,
        backgroundColor: '#1A1A23',
        justifyContent: 'center',
        height: 36,
    },
    categoryChipActive: {
        backgroundColor: '#2563EB',
    },
    categoryChipInactive: {
        backgroundColor: '#161622',
        borderColor: '#333',
    },
    chipContent: { flexDirection: 'row', alignItems: 'center' },
    categoryText: { fontSize: 13, fontWeight: '700' },

    // New Banner Styles
    bannerContainer: {
        backgroundColor: '#12121A', // 더 짙은 배경색으로 변경 (User Request)
        borderRadius: 24, padding: 24, marginBottom: 32,
        borderWidth: 1, borderColor: '#2A2A35',
        alignItems: 'center',
        // 그림자 추가
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5, // 그림자 진하게
        shadowRadius: 10,
        elevation: 8,
    },
    bannerHeader: {
        width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16,
    },
    bannerLabel: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    bannerLabelText: { color: '#3B82F6', fontSize: 11, fontWeight: 'bold' },
    bannerContentCentered: { alignItems: 'center', width: '100%' },
    bannerTitle: {
        fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center', lineHeight: 30, marginBottom: 12,
    },
    bannerDesc: {
        fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24,
    },
    moonImageContainer: {
        width: 180, height: 180, borderRadius: 90, overflow: 'hidden', marginBottom: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000',
        justifyContent: 'center', alignItems: 'center',
    },
    moonImage: { width: '100%', height: '100%' },
    moonGlow: {
        position: 'absolute', width: '100%', height: '100%', borderRadius: 90,
        backgroundColor: 'rgba(0,0,0,0.3)', // minimal overlay
    },
    bannerButton: {
        width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12,
    },
    bannerButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    bannerButtonSubText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
    bannerFooterText: { color: '#444', fontSize: 10 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    // Remove old banner styles that are not used
    bannerImage: { display: 'none' },
    bannerOverlay: { display: 'none' },
    bannerTag: { display: 'none' },
    bannerTagText: { display: 'none' },
});
