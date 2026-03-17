import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, StatusBar, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

export default function PersonalInfoScreen() {
    const router = useRouter();
    const [nickname, setNickname] = useState('Explorer_2847');
    const [email] = useState('explorer@lunamap.com');
    const [phone, setPhone] = useState('+82 10-1234-5678');
    const [isModified, setIsModified] = useState(false);

    const handleNicknameChange = (text: string) => {
        setNickname(text);
        setIsModified(true);
    };

    const handlePhoneChange = (text: string) => {
        setPhone(text);
        setIsModified(true);
    };

    const handleSave = () => {
        // TODO: 변경사항 저장 로직
        setIsModified(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>개인정보 설정</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 기본 프로필 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>기본 프로필</Text>
                    <Text style={styles.sectionDesc}>계정 상세 정보 및 연락처를 업데이트하세요.</Text>

                    {/* 닉네임 */}
                    <Text style={styles.fieldLabel}>닉네임</Text>
                    <TextInput
                        style={styles.textInput}
                        value={nickname}
                        onChangeText={handleNicknameChange}
                        placeholder="닉네임을 입력하세요"
                        placeholderTextColor="#BDBDBD"
                    />

                    {/* 이메일 (수정 불가) */}
                    <Text style={styles.fieldLabel}>이메일</Text>
                    <View style={styles.readOnlyInput}>
                        <Text style={styles.readOnlyText}>{email}</Text>
                    </View>

                    {/* 휴대폰 번호 */}
                    <Text style={styles.fieldLabel}>휴대폰 번호</Text>
                    <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={handlePhoneChange}
                        placeholder="+82 10-0000-0000"
                        placeholderTextColor="#BDBDBD"
                        keyboardType="phone-pad"
                    />
                </View>
            </ScrollView>

            {/* 변경사항 저장 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.saveBtn, !isModified && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isModified}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.saveBtnText, !isModified && styles.saveBtnTextDisabled]}>
                        변경사항 저장
                    </Text>
                </TouchableOpacity>
            </View>
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
    scrollContent: { paddingBottom: 120 },

    section: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
    sectionDesc: { fontSize: 13, color: '#9E9E9E', marginBottom: 28 },

    fieldLabel: { fontSize: 12, color: '#9E9E9E', fontWeight: '500', marginBottom: 8, marginTop: 20 },
    textInput: {
        backgroundColor: '#F7F7FA', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
        fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#EFEFEF',
    },
    readOnlyInput: {
        backgroundColor: '#F0F0F0', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
        borderWidth: 1, borderColor: '#E8E8E8',
    },
    readOnlyText: { fontSize: 15, color: '#9E9E9E' },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 36,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    saveBtn: {
        backgroundColor: '#4A90D9', borderRadius: 12, paddingVertical: 16, alignItems: 'center',
    },
    saveBtnDisabled: { backgroundColor: '#E0E0E0' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    saveBtnTextDisabled: { color: '#BDBDBD' },
});
