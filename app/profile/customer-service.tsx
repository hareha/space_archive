import React, { useEffect, useState, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useOnboarding } from '@/components/OnboardingContext';
import Constants from 'expo-constants';
import { supabase } from '@/services/supabase';

const LOGO = require('@/assets/images/plusultra_icon.png');

interface LegalDoc {
    slug: string;
    title: string;
    content: string;
    last_updated_at: string;
}

export default function CustomerServiceScreen() {
    const router = useRouter();
    const { setShowOnboarding } = useOnboarding();
    const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
    const [showLoadingPreview, setShowLoadingPreview] = useState(false);

    const handleShowLoading = useCallback(() => {
        setShowLoadingPreview(true);
        setTimeout(() => setShowLoadingPreview(false), 3000);
    }, []);

    const appVersion = Constants.expoConfig?.version ?? '1.0.0';

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('legal_documents')
                .select('slug, title, content, last_updated_at')
                .order('id');
            if (data) setLegalDocs(data);
        })();
    }, []);

    const getDoc = (slug: string) => legalDocs.find(d => d.slug === slug);
    const formatDate = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <SafeAreaView style={st.container}>
            <StatusBar barStyle="dark-content" />

            {/* ── 헤더 ── */}
            <View style={st.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={st.headerTitle}>고객센터</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── 앱 정보 ── */}
                <View style={st.appInfoRow}>
                    <Image source={LOGO} style={st.appLogo} resizeMode="contain" />
                    <View style={st.appInfoText}>
                        <Text style={st.appName}>Plus Ultra</Text>
                        <Text style={st.appVersion}>버전 {appVersion} · 최신 버전</Text>
                    </View>
                </View>

                {/* ── 문의하기 ── */}
                <View style={st.menuGroup}>
                    <Text style={st.menuHeader}>문의하기</Text>
                    <View style={st.menuList}>
                        <TouchableOpacity
                            style={st.menuItem}
                            onPress={() => router.push('/profile/notices')}
                            activeOpacity={0.6}
                        >
                            <Text style={st.menuItemText}>공지사항</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={st.menuItem}
                            onPress={() => setShowOnboarding(true)}
                            activeOpacity={0.6}
                        >
                            <Text style={st.menuItemText}>튜토리얼</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={st.menuItem}
                            onPress={handleShowLoading}
                            activeOpacity={0.6}
                        >
                            <Text style={st.menuItemText}>로딩화면 보기</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 구분선 ── */}
                <View style={st.divider} />

                {/* ── 약관 및 정책 (DB 연동) ── */}
                <View style={st.menuGroup}>
                    <Text style={st.menuHeader}>약관 및 정책</Text>
                    <View style={st.menuList}>
                        <TouchableOpacity style={st.menuItemWithSub} activeOpacity={0.6}>
                            <Text style={st.menuItemText}>이용약관</Text>
                            <Text style={st.menuItemSub}>
                                최종 수정일 {formatDate(getDoc('terms_of_service')?.last_updated_at || '2024-10-01')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.menuItemWithSub} activeOpacity={0.6}>
                            <Text style={st.menuItemText}>개인정보처리방침</Text>
                            <Text style={st.menuItemSub}>
                                최종 수정일 {formatDate(getDoc('privacy_policy')?.last_updated_at || '2024-10-01')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.menuItem} activeOpacity={0.6}>
                            <Text style={st.menuItemText}>위치기반 서비스 이용약관</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>

            {/* 로딩 화면 프리뷰 (터치하면 닫힘) */}
            {showLoadingPreview && (
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setShowLoadingPreview(false)}
                >
                    <LoadingOverlay visible={true} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, height: 58,
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: {
        fontSize: 18, fontWeight: '600', color: '#1A1A1A',
    },

    scrollContent: { paddingTop: 20, paddingBottom: 40 },

    // ── 앱 정보 ──
    appInfoRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 16, gap: 12, marginBottom: 40,
    },
    appLogo: {
        width: 28, height: 48,
    },
    appInfoText: {
        flex: 1, paddingTop: 2, gap: 8,
    },
    appName: {
        fontSize: 18, fontWeight: '600', color: '#1A1A1A',
    },
    appVersion: {
        fontSize: 14, fontWeight: '400', color: '#666666',
        lineHeight: 21,
    },

    // ── 메뉴 ──
    menuGroup: {
        paddingHorizontal: 16, gap: 14,
    },
    menuHeader: {
        fontSize: 14, fontWeight: '500', color: '#3C57E9',
    },
    menuList: {},
    menuItem: {
        paddingVertical: 15, justifyContent: 'center',
    },
    menuItemWithSub: {
        paddingVertical: 15, justifyContent: 'center', gap: 4,
    },
    menuItemText: {
        fontSize: 18, fontWeight: '500', color: '#1A1A1A',
    },
    menuItemSub: {
        fontSize: 14, fontWeight: '400', color: '#999999',
        lineHeight: 21,
    },

    divider: {
        height: 1, backgroundColor: '#00000014',
        marginHorizontal: 16, marginVertical: 24,
    },
});
