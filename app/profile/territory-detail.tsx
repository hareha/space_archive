import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    Dimensions, Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import ARSurfaceViewer from '@/components/ARSurfaceViewer';
import { createCesiumHtml } from '@/constants/cesium/CesiumHtml';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { LANDING_MODELS } from '@/constants/landingModels';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { requestJumpToCell } from '@/constants/jumpToCellStore';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 280;

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
    'Th': { name: '토륨', icon: '🟠', color: '#FF8A65', desc: '방사성 열원' },
    'K': { name: '칼륨', icon: '🟣', color: '#BA68C8', desc: '방사성 원소' },
    'Na₂O': { name: '나트륨', icon: '🟡', color: '#FFD54F', desc: '광물 성분' },
    'Cr₂O₃': { name: '크롬', icon: '⚙️', color: '#78909C', desc: '내열 합금' },
    'MnO': { name: '망간', icon: '🔘', color: '#A1887F', desc: '철강 체련' },
};

// 위경도 기반 결정적 수치 생성 (seed hash)
function getResourceValue(lat: number, lng: number, resourceKey: string): number {
    const seed = Math.abs(lat * 1000 + lng * 100 + resourceKey.charCodeAt(0) * 7 + resourceKey.length * 13);
    const hash = ((seed * 2654435761) >>> 0) % 10000;
    return parseFloat((hash / 500).toFixed(1)); // 0.0 ~ 20.0 wt%
}

const ALL_RESOURCES = Object.keys(MINERAL_INFO);
const DEFAULT_VISIBLE = 5;

// 보유 기간 계산
function daysSince(dateStr: string): number {
    if (!dateStr) return 0;
    const [y, m, d] = dateStr.split('.').map(Number);
    const past = new Date(y, m - 1, d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
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
    const scrollViewRef = useRef<any>(null);
    const initTimers = useRef<ReturnType<typeof setTimeout>[]>([]);  // onWebViewLoad의 예약 타이머
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [cesiumHtmlUri, setCesiumHtmlUri] = useState<string | null>(null);
    const [firstPersonMode, setFirstPersonMode] = useState(false);
    const [fpReady, setFpReady] = useState(false);
    const [cesiumReady, setCesiumReady] = useState(false);
    const fpGuideAnim = useRef(new Animated.Value(0)).current;
    const [showFpGuide, setShowFpGuide] = useState(false);
    // LayoutAnimation 활성화 (Android)
    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);
    const deviceOrientation = useDeviceOrientation(32);

    // 파라미터 → 구역 객체
    const territory: Territory = useMemo(() => ({
        id: params.token || '',
        token: params.token || '',
        level: Number(params.level) || 16,
        lat: Number(params.lat) || 0,
        lng: Number(params.lng) || 0,
        area: params.area || '0',
        magCost: Number(params.magCost) || 0,
        occupiedDate: params.occupiedDate || '',
        minerals: params.minerals ? params.minerals.split(',') : [],
        score: Number(params.score) || 0,
    }), [params]);

    const days = daysSince(territory.occupiedDate);
    const [resourceExpanded, setResourceExpanded] = useState(false);
    const [showARSurface, setShowARSurface] = useState(false);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        // Cesium HTML을 file://로 저장 (GLB file:// 로드 허용)
        (async () => {
            try {
                const htmlContent = createCesiumHtml('', '');
                const htmlPath = FileSystem.documentDirectory + 'cesium_territory.html';
                await FileSystem.writeAsStringAsync(htmlPath, htmlContent, { encoding: FileSystem.EncodingType.UTF8 });
                setCesiumHtmlUri(htmlPath);
            } catch (e) { console.warn('[TerritoryDetail] HTML save error:', e); }
        })();
    }, []);

    // 착륙선 3D 모델 로드 및 배치 (index.tsx와 동일한 SET_MODEL_URI 방식)
    const loadLandingModels = async () => {
        async function injectGlb(requirePath: any, modelName: string) {
            try {
                const asset = await Asset.fromModule(requirePath).downloadAsync();
                if (!asset.localUri) return;
                const destPath = FileSystem.documentDirectory + modelName + '.glb';
                const fileInfo = await FileSystem.getInfoAsync(destPath);
                if (!fileInfo.exists) {
                    await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
                }
                const uri = destPath;
                const msg: any = { type: 'SET_MODEL_URI', model: modelName, uri };
                if (modelName === 'apollo') {
                    msg.sites = LANDING_MODELS.map((m: any) => ({ lat: m.lat, lng: m.lng, height: m.height, scale: m.scale }));
                }
                webviewRef.current?.postMessage(JSON.stringify(msg));
                console.log(`[TerritoryDetail] ${modelName} GLB injected via SET_MODEL_URI`);
            } catch (e) { console.warn(`[TerritoryDetail] ${modelName} GLB load error:`, e); }
        }

        await injectGlb(require('../../assets/3d/apollo_11_lunar_module.glb'), 'apollo');
        await injectGlb(require('../../assets/3d/danuri.glb'), 'danuri');
        await injectGlb(require('../../assets/3d/chandrayaan.glb'), 'chandrayaan');
        await injectGlb(require('../../assets/3d/capstone.glb'), 'capstone');
        await injectGlb(require('../../assets/3d/lro.glb'), 'lro');
    };

    // 자이로 → WebView 전송
    useEffect(() => {
        if (!firstPersonMode || !fpReady) return;
        webviewRef.current?.postMessage(JSON.stringify({
            type: 'GYRO_UPDATE',
            azimuth: deviceOrientation.azimuth,
            altitude: deviceOrientation.altitude,
        }));
    }, [firstPersonMode, fpReady, deviceOrientation.azimuth, deviceOrientation.altitude]);

    // 1인칭 안내 카드: fpReady 시 표시 → 1초 후 fadeOut
    useEffect(() => {
        if (fpReady && firstPersonMode) {
            setShowFpGuide(true);
            fpGuideAnim.setValue(1);
            const timer = setTimeout(() => {
                Animated.timing(fpGuideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }).start(() => setShowFpGuide(false));
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setShowFpGuide(false);
        }
    }, [fpReady, firstPersonMode]);

    const FP_LAYOUT_DURATION = 600; // ms, 천천히 확장

    const enterFirstPerson = useCallback(() => {
        setFpReady(false);

        // 0) onWebViewLoad에서 예약한 타이머(GO_TO_LOCATION, HIGHLIGHT 등) 전부 취소
        initTimers.current.forEach(t => clearTimeout(t));
        initTimers.current = [];

        // 1) 즉시: 진행 중인 카메라 이동(lookAt orbit등) 취소
        webviewRef.current?.postMessage(JSON.stringify({ type: 'CANCEL_FLIGHTS' }));

        // 2) 천천히 화면 확장 (LayoutAnimation — 네이티브 스레드)
        LayoutAnimation.configureNext({
            duration: FP_LAYOUT_DURATION,
            update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
            delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
        setFirstPersonMode(true);
        setScrollEnabled(false);

        // 3) 화면 확장 완료 후 → Cesium 줌인 시작 (확장과 줌인 겹치지 않음)
        const sendMsg = () => {
            webviewRef.current?.postMessage(JSON.stringify({
                type: 'FIRST_PERSON_ENTER',
                lat: territory.lat,
                lng: territory.lng,
                token: territory.token,
            }));
        };
        setTimeout(() => {
            if (cesiumReady) {
                sendMsg();
            } else {
                const retryId = setInterval(() => {
                    if (webviewRef.current) {
                        sendMsg();
                        clearInterval(retryId);
                    }
                }, 500);
                setTimeout(() => clearInterval(retryId), 10000);
            }
        }, FP_LAYOUT_DURATION);
    }, [territory.lat, territory.lng, territory.token, cesiumReady]);

    const exitFirstPerson = useCallback(() => {
        setFpReady(false);
        // 천천히 화면 축소 (LayoutAnimation — 네이티브 스레드)
        LayoutAnimation.configureNext({
            duration: FP_LAYOUT_DURATION,
            update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.scaleY },
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
        setFirstPersonMode(false);
        setScrollEnabled(true);
        webviewRef.current?.postMessage(JSON.stringify({
            type: 'FIRST_PERSON_EXIT',
            lat: territory.lat,
            lng: territory.lng,
        }));
    }, [territory.lat, territory.lng]);

    const onWebViewMessage = useCallback((event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'FP_READY') {
                setFpReady(true);
            }
            if (data.type === 'CESIUM_READY' || data.type === 'DEBUG_LOG') {
                setCesiumReady(true);
            }
        } catch (e) {}
    }, []);

    // CesiumJS 로드 → 셀 하이라이트 + lookAt orbit 뷰 + 착륙선 모델
    const onWebViewLoad = () => {
        setCesiumReady(true);
        // 기존 타이머 초기화
        initTimers.current.forEach(t => clearTimeout(t));
        initTimers.current = [];

        // 1단계: S2 셀 하이라이트
        initTimers.current.push(setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
                type: 'HIGHLIGHT_CELL',
                token: territory.token,
            }));
        }, 1500));

        // 2단계: 해당 위치로 orbit 뷰
        initTimers.current.push(setTimeout(() => {
            webviewRef.current?.postMessage(JSON.stringify({
                type: 'GO_TO_LOCATION',
                payload: {
                    lat: territory.lat,
                    lng: territory.lng,
                    orbit: true,
                },
            }));
        }, 2000));

        // 3단계: 착륙선 모델 배치 (Cesium 초기화 후)
        initTimers.current.push(setTimeout(() => {
            loadLandingModels();
        }, 2000));
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar barStyle={firstPersonMode ? 'light-content' : 'dark-content'} />

            {/* ── 헤더 — 1인칭 시 숨김 (LayoutAnimation이 자연스럽게 전환) ── */}
            {!firstPersonMode && (
                <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
                    <View style={styles.headerBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>구역 상세</Text>
                        <View style={{ width: 38 }} />
                    </View>
                </SafeAreaView>
            )}

            {/* ── WebView 영역 — 1인칭 시 flex:1로 전체화면 (LayoutAnimation 전환) ── */}
            <View style={firstPersonMode ? { flex: 1 } : { height: MAP_HEIGHT }}>
                <WebView
                    ref={webviewRef}
                    originWhitelist={['*']}
                    source={cesiumHtmlUri ? { uri: cesiumHtmlUri } : { html: '<html><body style="background:#000"></body></html>' }}
                    style={{ flex: 1 }}
                    onLoadEnd={onWebViewLoad}
                    onMessage={onWebViewMessage}
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
                    allowingReadAccessToURL={'file:///'}
                />
                {/* 1인칭 뷰 버튼 (평상시) */}
                {!firstPersonMode && (
                    <TouchableOpacity onPress={enterFirstPerson} style={styles.fpButton}>
                        <Ionicons name="eye" size={18} color="#fff" />
                        <Text style={styles.fpButtonText}>1인칭</Text>
                    </TouchableOpacity>
                )}
                {/* 1인칭 모드 UI */}
                {firstPersonMode && (
                    <>
                        <TouchableOpacity onPress={exitFirstPerson} style={styles.fpBackBtn}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        {!fpReady && (
                            <View style={styles.fpLoadingOverlay}>
                                <Text style={styles.fpLoadingText}>지표면으로 이동 중...</Text>
                            </View>
                        )}
                        {showFpGuide && (
                            <Animated.View style={[styles.fpGuideOverlay, { opacity: fpGuideAnim }]}>
                                <View style={styles.fpGuideCard}>
                                    <Text style={styles.fpGuideText}>📱 휴대폰을 움직여{"\n"}시점을 전환해보세요</Text>
                                </View>
                            </Animated.View>
                        )}
                    </>
                )}
            </View>

            {/* ── 스크롤 컨텐츠 — 1인칭 시 숨김 (LayoutAnimation 전환) ── */}
            {!firstPersonMode && (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <Animated.ScrollView
                    ref={scrollViewRef}
                    style={[styles.contentScroll, { opacity: fadeAnim }]}
                    contentContainerStyle={styles.contentInner}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={scrollEnabled}
                >
                    {/* ── MAG ID + 면적/위경도 ── */}
                    <View style={styles.tokenSection}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tokenId}>
                                {'MAG-L' + territory.level + '-' + territory.token}
                            </Text>
                            <Text style={styles.tokenSub}>
                                {(() => { const v = parseFloat(territory.area); return isNaN(v) ? '1,740' : v.toLocaleString(); })() + ' m²  ·  ' + Math.abs(territory.lat).toFixed(2) + '°' + (territory.lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(territory.lng).toFixed(2) + '°' + (territory.lng >= 0 ? 'E' : 'W')}
                            </Text>
                        </View>
                    </View>

                    {/* URN */}
                    <Text style={styles.urnText}>urn:mag:301:{territory.level}:{territory.token}</Text>

                    {/* ── 소유 정보 ── */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>개척 정보</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>개척일</Text>
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
                            <Text style={styles.infoLabel}>개척 비용</Text>
                            <Text style={styles.infoValue}>{territory.magCost} Mag</Text>
                        </View>
                    </View>

                    {/* ── 자원 현황 ── */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>자원 현황</Text>
                        {ALL_RESOURCES.slice(0, resourceExpanded ? ALL_RESOURCES.length : DEFAULT_VISIBLE).map((m, i) => {
                            const info = MINERAL_INFO[m];
                            const concentration = getResourceValue(territory.lat, territory.lng, m);
                            const barWidth = Math.min(concentration * 4, 100);
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
                        {ALL_RESOURCES.length > DEFAULT_VISIBLE && (
                            <TouchableOpacity
                                style={styles.expandBtn}
                                onPress={() => setResourceExpanded(!resourceExpanded)}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.expandBtnText}>
                                    {resourceExpanded ? `접기 ▲` : `나머지 ${ALL_RESOURCES.length - DEFAULT_VISIBLE}개 더보기 ▼`}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.mineralNote}>※ 원격 탐사 추정치, 실측과 차이 있을 수 있음</Text>
                    </View>

                    {/* ── 빠른 액션 ── */}
                    <View style={{ paddingHorizontal: 16 }}>
                        <TouchableOpacity
                            style={styles.actionCardFull}
                            onPress={() => {
                                requestJumpToCell({
                                    token: territory.token,
                                    level: territory.level,
                                    lat: territory.lat,
                                    lng: territory.lng,
                                });
                                router.navigate('/(tabs)');
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="navigate-outline" size={20} color="#fff" />
                            <Text style={styles.actionFullText}>지도에서 보기</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </Animated.ScrollView>
            </View>
            )}


            {/* AR 표면 뷰어 모달 */}
            {showARSurface && (
                <ARSurfaceViewer
                    lat={territory.lat}
                    lng={territory.lng}
                    token={territory.token}
                    level={territory.level}
                    onClose={() => setShowARSurface(false)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    // ── 헤더 ──
    headerBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFFFFF',
        zIndex: 20,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

    // ── 맵 (CesiumJS WebView) ──
    mapContainer: { height: MAP_HEIGHT, backgroundColor: 'transparent', overflow: 'hidden', borderRadius: 0 },
    webview: { flex: 1 },

    // ── 스크롤 컨텐츠 ──
    contentScroll: { flex: 1 },
    contentInner: { paddingBottom: 30 },

    // ── 토큰 섹션 ──
    tokenSection: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, marginBottom: 4,
    },
    tokenId: { fontSize: 17, fontWeight: '700', color: '#111', letterSpacing: 0.3 },
    tokenSub: { fontSize: 13, color: '#999', marginTop: 6 },

    urnText: {
        fontSize: 11, color: '#BDBDBD', fontFamily: 'monospace',
        paddingHorizontal: 20, marginTop: 2, marginBottom: 24,
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
    expandBtn: {
        alignItems: 'center', paddingVertical: 12, marginTop: 4,
        borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    expandBtnText: { fontSize: 13, fontWeight: '600', color: '#4A90D9' },

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
    actionCardFull: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#4A90D9', borderRadius: 14,
        paddingVertical: 16,
    },
    actionFullText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    actionText: { fontSize: 13, fontWeight: '600', color: '#333' },
    fpButton: {
        position: 'absolute', bottom: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 20,
    },
    fpButtonText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    fpBackBtn: {
        position: 'absolute', top: 56, left: 16,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    },
    fpLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    fpLoadingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    fpGuideOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 10,
    },
    fpGuideCard: {
        width: 240, paddingVertical: 20, paddingHorizontal: 24,
        backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    fpGuideText: {
        color: '#fff', fontSize: 15, fontWeight: '600',
        textAlign: 'center', lineHeight: 22,
    },
});
