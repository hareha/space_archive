import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '@/components/OnboardingContext';

function MenuRow({ label, sub, onPress }: { label: string; sub?: string; onPress?: () => void }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{label}</Text>
                {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
        </TouchableOpacity>
    );
}

export default function CustomerServiceScreen() {
    const router = useRouter();
    const { setShowOnboarding } = useOnboarding();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>고객센터</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 앱 정보 */}
                <View style={styles.appInfoSection}>
                    <Text style={styles.appName}>Plus Ultra</Text>
                    <Text style={styles.appVersion}>버전 1.0.3 · 최신 버전</Text>
                </View>

                {/* 문의하기 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>문의하기</Text>
                    <MenuRow label="공지사항" onPress={() => router.push('/profile/notices')} />
                    <MenuRow label="온보딩 다시보기" onPress={() => setShowOnboarding(true)} />
                </View>

                {/* 약관 및 정책 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>약관 및 정책</Text>
                    <MenuRow label="이용약관" sub="최초 수정일 2024.10.01" />
                    <MenuRow label="개인정보처리방침" sub="최초 수정일 2024.10.01" />
                    <MenuRow label="위치기반 서비스 이용약관" />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 40 },

    // 앱 정보
    appInfoSection: {
        paddingHorizontal: 20, paddingVertical: 22,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    appName: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
    appVersion: { fontSize: 13, color: '#9E9E9E' },

    // 메뉴 섹션
    menuSection: {
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: '#9E9E9E', marginBottom: 4 },
    menuRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    menuLabel: { fontSize: 15, color: '#333', fontWeight: '400' },
    menuSub: { fontSize: 11, color: '#BDBDBD', marginTop: 3 },
});
