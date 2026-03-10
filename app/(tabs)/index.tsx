import { useState } from 'react';
import {
    StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
    StatusBar, View, Text, TextInput, FlatList
} from 'react-native';
import NewsCard from '@/components/NewsCard';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { NEWS_DATA } from '@/constants/MockData';

const CATEGORIES = ['전체', '탐사', '자원', '기술', '분석'];

export default function TabOneScreen() {

    const [selectedCategory, setSelectedCategory] = useState<string>('전체');
    const [searchText, setSearchText] = useState('');
    const [sortOrder, setSortOrder] = useState<'최신순' | '인기순'>('최신순');
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

    const filteredNews = NEWS_DATA.filter(item => {
        const matchesCategory = selectedCategory === '전체' || item.category === selectedCategory;
        const matchesSearch = searchText === '' ||
            item.title.includes(searchText) ||
            item.summary.includes(searchText);
        return matchesCategory && matchesSearch;
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* ① 헤더 */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>인사이트</Text>
                <TouchableOpacity style={styles.searchIconBtn}>
                    <Ionicons name="search" size={22} color="#1A1A1A" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ① 검색 영역 */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchInputWrap}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="키워드를 입력하세요"
                            placeholderTextColor="#ACACAC"
                            value={searchText}
                            onChangeText={setSearchText}
                            returnKeyType="search"
                        />
                        <TouchableOpacity style={styles.filterBtn}>
                            <Ionicons name="options-outline" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ② 카테고리 칩 영역 */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryRow}
                    contentContainerStyle={styles.categoryRowContent}
                >
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                selectedCategory === cat ? styles.categoryChipActive : styles.categoryChipInactive
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.categoryChipText,
                                selectedCategory === cat ? styles.categoryChipTextActive : styles.categoryChipTextInactive
                            ]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* 정렬 */}
                <View style={styles.sortRow}>
                    <TouchableOpacity
                        style={styles.sortBtn}
                        onPress={() => {
                            setSortOrder(sortOrder === '최신순' ? '인기순' : '최신순');
                        }}
                    >
                        <Text style={styles.sortText}>{sortOrder}</Text>
                        <Ionicons name="chevron-down" size={14} color="#888" />
                    </TouchableOpacity>

                    <View style={styles.viewToggle}>
                        <TouchableOpacity
                            style={[styles.viewToggleBtn, viewMode === 'card' && styles.viewToggleBtnActive]}
                            onPress={() => setViewMode('card')}
                        >
                            <Ionicons name="grid-outline" size={16} color={viewMode === 'card' ? '#1A1A1A' : '#ACACAC'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                            onPress={() => setViewMode('list')}
                        >
                            <Ionicons name="list-outline" size={16} color={viewMode === 'list' ? '#1A1A1A' : '#ACACAC'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ③ 뉴스 피드 리스트 */}
                {filteredNews.map((news) => (
                    <TouchableOpacity key={news.id} onPress={() => router.push(`/news/${news.id}`)} activeOpacity={0.8}>
                        <NewsCard
                            category={news.category}
                            title={news.title}
                            summary={news.summary}
                            date={news.date}
                            imageUrl={news.imageUrl}
                            viewMode={viewMode}
                        />
                    </TouchableOpacity>
                ))}

                {filteredNews.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={48} color="#CCC" />
                        <Text style={styles.emptyText}>해당 카테고리의 기사가 없습니다.</Text>
                    </View>
                )}

                {/* 하단 여백 */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },

    // ── 헤더 ──
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#F5F5F5',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    searchIconBtn: {
        padding: 6,
    },

    scrollContent: {
        paddingHorizontal: 20,
    },

    // ── 검색 ──
    searchContainer: {
        marginBottom: 16,
    },
    searchInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBEBEB',
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1A1A1A',
        paddingVertical: 0,
    },
    filterBtn: {
        paddingLeft: 10,
    },

    // ── 카테고리 ──
    categoryRow: {
        marginBottom: 12,
        maxHeight: 44,
    },
    categoryRowContent: {
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryChipActive: {
        backgroundColor: '#1A1A1A',
    },
    categoryChipInactive: {
        backgroundColor: '#E8E8E8',
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
    },
    categoryChipTextInactive: {
        color: '#666',
    },

    // ── 정렬 ──
    sortRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 12,
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sortText: {
        fontSize: 13,
        color: '#888',
    },

    // ── 보기모드 토글 ──
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#EBEBEB',
        borderRadius: 8,
        padding: 2,
        gap: 2,
    },
    viewToggleBtn: {
        padding: 6,
        borderRadius: 6,
    },
    viewToggleBtnActive: {
        backgroundColor: '#fff',
    },

    // ── 빈 상태 ──
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
