import React, { useState, useEffect, useRef, useMemo } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    Modal,
    ActivityIndicator,
    Platform,
    Animated,
} from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { createCesiumARSurfaceHtml } from '@/constants/cesium/CesiumARSurfaceHtml';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
    lat: number;
    lng: number;
    token: string;
    level: number;
    onClose: () => void;
}

export default function ARSurfaceViewer({ lat, lng, token, level, onClose }: Props) {
    const deviceOrientation = useDeviceOrientation(32);
    const insets = useSafeAreaInsets();

    const cesiumRef = useRef<WebView>(null);
    const [cesiumReady, setCesiumReady] = useState(false);
    const [surfaceH, setSurfaceH] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fadeInAnim = useRef(new Animated.Value(0)).current;

    const [earthBase64, setEarthBase64] = useState('');

    // 지구 텍스철 base64 로드
    useEffect(() => {
        (async () => {
            try {
                const earthAsset = Asset.fromModule(require('../assets/images/earth.jpg'));
                await earthAsset.downloadAsync();
                if (earthAsset.localUri) {
                    const b64 = await FileSystem.readAsStringAsync(earthAsset.localUri, { encoding: 'base64' });
                    setEarthBase64(`data:image/jpeg;base64,${b64}`);
                }
            } catch (e) { console.warn('Earth texture load error:', e); }
        })();
    }, []);

    // Cesium HTML (lat/lng/earth 기반)
    const cesiumHtml = useMemo(() => createCesiumARSurfaceHtml(lat, lng, earthBase64), [lat, lng, earthBase64]);

    // Cesium ready → fade in
    useEffect(() => {
        if (cesiumReady) {
            Animated.timing(fadeInAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        }
    }, [cesiumReady]);

    // ── 디바이스 방향 → Cesium 카메라 업데이트 ──
    const lastSentRef = useRef({ heading: -1, pitch: -1, ts: 0 });

    useEffect(() => {
        if (!cesiumReady) return;

        const now = Date.now();
        if (now - lastSentRef.current.ts < 50) return; // 50ms throttle

        const heading = deviceOrientation.azimuth;
        const pitch = deviceOrientation.altitude;

        // 변화 없으면 스킵
        const dH = Math.abs(heading - lastSentRef.current.heading);
        const dP = Math.abs(pitch - lastSentRef.current.pitch);
        if (dH < 0.5 && dP < 0.5) return;

        lastSentRef.current = { heading, pitch, ts: now };

        cesiumRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_ORIENTATION',
            heading: heading,
            pitch: pitch,
        }));
    }, [deviceOrientation, cesiumReady]);

    // Cesium 메시지 핸들러
    const handleCesiumMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'AR_SURFACE_READY') {
                setCesiumReady(true);
                if (data.surfaceH !== undefined) setSurfaceH(data.surfaceH);
            } else if (data.type === 'AR_SURFACE_ERROR') {
                setError(data.error || '알 수 없는 오류');
            }
        } catch (e) {}
    };

    const compassRotation = -deviceOrientation.azimuth;

    return (
        <Modal visible animationType="slide" statusBarTranslucent>
            <View style={styles.container}>

                {/* ① Cesium 풀스크린 */}
                <Animated.View style={[styles.cesiumLayer, { opacity: fadeInAnim }]}>
                    {earthBase64 ? (
                        <WebView
                            ref={cesiumRef}
                            source={{ html: cesiumHtml, baseUrl: 'https://moon.com' }}
                            style={styles.cesiumWebView}
                            originWhitelist={['*']}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            scrollEnabled={false}
                            bounces={false}
                            overScrollMode="never"
                            allowFileAccess={true}
                            allowFileAccessFromFileURLs={true}
                            allowUniversalAccessFromFileURLs={true}
                            onMessage={handleCesiumMessage}
                        />
                    ) : (
                        <View style={styles.cesiumWebView} />
                    )}
                </Animated.View>

                <LoadingOverlay visible={!cesiumReady} />

                {/* ③ HUD 상단 */}
                <View style={[styles.hudTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                    <View style={styles.hudTopInner}>
                        <View style={styles.hudInfoCol}>
                            <Text style={styles.hudLabel}>LUNAR SURFACE VIEW</Text>
                            <Text style={styles.hudToken}>
                                L{level} · {token}
                            </Text>
                            <Text style={styles.hudCoord}>
                                {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'}{' '}
                                {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ④ HUD 하단: 나침반 + 상태 */}
                <View style={[styles.hudBottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
                    {/* 나침반 */}
                    <View style={styles.compassContainer}>
                        <View style={[
                            styles.compassRing,
                            { transform: [{ rotate: `${compassRotation}deg` }] }
                        ]}>
                            <View style={styles.compassNorth}>
                                <Text style={styles.compassN}>N</Text>
                            </View>
                            <View style={[styles.compassDir, { top: '50%', right: 2, marginTop: -6 }]}>
                                <Text style={styles.compassDirText}>E</Text>
                            </View>
                            <View style={[styles.compassDir, { bottom: 2, left: '50%', marginLeft: -5 }]}>
                                <Text style={styles.compassDirText}>S</Text>
                            </View>
                            <View style={[styles.compassDir, { top: '50%', left: 2, marginTop: -6 }]}>
                                <Text style={styles.compassDirText}>W</Text>
                            </View>
                        </View>
                        <View style={styles.compassCenter} />
                    </View>

                    {/* 상태 표시줄 */}
                    <View style={styles.statusRow}>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>방위</Text>
                            <Text style={styles.statusValue}>
                                {Math.round(deviceOrientation.azimuth)}°
                            </Text>
                        </View>
                        <View style={styles.statusDot} />
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>기울기</Text>
                            <Text style={styles.statusValue}>
                                {Math.round(deviceOrientation.altitude)}°
                            </Text>
                        </View>
                        <View style={styles.statusDot} />
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>고도</Text>
                            <Text style={styles.statusValue}>
                                {surfaceH !== null ? `${surfaceH.toFixed(0)}m` : '--'}
                            </Text>
                        </View>
                    </View>

                    {/* 조작 안내 */}
                    {cesiumReady && (
                        <Text style={styles.guideText}>
                            📱 핸드폰을 움직여 달 표면을 둘러보세요
                        </Text>
                    )}
                </View>

                {/* 에러 */}
                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>⚠ {error}</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    // Cesium 풀스크린
    cesiumLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    cesiumWebView: {
        flex: 1,
        backgroundColor: '#000',
    },

    // 로딩
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5,
        backgroundColor: '#000',
        alignItems: 'center', justifyContent: 'center',
    },
    loadingBox: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingTitle: {
        color: '#fff', fontSize: 20, fontWeight: '700',
        marginTop: 16,
    },
    loadingSubtitle: {
        color: 'rgba(255,255,255,0.5)', fontSize: 13,
        textAlign: 'center', marginTop: 8,
    },

    // HUD 상단
    hudTop: {
        position: 'absolute', top: 0, left: 0, right: 0,
        zIndex: 10,
        paddingHorizontal: 16,
    },
    hudTopInner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    hudInfoCol: {},
    hudLabel: {
        color: '#3B82F6', fontSize: 10, fontWeight: '700',
        letterSpacing: 2,
    },
    hudToken: {
        color: '#fff', fontSize: 15, fontWeight: '700',
        marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    hudCoord: {
        color: 'rgba(255,255,255,0.4)', fontSize: 11,
        marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    closeButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },

    // HUD 하단
    hudBottom: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 10,
        alignItems: 'center',
    },
    compassContainer: {
        width: 64, height: 64,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
    },
    compassRing: {
        width: 56, height: 56, borderRadius: 28,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center', justifyContent: 'center',
    },
    compassNorth: {
        position: 'absolute', top: -2, left: '50%', marginLeft: -5,
    },
    compassN: { color: '#EF4444', fontSize: 10, fontWeight: '900' },
    compassDir: { position: 'absolute' },
    compassDirText: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '600' },
    compassCenter: {
        position: 'absolute',
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#3B82F6',
    },

    statusRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        paddingVertical: 10, paddingHorizontal: 20,
        gap: 12,
    },
    statusItem: { alignItems: 'center' },
    statusLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
    statusValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
    statusDot: {
        width: 3, height: 3, borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },

    guideText: {
        color: 'rgba(255,255,255,0.4)', fontSize: 12,
        marginTop: 10,
    },

    errorBanner: {
        position: 'absolute', top: '50%', left: 20, right: 20,
        zIndex: 40,
        backgroundColor: 'rgba(239,68,68,0.9)',
        borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20,
        alignItems: 'center',
    },
    errorText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
