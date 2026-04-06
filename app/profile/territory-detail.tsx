import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    StyleSheet, View, ScrollView, TouchableOpacity, StatusBar,
    Dimensions, Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
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
    // '2026.04.02' 또는 '2026-04-02' 둘 다 지원
    const parts = dateStr.split(/[.\-]/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return 0;
    const [y, m, d] = parts;
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
    const navigation = useNavigation();
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
        await injectGlb(require('../../assets/3d/chandrayaan-2.glb'), 'chandrayaan');
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

        // 1인칭 모드에서는 셀 하이라이트/orbit/모델 로드 건너뛰고 바로 1인칭 진입
        if (firstPersonMode) {
            initTimers.current.push(setTimeout(() => {
                webviewRef.current?.postMessage(JSON.stringify({
                    type: 'FIRST_PERSON_ENTER',
                    lat: territory.lat,
                    lng: territory.lng,
                    token: territory.token,
                }));
            }, 1500));
            return;
        }

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

            {/* ── 헤더 — 1인칭 시 숨김 ── */}
            {!firstPersonMode && (
                <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
                    <View style={styles.headerBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>{'MAG-L' + territory.level + '-' + territory.token.slice(0, 9)}</Text>
                        <View style={{ width: 40 }} />
                    </View>
                </SafeAreaView>
            )}

            {/* ── 1인칭 모드: WebView 전체화면 ── */}
            {firstPersonMode && (
                <View style={{ flex: 1 }}>
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
                </View>
            )}

            {/* ── 스크롤 컨텐츠 — 1인칭 시 숨김 ── */}
            {!firstPersonMode && (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <Animated.ScrollView
                    ref={scrollViewRef}
                    style={[styles.contentScroll, { opacity: fadeAnim }]}
                    contentContainerStyle={styles.contentInner}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={scrollEnabled}
                >
                    {/* ── 메타 정보 (border-left 4px #666) ── */}
                    <View style={styles.metaSection}>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>S2cellId</Text>
                            <Text style={styles.metaValue}>{territory.token.slice(0, 9)}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Area</Text>
                            <Text style={styles.metaValue}>1,740 m²</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Urn</Text>
                            <Text style={styles.metaValue}>301:{territory.level}:{territory.token.slice(0, 9)}</Text>
                        </View>
                    </View>

                    {/* ── 3D 맵 (라운드 박스) — 터치 시 스크롤 잠금 ── */}
                    <View
                        style={styles.mapBox}
                        onTouchStart={() => setScrollEnabled(false)}
                        onTouchEnd={() => setScrollEnabled(true)}
                        onTouchCancel={() => setScrollEnabled(true)}
                    >
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
                        {/* 좌표 레이블 */}
                        <View style={styles.mapCoordLabel}>
                            <Text style={styles.mapCoordText}>
                                {Math.abs(territory.lat).toFixed(2)}°{territory.lat >= 0 ? 'N' : 'S'} {Math.abs(territory.lng).toFixed(2)}°{territory.lng >= 0 ? 'E' : 'W'}
                            </Text>
                        </View>
                        {/* 1인칭 뷰 버튼 — 극지방(위도 ±60° 이상)에서는 타일맵 과부하로 숨김 */}
                        {Math.abs(territory.lat) < 60 && (
                        <TouchableOpacity onPress={enterFirstPerson} style={styles.fpButton}>
                            <Ionicons name="eye" size={18} color="#fff" />
                            <Text style={styles.fpButtonText}>1인칭</Text>
                        </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Ownership Details (bg #EAECF6 rounded 6) ── */}
                    <View style={styles.ownershipCard}>
                        <Text style={styles.ownershipTitle}>개척 정보</Text>
                        <View style={styles.ownershipBody}>
                            <View style={styles.ownershipRow}>
                                <View style={styles.ownershipLabelRow}>
                                    <View style={styles.ownershipDot} />
                                    <Text style={styles.ownershipLabel}>개척일</Text>
                                </View>
                                <Text style={styles.ownershipValue}>{territory.occupiedDate}</Text>
                            </View>
                            <View style={styles.ownershipRow}>
                                <View style={styles.ownershipLabelRow}>
                                    <View style={styles.ownershipDot} />
                                    <Text style={styles.ownershipLabel}>보유 기간</Text>
                                </View>
                                <Text style={styles.ownershipValue}>{days}일</Text>
                            </View>
                            <View style={styles.ownershipRow}>
                                <View style={styles.ownershipLabelRow}>
                                    <View style={styles.ownershipDot} />
                                    <Text style={styles.ownershipLabel}>규모</Text>
                                </View>
                                <Text style={styles.ownershipValue}>{territory.magCost} Mag</Text>
                            </View>

                        </View>
                    </View>

                    {/* ── 추정 자원 (Gage) ── */}
                    <View style={styles.resourceSection}>
                        <Text style={styles.resourceSectionTitle}>추정 자원</Text>
                        <Text style={styles.resourceDisclaimer}>※ 원격 탐사 추정치, 실측과 차이 있을 수 있음</Text>
                        {ALL_RESOURCES.slice(0, resourceExpanded ? ALL_RESOURCES.length : DEFAULT_VISIBLE).map((m, i) => {
                            const info = MINERAL_INFO[m];
                            const concentration = getResourceValue(territory.lat, territory.lng, m);
                            const barWidth = Math.min(concentration * 4, 100);
                            return (
                                <View key={i} style={styles.gageItem}>
                                    <View style={styles.gageHeader}>
                                        <Text style={styles.gageName}>{m}</Text>
                                        <Text style={styles.gagePct}>{concentration} wt%</Text>
                                    </View>
                                    <View style={styles.gageBarBg}>
                                        <View style={[styles.gageBarFill, { width: `${barWidth}%`, backgroundColor: info?.color || '#D5922E' }]} />
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
                    </View>

                    {/* ── 하단 버튼 (단일) ── */}
                    <View style={styles.bottomBtnRow}>
                        <TouchableOpacity
                            style={styles.mapBtn}
                            onPress={() => {
                                requestJumpToCell({
                                    token: territory.token,
                                    level: territory.level,
                                    lat: territory.lat,
                                    lng: territory.lng,
                                });
                                navigation.getParent()?.goBack();
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.mapBtnText}>지도에서 보기</Text>
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
        backgroundColor: '#FFFFFF',
        zIndex: 20,
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },

    // ── 맵 박스 (라운드) ──
    mapBox: {
        marginHorizontal: 16, marginBottom: 20,
        height: 215, borderRadius: 10, overflow: 'hidden',
        backgroundColor: '#000',
    },
    mapCoordLabel: {
        position: 'absolute', bottom: 12, alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 5,
    },
    mapCoordText: { color: '#fff', fontSize: 13, fontWeight: '500' },

    // ── 스크롤 ──
    contentScroll: { flex: 1 },
    contentInner: { paddingBottom: 30, paddingTop: 20 },

    // ── 메타 정보 (border-left 4px #666) ──
    metaSection: {
        marginHorizontal: 16, paddingLeft: 16,
        borderLeftWidth: 4, borderLeftColor: '#666666',
        gap: 4, marginBottom: 24,
    },
    metaRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        height: 17,
    },
    metaLabel: { fontSize: 14, fontWeight: '400', color: '#999999', lineHeight: 21 },
    metaValue: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },

    // ── Ownership (bg #EAECF6 rounded 6) ──
    ownershipCard: {
        marginHorizontal: 16, marginBottom: 20,
        backgroundColor: '#EAECF6', borderRadius: 6,
        paddingTop: 16, paddingBottom: 18, paddingHorizontal: 16,
    },
    ownershipTitle: {
        fontSize: 14, fontWeight: '500', color: '#707070',
        marginBottom: 14,
    },
    ownershipBody: { gap: 6 },
    ownershipRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        height: 17,
    },
    ownershipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ownershipDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#999999' },
    ownershipLabel: { fontSize: 14, fontWeight: '400', color: '#999999', lineHeight: 21 },
    ownershipValue: { fontSize: 14, fontWeight: '500', color: '#1A1A1A' },

    // ── 자원 섹션 ──
    resourceSection: { paddingHorizontal: 16, marginBottom: 20 },
    resourceSectionTitle: { fontSize: 14, fontWeight: '500', color: '#3C57E9', marginBottom: 6 },
    resourceDisclaimer: { fontSize: 12, fontWeight: '400', color: '#999999', marginBottom: 14 },

    // ── Gage (자원 바) ──
    gageItem: { gap: 7, marginBottom: 14 },
    gageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gageName: { fontSize: 14, fontWeight: '500', color: '#3B4576', lineHeight: 21 },
    gagePct: { fontSize: 12, fontWeight: '400', color: '#999999', lineHeight: 17 },
    gageBarBg: { height: 13, backgroundColor: '#EAEAEA', borderRadius: 10, overflow: 'hidden' },
    gageBarFill: { height: 13, borderRadius: 10 },
    expandBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    expandBtnText: { fontSize: 13, fontWeight: '600', color: '#3C57E9' },

    // ── 하단 버튼 (단일 파란 버튼) ──
    bottomBtnRow: { paddingHorizontal: 16, paddingTop: 10 },
    mapBtn: {
        backgroundColor: '#3C57E9', borderRadius: 5,
        height: 56, alignItems: 'center', justifyContent: 'center',
    },
    mapBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

    // ── 1인칭 ──
    fpButton: {
        position: 'absolute', top: 12, right: 12,
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
