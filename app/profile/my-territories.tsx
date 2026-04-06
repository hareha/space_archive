import React, { useState, useMemo, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, DeviceEventEmitter,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { useEll, type PurchasedTerritory } from '@/components/EllContext';

// ═══════════════════════════════════════
// 분류 체계: 위경도 사분면
// ═══════════════════════════════════════
interface GroupDef { key: string; label: string; color: string }

const LAT_BANDS: GroupDef[] = [
    { key: 'np', label: '북극 (60°~90°N)', color: '#4A90D9' },
    { key: 'nl', label: '북위 (0°~60°N)', color: '#66BB6A' },
    { key: 'sl', label: '남위 (0°~60°S)', color: '#FFA726' },
    { key: 'sp', label: '남극 (60°~90°S)', color: '#AB47BC' },
];

interface Territory {
    id: string;
    token: string;
    level: number;
    lat: number;
    lng: number;
    area: string;
    magCost: number;
    occupiedDate: string;
    minerals?: string[];
    score?: number;
}

function getLatBandKey(t: Territory): string {
    if (t.lat >= 60) return 'np';
    if (t.lat >= 0) return 'nl';
    if (t.lat >= -60) return 'sl';
    return 'sp';
}

interface GroupData {
    def: GroupDef;
    items: Territory[];
    totalArea: number;
    owned: boolean;
}

function buildGroups(
    territories: Territory[],
    allDefs: GroupDef[],
    keyFn: (t: Territory) => string,
): GroupData[] {
    const byKey = new Map<string, Territory[]>();
    territories.forEach(t => {
        const k = keyFn(t);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(t);
    });
    return allDefs.map(def => {
        const items = byKey.get(def.key) || [];
        return {
            def,
            items,
            totalArea: items.length * 1740,
            owned: items.length > 0,
        };
    });
}

// 면적 표시: 0.1km² 미만이면 m², 이상이면 km²
function formatArea(areaM2: number): string {
    const km2 = areaM2 / 1000000;
    if (km2 >= 0.1) return km2.toFixed(1) + ' km²';
    return areaM2.toLocaleString() + ' m²';
}

// ═══════════════════════════════════════
// 메인
// ═══════════════════════════════════════
export default function MyTerritoriesScreen() {
    const router = useRouter();
    const { purchasedTerritories, totalOccupied, totalMagSpent, totalArea } = useEll();

    const MY_TERRITORIES: Territory[] = useMemo(() => purchasedTerritories.map(pt => ({
        ...pt,
        minerals: [],
        score: 0,
    })), [purchasedTerritories]);

    const TOTAL_COUNT = MY_TERRITORIES.length;
    const TOTAL_AREA_VAL = totalArea;

    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const groups = useMemo(() => {
        return buildGroups(MY_TERRITORIES, LAT_BANDS, getLatBandKey);
    }, [MY_TERRITORIES]);

    const navigateToDetail = useCallback((t: Territory) => {
        router.push({
            pathname: '/profile/territory-detail',
            params: {
                token: t.token,
                level: String(t.level),
                lat: String(t.lat),
                lng: String(t.lng),
                area: t.area,
                magCost: String(t.magCost),
                occupiedDate: t.occupiedDate,
                minerals: (t.minerals || []).join(','),
                score: String(t.score || 0),
            },
        });
    }, [router]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>내 구역 관리</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Status 카드 ── */}
                <View style={styles.statusRow}>
                    <View style={styles.statusCard}>
                        <Text style={styles.statusLabel}>총 개척</Text>
                        <View style={styles.statusValRow}>
                            <Text style={styles.statusValue}>{totalMagSpent}</Text>
                            <Text style={styles.statusUnit}>Mag</Text>
                        </View>
                    </View>
                    <View style={styles.statusCard}>
                        <Text style={styles.statusLabel}>총 면적</Text>
                        <View style={styles.statusValRow}>
                            {TOTAL_COUNT === 0 ? (
                                <Text style={styles.statusValue}>-</Text>
                            ) : (() => {
                                const areaM2 = TOTAL_COUNT * 1740;
                                const km2 = areaM2 / 1000000;
                                const isKm = km2 >= 0.1;
                                return (
                                    <>
                                        <Text style={styles.statusValue}>
                                            {isKm ? km2.toFixed(1) : areaM2.toLocaleString()}
                                        </Text>
                                        <Text style={styles.statusUnit}>{isKm ? 'km²' : 'm²'}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>
                </View>

                {/* ── 섹션 헤더 ── */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>{TOTAL_COUNT}개 구역</Text>
                </View>

                {/* ── 그룹 리스트 (아코디언) ── */}
                <View style={styles.groupContainer}>
                    {groups.map((group, gi) => {
                        const isOwned = group.owned;
                        const isExpanded = expandedKey === group.def.key;
                        return (
                            <View key={group.def.key}>
                                {/* 구분선 */}
                                {gi > 0 && <View style={styles.groupDivider} />}

                                {/* 그룹 헤더 */}
                                <TouchableOpacity
                                    style={styles.groupHeader}
                                    onPress={() => isOwned && setExpandedKey(prev => prev === group.def.key ? null : group.def.key)}
                                    activeOpacity={isOwned ? 0.7 : 1}
                                >
                                    <View style={styles.groupLeft}>
                                        <Ionicons name="location-outline" size={20} color={isOwned ? '#1A1A1A' : '#B2B2B2'} />
                                        <View style={styles.groupTextArea}>
                                            <Text style={[styles.groupName, !isOwned && styles.groupNameDim]}>{group.def.label}</Text>
                                            {isOwned ? (
                                                <Text style={styles.groupMeta}>
                                                    {group.items.length}개 구역 · {formatArea(group.totalArea)}
                                                </Text>
                                            ) : (
                                                <Text style={styles.groupMetaDim}>미개척</Text>
                                            )}
                                        </View>
                                    </View>
                                    {isOwned && (
                                        <View style={styles.expanderBtn}>
                                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color="#808080" />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* 확장된 구역 상세 */}
                                {isOwned && isExpanded && (
                                    <View>
                                        {/* 헤더 다음 구분선 */}
                                        <View style={styles.groupDivider} />
                                        <View style={styles.sectorList}>
                                            {group.items.map((t: Territory, ti: number) => (
                                                <TouchableOpacity
                                                    key={t.id}
                                                    style={[styles.sectorDetailRow, ti > 0 && { marginTop: 19 }]}
                                                    onPress={() => navigateToDetail(t)}
                                                    activeOpacity={0.6}
                                                >
                                                    <View style={styles.sectorContent}>
                                                        {/* 타이틀 행: 파란 바 + MAG ID */}
                                                        <View style={styles.sectorTitleRow}>
                                                            <View style={styles.sectorLeftBar} />
                                                            <Text style={styles.sectorTitle}>
                                                                MAG-L{t.level}-{t.token.slice(0, 9)}
                                                            </Text>
                                                            <Ionicons name="chevron-forward" size={20} color="#B2B2B2" />
                                                        </View>
                                                        {/* 메타 정보: 파란 바 없이 paddingLeft으로 정렬 */}
                                                        <View style={styles.sectorMeta}>
                                                            <Text style={styles.sectorCoord}>
                                                                {Math.abs(t.lat).toFixed(2)}°{t.lat >= 0 ? 'N' : 'S'} {Math.abs(t.lng).toFixed(2)}°{t.lng >= 0 ? 'E' : 'W'}
                                                            </Text>
                                                            <View style={styles.sectorMetaBottom}>
                                                                <Text style={styles.sectorMinerals}>
                                                                    {(t.minerals && t.minerals.length > 0) ? t.minerals.join(' ') : 'He-3 H2O'}
                                                                </Text>
                                                                <View style={styles.sectorDot} />
                                                                <Text style={styles.sectorArea}>
                                                                    {formatArea(1740)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {/* 확장 섹션 하단 구분선 */}
                                        <View style={styles.groupDivider} />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* 하단 버튼 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.claimBtn}
                    onPress={() => {
                        router.back();
                        DeviceEventEmitter.emit('switchToPioneer');
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={styles.claimBtnText}>추가 구역 개척</Text>
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
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    scrollContent: { paddingBottom: 120 },

    // ── Status 카드 ──
    statusRow: {
        flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 20,
    },
    statusCard: {
        flex: 1, backgroundColor: '#EAECF6', borderRadius: 6,
        padding: 14, justifyContent: 'space-between', minHeight: 90,
    },
    statusLabel: { fontSize: 13, fontWeight: '400', color: '#707070' },
    statusValRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 },
    statusValue: { fontSize: 28, fontWeight: '600', color: '#1A1A1A' },
    statusUnit: { fontSize: 12, fontWeight: '500', color: '#999', paddingBottom: 1 },

    // ── 섹션 헤더 ──
    sectionHeaderRow: { paddingHorizontal: 16, paddingTop: 40 },
    sectionHeader: { fontSize: 14, fontWeight: '500', color: '#3C57E9' },

    // ── 그룹 컨테이너 ──
    groupContainer: { paddingHorizontal: 16 },
    groupDivider: { height: 1, backgroundColor: '#EBECF1' },

    // ── 그룹 헤더 ──
    groupHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 7,
    },
    groupLeft: {
        flex: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
        paddingVertical: 14,
    },
    groupTextArea: { flex: 1, gap: 5 },
    groupName: { fontSize: 16, fontWeight: '500', color: '#1A1A1A' },
    groupNameDim: { color: '#B2B2B2' },
    groupMeta: { fontSize: 14, fontWeight: '400', color: '#3B4576' },
    groupMetaDim: { fontSize: 14, fontWeight: '400', color: '#B2B2B2' },
    expanderBtn: {
        width: 24, height: 24, borderRadius: 15,
        backgroundColor: '#EBECF1',
        justifyContent: 'center', alignItems: 'center',
    },

    // ── 구역 상세 (확장) ──
    sectorList: {
        paddingLeft: 30, paddingVertical: 22,
    },
    sectorDetailRow: {
    },
    sectorContent: { gap: 3 },
    sectorTitleRow: {
        flexDirection: 'row', alignItems: 'center',
    },
    sectorLeftBar: {
        width: 4, backgroundColor: '#3C57E9', alignSelf: 'stretch', marginRight: 14,
    },
    sectorTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1A1A1A' },
    sectorMeta: { paddingLeft: 18, gap: 2 },
    sectorCoord: { fontSize: 14, fontWeight: '400', color: '#999999', lineHeight: 21 },
    sectorMetaBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectorMinerals: { fontSize: 12, fontWeight: '400', color: '#3B4576', lineHeight: 17 },
    sectorDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#999999' },
    sectorArea: { fontSize: 12, fontWeight: '400', color: '#999999', lineHeight: 17 },

    // ── 하단 버튼 ──
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: 36,
        backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.06, shadowRadius: 4,
        elevation: 4,
    },
    claimBtn: {
        backgroundColor: '#3C57E9', borderRadius: 5,
        height: 56, alignItems: 'center', justifyContent: 'center',
    },
    claimBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
