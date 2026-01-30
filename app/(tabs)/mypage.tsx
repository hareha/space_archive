import { useState } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Text, View } from '@/components/Themed';
import LandCard from '@/components/LandCard';
import NewsCard from '@/components/NewsCard'; // For scraped news
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LAND_DATA, NEWS_DATA } from '@/constants/MockData';

export default function MyPageScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [activeTab, setActiveTab] = useState<'lands' | 'scraps'>('lands');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileHeader}>
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop' }}
                            style={styles.avatar}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={styles.nickname}>CosmicExplorer</Text>
                            <Text style={styles.level}>Level 5. Moon Walker</Text>
                        </View>
                        <TouchableOpacity style={styles.settingsButton}>
                            <Ionicons name="settings-outline" size={24} color="#ccc" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>2</Text>
                            <Text style={styles.statLabel}>보유 토지</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>15</Text>
                            <Text style={styles.statLabel}>스크랩</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>320</Text>
                            <Text style={styles.statLabel}>포인트</Text>
                        </View>
                    </View>
                </View>

                {/* Content Tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'lands' && styles.activeTab]}
                        onPress={() => setActiveTab('lands')}
                    >
                        <Text style={[styles.tabText, activeTab === 'lands' && styles.activeTabText]}>내 영토</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'scraps' && styles.activeTab]}
                        onPress={() => setActiveTab('scraps')}
                    >
                        <Text style={[styles.tabText, activeTab === 'scraps' && styles.activeTabText]}>스크랩</Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                <View style={styles.listContainer}>
                    {activeTab === 'lands' ? (
                        LAND_DATA.map((land) => (
                            <LandCard
                                key={land.id}
                                id={land.id}
                                location={land.location}
                                coords={land.coords}
                                area={land.area}
                                imageUrl={land.imageUrl}
                            />
                        ))
                    ) : (
                        NEWS_DATA.slice(0, 2).map((news) => (
                            <NewsCard
                                key={news.id}
                                category={news.category}
                                title={news.title}
                                summary={news.summary}
                                date={news.date}
                                imageUrl={news.imageUrl}
                            />
                        ))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    profileSection: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 20,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    profileInfo: {
        marginLeft: 16,
        flex: 1,
    },
    nickname: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    level: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '600',
    },
    settingsButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        padding: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    tabButton: {
        marginRight: 20,
        paddingBottom: 8,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#fff',
    },
    listContainer: {
        paddingHorizontal: 20,
    },
});
