import React, { useState, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity,
    StatusBar, SafeAreaView, Modal, ImageBackground, Image, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AR2MoonViewer from '@/components/AR2MoonViewer';
import { useAuth } from '@/components/AuthContext';
import { useEll } from '@/components/EllContext';
import LoginPrompt from '@/components/LoginPrompt';
import Svg, { Path, Rect } from 'react-native-svg';

// ─── 커스텀 SVG 아이콘 ───
const SvgIcons: Record<string, (props: { size?: number; color?: string }) => React.ReactElement> = {
    category: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Rect x="2.39" y="2.39" width="6.42" height="7" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Rect width="6.46" height="6.96" transform="matrix(0.96 0.28 -0.24 0.97 13.41 1.61)" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Rect x="2.39" y="12.61" width="6.42" height="7" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Rect x="13.19" y="12.61" width="6.42" height="7" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
        </Svg>
    ),
    folder: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M6.996 13.829H15.003" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path fillRule="evenodd" clipRule="evenodd" d="M19.48 18.633H2.521V3.367H8.904L10.978 5.915H19.48V18.633Z" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
        </Svg>
    ),
    ar: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M2.5 6V2.5H6M16 2.5H19.5V6M19.5 16V19.5H16M6 19.5H2.5V16" stroke={color} strokeWidth={1.5} />
            <Path d="M5 7.5L11 4L17 7.5M5 7.5V14.5L11 18M5 7.5L11 11M11 18L17 14.5V7.5M11 18V11M17 7.5L11 11" stroke={color} strokeWidth={1.5} />
        </Svg>
    ),
    ticket: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M12.569 4.429V6.481" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M12.569 15.884V17.6" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M12.569 8.928V13.102" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M18.55 4.429H3.45V8.036C5.095 8.036 6.393 9.37 6.393 11.014C6.393 12.66 5.095 13.993 3.45 13.993V17.6H18.55V13.993C16.905 13.993 15.607 12.66 15.607 11.014C15.607 9.37 16.905 8.036 18.55 8.036V4.429Z" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
        </Svg>
    ),
    swap: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M3.529 15.267L16.307 15.267" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M7.742 11.054C7.742 13.22 5.835 15.267 3.53 15.267" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M7.742 19.479C7.742 17.313 5.835 15.266 3.53 15.266" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M18.471 6.733L5.693 6.733" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M14.258 10.946C14.258 8.78 16.165 6.733 18.47 6.733" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M14.258 2.521C14.258 4.687 16.165 6.734 18.47 6.734" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
        </Svg>
    ),
    customer_service: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M18.2 11.199C18.2 7.256 14.982 4.05 11 4.05C7.018 4.05 3.8 7.256 3.8 11.199C3.8 12.27 3.932 12.958 4.095 13.463C4.205 13.798 4.467 13.468 4.597 13.346C5.022 12.947 5.585 12.729 6.168 12.738C6.751 12.746 7.308 12.98 7.721 13.391C9 14.662 10.18 16.424 8.55 18.044C7.675 18.914 6.358 19.275 5.355 18.339C4.061 17.13 2.937 15.722 2.383 14.019C2.153 13.305 2 12.424 2 11.198C2 6.25 6.035 2.25 11 2.25C15.965 2.25 20 6.25 20 11.199C20 12.425 19.848 13.306 19.617 14.018C19.063 15.722 17.939 17.13 16.645 18.338C15.642 19.275 14.325 18.914 13.45 18.044C11.821 16.424 13 14.662 14.278 13.391C14.691 12.98 15.249 12.746 15.832 12.737C16.415 12.729 16.978 12.947 17.404 13.346C17.653 13.58 17.776 13.859 17.905 13.463C18.068 12.959 18.2 12.269 18.2 11.199Z" fill={color} />
        </Svg>
    ),
    logout: ({ size = 22, color = '#1A1A1A' }) => (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Path d="M19.039 11L7.326 11" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M16.709 7.998L19.724 11L16.709 14.003" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
            <Path d="M11 2.75H3.25V19.25H11" stroke={color} strokeWidth={1.5} strokeLinecap="square" />
        </Svg>
    ),
};

// ─── 메뉴 아이템 ───
function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
    const SvgIcon = SvgIcons[icon];
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.menuRowLeft}>
                {SvgIcon ? (
                    <View style={styles.menuIcon}><SvgIcon size={22} color="#1A1A1A" /></View>
                ) : (
                    <Ionicons name={icon as any} size={22} color="#1A1A1A" style={styles.menuIcon} />
                )}
                <Text style={styles.menuLabel}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

// ─── 메인 컴포넌트 ───
export default function MyPageScreen() {
    const router = useRouter();
    const { user, isLoggedIn, logout, refreshUser } = useAuth();
    const { ellBalance, remainingMag, totalOccupied } = useEll();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showAR, setShowAR] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const { refreshBalance } = useEll();

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refreshUser().catch(() => {}),
            refreshBalance().catch(() => {}),
        ]);
        setRefreshing(false);
    }, [refreshUser, refreshBalance]);

    const handleLogout = async () => {
        setShowLogoutModal(false);
        await logout();
    };

    if (!isLoggedIn) {
        return <LoginPrompt />;
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* StatusBar는 _layout.tsx에서 탭별로 관리 */}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#3C57E9"
                    />
                }
            >
                {/* ═══ ① 프로필 영역 ═══ */}
                <TouchableOpacity style={styles.profileSection} onPress={() => router.push('/profile/manage')} activeOpacity={0.7}>
                    <View style={styles.avatarPlaceholder}>
                        {user?.avatarUrl ? (
                            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                            <Ionicons name="person" size={24} color="#9E9E9E" />
                        )}
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.userName}>{user?.nickname || 'User'}</Text>
                        <Text style={styles.userEmail}>{user?.email || ''}</Text>
                    </View>
                </TouchableOpacity>

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
                            <Text style={styles.statUnit}>Mag</Text>
                        </View>
                    </View>

                    {/* 개척 가능 구역 */}
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>개척 가능 구역</Text>
                        <View style={styles.statValArea}>
                            <Text style={styles.statNumber}>{remainingMag}</Text>
                            <Text style={styles.statUnit}>Mag</Text>
                        </View>
                    </View>
                </View>

                {/* ═══ ④ 내 활동 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>내 활동</Text>
                    <MenuRow icon="category" label="내 구역 관리" onPress={() => router.push('/profile/my-territories')} />
                    <MenuRow icon="folder" label="스크랩북" onPress={() => router.push('/profile/scrapbook')} />
                    <MenuRow icon="ar" label="AR 모드" onPress={() => setShowAR(true)} />
                </View>

                <View style={styles.divider} />

                {/* ═══ ⑤ 결제 · 이용권 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>결제 · 이용권</Text>
                    <MenuRow icon="ticket" label="이용권 및 프로모션" onPress={() => router.push('/profile/subscription')} />
                    <MenuRow icon="swap" label="거래 내역" />
                </View>

                <View style={styles.divider} />

                {/* ═══ ⑥ 고객지원 ═══ */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>고객지원</Text>
                    <MenuRow icon="customer_service" label="고객센터" onPress={() => router.push('/profile/customer-service')} />
                    <MenuRow icon="logout" label="로그아웃" onPress={() => setShowLogoutModal(true)} />
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
                        <Text style={styles.modalTitle}>로그아웃 하시겠습니까?</Text>
                        <Text style={styles.modalBody}>주요 서비스 이용을 위해 다시 로그인해야 합니다.</Text>
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLogoutModal(false)}>
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleLogout}>
                                <Text style={styles.modalConfirmText}>확인</Text>
                            </TouchableOpacity>
                        </View>
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
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 14,
        gap: 14,
    },
    avatarPlaceholder: {
        width: 48, height: 48, borderRadius: 30,
        backgroundColor: '#EBECF1',
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 48, height: 48, borderRadius: 30,
    },
    profileInfo: { flex: 1, gap: 4 },
    userName: { fontSize: 18, fontWeight: '500', color: '#1A1A1A' },
    userEmail: { fontSize: 14, color: '#999999' },

    // ═══ Balance 카드 ═══
    balanceWrapper: {
        paddingHorizontal: 16,
        marginBottom: 0,
    },
    balanceCardOuter: {
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    balanceCard: {
        paddingHorizontal: 16,
        paddingTop: 36,
        paddingBottom: 24,
        alignItems: 'center',
    },
    balanceBgImage: {
        opacity: 0.7,
        borderRadius: 6,
    },
    balanceLabelWrap: {
        marginBottom: 12,
    },
    balanceLabel: {
        fontSize: 14,
        fontWeight: '400',
        color: '#EBECF1',
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 8,
    },
    balanceValue: {
        fontSize: 34,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    balanceUnit: {
        fontSize: 14,
        fontWeight: '500',
        color: '#999999',
        marginLeft: 10,
    },
    balancePeriod: {
        fontSize: 14,
        color: '#999999',
        marginBottom: 24,
        textAlign: 'center',
    },
    buyPassBlur: {
        borderRadius: 6,
        overflow: 'hidden',
        alignSelf: 'stretch',
    },
    buyPassBtn: {
        paddingVertical: 20,
        alignItems: 'center',
        alignSelf: 'stretch',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        borderRadius: 6,
    },
    buyPassText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // ═══ 통계 ═══
    statsSection: {
        paddingHorizontal: 16,
        marginBottom: 0,
        gap: 7,
        marginTop: 20,
    },
    statCard: {
        backgroundColor: '#EAECF6',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 6,
    },
    statLabel: { fontSize: 14, color: '#707070', fontWeight: '400', marginBottom: 12 },
    statValArea: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' },
    statNumber: { fontSize: 34, fontWeight: '500', color: '#1A1A1A' },
    statNumberSm: { fontSize: 20, fontWeight: '500', color: '#1A1A1A' },
    statUnit: { fontSize: 14, fontWeight: '500', color: '#808080', marginLeft: 10 },
    statSub: { fontSize: 12, color: '#B2B2B2' },

    // ═══ 구분선 ═══
    divider: {
        height: 1,
        backgroundColor: '#EBECF1',
        marginHorizontal: 16,
    },

    // ═══ 메뉴 섹션 ═══
    menuSection: {
        paddingHorizontal: 16,
        marginBottom: 0,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3C57E9',
        marginBottom: 14,
    },
    menuRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 52,
        paddingVertical: 14,
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    menuIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
    menuLabel: { fontSize: 18, color: '#1A1A1A', fontWeight: '500' },

    // ═══ 로그아웃 모달 ═══
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: 10, paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24,
        width: '100%',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.17, shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 20 },
    modalBody: { fontSize: 16, fontWeight: '400', color: '#1A1A1A', lineHeight: 24, marginBottom: 20 },
    modalBtnRow: {
        flexDirection: 'row', gap: 12,
    },
    modalCancelBtn: {
        flex: 1, backgroundColor: '#EAECF6', borderRadius: 5, height: 48,
        alignItems: 'center', justifyContent: 'center',
    },
    modalCancelText: { color: '#1A1A1A', fontSize: 16, fontWeight: '600' },
    modalConfirmBtn: {
        flex: 1, backgroundColor: '#3C57E9', borderRadius: 5, height: 48,
        alignItems: 'center', justifyContent: 'center',
    },
    modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
