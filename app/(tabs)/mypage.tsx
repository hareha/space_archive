import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import { useAuth } from '@/components/AuthContext';
import LoginPrompt from '@/components/LoginPrompt';

// ─── 메뉴 아이템 ───
function MenuRow({ icon, label, onPress, color }: { icon: string; label: string; onPress?: () => void; color?: string }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.menuRowLeft}>
                <Ionicons name={icon as any} size={20} color={color || '#555'} style={styles.menuIcon} />
                <Text style={[styles.menuLabel, color ? { color } : null]}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
        </TouchableOpacity>
    );
}

// ─── 메인 컴포넌트 ───
export default function MyPageScreen() {
    const router = useRouter();
    const { user, isLoggedIn, logout } = useAuth();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showAR, setShowAR] = useState(false);

    const handleLogout = async () => {
        setShowLogoutModal(false);
        await logout();
    };

    // 비로그인 상태
    if (!isLoggedIn) {
        return <LoginPrompt />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>마이페이지</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* User Profile */}
                <TouchableOpacity
                    style={styles.profileSection}
                    activeOpacity={0.7}
                    onPress={() => router.push('/profile/manage')}
                >
                    <View style={styles.profileRow}>
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={28} color="#9E9E9E" />
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.userName}>{user?.nickname || 'User'}</Text>
                            <Text style={styles.userEmail}>{user?.email || ''}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
                    </View>
                    <View style={styles.membershipBadge}>
                        <Text style={styles.membershipText}>FREE 멤버십</Text>
                        <Text style={styles.membershipCta}>업그레이드 →</Text>
                    </View>
                </TouchableOpacity>

                {/* 자산 및 활동 대시보드 */}
                <View style={styles.dashboardSection}>
                    <View style={styles.dashboardHeader}>
                        <Text style={styles.dashboardLabel}>보유 자산</Text>
                        <TouchableOpacity style={styles.purchaseButton} activeOpacity={0.7}>
                            <Text style={styles.purchaseButtonText}>+이용권 구매하기</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.assetValue}>{(user?.magBalance || 0).toLocaleString()} ell</Text>
                    <Text style={styles.assetPeriod}>2025.03.09 ~ 2025.04.09</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>총 점유 구역</Text>
                            <View style={styles.statValueRow}>
                                <Text style={styles.statNumber}>{user?.totalOccupied || 0}</Text>
                                <Text style={styles.statUnit}> Mag</Text>
                            </View>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>점유 가능 구역</Text>
                            <View style={styles.statValueRow}>
                                <Text style={styles.statNumber}>36</Text>
                                <Text style={styles.statUnit}> Mag</Text>
                            </View>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>스크랩</Text>
                            <View style={styles.statValueRow}>
                                <Text style={styles.statNumber}>5</Text>
                                <Text style={styles.statUnit}> 건</Text>
                            </View>
                            <Text style={styles.statSub}>구역 3 · 콘텐츠 2</Text>
                        </View>
                    </View>
                </View>

                {/* 내 활동 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>내 활동</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow icon="grid-outline" label="내 구역 관리" onPress={() => router.push('/profile/my-territories')} />
                        <MenuRow icon="bookmark-outline" label="스크랩북" onPress={() => router.push('/profile/scrapbook')} />
                        <MenuRow icon="cube-outline" label="AR 모드" onPress={() => setShowAR(true)} />
                    </View>
                </View>

                {/* 결제 · 이용권 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>결제 · 이용권</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow icon="card-outline" label="이용권 및 프로모션" onPress={() => router.push('/profile/subscription')} />
                        <MenuRow icon="receipt-outline" label="거래 내역" />
                    </View>
                </View>

                {/* 설정 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>설정</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow icon="headset-outline" label="고객센터" onPress={() => router.push('/profile/customer-service')} />
                        <MenuRow icon="log-out-outline" label="로그아웃" onPress={() => setShowLogoutModal(true)} color="#E53935" />
                    </View>
                </View>
            </ScrollView>

            {showAR && <AR2MoonViewer onClose={() => setShowAR(false)} />}

            {/* 로그아웃 모달 */}
            <Modal
                visible={showLogoutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Ionicons name="log-out-outline" size={36} color="#E53935" style={{ marginBottom: 16 }} />
                        <Text style={styles.modalTitle}>로그아웃 하시겠습니까?</Text>
                        <TouchableOpacity style={styles.logoutConfirmBtn} onPress={handleLogout}>
                            <Text style={styles.logoutConfirmText}>로그아웃</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.logoutCancelBtn} onPress={() => setShowLogoutModal(false)}>
                            <Text style={styles.logoutCancelText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ─── 스타일 ───
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    headerBar: {
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 40 },

    // ── User Profile ──
    profileSection: {
        paddingHorizontal: 20, paddingVertical: 20,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    profileRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 14,
    },
    avatarPlaceholder: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    profileInfo: { flex: 1 },
    userName: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
    userEmail: { fontSize: 13, color: '#9E9E9E' },
    membershipBadge: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#F7F7FA', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16,
    },
    membershipText: { fontSize: 13, fontWeight: '600', color: '#666' },
    membershipCta: { fontSize: 13, fontWeight: '600', color: '#4A90D9' },

    // ── 자산 대시보드 ──
    dashboardSection: {
        paddingHorizontal: 20, paddingVertical: 20,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    dashboardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
    },
    dashboardLabel: { fontSize: 13, color: '#9E9E9E', fontWeight: '500' },
    purchaseButton: {
        backgroundColor: '#4A90D9', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14,
    },
    purchaseButtonText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
    assetValue: { fontSize: 32, fontWeight: '800', color: '#1A1A1A', marginBottom: 4, letterSpacing: -0.5 },
    assetPeriod: { fontSize: 12, color: '#BDBDBD', marginBottom: 20 },
    statsRow: {
        flexDirection: 'row', backgroundColor: '#F7F7FA', borderRadius: 12,
        paddingVertical: 16, paddingHorizontal: 8,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: '#E5E5E5', marginVertical: 4 },
    statLabel: { fontSize: 11, color: '#9E9E9E', marginBottom: 6, fontWeight: '500' },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
    statNumber: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
    statUnit: { fontSize: 12, fontWeight: '500', color: '#9E9E9E' },
    statSub: { fontSize: 10, color: '#BDBDBD', marginTop: 3 },

    // ── 섹션 / 메뉴 ──
    menuSection: {
        paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9E9E9E', marginBottom: 4 },
    menuGroup: { marginTop: 4 },
    menuRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    menuIcon: { marginRight: 14 },
    menuLabel: { fontSize: 15, color: '#333333', fontWeight: '400' },

    // ── 로그아웃 모달 ──
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 16, paddingVertical: 32, paddingHorizontal: 24,
        alignItems: 'center', width: '100%',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 24 },
    logoutConfirmBtn: {
        backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', width: '100%', marginBottom: 10,
    },
    logoutConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    logoutCancelBtn: {
        backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', width: '100%',
    },
    logoutCancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
});
