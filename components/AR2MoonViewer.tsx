import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, G, Text as SvgText, Path, Polyline, Rect, Defs, RadialGradient, LinearGradient, Stop, Ellipse } from 'react-native-svg';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { useMoonPosition, calculateMoonAltAz } from '@/hooks/useMoonPosition';
import { createCesiumARHtml } from '@/constants/cesium/CesiumARHtml';
import { useEll } from '@/components/EllContext';
import { Vibration } from 'react-native';
import SunCalc from 'suncalc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MOON_VIEW_START = 60;
const MOON_VIEW_END = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.55;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

interface Props {
    onClose: () => void;
}

interface TrajectoryPoint {
    hour: number;
    azimuth: number;
    altitude: number;
    isAboveHorizon: boolean;
}

export default function AR2MoonViewer({ onClose }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const deviceOrientation = useDeviceOrientation();
    const moonPosition = useMoonPosition(30000); // 30초마다 갱신
    const { purchasedTerritories } = useEll();
    const insets = useSafeAreaInsets();

    // 사용자 위치
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

    // 오늘의 달 궤적 (30분 간격, 48포인트)
    const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);

    // 월출/월몰 시각
    const [riseSetInfo, setRiseSetInfo] = useState<{
        riseTime: string | null;
        setTime: string | null;
        transitTime: string | null;
        transitAlt: number | null;
    }>({ riseTime: null, setTime: null, transitTime: null, transitAlt: null });

    // ── 초점 ──
    const [isFocusedMode, setIsFocusedMode] = useState(false);
    const [cesiumReady, setCesiumReady] = useState(false);
    const [cesiumLoadFailed, setCesiumLoadFailed] = useState(false);
    const cesiumTimeoutRef = useRef<any>(null);
    const cesiumRetryCount = useRef(0);
    const [showTerritory, setShowTerritory] = useState(false);
    const cesiumWebViewRef = useRef<WebView>(null);
    const [cesiumKey, setCesiumKey] = useState(0);
    const cesiumARHtml = useMemo(() => createCesiumARHtml(), []);

    // ── Cesium 로딩 타임아웃 (5초) + 자동 재시도 (최대 3회, 초기 로딩 시에만) ──
    const cesiumWasReady = useRef(false); // 한번이라도 로딩 성공했으면 true
    useEffect(() => {
        if (isFocusedMode && !cesiumReady && !cesiumWasReady.current) {
            cesiumTimeoutRef.current = setTimeout(() => {
                if (cesiumRetryCount.current < 2) {
                    cesiumRetryCount.current += 1;
                    console.log(`[Cesium] 재시도 ${cesiumRetryCount.current}/3`);
                    setCesiumKey(k => k + 1);
                } else {
                    Alert.alert('로딩 실패', '네트워크 연결을 확인해주세요.', [{ text: '확인' }]);
                    setIsFocusedMode(false);
                    setCesiumReady(false);
                    setShowTerritory(false);
                    cesiumRetryCount.current = 0;
                }
            }, 5000);
        }
        if (cesiumReady) {
            cesiumWasReady.current = true;
            cesiumRetryCount.current = 0;
            setCesiumLoadFailed(false);
            if (cesiumTimeoutRef.current) {
                clearTimeout(cesiumTimeoutRef.current);
                cesiumTimeoutRef.current = null;
            }
        }
        if (!isFocusedMode) {
            cesiumWasReady.current = false; // 포커스 해제 시 리셋
        }
        return () => {
            if (cesiumTimeoutRef.current) clearTimeout(cesiumTimeoutRef.current);
        };
    }, [isFocusedMode, cesiumReady, cesiumKey]);

    // ── 초점 트리거 ──
    const focusTimerRef = React.useRef<any>(null);
    const [focusProgress, setFocusProgress] = useState(0);

    // ── 별 깜박임 애니메이션 ──
    const twinkleAnims = useRef(
        Array.from({ length: 4 }, () => new Animated.Value(1))
    ).current;

    useEffect(() => {
        if (!isFocusedMode) return;
        const loops = twinkleAnims.map((anim: Animated.Value, idx: number) => {
            const duration = 1500 + idx * 700;
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, { toValue: 0.3, duration, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 1, duration: duration * 0.8, useNativeDriver: true }),
                ])
            );
        });
        loops.forEach((l: Animated.CompositeAnimation) => l.start());
        return () => loops.forEach((l: Animated.CompositeAnimation) => l.stop());
    }, [isFocusedMode]);

    // ── 유성 애니메이션 ──
    const [meteor, setMeteor] = useState<{ x: number; y: number; angle: number; len: number } | null>(null);
    const meteorAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!isFocusedMode) return;
        let timer: any;
        const spawnMeteor = () => {
            const x = Math.random() * SCREEN_WIDTH;
            const y = Math.random() * SCREEN_HEIGHT * 0.5;
            const angle = 20 + Math.random() * 40;
            const len = 80 + Math.random() * 120;
            setMeteor({ x, y, angle, len });
            meteorAnim.setValue(0);
            Animated.timing(meteorAnim, {
                toValue: 1,
                duration: 600 + Math.random() * 400,
                useNativeDriver: true,
            }).start(() => {
                setMeteor(null);
                timer = setTimeout(spawnMeteor, 5000 + Math.random() * 10000);
            });
        };
        timer = setTimeout(spawnMeteor, 2000 + Math.random() * 3000);
        return () => { clearTimeout(timer); setMeteor(null); };
    }, [isFocusedMode]);

    // ── 위치 획득 & 궤적 계산 ──
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const lat = loc.coords.latitude;
                const lon = loc.coords.longitude;
                setUserLocation({ lat, lon });

                // === suncalc 라이브러리로 월출/월몰 계산 ===
                // 특정 날짜에 월출/월몰이 없을 수 있으므로 전날~다음날 범위에서 탐색
                const now = new Date();
                let riseTime: string | null = null;
                let setTime: string | null = null;

                // 오늘 기준 -1일 ~ +1일 범위에서 월출/월몰 탐색
                for (let dayOffset = 0; dayOffset <= 1 && (!riseTime || !setTime); dayOffset++) {
                    const offsets = dayOffset === 0 ? [0] : [-1, 1];
                    for (const off of offsets) {
                        const checkDate = new Date(now);
                        checkDate.setDate(checkDate.getDate() + off);
                        const moonTimes = SunCalc.getMoonTimes(checkDate, lat, lon);
                        if (!riseTime && moonTimes.rise && !moonTimes.alwaysUp && !moonTimes.alwaysDown) {
                            riseTime = `${moonTimes.rise.getHours().toString().padStart(2, '0')}:${moonTimes.rise.getMinutes().toString().padStart(2, '0')}`;
                        }
                        if (!setTime && moonTimes.set && !moonTimes.alwaysUp && !moonTimes.alwaysDown) {
                            setTime = `${moonTimes.set.getHours().toString().padStart(2, '0')}:${moonTimes.set.getMinutes().toString().padStart(2, '0')}`;
                        }
                    }
                }

                // === 궤적 계산 (Meeus, SVG 렌더링용 30분 간격) ===
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                const points: TrajectoryPoint[] = [];
                let transitTime: string | null = null;
                let transitAlt: number = -999;

                for (let i = 0; i <= 48; i++) {
                    const minutes = i * 30;
                    const t = new Date(startOfDay.getTime() + minutes * 60000);
                    const pos = calculateMoonAltAz(lat, lon, t);

                    points.push({
                        hour: minutes / 60,
                        azimuth: pos.azimuth,
                        altitude: pos.altitude,
                        isAboveHorizon: pos.altitude > 0,
                    });

                    // 남중 고도 탐지
                    if (pos.altitude > transitAlt) {
                        transitAlt = pos.altitude;
                        const h = Math.floor(minutes / 60);
                        const m = minutes % 60;
                        transitTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                }

                setTrajectory(points);
                setRiseSetInfo({
                    riseTime,
                    setTime,
                    transitTime,
                    transitAlt: transitAlt > -90 ? Math.round(transitAlt * 10) / 10 : null,
                });
            } catch (e) {
                console.error('[AR2] trajectory calc error:', e);
            }
        })();
    }, []);

    // ════════════════════════════════════════════════════════════════
    // ★ 3D 투영
    // ════════════════════════════════════════════════════════════════
    const CAM_FOV_X = 60;
    const CAM_FOV_Y = 80;
    const FOCAL_X = SCREEN_WIDTH / (2 * Math.tan((CAM_FOV_X / 2) * RAD));
    const FOCAL_Y = SCREEN_HEIGHT / (2 * Math.tan((CAM_FOV_Y / 2) * RAD));

    const azAltToWorld = useCallback((az: number, alt: number): [number, number, number] => {
        const a = az * RAD, e = alt * RAD;
        return [
            Math.cos(e) * Math.sin(a),
            Math.cos(e) * Math.cos(a),
            Math.sin(e),
        ];
    }, []);

    const worldToScreen = useCallback((
        wx: number, wy: number, wz: number,
        fwd: [number, number, number],
        right: [number, number, number],
        up: [number, number, number]
    ): { x: number; y: number; inFront: boolean } => {
        const cx = wx * right[0] + wy * right[1] + wz * right[2];
        const cy = wx * up[0] + wy * up[1] + wz * up[2];
        const cz = wx * fwd[0] + wy * fwd[1] + wz * fwd[2];

        if (cz <= 0.001) {
            return { x: SCREEN_WIDTH / 2 + cx * 1000, y: SCREEN_HEIGHT / 2 - cy * 1000, inFront: false };
        }

        return {
            x: SCREEN_WIDTH / 2 + (cx / cz) * FOCAL_X,
            y: SCREEN_HEIGHT / 2 - (cy / cz) * FOCAL_Y,
            inFront: true,
        };
    }, [FOCAL_X, FOCAL_Y]);

    // ── 달 현재 화면 위치 ──
    const moonProj = useMemo(() => {
        // 대기 굴절 보정 (Bennett 공식) — 낮은 고도에서 달이 실제보다 높게 보임
        let apparentAlt = moonPosition.altitude;
        if (apparentAlt > -1) {
            const r = 1.02 / Math.tan((apparentAlt + 10.3 / (apparentAlt + 5.11)) * Math.PI / 180) / 60;
            apparentAlt += r;
        }
        const [mx, my, mz] = azAltToWorld(moonPosition.azimuth, apparentAlt);
        const result = worldToScreen(
            mx, my, mz,
            deviceOrientation.forward, deviceOrientation.right, deviceOrientation.up
        );
        const margin = 50;
        const onScreen = result.inFront
            && result.x >= -margin && result.x <= SCREEN_WIDTH + margin
            && result.y >= -margin && result.y <= SCREEN_HEIGHT + margin;
        return { ...result, onScreen };
    }, [moonPosition, deviceOrientation, azAltToWorld, worldToScreen]);

    // ── 궤적 화면 투영 ──
    const trajectoryScreenPoints = useMemo(() => {
        return trajectory.map(pt => {
            const [wx, wy, wz] = azAltToWorld(pt.azimuth, pt.altitude);
            const screen = worldToScreen(
                wx, wy, wz,
                deviceOrientation.forward, deviceOrientation.right, deviceOrientation.up
            );
            return { ...pt, ...screen };
        });
    }, [trajectory, deviceOrientation, azAltToWorld, worldToScreen]);

    const moonScreenX = moonProj.x;
    const moonScreenY = moonProj.y;
    const isVisible = moonProj.onScreen;

    // ── 방향 가이드 ──
    const directionGuide = useMemo(() => {
        if (isVisible) return null;
        const dx = moonScreenX - SCREEN_WIDTH / 2;
        const dy = moonScreenY - SCREEN_HEIGHT / 2;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        const nx = dx / len;
        const ny = dy / len;
        const pad = 40;
        const halfW = SCREEN_WIDTH / 2 - pad;
        const halfH = SCREEN_HEIGHT / 2 - pad;
        let t = Infinity;
        if (Math.abs(nx) > 0.001) t = Math.min(t, halfW / Math.abs(nx));
        if (Math.abs(ny) > 0.001) t = Math.min(t, halfH / Math.abs(ny));
        const edgeX = SCREEN_WIDTH / 2 + nx * t;
        const edgeY = SCREEN_HEIGHT / 2 + ny * t;
        const rotation = Math.atan2(ny, nx) * DEG + 90;

        let diffAz = moonPosition.azimuth - deviceOrientation.azimuth;
        if (diffAz > 180) diffAz -= 360;
        if (diffAz < -180) diffAz += 360;
        const diffAlt = moonPosition.altitude - deviceOrientation.altitude;
        const distAngle = Math.sqrt(diffAz * diffAz + diffAlt * diffAlt);

        return { x: edgeX, y: edgeY, rotation, opacity: Math.min(1, Math.max(0.3, distAngle / 180)), distAngle };
    }, [isVisible, moonScreenX, moonScreenY, moonPosition, deviceOrientation]);

    // ── 각도 차이 ──
    const getAngleDiff = (a1: number, a2: number) => {
        let diff = a1 - a2;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    };
    const diffAz = Math.abs(getAngleDiff(moonPosition.azimuth, deviceOrientation.azimuth));
    const diffAlt = Math.abs(getAngleDiff(moonPosition.altitude, deviceOrientation.altitude));
    const isMatched = diffAz < 5 && diffAlt < 5;

    // ── 1초 초점 트리거 로직 ──
    useEffect(() => {
        if (isMatched && !isFocusedMode) {
            if (!focusTimerRef.current) {
                const startTime = Date.now();
                focusTimerRef.current = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(1, elapsed / 1000);
                    setFocusProgress(progress);
                    if (progress >= 1) {
                        if (focusTimerRef.current) clearInterval(focusTimerRef.current);
                        focusTimerRef.current = null;
                        setIsFocusedMode(true);
                        Vibration.vibrate(50);
                    }
                }, 16);
            }
        } else {
            if (focusTimerRef.current) {
                clearInterval(focusTimerRef.current);
                focusTimerRef.current = null;
            }
            setFocusProgress(0);
        }
        return () => {
            if (focusTimerRef.current) clearInterval(focusTimerRef.current);
        };
    }, [isMatched, isFocusedMode]);

    // ── 방위각을 방향 텍스트로 ──
    const azToDirection = (az: number): string => {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return dirs[Math.round(az / 22.5) % 16];
    };
    const azToDirectionKr = (az: number): string => {
        const dirs = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
            '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        return dirs[Math.round(az / 22.5) % 16];
    };

    // ── 위상 이름 ──
    const getPhaseName = (phase: number): string => {
        if (phase < 0.03 || phase > 0.97) return '🌑 새달';
        if (phase < 0.22) return '🌒 초승달';
        if (phase < 0.28) return '🌓 상현달';
        if (phase < 0.47) return '🌔 상현망';
        if (phase < 0.53) return '🌕 보름달';
        if (phase < 0.72) return '🌖 하현망';
        if (phase < 0.78) return '🌗 하현달';
        return '🌘 그믐달';
    };

    // ── 현재 시간 (0~24 시 단위) ──
    const nowHour = useMemo(() => {
        const now = new Date();
        return now.getHours() + now.getMinutes() / 60;
    }, [moonPosition]); // moonPosition 갱신 시마다 재계산

    // ── 월출 방향 계산 ──
    const moonRiseDirection = useMemo(() => {
        for (let i = 1; i < trajectory.length; i++) {
            if (trajectory[i - 1].altitude <= 0 && trajectory[i].altitude > 0) {
                const az = trajectory[i].azimuth;
                return { azimuth: Math.round(az), direction: azToDirectionKr(az) };
            }
        }
        return null;
    }, [trajectory]);

    // ════════════════════════════════════════════════════════════════
    // 렌더링
    // ════════════════════════════════════════════════════════════════

    if (!permission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD700" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <Modal visible animationType="fade" statusBarTranslucent>
                <View style={styles.permissionContainer}>
                    <MaterialCommunityIcons name="camera-off" size={64} color="#666" />
                    <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
                    <Text style={styles.permissionText}>
                        실제 달 위치 탐색을 위해{'\n'}카메라 접근 권한이 필요합니다
                    </Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                        <Text style={styles.permissionButtonText}>권한 허용</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }



    // ── 위상 영문명 ──
    const getPhaseEnglish = (phase: number): string => {
        if (phase < 0.03 || phase > 0.97) return 'New Moon';
        if (phase < 0.22) return 'Waxing Crescent';
        if (phase < 0.28) return 'First Quarter';
        if (phase < 0.47) return 'Waxing Gibbous';
        if (phase < 0.53) return 'Full Moon';
        if (phase < 0.72) return 'Waning Gibbous';
        if (phase < 0.78) return 'Last Quarter';
        return 'Waning Crescent';
    };

    // ── 위상 한글명 (이모지 없이) ──
    const getPhaseKorean = (phase: number): string => {
        if (phase < 0.03 || phase > 0.97) return '새달';
        if (phase < 0.22) return '초승달';
        if (phase < 0.28) return '상현달';
        if (phase < 0.47) return '상현망';
        if (phase < 0.53) return '보름달';
        if (phase < 0.72) return '하현망';
        if (phase < 0.78) return '하현달';
        return '그믐달';
    };

    // ── 월출 방향 화살표 ──
    const getRiseArrow = (az: number): string => {
        if (az >= 337.5 || az < 22.5) return '↑';
        if (az < 67.5) return '↗';
        if (az < 112.5) return '→';
        if (az < 157.5) return '↘';
        if (az < 202.5) return '↓';
        if (az < 247.5) return '↙';
        if (az < 292.5) return '←';
        return '↖';
    };

    return (
        <Modal visible animationType="slide" statusBarTranslucent>
            <View style={styles.container}>
                <CameraView style={styles.camera} facing="back">
                    <View style={styles.overlay}>

                        {/* ═══ ① 상단 헤더 (Figma: 264:21726) ═══ */}
                        {!isFocusedMode && (
                            <View style={[styles.topPanel, { paddingTop: insets.top, zIndex: 50, elevation: 50 }]}>
                                {/* 타이틀 행: Today's Moon + X 닫기 */}
                                <View style={styles.topTitleRow}>
                                    <View style={styles.topTitleLeft}>
                                        <Text style={styles.topLabel}>오늘의 달</Text>
                                        <Text style={styles.topPhaseName}>
                                            {getPhaseKorean(moonPosition.phase)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                                        <Ionicons name="close" size={28} color="#EBECF1" />
                                    </TouchableOpacity>
                                </View>
                                {/* 소항목 행: Illumination | Moonrise | Moonset | Altitude */}
                                <View style={styles.topInfoBar}>
                                    <View style={styles.topInfoItem}>
                                        <Text style={styles.topInfoLabel}>밝기</Text>
                                        <Text style={styles.topInfoValue}>{(moonPosition.illumination * 100).toFixed(0)}%</Text>
                                    </View>
                                    <View style={styles.topInfoDivider} />
                                    <View style={styles.topInfoItem}>
                                        <Text style={styles.topInfoLabel}>월출</Text>
                                        <Text style={styles.topInfoValue}>{riseSetInfo.riseTime ?? '--:--'}</Text>
                                    </View>
                                    <View style={styles.topInfoDivider} />
                                    <View style={styles.topInfoItem}>
                                        <Text style={styles.topInfoLabel}>월몰</Text>
                                        <Text style={styles.topInfoValue}>{riseSetInfo.setTime ?? '--:--'}</Text>
                                    </View>
                                    <View style={styles.topInfoDivider} />
                                    <View style={styles.topInfoItem}>
                                        <Text style={styles.topInfoLabel}>고도</Text>
                                        <Text style={styles.topInfoValue}>{moonPosition.altitude.toFixed(0)}°</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* 중앙 타겟 */}
                        <View style={styles.centerTargetOuter} pointerEvents="none">
                            <View style={[styles.centerTargetInner, isMatched && styles.centerTargetMatched]}>
                                <View style={styles.crosshairH} />
                                <View style={styles.crosshairV} />
                                {isMatched && !isFocusedMode && (
                                    <View style={styles.focusProgressContainer}>
                                        <View style={[styles.focusProgressBar, { width: `${focusProgress * 100}%` }]} />
                                    </View>
                                )}
                                {isMatched && <View style={styles.glowEffect} />}
                            </View>
                        </View>

                        {/* AR 오버레이 (SVG) */}
                        <AnimatedSvg pointerEvents="none" style={StyleSheet.absoluteFillObject}>

                            {/* ── 궤적 렌더링 ── */}
                            {trajectoryScreenPoints.length > 1 && (() => {
                                const segments: { points: string; above: boolean }[] = [];
                                let currentSegment: string[] = [];
                                let currentAbove = false;

                                trajectoryScreenPoints.forEach((pt, idx) => {
                                    if (!pt.inFront) {
                                        if (currentSegment.length > 1) {
                                            segments.push({ points: currentSegment.join(' '), above: currentAbove });
                                        }
                                        currentSegment = [];
                                        return;
                                    }
                                    if (Math.abs(pt.x) > SCREEN_WIDTH * 3 || Math.abs(pt.y) > SCREEN_HEIGHT * 3) {
                                        if (currentSegment.length > 1) {
                                            segments.push({ points: currentSegment.join(' '), above: currentAbove });
                                        }
                                        currentSegment = [];
                                        return;
                                    }

                                    if (currentSegment.length === 0) {
                                        currentAbove = pt.isAboveHorizon;
                                    }
                                    currentSegment.push(`${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
                                });
                                if (currentSegment.length > 1) {
                                    segments.push({ points: currentSegment.join(' '), above: currentAbove });
                                }

                                return segments.map((seg, i) => (
                                    <Polyline
                                        key={`traj-${i}`}
                                        points={seg.points}
                                        stroke={'rgba(255,255,255,0.35)'}
                                        strokeWidth={1}
                                        fill="none"
                                    />
                                ));
                            })()}

                            {/* 궤적 위 시간 라벨 + 달 아이콘 (매 2시간) */}
                            {trajectoryScreenPoints.map((pt, idx) => {
                                if (!pt.inFront) return null;
                                if (pt.hour % 2 !== 0) return null;
                                if (Math.abs(pt.x) > SCREEN_WIDTH * 2 || Math.abs(pt.y) > SCREEN_HEIGHT * 2) return null;

                                const isNow = Math.abs(pt.hour - nowHour) < 0.5;
                                const h = Math.floor(pt.hour);
                                const label = `${h.toString().padStart(2, '0')}:00`;
                                const moonR = 7.5; // 달 위상 아이콘 반지름

                                return (
                                    <G key={`label-${idx}`}>
                                        {/* 달 위상 아이콘 (속 빈 테두리 원) */}
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={moonR}
                                            fill="none"
                                            stroke={isNow ? '#EBECF1' : 'rgba(235,236,241,0.5)'}
                                            strokeWidth={1.5}
                                        />
                                        {/* 시간 텍스트 */}
                                        <SvgText
                                            x={pt.x}
                                            y={pt.y + moonR + 14}
                                            fill={isNow ? '#EBECF1' : 'rgba(235,236,241,0.7)'}
                                            fontSize={14}
                                            fontWeight="500"
                                            textAnchor="middle"
                                        >
                                            {label}
                                        </SvgText>
                                    </G>
                                );
                            })}

                            {/* 달 현재 위치 마커 */}
                            {isVisible && (
                                <G>
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={isMatched ? 38 : 28}
                                        stroke={isMatched ? '#00f0ff' : '#FFD700'}
                                        strokeWidth={2.5}
                                        fill="none"
                                        strokeDasharray={isMatched ? undefined : '8,4'}
                                    />
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={isMatched ? 18 : 12}
                                        fill={isMatched ? 'rgba(0,240,255,0.4)' : 'rgba(255,215,0,0.3)'}
                                        stroke={isMatched ? '#00f0ff' : '#FFD700'}
                                        strokeWidth={1.5}
                                    />
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={3}
                                        fill={isMatched ? '#00f0ff' : '#FFD700'}
                                    />

                                </G>
                            )}

                            {/* 방향 화살표 */}
                            {directionGuide && (
                                <G transform={`translate(${directionGuide.x}, ${directionGuide.y}) rotate(${directionGuide.rotation})`}>
                                    <Path
                                        d="M -15 15 L 0 -15 L 15 15 L 0 5 Z"
                                        fill={`rgba(255,215,0,${directionGuide.opacity})`}
                                    />
                                </G>
                            )}
                        </AnimatedSvg>

                        {/* ═══ ② 하단 — 실시간 바라보는 방향 (자이로 연동) ═══ */}
                        {!isFocusedMode && <View style={[styles.bottomPanel, { paddingBottom: Math.max(8, insets.bottom) }]}>
                            <View style={styles.bottomRow}>
                                {/* 방위 */}
                                <View style={styles.bottomStatus}>
                                    <Text style={styles.bottomStatusLabel}>방위</Text>
                                    <View style={styles.bottomValueRow}>
                                        <Text style={styles.bottomValue}>{deviceOrientation.azimuth.toFixed(0)}</Text>
                                        <Text style={styles.bottomUnit}>°</Text>
                                    </View>
                                </View>

                                <View style={styles.bottomDivider} />

                                {/* 기울기 */}
                                <View style={styles.bottomStatus}>
                                    <Text style={styles.bottomStatusLabel}>기울기</Text>
                                    <View style={styles.bottomValueRow}>
                                        <Text style={styles.bottomValue}>{deviceOrientation.altitude.toFixed(0)}</Text>
                                        <Text style={styles.bottomUnit}>°</Text>
                                    </View>
                                </View>

                                <View style={styles.bottomDivider} />

                                {/* 방향 */}
                                <View style={styles.bottomStatus}>
                                    <Text style={styles.bottomStatusLabel}>방향</Text>
                                    <View style={styles.bottomValueRow}>
                                        <Text style={styles.bottomValue}>{azToDirectionKr(deviceOrientation.azimuth)}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>}

                        {/* 매칭 토스트 */}
                        {isMatched && !isFocusedMode && (
                            <View style={styles.matchToast}>
                                <Text style={styles.matchToastText}>🎯 달을 향하고 있습니다!</Text>
                            </View>
                        )}


                    </View>
                </CameraView>

                {/* ═══ CESIUM 3D 달 오버레이 (포커스 모드) — 달 위치에 고정 ═══ */}
                {isFocusedMode && (
                    <>
                        {/* 밤하늘 필터 — SVG 리얼 우주 배경 */}
                        <View style={styles.nightSkyOverlay} pointerEvents="none">
                            <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFillObject}>
                                <Defs>
                                    {/* 배경 그래디언트 — 깊은 우주 */}
                                    <RadialGradient id="bgGrad" cx="50%" cy="40%" rx="80%" ry="80%">
                                        <Stop offset="0%" stopColor="#0c1028" stopOpacity="0.25" />
                                        <Stop offset="40%" stopColor="#070b1a" stopOpacity="0.30" />
                                        <Stop offset="100%" stopColor="#020410" stopOpacity="0.40" />
                                    </RadialGradient>
                                    {/* 성운 1 — 파란 */}
                                    <RadialGradient id="neb1" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#1a3a6e" stopOpacity="0.3" />
                                        <Stop offset="50%" stopColor="#0f2040" stopOpacity="0.12" />
                                        <Stop offset="100%" stopColor="#0f2040" stopOpacity="0" />
                                    </RadialGradient>
                                    {/* 성운 2 — 보라 */}
                                    <RadialGradient id="neb2" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#4a1a6e" stopOpacity="0.25" />
                                        <Stop offset="50%" stopColor="#2a0e40" stopOpacity="0.1" />
                                        <Stop offset="100%" stopColor="#2a0e40" stopOpacity="0" />
                                    </RadialGradient>
                                    {/* 성운 3 — 청록 */}
                                    <RadialGradient id="neb3" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#0e3a4a" stopOpacity="0.2" />
                                        <Stop offset="50%" stopColor="#082530" stopOpacity="0.08" />
                                        <Stop offset="100%" stopColor="#082530" stopOpacity="0" />
                                    </RadialGradient>
                                    {/* 은하수 띠 */}
                                    <LinearGradient id="milkyway" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <Stop offset="0%" stopColor="#8090c0" stopOpacity="0" />
                                        <Stop offset="30%" stopColor="#6080b0" stopOpacity="0.06" />
                                        <Stop offset="50%" stopColor="#90a8d0" stopOpacity="0.1" />
                                        <Stop offset="70%" stopColor="#6080b0" stopOpacity="0.06" />
                                        <Stop offset="100%" stopColor="#8090c0" stopOpacity="0" />
                                    </LinearGradient>
                                    {/* 별 글로우용 */}
                                    <RadialGradient id="starGlow1" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                                        <Stop offset="40%" stopColor="#ccdeff" stopOpacity="0.15" />
                                        <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
                                    </RadialGradient>
                                    <RadialGradient id="starGlow2" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#aaccff" stopOpacity="0.45" />
                                        <Stop offset="40%" stopColor="#6688cc" stopOpacity="0.12" />
                                        <Stop offset="100%" stopColor="#6688cc" stopOpacity="0" />
                                    </RadialGradient>
                                    <RadialGradient id="starGlow3" cx="50%" cy="50%" rx="50%" ry="50%">
                                        <Stop offset="0%" stopColor="#ffeebb" stopOpacity="0.4" />
                                        <Stop offset="40%" stopColor="#ccaa66" stopOpacity="0.1" />
                                        <Stop offset="100%" stopColor="#ccaa66" stopOpacity="0" />
                                    </RadialGradient>
                                </Defs>

                                {/* 배경 */}
                                <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#bgGrad)" />

                                {/* 은하수 띠 (대각선) */}
                                <G rotation={-25} origin={`${SCREEN_WIDTH / 2}, ${SCREEN_HEIGHT / 2}`}>
                                    <Rect x={-SCREEN_WIDTH * 0.3} y={SCREEN_HEIGHT * 0.3} width={SCREEN_WIDTH * 1.6} height={SCREEN_HEIGHT * 0.25} fill="url(#milkyway)" />
                                </G>

                                {/* 성운 */}
                                <Ellipse cx={SCREEN_WIDTH * 0.12} cy={SCREEN_HEIGHT * 0.18} rx={SCREEN_WIDTH * 0.28} ry={SCREEN_WIDTH * 0.22} fill="url(#neb1)" />
                                <Ellipse cx={SCREEN_WIDTH * 0.85} cy={SCREEN_HEIGHT * 0.72} rx={SCREEN_WIDTH * 0.24} ry={SCREEN_WIDTH * 0.2} fill="url(#neb2)" />
                                <Ellipse cx={SCREEN_WIDTH * 0.45} cy={SCREEN_HEIGHT * 0.88} rx={SCREEN_WIDTH * 0.2} ry={SCREEN_WIDTH * 0.16} fill="url(#neb3)" />

                                {/* 별 200개 */}
                                {Array.from({ length: 200 }, (_, i) => {
                                    let h = (i + 1) * 2654435761;
                                    h = ((h >> 16) ^ h) * 0x45d9f3b;
                                    const h1 = (h >>> 0);
                                    h = ((h >> 16) ^ h) * 0x3335b369;
                                    const h2 = (h >>> 0);
                                    const h3 = ((h >> 8) ^ (h * 7)) >>> 0;

                                    const sx = (h1 % 10000) / 10000 * SCREEN_WIDTH;
                                    const sy = (h2 % 10000) / 10000 * SCREEN_HEIGHT;
                                    const sizeRand = (h3 % 1000) / 1000;
                                    const brightness = 0.35 + ((h3 >> 10) % 650) / 1000;

                                    let r: number;
                                    if (sizeRand < 0.65) r = 0.2 + sizeRand * 0.4;
                                    else if (sizeRand < 0.9) r = 0.5 + (sizeRand - 0.65) * 1.5;
                                    else r = 0.9 + (sizeRand - 0.9) * 3;

                                    const ct = ((h3 >> 20) % 100);
                                    let fill: string;
                                    let glowId: string;
                                    if (ct < 70) { fill = `rgba(255,255,255,${brightness.toFixed(2)})`; glowId = 'starGlow1'; }
                                    else if (ct < 82) { fill = `rgba(170,200,255,${brightness.toFixed(2)})`; glowId = 'starGlow2'; }
                                    else if (ct < 92) { fill = `rgba(255,235,180,${(brightness * 0.9).toFixed(2)})`; glowId = 'starGlow3'; }
                                    else { fill = `rgba(255,180,160,${(brightness * 0.8).toFixed(2)})`; glowId = 'starGlow3'; }

                                    return (
                                        <G key={`s${i}`}>
                                            {r > 0.8 && <Circle cx={sx} cy={sy} r={r * 3} fill={`url(#${glowId})`} />}
                                            <Circle cx={sx} cy={sy} r={r} fill={fill} />
                                        </G>
                                    );
                                })}
                            </Svg>

                            {/* 별 깜박임 레이어 */}
                            {twinkleAnims.map((anim, gIdx) => (
                                <Animated.View
                                    key={`twinkle-g${gIdx}`}
                                    style={{
                                        ...StyleSheet.absoluteFillObject,
                                        opacity: anim,
                                    }}
                                    pointerEvents="none"
                                >
                                    {Array.from({ length: 12 }, (_, j) => {
                                        const idx = gIdx * 12 + j;
                                        let h = (idx + 200) * 1364435761;
                                        h = ((h >> 16) ^ h) * 0x45d9f3b;
                                        const px = ((h >>> 0) % 10000) / 100;
                                        h = ((h >> 13) ^ h) * 0x3335b369;
                                        const py = ((h >>> 0) % 10000) / 100;
                                        const sz = 1.5 + ((h >>> 8) % 20) / 10;
                                        return (
                                            <View
                                                key={`tw${idx}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${px}%`,
                                                    top: `${py}%`,
                                                    width: sz,
                                                    height: sz,
                                                    borderRadius: sz / 2,
                                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                                    shadowColor: '#fff',
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0.8,
                                                    shadowRadius: sz * 2,
                                                } as any}
                                            />
                                        );
                                    })}
                                </Animated.View>
                            ))}

                            {/* 유성 */}
                            {meteor && (
                                <Animated.View
                                    style={{
                                        position: 'absolute',
                                        left: meteor.x,
                                        top: meteor.y,
                                        width: meteor.len,
                                        height: 2,
                                        borderRadius: 1,
                                        transform: [
                                            { rotate: `${meteor.angle}deg` },
                                            { translateX: meteorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, meteor.len * 2] }) },
                                        ],
                                        opacity: meteorAnim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        shadowColor: '#fff',
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowOpacity: 0.9,
                                        shadowRadius: 6,
                                    } as any}
                                    pointerEvents="none"
                                />
                            )}
                        </View>
                        {/* Cesium 3D 달 — 실제 달 위치에 고정 */}
                        <View
                            style={[
                                styles.cesiumOverlay,
                                {
                                    transform: [
                                        { translateX: moonScreenX - SCREEN_WIDTH / 2 },
                                        { translateY: moonScreenY - SCREEN_HEIGHT / 2 },
                                    ],
                                }
                            ]}
                            pointerEvents="box-none"
                        >
                            <WebView
                                key={`cesium-${cesiumKey}`}
                                ref={cesiumWebViewRef}
                                source={{ html: cesiumARHtml, baseUrl: 'https://cesium.com' }}
                                style={styles.cesiumWebView}
                                originWhitelist={['*']}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                allowsInlineMediaPlayback={true}
                                mediaPlaybackRequiresUserAction={false}
                                scrollEnabled={false}
                                bounces={false}
                                overScrollMode="never"
                                allowFileAccess={true}
                                allowFileAccessFromFileURLs={true}
                                allowUniversalAccessFromFileURLs={true}
                                mixedContentMode="always"
                                {...(Platform.OS === 'ios'
                                    ? { opaque: false } as any
                                    : {}
                                )}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'AR_CESIUM_READY') {
                                            setCesiumReady(true);
                                            const phase = moonPosition.phase;
                                            cesiumWebViewRef.current?.injectJavaScript(`
                                                if (window.startZoomIn) window.startZoomIn();
                                                if (window.setMoonPhase) window.setMoonPhase(${phase});
                                                true;
                                            `);
                                        } else if (data.type === 'AR_CESIUM_ERROR') {
                                            console.warn('[AR Cesium] Init error:', data.error);
                                        } else if (data.type === 'AR_CESIUM_LOG') {
                                            console.log('[AR Cesium]', data.step, data.error || '');
                                        } else if (data.type === 'TERRITORY_TOGGLED') {
                                            setShowTerritory(data.visible);
                                        } else if (data.type === 'CLOSE_AR') {
                                            setIsFocusedMode(false);
                                            setCesiumReady(false);
                                            setShowTerritory(false);
                                        }
                                    } catch (e) { }
                                }}
                                onError={(err) => {
                                    console.warn('[AR Cesium] WebView error:', err.nativeEvent);
                                }}
                                onHttpError={(syntheticEvent) => {
                                    console.warn('[AR Cesium] HTTP error:', syntheticEvent.nativeEvent);
                                }}
                            />
                            {!cesiumReady && (
                                <View style={styles.cesiumLoading}>
                                    {cesiumLoadFailed ? (
                                        <Text style={[styles.cesiumLoadingText, { color: '#999' }]}>네트워크 연결을 확인해주세요</Text>
                                    ) : (
                                        <>
                                            <ActivityIndicator size="large" color="#00f0ff" />
                                            <Text style={styles.cesiumLoadingText}>로딩 중...</Text>
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/* ═══ 포커스 모드 UI 버튼 — container 최하단 자식으로 렌더링 (WebView 위에 확실히 배치) ═══ */}
                {isFocusedMode && (
                    <>
                        <TouchableOpacity
                            style={styles.focusExitBtn}
                            onPress={() => {
                                setIsFocusedMode(false);
                                setCesiumReady(false);
                                setShowTerritory(false);
                            }}
                            activeOpacity={0.6}
                        >
                            <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                        {cesiumReady && (
                            <TouchableOpacity
                                style={[styles.territoryBtn, showTerritory && styles.territoryBtnActive]}
                                onPress={() => {
                                    if (purchasedTerritories.length === 0) return;

                                    // 실제 구매한 셀을 위치별로 그룹핑
                                    const cellsByRegion: Record<string, { lat: number; lng: number; count: number; cells: string[] }> = {};
                                    purchasedTerritories.forEach(c => {
                                        const key = `${Math.round(c.lat)}_${Math.round(c.lng)}`;
                                        if (!cellsByRegion[key]) {
                                            cellsByRegion[key] = { lat: c.lat, lng: c.lng, count: 0, cells: [] };
                                        }
                                        cellsByRegion[key].count++;
                                        cellsByRegion[key].cells.push(c.token);
                                        cellsByRegion[key].lat = (cellsByRegion[key].lat * (cellsByRegion[key].count - 1) + c.lat) / cellsByRegion[key].count;
                                        cellsByRegion[key].lng = (cellsByRegion[key].lng * (cellsByRegion[key].count - 1) + c.lng) / cellsByRegion[key].count;
                                    });
                                    const regions = Object.values(cellsByRegion);
                                    const cellTokens = purchasedTerritories.map(c => c.token);
                                    cesiumWebViewRef.current?.injectJavaScript(`
                                        (function() {
                                            var event = new MessageEvent('message', {
                                                data: JSON.stringify({
                                                    type: 'TOGGLE_TERRITORIES',
                                                    cellTokens: ${JSON.stringify(cellTokens)},
                                                    regions: ${JSON.stringify(regions)}
                                                })
                                            });
                                            window.dispatchEvent(event);
                                        })();
                                        true;
                                    `);
                                }}
                            >
                                <Ionicons name={showTerritory ? 'location' : 'location-outline'} size={18} color="#fff" />
                                <Text style={styles.territoryBtnText}>{showTerritory ? '구역 숨기기' : '내 구역 보기'}</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* 닫기 버튼은 상단 헤더에 포함 */}
            </View>
        </Modal>
    );
}

const AnimatedSvg = Svg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    camera: { flex: 1 },
    overlay: { flex: 1 },

    // ═══ ① 상단 패널 (Figma: 264:21726) ═══
    topPanel: {
        paddingBottom: 2,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    topTitleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingTop: 20,
    },
    topTitleLeft: {
        flex: 1,
        gap: 2,
    },
    topLabel: {
        color: '#999999',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 21,
    },
    topPhaseName: {
        color: '#EBECF1',
        fontSize: 18,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 10,
        zIndex: 100,
    },
    topInfoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        borderRadius: 8,
        marginTop: 15,
    },
    topInfoItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    topInfoLabel: {
        color: '#999999',
        fontSize: 12,
        fontWeight: '400',
        letterSpacing: -0.24,
    },
    topInfoValue: {
        color: '#7295FE',
        fontSize: 12,
        fontWeight: '400',
        letterSpacing: -0.24,
    },
    topInfoDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },

    // ═══ 중앙 타겟 ═══
    centerTargetOuter: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerTargetInner: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center', alignItems: 'center',
    },
    centerTargetMatched: { borderColor: '#00f0ff', borderWidth: 2 },
    crosshairH: { position: 'absolute', width: 140, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    crosshairV: { position: 'absolute', height: 140, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    glowEffect: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0, 240, 255, 0.15)' },

    // ═══ ② 하단 패널 (Figma: 264:21709) ═══
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    axisContainer: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 10,
    },
    axisRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    axisLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        width: 28,
        textAlign: 'center',
    },
    axisTrack: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 3,
        position: 'relative' as const,
        justifyContent: 'center' as const,
    },
    axisCenter: {
        position: 'absolute' as const,
        left: '50%',
        width: 2,
        height: 14,
        marginLeft: -1,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 1,
    },
    axisIndicator: {
        position: 'absolute' as const,
        width: 12,
        height: 12,
        borderRadius: 6,
        marginLeft: -6,
        backgroundColor: '#7295FE',
    },
    axisIndicatorClose: {
        backgroundColor: '#6ff59a',
        shadowColor: '#6ff59a',
        shadowOpacity: 0.6,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
    },
    axisArrow: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 18,
        fontWeight: '600',
        width: 24,
        textAlign: 'center' as const,
    },
    axisArrowClose: {
        color: '#6ff59a',
    },
    bottomRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingTop: 6,
        paddingBottom: 8,
    },
    bottomStatus: {
        flex: 1,
        alignItems: 'center' as const,
        gap: 5,
    },
    bottomStatusLabel: {
        color: '#999999',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 21,
    },
    bottomValueRow: {
        flexDirection: 'row' as const,
        alignItems: 'flex-end' as const,
        gap: 4,
    },
    bottomValue: {
        color: '#EBECF1',
        fontSize: 18,
        fontWeight: '500',
    },
    bottomUnit: {
        color: '#808080',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.24,
        paddingBottom: 1,
    },
    bottomDivider: {
        width: 1,
        height: 44,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    gageContainer: {
        paddingHorizontal: 18,
        width: '100%',
    },
    gageBg: {
        height: 7,
        backgroundColor: '#707070',
        borderRadius: 10,
        overflow: 'hidden' as const,
    },
    gageFill: {
        height: '100%',
        borderRadius: 10,
        backgroundColor: '#7295FE',
    },

    // ═══ 매칭 토스트 ═══
    matchToast: {
        position: 'absolute',
        bottom: 140,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 240, 255, 0.25)',
        borderWidth: 1,
        borderColor: '#00f0ff',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    matchToastText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
        textShadowColor: 'black',
        textShadowRadius: 2,
        textShadowOffset: { width: 1, height: 1 },
    },

    // ═══ 권한 ═══
    permissionContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 20 },
    permissionText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 },
    permissionButton: { backgroundColor: '#FFD700', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 40 },
    permissionButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
    closeButton: { position: 'absolute', top: 50, right: 30 },

    // ═══ 포커스 프로그레스 ═══
    focusProgressContainer: {
        position: 'absolute',
        bottom: 10,
        width: 60,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    focusProgressBar: {
        height: '100%',
        backgroundColor: '#00f0ff',
    },

    // ═══ 밤하늘 오버레이 ═══
    nightSkyOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: 'rgba(5, 5, 20, 0.35)',
        zIndex: 15,
    },

    // ═══ Cesium AR 오버레이 (달 위치 추적) ═══
    cesiumOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        zIndex: 20,
    },
    cesiumWebView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    cesiumLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    cesiumLoadingText: {
        color: '#00f0ff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
    },
    focusExitBtn: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 9999,
        elevation: 9999,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    territoryBtn: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 9999,
        elevation: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.5)',
    },
    territoryBtnActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderColor: 'rgba(147, 197, 253, 0.7)',
    },
    territoryBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    focusInfoBar: {
        position: 'absolute',
        bottom: 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    focusInfoItem: {
        alignItems: 'center',
        flex: 1,
    },
    focusInfoLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 4,
    },
    focusInfoValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    focusInfoDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
});
