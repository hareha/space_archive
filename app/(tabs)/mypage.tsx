import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Text } from '@/components/Themed';
import LandCard from '@/components/LandCard';
import { MY_LANDS, SCRAPPED_NEWS } from '@/constants/MockData';
import { FontAwesome } from '@expo/vector-icons';

export default function MyPageScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('lands');

    const handleViewMap = (coordinates: string) => {
        // Parse coordinates "Lat 0.67N, Lon 23.47E"
        try {
            const latMatch = coordinates.match(/Lat\s*([\d.]+)([NS])/);
            const lonMatch = coordinates.match(/Lon\s*([\d.]+)([EW])/);

            if (latMatch && lonMatch) {
                let lat = parseFloat(latMatch[1]);
                if (latMatch[2] === 'S') lat = -lat;

                let lon = parseFloat(lonMatch[1]);
                if (lonMatch[2] === 'W') lon = -lon;

                router.push({
                    pathname: '/moon',
                    params: { lat, lng: lon }
                });
            }
        } catch (e) {
            console.error('Error parsing coordinates', e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header Bar */}
            <View style={styles.headerBar}>
                <TouchableOpacity style={styles.iconButton}>
                    <FontAwesome name="arrow-left" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>마이페이지</Text>
                <TouchableOpacity style={styles.iconButton}>
                    <FontAwesome name="cog" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop' }}
                            style={styles.avatar}
                        />
                        <View style={styles.verifiedBadge}>
                            <FontAwesome name="check" size={10} color="#fff" />
                        </View>
                    </View>
                    <Text style={styles.name}>김우주</Text>
                    <Text style={styles.level}>Space Pioneer Lv.4</Text>

                    {/* Stats Boxes */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>보유 토지</Text>
                            <Text style={styles.statValue}>12 필지</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>스크랩</Text>
                            <Text style={styles.statValue}>48 건</Text>
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={styles.tabItem}
                        onPress={() => setActiveTab('lands')}
                    >
                        <FontAwesome name="flag" size={14} color={activeTab === 'lands' ? '#3B82F6' : '#666'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'lands' && styles.activeTabText]}>내 토지</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.tabItem}
                        onPress={() => setActiveTab('scrap')}
                    >
                        <FontAwesome name="bookmark" size={14} color={activeTab === 'scrap' ? '#3B82F6' : '#666'} style={{ marginRight: 6 }} />
                        <Text style={[styles.tabText, activeTab === 'scrap' && styles.activeTabText]}>스크랩한 칼럼</Text>
                    </TouchableOpacity>
                </View>

                {/* Content List */}
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>보유 목록</Text>
                    <TouchableOpacity>
                        <Text style={styles.viewAll}>전체보기 <FontAwesome name="chevron-right" size={10} /></Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.listContainer}>
                    {activeTab === 'lands' ? (
                        <>
                            {MY_LANDS.map((land) => (
                                <LandCard
                                    key={land.id}
                                    id={land.id}
                                    location={land.location}
                                    coordinates={land.coordinates}
                                    area={land.area}
                                    purchaseDate={land.purchaseDate}
                                    imageUrl={land.imageUrl}
                                    onViewMap={() => handleViewMap(land.coordinates)}
                                />
                            ))}
                            {/* Promo Card matching design */}
                            <TouchableOpacity style={styles.promoCard}>
                                <View style={styles.promoIcon}>
                                    <FontAwesome name="map-marker" size={20} color="#3B82F6" />
                                </View>
                                <Text style={styles.promoTitle}>새로운 좌표 남기기</Text>
                                <Text style={styles.promoDesc}>250억여개로 나뉘어진 달에 나만의 좌표를 남겨보세요</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {SCRAPPED_NEWS.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.scrapCard}
                                    onPress={() => router.push(`/news/${item.id}`)}
                                >
                                    <Image source={{ uri: item.imageUrl }} style={styles.scrapImage} />
                                    <View style={styles.scrapContent}>
                                        <View style={styles.scrapHeader}>
                                            <Text style={styles.scrapCategory}>{item.category}</Text>
                                            <Text style={styles.scrapDate}>{item.date}</Text>
                                        </View>
                                        <Text style={styles.scrapTitle} numberOfLines={2}>{item.title}</Text>
                                        <View style={styles.scrapAction}>
                                            <FontAwesome name="bookmark" size={12} color="#3B82F6" />
                                            <Text style={styles.scrapActionText}>저장됨</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0B15' },
    headerBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 10,
    },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    iconButton: { padding: 8 },
    scrollContent: { paddingBottom: 40 },

    profileSection: {
        alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20,
        backgroundColor: '#10101A', marginBottom: 20,
    },
    avatarContainer: { position: 'relative', marginBottom: 16 },
    avatar: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 2, borderColor: '#1E1E2C',
    },
    verifiedBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: '#3B82F6', width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#10101A',
    },
    name: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    level: { fontSize: 13, color: '#888', marginBottom: 24 },

    statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
    statBox: {
        flex: 1, backgroundColor: '#1A1A25', borderRadius: 12, padding: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    statLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    tabsContainer: {
        flexDirection: 'row', justifyContent: 'center', marginBottom: 20,
        borderBottomWidth: 1, borderBottomColor: '#222',
    },
    tabItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24,
    },
    tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
    activeTabText: { color: '#fff' },

    listHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 12,
    },
    listTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    viewAll: { fontSize: 12, color: '#3B82F6' },

    listContainer: { paddingHorizontal: 20 },

    promoCard: {
        backgroundColor: '#12121A', borderRadius: 16, padding: 24, alignItems: 'center',
        borderWidth: 1, borderColor: '#222', borderStyle: 'dashed',
    },
    promoIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    promoTitle: { color: '#ccc', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
    promoDesc: { color: '#666', fontSize: 11, textAlign: 'center' },

    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { color: '#666', marginTop: 10 },

    // Scrap Card Styles
    scrapCard: {
        flexDirection: 'row', backgroundColor: '#1A1A25', borderRadius: 12, marginBottom: 12,
        padding: 12, alignItems: 'center',
    },
    scrapImage: { width: 80, height: 80, borderRadius: 8, marginRight: 16 },
    scrapContent: { flex: 1 },
    scrapHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    scrapCategory: { color: '#3B82F6', fontSize: 11, fontWeight: 'bold' },
    scrapDate: { color: '#666', fontSize: 11 },
    scrapTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 20, marginBottom: 8 },
    scrapAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    scrapActionText: { color: '#3B82F6', fontSize: 11 },
});
