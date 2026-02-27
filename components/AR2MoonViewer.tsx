import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, G, Text as SvgText, Path, Polyline, Rect } from 'react-native-svg';
import * as Location from 'expo-location';

import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { useMoonPosition, calculateMoonAltAz } from '@/hooks/useMoonPosition';
import { Vibration } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

    // ── 초점 트리거 ──
    const focusTimerRef = React.useRef<any>(null);
    const [focusProgress, setFocusProgress] = useState(0);

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

                // 오늘 0시부터 24시까지 30분 간격으로 계산
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                const points: TrajectoryPoint[] = [];

                let riseTime: string | null = null;
                let setTime: string | null = null;
                let transitTime: string | null = null;
                let transitAlt: number = -999;
                let prevAlt = -999;

                for (let i = 0; i <= 48; i++) {
                    const t = new Date(startOfDay.getTime() + i * 30 * 60000);
                    const pos = calculateMoonAltAz(lat, lon, t);
                    const aboveHorizon = pos.altitude > 0;

                    points.push({
                        hour: i * 0.5,
                        azimuth: pos.azimuth,
                        altitude: pos.altitude,
                        isAboveHorizon: aboveHorizon,
                    });

                    // 월출/월몰 탐지
                    if (prevAlt !== -999) {
                        if (prevAlt <= 0 && pos.altitude > 0) {
                            const h = Math.floor((i * 0.5));
                            const m = ((i * 0.5) % 1) * 60;
                            riseTime = `${h.toString().padStart(2, '0')}:${Math.round(m).toString().padStart(2, '0')}`;
                        }
                        if (prevAlt > 0 && pos.altitude <= 0) {
                            const h = Math.floor((i * 0.5));
                            const m = ((i * 0.5) % 1) * 60;
                            setTime = `${h.toString().padStart(2, '0')}:${Math.round(m).toString().padStart(2, '0')}`;
                        }
                    }

                    // 남중 고도 탐지
                    if (pos.altitude > transitAlt) {
                        transitAlt = pos.altitude;
                        const h = Math.floor((i * 0.5));
                        const m = ((i * 0.5) % 1) * 60;
                        transitTime = `${h.toString().padStart(2, '0')}:${Math.round(m).toString().padStart(2, '0')}`;
                    }

                    prevAlt = pos.altitude;
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
        const [mx, my, mz] = azAltToWorld(moonPosition.azimuth, moonPosition.altitude);
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

    return (
        <Modal visible animationType="slide" statusBarTranslucent>
            <View style={styles.container}>
                <CameraView style={styles.camera} facing="back">
                    <View style={styles.overlay}>

                        {/* 닫기 버튼 */}
                        <TouchableOpacity style={styles.backButton} onPress={onClose}>
                            <Ionicons name="chevron-down" size={32} color="#fff" />
                        </TouchableOpacity>

                        {/* 상단 정보 배너 */}
                        <View style={styles.topInfoBox}>
                            <Text style={styles.headerTitle}>🌙 실제 달 찾기</Text>
                            <View style={styles.headerRow}>
                                <Text style={styles.headerSubtitle}>
                                    {moonPosition.isVisible ? '달이 하늘에 떠 있습니다' : '달이 지평선 아래에 있습니다'}
                                </Text>
                                <View style={[styles.statusDot, { backgroundColor: moonPosition.isVisible ? '#4CAF50' : '#FF5252' }]} />
                            </View>
                            <Text style={styles.headerPhase}>
                                {getPhaseName(moonPosition.phase)} · 밝기 {(moonPosition.illumination * 100).toFixed(0)}%
                            </Text>
                        </View>

                        {/* 중앙 타겟 */}
                        <View style={styles.centerTargetOuter}>
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
                                // 카메라 앞쪽에 있는 연속된 점들을 세그먼트로 그룹화
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
                                    // 화면에서 너무 벗어난 점은 제외
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
                                        stroke={seg.above ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.15)'}
                                        strokeWidth={seg.above ? 2 : 1}
                                        strokeDasharray={seg.above ? undefined : '4,4'}
                                        fill="none"
                                    />
                                ));
                            })()}

                            {/* 궤적 위 시간 라벨 (매 2시간) */}
                            {trajectoryScreenPoints.map((pt, idx) => {
                                if (!pt.inFront) return null;
                                if (pt.hour % 2 !== 0) return null;
                                if (Math.abs(pt.x) > SCREEN_WIDTH * 2 || Math.abs(pt.y) > SCREEN_HEIGHT * 2) return null;

                                const isNow = Math.abs(pt.hour - nowHour) < 0.5;
                                const label = `${Math.floor(pt.hour)}시`;

                                return (
                                    <G key={`label-${idx}`}>
                                        <Circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={isNow ? 5 : 3}
                                            fill={isNow ? '#FF6B6B' : pt.isAboveHorizon ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.3)'}
                                        />
                                        <SvgText
                                            x={pt.x}
                                            y={pt.y - 10}
                                            fill={isNow ? '#FF6B6B' : '#fff'}
                                            fontSize={isNow ? 11 : 9}
                                            fontWeight={isNow ? 'bold' : 'normal'}
                                            textAnchor="middle"
                                            opacity={isNow ? 1 : 0.7}
                                        >
                                            {label}
                                        </SvgText>
                                    </G>
                                );
                            })}

                            {/* 달 현재 위치 마커 */}
                            {isVisible && (
                                <G>
                                    {/* 외곽 링 */}
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={isMatched ? 38 : 28}
                                        stroke={isMatched ? '#00f0ff' : '#FFD700'}
                                        strokeWidth={2.5}
                                        fill="none"
                                        strokeDasharray={isMatched ? undefined : '8,4'}
                                    />
                                    {/* 내부 원 */}
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={isMatched ? 18 : 12}
                                        fill={isMatched ? 'rgba(0,240,255,0.4)' : 'rgba(255,215,0,0.3)'}
                                        stroke={isMatched ? '#00f0ff' : '#FFD700'}
                                        strokeWidth={1.5}
                                    />
                                    {/* 중심점 */}
                                    <Circle
                                        cx={moonScreenX}
                                        cy={moonScreenY}
                                        r={3}
                                        fill={isMatched ? '#00f0ff' : '#FFD700'}
                                    />
                                    {/* 라벨 */}
                                    <SvgText
                                        x={moonScreenX}
                                        y={moonScreenY - (isMatched ? 48 : 38)}
                                        fill="#fff"
                                        fontSize={14}
                                        fontWeight="bold"
                                        textAnchor="middle"
                                    >
                                        🌙 Moon
                                    </SvgText>
                                    <SvgText
                                        x={moonScreenX}
                                        y={moonScreenY + (isMatched ? 55 : 45)}
                                        fill="rgba(255,255,255,0.8)"
                                        fontSize={10}
                                        textAnchor="middle"
                                    >
                                        {Math.round(moonPosition.distance).toLocaleString()}km
                                    </SvgText>
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



                        {/* 하단 HUD vs 위성 목록 */}
                        {!isFocusedMode && (
                            <View style={styles.bottomHud}>
                                {/* 달 정보 행 */}
                                <View style={styles.hudSection}>
                                    <Text style={styles.hudSectionTitle}>🌙 달</Text>
                                    <View style={styles.hudGrid}>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>방위</Text>
                                            <Text style={styles.hudValue}>{moonPosition.azimuth.toFixed(1)}°</Text>
                                            <Text style={styles.hudSub}>{azToDirectionKr(moonPosition.azimuth)}</Text>
                                        </View>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>고도</Text>
                                            <Text style={[styles.hudValue, moonPosition.altitude < 0 && { color: '#FF6B6B' }]}>
                                                {moonPosition.altitude.toFixed(1)}°
                                            </Text>
                                        </View>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>거리</Text>
                                            <Text style={styles.hudValue}>{(moonPosition.distance / 1000).toFixed(1)}</Text>
                                            <Text style={styles.hudSub}>만km</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* 카메라 정보 행 */}
                                <View style={[styles.hudSection, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                                    <Text style={styles.hudSectionTitle}>📱 카메라</Text>
                                    <View style={styles.hudGrid}>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>방위</Text>
                                            <Text style={[styles.hudValue, diffAz < 5 && styles.hudValueMatch]}>
                                                {deviceOrientation.azimuth.toFixed(1)}°
                                            </Text>
                                            <Text style={styles.hudSub}>{azToDirectionKr(deviceOrientation.azimuth)}</Text>
                                        </View>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>고도</Text>
                                            <Text style={[styles.hudValue, diffAlt < 5 && styles.hudValueMatch]}>
                                                {deviceOrientation.altitude.toFixed(1)}°
                                            </Text>
                                        </View>
                                        <View style={styles.hudCell}>
                                            <Text style={styles.hudLabel}>차이</Text>
                                            <Text style={[styles.hudValue, isMatched && styles.hudValueMatch]}>
                                                {Math.sqrt(diffAz * diffAz + diffAlt * diffAlt).toFixed(1)}°
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* 오늘의 달 정보 */}
                                <View style={[styles.hudSection, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                                    <View style={styles.riseSetRow}>
                                        <View style={styles.riseSetItem}>
                                            <Text style={styles.riseSetLabel}>🌅 월출</Text>
                                            <Text style={styles.riseSetValue}>{riseSetInfo.riseTime ?? '--:--'}</Text>
                                        </View>
                                        <View style={styles.riseSetItem}>
                                            <Text style={styles.riseSetLabel}>☀️ 남중</Text>
                                            <Text style={styles.riseSetValue}>
                                                {riseSetInfo.transitTime ?? '--:--'}
                                                {riseSetInfo.transitAlt !== null && ` (${riseSetInfo.transitAlt}°)`}
                                            </Text>
                                        </View>
                                        <View style={styles.riseSetItem}>
                                            <Text style={styles.riseSetLabel}>🌇 월몰</Text>
                                            <Text style={styles.riseSetValue}>{riseSetInfo.setTime ?? '--:--'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* 매칭 토스트 */}
                        {isMatched && !isFocusedMode && (
                            <View style={styles.matchToast}>
                                <Text style={styles.matchToastText}>🎯 달을 향하고 있습니다!</Text>
                            </View>
                        )}

                    </View>
                </CameraView>
            </View>
        </Modal>
    );
}

const AnimatedSvg = Svg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'space-between' },
    backButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 },

    topInfoBox: {
        marginTop: 55,
        marginHorizontal: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        padding: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.25)',
    },
    headerTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
    headerSubtitle: { color: '#fff', fontSize: 13 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    headerPhase: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },

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

    bottomHud: {
        backgroundColor: 'rgba(0, 5, 20, 0.88)',
        marginHorizontal: 12,
        marginBottom: 30,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.2)',
    },
    hudSection: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    hudSectionTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '600',
    },
    hudGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    hudCell: {
        alignItems: 'center',
        flex: 1,
    },
    hudLabel: {
        color: '#666',
        fontSize: 10,
        marginBottom: 2,
    },
    hudValue: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    hudValueMatch: {
        color: '#00f0ff',
    },
    hudSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9,
        marginTop: 1,
    },

    riseSetRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 4,
    },
    riseSetItem: {
        alignItems: 'center',
        flex: 1,
    },
    riseSetLabel: {
        color: '#888',
        fontSize: 10,
        marginBottom: 3,
    },
    riseSetValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'monospace',
    },

    matchToast: {
        position: 'absolute',
        bottom: 220,
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

    permissionContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 20 },
    permissionText: { color: '#aaa', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 },
    permissionButton: { backgroundColor: '#FFD700', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, marginTop: 40 },
    permissionButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
    closeButton: { position: 'absolute', top: 50, right: 30 },

    // Focused Mode Styles
    focusProgressContainer: {
        position: 'absolute',
        bottom: 10,
        width: 60,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden'
    },
    focusProgressBar: {
        height: '100%',
        backgroundColor: '#00f0ff'
    },
    bottomSpacecraftPanel: {
        backgroundColor: 'rgba(0, 5, 20, 0.9)',
        marginHorizontal: 10,
        marginBottom: 25,
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.3)'
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 8,
        alignItems: 'center'
    },
    filterBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    filterBtnActive: {
        backgroundColor: '#3B82F6'
    },
    filterBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold'
    },
    exitFocusedBtn: {
        marginLeft: 'auto',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardListContainer: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap'
    },
    spacecraftCard: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    spacecraftCardSelected: {
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
        borderColor: 'rgba(0, 240, 255, 0.5)',
        borderWidth: 1
    },
    cardDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    cardName: {
        color: '#fff',
        fontSize: 11,
        maxWidth: 70
    },
    spacecraftMarker: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center'
    },
    markerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#fff'
    },
    markerText: {
        color: '#fff',
        fontSize: 10,
        marginTop: 2,
        fontWeight: 'bold',
        textShadowColor: '#000',
        textShadowRadius: 3
    },
    detailPanel: {
        position: 'absolute',
        top: 130,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    detailTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    detailDesc: {
        color: '#ccc',
        fontSize: 13,
        lineHeight: 18
    },
    detailInfo: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 15
    },
    detailText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500'
    }
});
