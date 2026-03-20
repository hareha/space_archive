import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    SafeAreaView, Dimensions, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { createCesiumHtml } from '@/constants/cesium/CesiumHtml';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 260;

// ─── 구역 데이터 (my-territories와 공유) ───
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

// 광물 상세 정보
const MINERAL_INFO: Record<string, { name: string; icon: string; color: string; desc: string }> = {
    'FeO': { name: '산화철', icon: '⚫', color: '#B0BEC5', desc: '건축 자재, 산소 추출' },
    'TiO₂': { name: '티타늄', icon: '🔩', color: '#78909C', desc: '고강도 합금, 태양전지' },
    'He-3': { name: '헬륨-3', icon: '⚡', color: '#FFD54F', desc: '핵융합 연료' },
    'H₂O': { name: '물/얼음', icon: '💧', color: '#4FC3F7', desc: '생명유지, 로켓연료' },
    'MgO': { name: '마그네슘', icon: '🟢', color: '#81C784', desc: '경량 합금, 내열재' },
    'SiO₂': { name: '규소', icon: '💎', color: '#CE93D8', desc: '반도체, 유리 제조' },
    'CaO': { name: '칼슘', icon: '🦴', color: '#FFCC80', desc: '시멘트, 건설 자재' },
    'Al₂O₃': { name: '알루미늄', icon: '🪶', color: '#90CAF9', desc: '경량 구조재' },
    'U': { name: '우라늄', icon: '☢️', color: '#EF5350', desc: '원자력 에너지' },
};

// 보유 기간 계산
function daysSince(dateStr: string): number {
    const [y, m, d] = dateStr.split('.').map(Number);
    const past = new Date(y, m - 1, d);
    const now = new Date(2026, 2, 16); // 현재 시뮬레이션 날짜
    return Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
}

function scoreColor(score: number) {
    if (score >= 80) return '#4A90D9';
    if (score >= 60) return '#66BB6A';
    if (score >= 40) return '#FFA726';
    return '#EF5350';
}

function scoreLabel(score: number) {
    if (score >= 90) return '최상급';
    if (score >= 80) return '우수';
    if (score >= 60) return '양호';
    if (score >= 40) return '보통';
    return '낮음';
}

export default function TerritoryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        token: string; level: string; lat: string; lng: string;
        area: string; magCost: string; occupiedDate: string;
        minerals: string; score: string;
    }>();

    const webviewRef = useRef<WebView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // 파라미터 → 구역 객체
    const territory: Territory = useMemo(() => ({
        id: params.token || '',
        token: params.token || '',
        level: Number(params.level) || 15,
        lat: Number(params.lat) || 0,
        lng: Number(params.lng) || 0,
        area: params.area || '0',
        magCost: Number(params.magCost) || 0,
        occupiedDate: params.occupiedDate || '',
        minerals: params.minerals ? params.minerals.split(',') : [],
        score: Number(params.score) || 0,
    }), [params]);

    const days = daysSince(territory.occupiedDate);
    const sc = territory.score || 0;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    // CesiumJS 로드 후 해당 좌표로 카메라 이동 + 셀 하이라이트
    const onWebViewLoad = () => {
        const flyScript = `
            (function() {
                var attempts = 0;
                var maxAttempts = 60; // 30초간 재시도
                function waitAndFly() {
                    attempts++;
                    if (attempts > maxAttempts) {
                        console.log('[Detail] Gave up waiting for tileset');
                        return;
                    }
                    // viewer와 tileset 모두 준비될 때까지 대기
                    if (!window.viewer || !window.tilesetReady) {
                        setTimeout(waitAndFly, 500);
                        return;
                    }
                    
                    var viewer = window.viewer;
                    var lat = ${territory.lat};
                    var lng = ${territory.lng};
                    var latRad = Cesium.Math.toRadians(lat);
                    var lngRad = Cesium.Math.toRadians(lng);
                    
                    // 모든 자동 회전 완전 차단
                    window._autoRotate = false;
                    var origRotate = viewer.camera.rotate.bind(viewer.camera);
                    viewer.camera.rotate = function() {}; // 자동 회전 no-op
                    
                    // Moon Ellipsoid 기반 좌표 계산
                    var moonRadius = Cesium.Ellipsoid.MOON.maximumRadius;
                    var altitude = 3000; // 3km 상공
                    var r = moonRadius + altitude;
                    var cosLat = Math.cos(latRad);
                    var dest = new Cesium.Cartesian3(
                        r * cosLat * Math.cos(lngRad),
                        r * cosLat * Math.sin(lngRad),
                        r * Math.sin(latRad)
                    );
                    
                    // 표면 기준점 (법선 벡터 계산용)
                    var surfR = moonRadius;
                    var surfPoint = new Cesium.Cartesian3(
                        surfR * cosLat * Math.cos(lngRad),
                        surfR * cosLat * Math.sin(lngRad),
                        surfR * Math.sin(latRad)
                    );
                    
                    // 카메라 이동 (거의 수직으로 내려다봄)
                    viewer.camera.flyTo({
                        destination: dest,
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-80),
                            roll: 0
                        },
                        duration: 1.5,
                        complete: function() {
                            console.log('[Detail] Camera flyTo complete');
                        }
                    });
                    
                    // 셀 하이라이트 (L15 ≈ 약 0.005°)
                    var d = 0.004;
                    var polyPositions = [];
                    var corners = [
                        [lng - d, lat - d],
                        [lng + d, lat - d],
                        [lng + d, lat + d],
                        [lng - d, lat + d]
                    ];
                    corners.forEach(function(c) {
                        var cLatR = Cesium.Math.toRadians(c[1]);
                        var cLngR = Cesium.Math.toRadians(c[0]);
                        var cCosLat = Math.cos(cLatR);
                        polyPositions.push(new Cesium.Cartesian3(
                            surfR * cCosLat * Math.cos(cLngR),
                            surfR * cCosLat * Math.sin(cLngR),
                            surfR * Math.sin(cLatR)
                        ));
                    });
                    
                    // 반투명 채움
                    viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.PolygonHierarchy(polyPositions),
                            material: new Cesium.Color(0.29, 0.56, 0.85, 0.45),
                            outline: true,
                            outlineColor: new Cesium.Color(0.29, 0.56, 0.85, 1.0),
                            outlineWidth: 2,
                            perPositionHeight: true,
                        }
                    });
                    
                    // 외곽선 강조
                    var linePositions = polyPositions.concat([polyPositions[0]]);
                    viewer.entities.add({
                        polyline: {
                            positions: linePositions,
                            width: 3,
                            material: new Cesium.Color(0.4, 0.7, 1.0, 1.0),
                        }
                    });
                    
                    console.log('[Detail] Highlight added at', lat, lng);
                }
                // 시작 (1초 후부터 시도)
                setTimeout(waitAndFly, 1000);
            })();
            true;
        `;
        setTimeout(() => {
            webviewRef.current?.injectJavaScript(flyScript);
        }, 500);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* 헤더 */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>구역 상세</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* ═══ 달 3D 프리뷰 (CesiumJS) ═══ */}
            <View style={styles.mapContainer}>
                <WebView
                    ref={webviewRef}
                    originWhitelist={['*']}
                    source={{ html: createCesiumHtml('', ''), baseUrl: 'https://moon.com' }}
                    style={styles.webview}
                    onLoadEnd={onWebViewLoad}
                    onMessage={() => {}}
                    injectedJavaScript={`
                        if (!window.ReactNativeWebView) {
                            window.ReactNativeWebView = { postMessage: function() {} };
                        }
                        window._autoRotate = false;
                        true;
                    `}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    scrollEnabled={false}
                    allowFileAccess={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                />
                {/* 좌표 오버레이 */}
                <View style={styles.coordOverlay}>
                    <Text style={styles.coordText}>
                        {Math.abs(territory.lat).toFixed(2)}°{territory.lat >= 0 ? 'N' : 'S'}{' '}
                        {Math.abs(territory.lng).toFixed(2)}°{territory.lng >= 0 ? 'E' : 'W'}
                    </Text>
                </View>
            </View>

            <Animated.ScrollView
                style={[styles.contentScroll, { opacity: fadeAnim }]}
                contentContainerStyle={styles.contentInner}
                showsVerticalScrollIndicator={false}
            >
                {/* ── 토큰 + 직접관리 뱃지 ── */}
                <View style={styles.tokenSection}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.tokenId}>{territory.token}</Text>
                        <Text style={styles.tokenSub}>
                            L{territory.level} · {territory.area} km²
                        </Text>
                    </View>
                    <View style={styles.manageBadge}>
                        <View style={styles.manageDot} />
                        <Text style={styles.manageText}>직접 관리</Text>
                    </View>
                </View>

                {/* URN */}
                <Text style={styles.urnText}>urn:mag:301:{territory.level}:{territory.token}</Text>

                {/* ── 소유 정보 ── */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>소유 정보</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>점유일</Text>
                        <Text style={styles.infoValue}>{territory.occupiedDate}</Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>보유 기간</Text>
                        <View style={styles.daysRow}>
                            <Text style={styles.daysValue}>{days}</Text>
                            <Text style={styles.daysUnit}>일째</Text>
                        </View>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>점유 비용</Text>
                        <Text style={styles.infoValue}>{territory.magCost} Mag</Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>구성</Text>
                        <Text style={styles.infoValue}>L16 × 4셀 번들</Text>
                    </View>
                </View>

                {/* ── 자원 잠재 가치 ── */}
                {sc > 0 && (
                    <View style={styles.sectionCard}>
                        <View style={styles.scoreTitleRow}>
                            <Text style={styles.sectionTitle}>자원 잠재 가치</Text>
                            <View style={[styles.scoreLabelBadge, { backgroundColor: scoreColor(sc) + '18' }]}>
                                <Text style={[styles.scoreLabelText, { color: scoreColor(sc) }]}>{scoreLabel(sc)}</Text>
                            </View>
                        </View>
                        <View style={styles.scoreDisplay}>
                            <Text style={[styles.scoreBig, { color: scoreColor(sc) }]}>{sc}</Text>
                            <Text style={styles.scoreMax}>/100</Text>
                        </View>
                        <View style={styles.scoreBarBg}>
                            <Animated.View style={[styles.scoreBarFill, {
                                width: `${sc}%`,
                                backgroundColor: scoreColor(sc),
                            }]} />
                        </View>
                    </View>
                )}

                {/* ── 자원 현황 ── */}
                {territory.minerals && territory.minerals.length > 0 && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>자원 현황</Text>
                        {territory.minerals.map((m, i) => {
                            const info = MINERAL_INFO[m];
                            // 시뮬레이션 농도 (wt%)
                            const concentration = (Math.random() * 20 + 2).toFixed(1);
                            const barWidth = Math.min(parseFloat(concentration) * 4, 100);
                            return (
                                <View key={i} style={styles.mineralRow}>
                                    <View style={styles.mineralLeft}>
                                        <Text style={styles.mineralIcon}>{info?.icon || '🔬'}</Text>
                                        <View>
                                            <Text style={styles.mineralFormula}>{m}</Text>
                                            <Text style={styles.mineralName}>{info?.name || '미확인'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.mineralRight}>
                                        <View style={styles.mineralBarBg}>
                                            <View style={[styles.mineralBarFill, { width: `${barWidth}%`, backgroundColor: info?.color || '#999' }]} />
                                        </View>
                                        <Text style={styles.mineralPct}>{concentration} wt%</Text>
                                    </View>
                                </View>
                            );
                        })}
                        {territory.minerals.length > 0 && (
                            <Text style={styles.mineralNote}>※ 원격 탐사 추정치, 실측과 차이 있을 수 있음</Text>
                        )}
                    </View>
                )}

                {/* ── 탐사 데이터 CTA ── */}
                <TouchableOpacity style={styles.exploreCta} activeOpacity={0.7}>
                    <View style={styles.exploreLeft}>
                        <Ionicons name="earth-outline" size={22} color="#4A90D9" />
                        <View>
                            <Text style={styles.exploreTitle}>탐사 데이터 보기</Text>
                            <Text style={styles.exploreSub}>위성 관측 기반 상세 분석</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
                </TouchableOpacity>

                {/* ── 빠른 액션 그리드 ── */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => {
                            router.back();
                            setTimeout(() => router.push({ pathname: '/(tabs)', params: { lat: territory.lat, lng: territory.lng } }), 300);
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="navigate-outline" size={24} color="#4A90D9" />
                        <Text style={styles.actionText}>지도에서 보기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.7}>
                        <Ionicons name="cube-outline" size={24} color="#66BB6A" />
                        <Text style={styles.actionText}>AR로 보기</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </Animated.ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // ── 헤더 ──
    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

    // ── 맵 ──
    mapContainer: { height: MAP_HEIGHT, backgroundColor: '#111' },
    webview: { flex: 1 },
    coordOverlay: {
        position: 'absolute', bottom: 10, left: 12,
        backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
        paddingVertical: 4, paddingHorizontal: 10,
    },
    coordText: { fontSize: 12, fontWeight: '600', color: '#fff', fontFamily: 'monospace' },

    // ── 스크롤 컨텐츠 ──
    contentScroll: { flex: 1 },
    contentInner: { paddingTop: 20, paddingBottom: 30 },

    // ── 토큰 섹션 ──
    tokenSection: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, marginBottom: 4,
    },
    tokenId: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', fontFamily: 'monospace', letterSpacing: 0.5 },
    tokenSub: { fontSize: 13, color: '#9E9E9E', marginTop: 2 },
    manageBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#E8F5E9', borderRadius: 8,
        paddingVertical: 6, paddingHorizontal: 10,
    },
    manageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#66BB6A' },
    manageText: { fontSize: 12, fontWeight: '600', color: '#66BB6A' },

    urnText: {
        fontSize: 11, color: '#BDBDBD', fontFamily: 'monospace',
        paddingHorizontal: 20, marginBottom: 20,
    },

    // ── 섹션 카드 ──
    sectionCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: '#FAFAFA', borderRadius: 14,
        paddingVertical: 16, paddingHorizontal: 18,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },

    // ── 소유 정보 행 ──
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 10,
    },
    infoLabel: { fontSize: 13, color: '#9E9E9E' },
    infoValue: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    infoDivider: { height: 1, backgroundColor: '#F0F0F0' },
    daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    daysValue: { fontSize: 20, fontWeight: '800', color: '#4A90D9' },
    daysUnit: { fontSize: 12, fontWeight: '600', color: '#4A90D9' },

    // ── 자원 가치 ──
    scoreTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    scoreLabelBadge: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
    scoreLabelText: { fontSize: 11, fontWeight: '700' },
    scoreDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 10 },
    scoreBig: { fontSize: 36, fontWeight: '800' },
    scoreMax: { fontSize: 14, fontWeight: '600', color: '#BDBDBD' },
    scoreBarBg: { height: 6, backgroundColor: '#E8E8E8', borderRadius: 3 },
    scoreBarFill: { height: 6, borderRadius: 3 },

    // ── 자원 현황 ──
    mineralRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    mineralLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 100 },
    mineralIcon: { fontSize: 18 },
    mineralFormula: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
    mineralName: { fontSize: 10, color: '#9E9E9E' },
    mineralRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 16 },
    mineralBarBg: { flex: 1, height: 6, backgroundColor: '#E8E8E8', borderRadius: 3 },
    mineralBarFill: { height: 6, borderRadius: 3 },
    mineralPct: { fontSize: 12, fontWeight: '700', color: '#666', width: 55, textAlign: 'right' },
    mineralNote: { fontSize: 10, color: '#BDBDBD', marginTop: 10, fontStyle: 'italic' },

    // ── 탐사 CTA ──
    exploreCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: '#F0F7FF', borderRadius: 14,
        paddingVertical: 16, paddingHorizontal: 18,
    },
    exploreLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    exploreTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
    exploreSub: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },

    // ── 액션 그리드 ──
    actionGrid: {
        flexDirection: 'row', gap: 10,
        paddingHorizontal: 16,
    },
    actionCard: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#F7F7FA', borderRadius: 14,
        paddingVertical: 20,
    },
    actionText: { fontSize: 13, fontWeight: '600', color: '#333' },
});
