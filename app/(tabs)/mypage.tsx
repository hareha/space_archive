import React, { useState } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity,
    StatusBar, SafeAreaView, Modal, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import { useAuth } from '@/components/AuthContext';
import { useEll } from '@/components/EllContext';
import LoginPrompt from '@/components/LoginPrompt';

// ─── 메뉴 아이템 ───
function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.menuRowLeft}>
                <Ionicons name={icon as any} size={20} color="#444" style={styles.menuIcon} />
                <Text style={styles.menuLabel}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

// ─── 메인 컴포넌트 ───
export default function MyPageScreen() {
    const router = useRouter();
    const { user, isLoggedIn, logout } = useAuth();
    const { ellBalance, remainingMag, totalOccupied } = useEll();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showAR, setShowAR] = useState(false);

    const handleLogout = async () => {
        setShowLogoutModal(false);
        await logout();
    };

    if (!isLoggedIn) {
        return <LoginPrompt />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ═══ ① 프로필 영역 ═══ */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={28} color="#9E9E9E" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.userName}>{user?.nickname || 'User'}</Text>
                        <Text style={styles.userEmail}>{user?.email || ''}</Text>
                    </View>
                </View>

                {/* ═══ ② Balance 카드 ═══ */}
                <View style={styles.balanceWrapper}>
                    <View style={styles.balanceCardOuter}>
                        <ImageBackground
                            source={require('@/assets/images/mypage_background.png')}
                            style={styles.balanceCard}
                            imageStyle={styles.balanceBgImage}
                            resizeMode="cover"
                        >
                            <View style={styles.balanceRow}>
                                <Text style={styles.balanceValue}>
                                    {ellBalance.toLocaleString()}
                                </Text>
                                <Text style={styles.balanceUnit}>ell</Text>
                            </View>
                            <Text style={styles.balancePeriod}>2025.03.09 ~ 2025.04.09</Text>

                            <BlurView intensity={30} tint="dark" style={styles.buyPassBlur}>
                                <TouchableOpacity style={styles.buyPassBtn} activeOpacity={0.8} onPress={() => router.push('/profile/subscription')}>
                                    <Text style={styles.buyPassText}>+ 이용권 구매하기</Text>
                                </TouchableOpacity>
                            </BlurView>
                        </ImageBackground>
                    </View>
                </View>

                {/* ═══ ③ 통계 카드들 ═══ */}
                <View style={styles.statsSection}>
                    {/* 총 개척 구역 */}
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>총 개척 구역</Text>
                        <View style={styles.statValArea}>
                            <Text style={styles.statNumber}>{totalOccupied}</Text>
                            <Text style={styles.statUnit}> Mag</Text>
                        </View>
                    </View>

                    {/* 개척 가능 구역 */}
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>개척 가능 구역</Text>
                        <View style={styles.statValArea}>
                            <Text style={styles.statNumber}>{remainingMag}</Text>
                            <Text style={styles.statUnit}> Mag</Text>
                        </View>
                    </View>


                </View>

                {/* ═══ ④ 내 활동 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>내 활동</Text>
                    <MenuRow icon="grid-outline" label="내 구역 관리" onPress={() => router.push('/profile/my-territories')} />
                    <MenuRow icon="bookmark-outline" label="스크랩북" onPress={() => router.push('/profile/scrapbook')} />
                    <MenuRow icon="cube-outline" label="AR 모드" onPress={() => setShowAR(true)} />
                </View>

                {/* ═══ ⑤ 결제 · 이용권 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>결제 · 이용권</Text>
                    <MenuRow icon="card-outline" label="이용권 및 프로모션" onPress={() => router.push('/profile/subscription')} />
                    <MenuRow icon="swap-horizontal-outline" label="거래 내역" />
                </View>

                {/* ═══ ⑥ 고객지원 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>고객지원</Text>
                    <MenuRow icon="chatbubble-ellipses-outline" label="고객센터" onPress={() => router.push('/profile/customer-service')} />
                    <MenuRow icon="log-out-outline" label="로그아웃" onPress={() => setShowLogoutModal(true)} />
                </View>

                <View style={{ height: 100 }} />
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
    scrollContent: { paddingBottom: 20 },

    // ═══ 프로필 ═══
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    avatarPlaceholder: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: '#E8E8EC',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 14,
    },
    profileInfo: { flex: 1 },
    userName: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
    userEmail: { fontSize: 13, color: '#9E9E9E' },

    // ═══ Balance 카드 ═══
    balanceWrapper: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    balanceCardOuter: {
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    balanceCard: {
        paddingHorizontal: 24,
        paddingTop: 36,
        paddingBottom: 24,
        alignItems: 'center',
    },
    balanceBgImage: {
        opacity: 0.7,
        borderRadius: 16,
    },
    balanceLabelWrap: {
        marginBottom: 16,
    },
    balanceLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 6,
    },
    balanceValue: {
        fontSize: 42,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    balanceUnit: {
        fontSize: 18,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.45)',
        marginLeft: 10,
    },
    balancePeriod: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 24,
        textAlign: 'center',
    },
    buyPassBlur: {
        borderRadius: 8,
        overflow: 'hidden',
        alignSelf: 'stretch',
    },
    buyPassBtn: {
        paddingVertical: 18,
        alignItems: 'center',
        alignSelf: 'stretch',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        borderRadius: 8,
    },
    buyPassText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },

    // ═══ 통계 ═══
    statsSection: {
        paddingHorizontal: 20,
        marginBottom: 28,
        gap: 8,
    },
    statCard: {
        backgroundColor: '#F5F6F8',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 8,
    },
    statLabel: { fontSize: 13, color: 'rgba(0, 0, 0, 0.75)', fontWeight: '400', marginBottom: 12 },
    statValArea: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' },
    statNumber: { fontSize: 32, fontWeight: '700', color: '#1A1A1A' },
    statNumberSm: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
    statUnit: { fontSize: 16, fontWeight: '500', color: '#818181ff' },
    statSub: { fontSize: 12, color: '#BDBDBD' },

    // ═══ 메뉴 섹션 ═══
    menuSection: {
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4A6CF7',
        marginBottom: 4,
        marginTop: 8,
    },
    menuRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    menuIcon: { marginRight: 14, width: 24, textAlign: 'center' },
    menuLabel: { fontSize: 15, color: '#1A1A1A', fontWeight: '400' },

    // ═══ 로그아웃 모달 ═══
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 4, paddingVertical: 32, paddingHorizontal: 24,
        alignItems: 'center', width: '100%',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 24 },
    logoutConfirmBtn: {
        backgroundColor: '#E53935', borderRadius: 2, paddingVertical: 14,
        alignItems: 'center', width: '100%', marginBottom: 10,
    },
    logoutConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    logoutCancelBtn: {
        backgroundColor: '#F0F0F0', borderRadius: 2, paddingVertical: 14,
        alignItems: 'center', width: '100%',
    },
    logoutCancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
});
