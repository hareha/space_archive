import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

function MenuRow({ icon, label, onPress, color }: { icon: string; label: string; onPress?: () => void; color?: string }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.menuRowLeft}>
                <Ionicons name={icon as any} size={20} color={color || '#555'} style={{ marginRight: 14 }} />
                <Text style={[styles.menuLabel, color ? { color } : null]}>{label}</Text>
            </View>
            {!color && <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />}
        </TouchableOpacity>
    );
}

export default function ProfileManageScreen() {
    const router = useRouter();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogout = () => {
        setShowLogoutModal(false);
        // TODO: 실제 로그아웃 처리
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>프로필 관리</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 프로필 이미지 */}
                <View style={styles.profileImageSection}>
                    <View style={styles.avatarLarge}>
                        <Ionicons name="person" size={48} color="#BDBDBD" />
                        <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.7}>
                            <Ionicons name="camera" size={14} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 내 계정 관리 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>내 계정 관리</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow
                            icon="person-outline"
                            label="개인정보 설정"
                            onPress={() => router.push('/profile/personal-info')}
                        />
                        <MenuRow
                            icon="lock-closed-outline"
                            label="비밀번호 변경"
                            onPress={() => router.push('/profile/change-password')}
                        />
                    </View>
                </View>

                {/* 기타 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>기타</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow
                            icon="log-out-outline"
                            label="로그아웃"
                            onPress={() => setShowLogoutModal(true)}
                        />
                        <MenuRow
                            icon="person-remove-outline"
                            label="회원 탈퇴"
                            color="#E53935"
                            onPress={() => router.push('/profile/withdraw')}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* 로그아웃 모달 */}
            <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
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

    // 프로필 이미지
    profileImageSection: {
        alignItems: 'center', paddingVertical: 32,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    avatarLarge: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center',
        position: 'relative',
    },
    cameraBtn: {
        position: 'absolute', bottom: 0, right: 0,
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: '#9E9E9E', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#fff',
    },

    // 메뉴 섹션
    menuSection: {
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6,
        borderBottomWidth: 8, borderBottomColor: '#F5F5F5',
    },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: '#9E9E9E', marginBottom: 4 },
    menuGroup: { marginTop: 4 },
    menuRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
    menuLabel: { fontSize: 15, color: '#333', fontWeight: '400' },

    // 모달
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
