import React, { useState, useMemo, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 6;
const CARD_SIZE = (width - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_PAGE_SIZE = 30;

// ═══════════════════════════════════════
// 분류 체계 A: S2 Face (0~5)
// ═══════════════════════════════════════
interface GroupDef { key: string; label: string; emoji: string; color: string }

const S2_FACES: GroupDef[] = [
    { key: 'f0', label: 'Face 0', emoji: '🟦', color: '#4A90D9' },
    { key: 'f1', label: 'Face 1', emoji: '🟩', color: '#66BB6A' },
    { key: 'f2', label: 'Face 2', emoji: '🟨', color: '#FFD54F' },
    { key: 'f3', label: 'Face 3', emoji: '🟧', color: '#FFA726' },
    { key: 'f4', label: 'Face 4', emoji: '🟪', color: '#AB47BC' },
    { key: 'f5', label: 'Face 5', emoji: '🟫', color: '#8D6E63' },
];

function getS2Face(token: string): number {
    const h = parseInt(token[0], 16);
    if (h <= 2) return 0;
    if (h <= 5) return 1;
    if (h <= 8) return 2;
    if (h <= 11) return 3;
    if (h <= 13) return 4;
    return 5;
}

function getFaceGroupKey(t: Territory): string {
    return 'f' + getS2Face(t.token);
}

// ═══════════════════════════════════════
// 분류 체계 B: 위경도 사분면
// ═══════════════════════════════════════
const LAT_BANDS: GroupDef[] = [
    { key: 'np', label: '북극 (60°~90°N)', emoji: '❄️', color: '#4A90D9' },
    { key: 'nl', label: '북위 (0°~60°N)',  emoji: '🔵', color: '#66BB6A' },
    { key: 'sl', label: '남위 (0°~60°S)',  emoji: '🟠', color: '#FFA726' },
    { key: 'sp', label: '남극 (60°~90°S)', emoji: '🧊', color: '#AB47BC' },
];

function getLatBandKey(t: Territory): string {
    if (t.lat >= 60) return 'np';
    if (t.lat >= 0) return 'nl';
    if (t.lat >= -60) return 'sl';
    return 'sp';
}

// ═══════════════════════════════════════
// 데이터
// ═══════════════════════════════════════
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

const MY_TERRITORIES: Territory[] = [
    // 북극 (60°~90°N) — 3구역
    { id: 'T001', token: '1a2b3c4d', level: 15, lat: 72.5, lng: 15.3, area: '2.6', magCost: 4, occupiedDate: '2025.11.20', minerals: ['He-3', 'H₂O'], score: 94 },
    { id: 'T002', token: '1a2b3c54', level: 15, lat: 70.8, lng: 16.1, area: '2.6', magCost: 4, occupiedDate: '2025.11.21', minerals: ['He-3'], score: 91 },
    { id: 'T003', token: '1a2b3c5c', level: 15, lat: 74.2, lng: -30.5, area: '2.5', magCost: 4, occupiedDate: '2026.01.05', minerals: ['H₂O', 'FeO'], score: 88 },
    // 북위 (0°~60°N) — 3구역
    { id: 'T004', token: '3c4a1b2f', level: 15, lat: 0.67, lng: 23.47, area: '3.2', magCost: 4, occupiedDate: '2025.12.15', minerals: ['FeO', 'TiO₂'], score: 87 },
    { id: 'T005', token: '3c4a1b34', level: 15, lat: 18.2, lng: -54.3, area: '3.1', magCost: 4, occupiedDate: '2026.01.10', minerals: ['TiO₂', 'MgO'], score: 72 },
    { id: 'T006', token: '5a7f42e4', level: 15, lat: 45.6, lng: 88.2, area: '2.9', magCost: 4, occupiedDate: '2026.02.01', minerals: ['MgO'], score: 68 },
    // 남위 (0°~60°S) — 3구역
    { id: 'T007', token: '7b12d8a4', level: 15, lat: -21.3, lng: -16.6, area: '3.0', magCost: 4, occupiedDate: '2026.02.28', minerals: ['SiO₂', 'CaO'], score: 54 },
    { id: 'T008', token: '7b12d8ac', level: 15, lat: -43.3, lng: -11.2, area: '2.8', magCost: 4, occupiedDate: '2026.03.05', minerals: ['Al₂O₃', 'FeO', 'U'], score: 93 },
    { id: 'T009', token: '9d456f1c', level: 15, lat: -15.7, lng: 45.8, area: '3.1', magCost: 4, occupiedDate: '2026.03.08', minerals: ['TiO₂'], score: 70 },
    // 남극 (60°~90°S) — 3구역
    { id: 'T010', token: '9d456f24', level: 15, lat: -65.4, lng: -22.1, area: '2.5', magCost: 4, occupiedDate: '2026.03.10', minerals: ['H₂O', 'He-3'], score: 96 },
    { id: 'T011', token: 'bc78ef12', level: 15, lat: -71.8, lng: 50.3, area: '2.4', magCost: 4, occupiedDate: '2026.03.11', minerals: ['H₂O'], score: 92 },
    { id: 'T012', token: 'bc78ef1a', level: 15, lat: -75.2, lng: -80.6, area: '2.3', magCost: 4, occupiedDate: '2026.03.12', minerals: ['He-3', 'Al₂O₃'], score: 90 },
];

// ─── 그룹 생성 ───
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
            totalArea: items.reduce((s, i) => s + parseFloat(i.area), 0),
            owned: items.length > 0,
        };
    });
}

// ─── 통계 ───
const TOTAL_COUNT = MY_TERRITORIES.length;
const TOTAL_MAG = MY_TERRITORIES.reduce((s, t) => s + t.magCost, 0);
const TOTAL_AREA = MY_TERRITORIES.reduce((s, t) => s + parseFloat(t.area), 0);

function scoreColor(score: number) {
    if (score >= 80) return '#4A90D9';
    if (score >= 60) return '#66BB6A';
    if (score >= 40) return '#FFA726';
    return '#EF5350';
}

// territory → 현재 분류의 색상
function getGroupColor(t: Territory, classify: 'face' | 'quadrant'): string {
    if (classify === 'face') return S2_FACES[getS2Face(t.token)].color;
    const q = getLatBandKey(t);
    return LAT_BANDS.find((x: GroupDef) => x.key === q)?.color || '#999';
}

// ═══════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════
type ClassifyMode = 'face' | 'quadrant';

export default function MyTerritoriesScreen() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [classify, setClassify] = useState<ClassifyMode>('quadrant');
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [gridPage, setGridPage] = useState(1);

    const groups = useMemo(() => {
        if (classify === 'face') return buildGroups(MY_TERRITORIES, S2_FACES, getFaceGroupKey);
        return buildGroups(MY_TERRITORIES, LAT_BANDS, getLatBandKey);
    }, [classify]);

    const gridVisible = MY_TERRITORIES.slice(0, gridPage * GRID_PAGE_SIZE);

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

    const handleScroll = useCallback((e: any) => {
        if (viewMode !== 'grid') return;
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
        const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
        if (dist < 200 && gridVisible.length < MY_TERRITORIES.length) {
            setGridPage(p => p + 1);
        }
    }, [viewMode, gridVisible.length]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>내 구역 관리</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={200}
            >
                {/* ── 대시보드 ── */}
                <View style={styles.dashboard}>
                    <DashCell label="총 보유 구역" value={String(TOTAL_COUNT)} unit="구역" />
                    <View style={styles.dashDivider} />
                    <DashCell label="점유 Mag" value={String(TOTAL_MAG)} unit="Mag" />
                    <View style={styles.dashDivider} />
                    <DashCell label="총 면적" value={TOTAL_AREA.toFixed(1)} unit="km²" />
                </View>

                {/* ── 분류 기준 선택 + 뷰 토글 ── */}
                <View style={styles.controlRow}>
                    {/* 분류 기준 */}
                    <View style={styles.classifyToggle}>
                        <TouchableOpacity
                            style={[styles.classifyBtn, classify === 'quadrant' && styles.classifyBtnActive]}
                            onPress={() => { setClassify('quadrant'); setExpandedKey(null); }}
                        >
                            <Text style={[styles.classifyText, classify === 'quadrant' && styles.classifyTextActive]}>위경도</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.classifyBtn, classify === 'face' && styles.classifyBtnActive]}
                            onPress={() => { setClassify('face'); setExpandedKey(null); }}
                        >
                            <Text style={[styles.classifyText, classify === 'face' && styles.classifyTextActive]}>S2 Face</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 뷰 모드 */}
                    <View style={styles.viewToggle}>
                        <TouchableOpacity
                            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                            onPress={() => setViewMode('list')}
                        >
                            <Ionicons name="list" size={16} color={viewMode === 'list' ? '#fff' : '#999'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                            onPress={() => setViewMode('grid')}
                        >
                            <Ionicons name="grid" size={16} color={viewMode === 'grid' ? '#fff' : '#999'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ═══ 리스트 (아코디언) 뷰 ═══ */}
                {viewMode === 'list' && groups.map(group => {
                    const isOwned = group.owned;
                    const isExpanded = expandedKey === group.def.key;
                    return (
                        <View key={group.def.key} style={[styles.groupRow, !isOwned && styles.groupRowDim]}>
                            <TouchableOpacity
                                style={styles.groupHeader}
                                onPress={() => isOwned && setExpandedKey(prev => prev === group.def.key ? null : group.def.key)}
                                activeOpacity={isOwned ? 0.7 : 1}
                            >
                                {/* 색상 도트 */}
                                <View style={[styles.groupDot, { backgroundColor: isOwned ? group.def.color : '#E0E0E0' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.groupName, !isOwned && styles.groupNameDim]}>{group.def.label}</Text>
                                    {isOwned ? (
                                        <Text style={styles.groupMeta}>{group.items.length}구역 · {group.totalArea.toFixed(1)} km²</Text>
                                    ) : (
                                        <Text style={styles.groupMetaDim}>미점유</Text>
                                    )}
                                </View>
                                {isOwned && (
                                    <View style={[styles.groupCountBadge, { backgroundColor: group.def.color + '20' }]}>
                                        <Text style={[styles.groupCountText, { color: group.def.color }]}>{group.items.length}</Text>
                                    </View>
                                )}
                                {isOwned && <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#BDBDBD" />}
                            </TouchableOpacity>

                            {isOwned && isExpanded && (
                                <View style={styles.groupBody}>
                                    {group.items.map((t: Territory) => (
                                        <TouchableOpacity key={t.id} style={styles.compactRow} onPress={() => navigateToDetail(t)} activeOpacity={0.6}>
                                            <View style={[styles.compactColorBar, { backgroundColor: group.def.color }]} />
                                            <View style={styles.rowLeft}>
                                                <Text style={styles.rowToken}>{t.token}</Text>
                                                <Text style={styles.rowCoord}>
                                                    {Math.abs(t.lat).toFixed(2)}°{t.lat >= 0 ? 'N' : 'S'} {Math.abs(t.lng).toFixed(2)}°{t.lng >= 0 ? 'E' : 'W'}
                                                </Text>
                                            </View>
                                            <View style={styles.rowMid}>
                                                {t.minerals && t.minerals.slice(0, 2).map((m: string, i: number) => (
                                                    <Text key={i} style={styles.rowMineral}>{m}</Text>
                                                ))}
                                            </View>
                                            <View style={styles.rowRight}>
                                                {t.score && <Text style={[styles.rowScore, { color: scoreColor(t.score) }]}>⚡{t.score}</Text>}
                                                <Text style={styles.rowArea}>{t.area} km²</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color="#D0D0D0" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* ═══ 그리드 뷰 (색상 = 구역 색상) ═══ */}
                {viewMode === 'grid' && (
                    <>
                        <View style={styles.gridContainer}>
                            {gridVisible.map(t => {
                                const gColor = getGroupColor(t, classify);
                                return (
                                    <TouchableOpacity key={t.id} style={styles.gridTile} onPress={() => navigateToDetail(t)} activeOpacity={0.7}>
                                        <View style={[styles.gridTileBar, { backgroundColor: gColor }]} />
                                        <Text style={styles.gridTileToken} numberOfLines={1}>{t.token}</Text>
                                        <Text style={styles.gridTileCoord} numberOfLines={1}>
                                            {Math.abs(t.lat).toFixed(1)}°{t.lat >= 0 ? 'N' : 'S'}
                                        </Text>
                                        <Text style={styles.gridTileArea}>{t.area} km²</Text>
                                        {t.score && <Text style={[styles.gridTileScore, { color: gColor }]}>⚡{t.score}</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {/* 범례 */}
                        <View style={styles.legendRow}>
                            {(classify === 'face' ? S2_FACES : LAT_BANDS).map(d => (
                                <View key={d.key} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                                    <Text style={styles.legendLabel}>{d.label}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.gridCounter}>{gridVisible.length} / {MY_TERRITORIES.length}개 구역</Text>
                    </>
                )}

                {/* ── 새 구역 점유 ── */}
                <TouchableOpacity style={styles.addCard} onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
                    <Ionicons name="add-circle-outline" size={18} color="#4A90D9" />
                    <Text style={styles.addCardText}>새 구역 점유하기</Text>
                </TouchableOpacity>
            </ScrollView>

            </SafeAreaView>
    );
}

// ─── 서브 컴포넌트 ───
function DashCell({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <View style={styles.dashCell}>
            <Text style={styles.dashLabel}>{label}</Text>
            <View style={styles.dashValueRow}>
                <Text style={styles.dashValue}>{value}</Text>
                <Text style={styles.dashUnit}>{unit}</Text>
            </View>
        </View>
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

    // ── 대시보드 ──
    dashboard: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 16, marginBottom: 4,
        backgroundColor: '#F7F7FA', borderRadius: 14,
        paddingVertical: 18, paddingHorizontal: 6,
    },
    dashCell: { flex: 1, alignItems: 'center' },
    dashDivider: { width: 1, height: 36, backgroundColor: '#E8E8E8' },
    dashLabel: { fontSize: 11, fontWeight: '600', color: '#9E9E9E', marginBottom: 6 },
    dashValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    dashValue: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
    dashUnit: { fontSize: 12, fontWeight: '600', color: '#BDBDBD' },

    // ── 컨트롤 행 (분류+뷰) ──
    controlRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    classifyToggle: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 8, padding: 2 },
    classifyBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    classifyBtnActive: { backgroundColor: '#1A1A1A' },
    classifyText: { fontSize: 12, fontWeight: '600', color: '#999' },
    classifyTextActive: { color: '#fff' },
    viewToggle: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 8, padding: 2 },
    viewToggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    viewToggleBtnActive: { backgroundColor: '#1A1A1A' },

    // ── 아코디언 그룹 ──
    groupRow: { marginHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    groupRowDim: { opacity: 0.4 },
    groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 },
    groupDot: { width: 14, height: 14, borderRadius: 4 },
    groupName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 1 },
    groupNameDim: { color: '#BDBDBD' },
    groupMeta: { fontSize: 12, color: '#9E9E9E' },
    groupMetaDim: { fontSize: 12, color: '#D0D0D0' },
    groupCountBadge: {
        borderRadius: 10, minWidth: 24, height: 24,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 6,
    },
    groupCountText: { fontSize: 11, fontWeight: '700' },
    groupBody: { paddingBottom: 8 },

    // ── 컴팩트 행 ──
    compactRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 11, paddingLeft: 0, paddingRight: 4,
        borderTopWidth: 1, borderTopColor: '#F7F7F7',
    },
    compactColorBar: { width: 3, height: 32, borderRadius: 2, marginRight: 10 },
    rowLeft: { width: 106 },
    rowToken: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 2, fontFamily: 'monospace' },
    rowCoord: { fontSize: 10, color: '#BDBDBD' },
    rowMid: { flex: 1, flexDirection: 'row', gap: 6 },
    rowMineral: { fontSize: 11, color: '#9E9E9E', fontWeight: '500' },
    rowRight: { alignItems: 'flex-end', marginRight: 8 },
    rowScore: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    rowArea: { fontSize: 10, color: '#BDBDBD' },

    // ── 그리드 ──
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: 16 },
    gridTile: {
        width: CARD_SIZE, backgroundColor: '#F7F7FA', borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 8, overflow: 'hidden',
    },
    gridTileBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
    gridTileToken: { fontSize: 11, fontWeight: '800', color: '#1A1A1A', marginBottom: 1, fontFamily: 'monospace' },
    gridTileCoord: { fontSize: 9, color: '#BDBDBD', marginBottom: 3 },
    gridTileArea: { fontSize: 10, color: '#666', fontWeight: '500' },
    gridTileScore: { fontSize: 10, fontWeight: '700', marginTop: 2 },

    // ── 범례 ──
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 10, color: '#9E9E9E' },

    gridCounter: { textAlign: 'center', fontSize: 12, color: '#BDBDBD', paddingVertical: 10 },

    // ── 추가 ──
    addCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginHorizontal: 16, marginTop: 4, paddingVertical: 14,
        borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E0E0', borderStyle: 'dashed', gap: 6,
    },
    addCardText: { fontSize: 13, fontWeight: '600', color: '#4A90D9' },
});
