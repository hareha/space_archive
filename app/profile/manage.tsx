import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, Modal, Image, Alert, ActivityIndicator, Platform, ActionSheetIOS } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/services/supabase';
import * as ImagePicker from 'expo-image-picker';

function MenuRow({ icon, label, onPress, color }: { icon: string; label: string; onPress?: () => void; color?: string }) {
    return (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.menuRowLeft}>
                <Ionicons name={icon as any} size={22} color={color || '#1A1A1A'} style={{ width: 22, textAlign: 'center' as const }} />
                <Text style={[styles.menuLabel, color ? { color } : null]}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function ProfileManageScreen() {
    const router = useRouter();
    const { user, logout, refreshUser } = useAuth();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(user?.avatarUrl || null);

    const handleLogout = async () => {
        setShowLogoutModal(false);
        await logout();
        router.replace('/(tabs)/mypage');
    };

    // ── 프로필 사진 선택 (네이티브 다이얼로그) ──
    const handlePickImage = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['취소', '앨범에서 선택', '카메라로 촬영', '기본 이미지로 변경'],
                    destructiveButtonIndex: 3,
                    cancelButtonIndex: 0,
                    title: '프로필 사진 변경',
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) pickFromGallery();
                    else if (buttonIndex === 2) pickFromCamera();
                    else if (buttonIndex === 3) resetAvatar();
                }
            );
        } else {
            Alert.alert('프로필 사진 변경', '', [
                { text: '앨범에서 선택', onPress: pickFromGallery },
                { text: '카메라로 촬영', onPress: pickFromCamera },
                { text: '기본 이미지로 변경', onPress: resetAvatar, style: 'destructive' },
                { text: '취소', style: 'cancel' },
            ]);
        }
    };

    const pickFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert('오류', '앨범을 열 수 없습니다. 설정에서 사진 접근 권한을 확인해주세요.');
        }
    };

    const pickFromCamera = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다. 설정에서 변경해주세요.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
                await uploadAvatar(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert('오류', '카메라를 열 수 없습니다. 설정에서 카메라 권한을 확인해주세요.');
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!user) return;
        setUploading(true);
        try {
            // React Native: fetch → arrayBuffer로 변환
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 2MB 제한
            if (uint8Array.length > 2 * 1024 * 1024) {
                Alert.alert('파일 크기 초과', '프로필 사진은 2MB 이하만 가능합니다.');
                setUploading(false);
                return;
            }

            const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
            const filePath = `${user.id}/avatar.${ext}`;

            // Supabase Storage 업로드
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, uint8Array, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType,
                });

            if (uploadError) {
                console.error('[Avatar] upload error:', uploadError);
                Alert.alert('업로드 실패', uploadError.message);
                return;
            }

            // public URL 가져오기
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 캐시 방지용 타임스탬프 추가
            const avatarUrl = `${publicUrl}?t=${Date.now()}`;

            // DB 업데이트
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (updateError) {
                Alert.alert('저장 실패', updateError.message);
                return;
            }

            // 즉시 로컬 반영 + 전역 상태 갱신
            setLocalAvatarUri(avatarUrl);
            await refreshUser();
            Alert.alert('완료', '프로필 사진이 변경되었습니다.');
        } catch (e: any) {
            console.error('[Avatar] error:', e);
            Alert.alert('오류', '이미지 업로드 중 문제가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const resetAvatar = async () => {
        if (!user) return;
        setUploading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ avatar_url: null, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (error) {
                Alert.alert('실패', error.message);
            } else {
                setLocalAvatarUri(null);
                await refreshUser();
                Alert.alert('완료', '기본 이미지로 변경되었습니다.');
            }
        } catch {
            Alert.alert('오류', '네트워크 연결을 확인해주세요.');
        } finally {
            setUploading(false);
        }
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
                    <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={handlePickImage}
                        activeOpacity={0.7}
                        disabled={uploading}
                    >
                        <View style={styles.avatarLarge}>
                            {uploading ? (
                                <ActivityIndicator size="large" color="#9E9E9E" />
                            ) : localAvatarUri ? (
                                <Image
                                    source={{ uri: localAvatarUri }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <Image source={require('@/assets/images/sailor.png')} style={styles.avatarImage} />
                            )}
                        </View>
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={14} color="#1A1A1A" />
                            <Text style={styles.editBadgeText}>Edit</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 계정 관리 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>계정 관리</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow
                            icon="shield-checkmark-outline"
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

                <View style={styles.sectionDivider} />

                {/* 기타 */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionLabel}>기타</Text>
                    <View style={styles.menuGroup}>
                        <MenuRow
                            icon="log-out-outline"
                            label="로그아웃"
                            onPress={() => setShowLogoutModal(true)}
                        />
                    </View>
                </View>

                {/* 하단 회원탈퇴 */}
                <View style={styles.deleteSection}>
                    <TouchableOpacity onPress={() => router.push('/profile/withdraw')} activeOpacity={0.6}>
                        <Text style={styles.deleteText}>회원 탈퇴</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* 로그아웃 모달 */}
            <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 40 },

    // 프로필 이미지
    profileImageSection: {
        alignItems: 'center', paddingVertical: 20,
    },
    avatarWrapper: {
        width: 151, height: 167,
        alignItems: 'center',
    },
    avatarLarge: {
        width: 151, height: 151, borderRadius: 80,
        backgroundColor: '#EBECF1', justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 151, height: 151, borderRadius: 80,
    },
    editBadge: {
        position: 'absolute', bottom: 0,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1, borderColor: '#EBECF1',
        borderRadius: 17, paddingHorizontal: 14, paddingVertical: 7,
        gap: 6,
    },
    editBadgeText: {
        fontSize: 14, fontWeight: '500', color: '#1A1A1A',
    },

    // 메뉴 섹션
    menuSection: {
        paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0,
    },
    sectionLabel: { fontSize: 14, fontWeight: '500', color: '#3C57E9', marginTop: 14, marginBottom: 0 },
    menuGroup: { marginTop: 0 },
    sectionDivider: {
        height: 1, backgroundColor: '#EBECF1', marginHorizontal: 16,
    },
    menuRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        height: 52, paddingVertical: 14,
    },
    menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    menuLabel: { fontSize: 18, color: '#1A1A1A', fontWeight: '500' },

    // 하단 회원탈퇴
    deleteSection: {
        paddingHorizontal: 16, paddingTop: 131, paddingBottom: 20,
    },
    deleteText: {
        fontSize: 14, color: '#999999', fontWeight: '400',
    },

    // 모달
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

    // 사진 선택 바텀시트
    sheetOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheetContent: {
        backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: {
        fontSize: 17, fontWeight: '700', color: '#1A1A1A',
        marginBottom: 16, textAlign: 'center',
    },
    sheetBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 16, paddingHorizontal: 16,
        backgroundColor: '#F7F7FA', borderRadius: 12,
        marginBottom: 8,
    },
    sheetBtnText: {
        flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A1A',
        marginLeft: 14,
    },
    sheetCancelBtn: {
        paddingVertical: 16, alignItems: 'center',
        backgroundColor: '#F0F0F0', borderRadius: 12, marginTop: 4,
    },
    sheetCancelText: { fontSize: 15, fontWeight: '600', color: '#9E9E9E' },
});
