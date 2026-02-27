// AR 달 탐사선 뷰어 컴포넌트
// 실제 API 데이터 기반 AR 표시 + 궤도 시각화

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    Modal,
    ScrollView,
    ActivityIndicator,
    Animated,
    Easing,
    PanResponder,
    Platform,
    Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import ThreeOrbitVisualizer from './ThreeOrbitVisualizer';

import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { useMoonPosition } from '@/hooks/useMoonPosition';
import {
    LIVE_MISSIONS,
    HISTORICAL_MISSIONS,
    Spacecraft,
    MOON_RADIUS_KM
} from '@/constants/SpacecraftData';
import {
    fetchSpacecraftPosition,
    fetchSpacecraftTrajectory,
    convertToScreenCoordinates,
    SpacecraftPosition,
    TrajectoryPoint
} from '@/services/HorizonsApi';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEG2RAD_LOCAL = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const FOV_X = 60; // 수평 시야각 (도)
const FOV_Y = 80; // 수직 시야각 (도)

// 3D 회전 변환 함수
function rotatePoint3D(point: { x: number; y: number; z: number }, az: number, el: number) {
    const radAz = (az * Math.PI) / 180;
    const radEl = (el * Math.PI) / 180;

    let { x, y, z } = point;

    // 1. Azimuth 회전 (Y축 기준 - 일반적인 3D 좌표계 기준)
    // 여기서는 JPL 좌표계 고려:
    // +Z: North, +Y: East, +X: Prime Meridian

    // Y축(East-West) 회전 (Azimuth)
    // Z축(North-South) 회전 (Tilt/Elevation)

    // 단순하게 X, Y, Z 회전 행렬 적용

    // Azimuth (Z축 회전이라 가정하거나 Y축 회전이라 가정 - 실험적)
    // 여기서는 화면상의 드래그 방향과 일치시키기 위해 간단한 회전 적용

    // Azimuth: Y축(세로축)을 중심으로 회전
    const cosAz = Math.cos(radAz);
    const sinAz = Math.sin(radAz);
    const x1 = x * cosAz - z * sinAz;
    const z1 = x * sinAz + z * cosAz;
    const y1 = y;

    // Elevation: X축(가로축)을 중심으로 회전
    const cosEl = Math.cos(radEl);
    const sinEl = Math.sin(radEl);
    const y2 = y1 * cosEl - z1 * sinEl;
    const z2 = y1 * sinEl + z1 * cosEl;
    const x2 = x1;

    return { x: x2, y: y2, z: z2 };
}

// Catmull-Rom Spline 보간 함수
function interpolateTrajectory(points: TrajectoryPoint[], segmentsPerPoint: number = 5): TrajectoryPoint[] {
    if (points.length < 2) return points;

    const result: TrajectoryPoint[] = [];

    // 점이 부족하면 그대로 반환 또는 선형 보간이라도 해야되지만, 일단 4점 이상이라 가정 (Artemis는 48개 등 충분함)
    // 4점 미만이면 그냥 선형 연결이 나음 (구현 복잡도 감소)
    if (points.length < 4) return points;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let t = 0; t < 1; t += 1 / segmentsPerPoint) {
            const t2 = t * t;
            const t3 = t2 * t;

            const f0 = -0.5 * t3 + t2 - 0.5 * t;
            const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
            const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
            const f3 = 0.5 * t3 - 0.5 * t2;

            const x = p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3;
            const y = p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3;
            const z = p0.z * f0 + p1.z * f1 + p2.z * f2 + p3.z * f3;

            // 타임스탬프도 보간 (안전한 처리를 위해 유효성 검사 추가)
            const time1 = new Date(p1.timestamp).getTime();
            const time2 = new Date(p2.timestamp).getTime();

            let interpolatedTime = p1.timestamp;
            if (!isNaN(time1) && !isNaN(time2)) {
                try {
                    const timeDiff = time2 - time1;
                    interpolatedTime = new Date(time1 + timeDiff * t).toISOString();
                } catch (e) {
                    console.warn('[Trajectory] Date interpolation failed', e);
                }
            }

            result.push({ x, y, z, timestamp: interpolatedTime });
        }
    }
    // 마지막 점 추가
    result.push(points[points.length - 1]);

    return result;
}

// 달 가이드 원 크기 축소
const GUIDE_CIRCLE_RADIUS = SCREEN_WIDTH * 0.22;

interface Props {
    onClose: () => void;
}

interface SpacecraftWithPosition extends Spacecraft {
    position?: SpacecraftPosition;
    screenPos?: { x: number; y: number; behindMoon: boolean };
    orbitRadius?: number; // 궤도 장반경
    orbitEccentricity?: number; // 타원 비율 (단반경/장반경)
    orbitTilt?: number; // 궤도 기울기 (도)
    trajectory?: TrajectoryPoint[];
    screenTrajectory?: { x: number; y: number; behindMoon?: boolean }[]; // 미리 계산된 화면 궤적
}

export default function ARMoonViewer({ onClose }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [isMoonAligned, setIsMoonAligned] = useState(false);
    // 달 위치 고정 앵커 (정렬 시점의 기기 방향)
    const [anchorPosition, setAnchorPosition] = useState<{ azimuth: number; altitude: number } | null>(null);

    const [liveSpacecraft, setLiveSpacecraft] = useState<SpacecraftWithPosition[]>([]);
    const [selectedSpacecraft, setSelectedSpacecraft] = useState<Spacecraft | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLiveMissions, setShowLiveMissions] = useState(true);
    const [showHistoricalMissions, setShowHistoricalMissions] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // 부드러운 AR 추적을 위해 센서 업데이트 속도 20ms
    const deviceOrientation = useDeviceOrientation(20);
    const moonPosition = useMoonPosition(60000);

    // 애니메이션
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const orbitRotation = useRef(new Animated.Value(0)).current;
    const gridOpacity = useRef(new Animated.Value(1)).current;

    // 3D 회전 상태
    const [rotation, setRotation] = useState({ az: 0, el: 0 });
    const isInteracting = useRef(false);

    // 자동 정렬 타이머
    const alignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ALIGN_THRESHOLD_DEG = 15; // 정렬 임계 각도
    const ALIGN_HOLD_MS = 500;       // 유지 시간

    // PanResponder: 스와이프 제스처 처리 (정렬 후에만)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                isInteracting.current = true;
            },
            onPanResponderMove: (_, gestureState) => {
                const sensitivity = 0.1;
                setRotation(prev => ({
                    az: prev.az + gestureState.dx * sensitivity,
                    el: prev.el + gestureState.dy * sensitivity
                }));
            },
            onPanResponderRelease: () => {
                isInteracting.current = false;
            }
        })
    ).current;

    // 궤도 회전 애니메이션 (선택된 탐사선용)
    useEffect(() => {
        if (selectedSpacecraft) {
            Animated.loop(
                Animated.timing(orbitRotation, {
                    toValue: 1,
                    duration: 8000,
                    easing: Easing.linear,
                    useNativeDriver: true
                })
            ).start();
        } else {
            orbitRotation.setValue(0);
        }
    }, [selectedSpacecraft]);

    // 가이드 원 펄스 애니메이션
    useEffect(() => {
        if (!isMoonAligned) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.06,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true
                    })
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isMoonAligned]);

    // 정렬 시 그리드 fade-out
    useEffect(() => {
        Animated.timing(gridOpacity, {
            toValue: isMoonAligned ? 0 : 1,
            duration: 600,
            useNativeDriver: true
        }).start();
    }, [isMoonAligned]);

    // ════════════════════════════════════════════════════════════════
    // ★ 3D 투영 기반 달 화면 위치 계산 (완전 재설계)
    // ════════════════════════════════════════════════════════════════
    const CAM_FOV_X = 60; // 수평 시야각 (도)
    const CAM_FOV_Y = 80; // 수직 시야각 (도)
    const RAD = Math.PI / 180;

    // Perspective 투영 초점거리 (pinhole camera)
    const FOCAL_X = SCREEN_WIDTH / (2 * Math.tan(CAM_FOV_X / 2 * RAD));
    const FOCAL_Y = SCREEN_HEIGHT / (2 * Math.tan(CAM_FOV_Y / 2 * RAD));

    /** (Az°, Alt°) → 월드 단위벡터 [East, North, Zenith] */
    const azAltToWorld = useCallback((az: number, alt: number): [number, number, number] => {
        const a = az * RAD, e = alt * RAD;
        return [
            Math.cos(e) * Math.sin(a),  // East
            Math.cos(e) * Math.cos(a),  // North
            Math.sin(e),                 // Zenith
        ];
    }, []);

    /** 월드 벡터 → 카메라 스크린 좌표 */
    const worldToScreen = useCallback((
        wx: number, wy: number, wz: number,
        fwd: [number, number, number],
        right: [number, number, number],
        up: [number, number, number]
    ): { x: number; y: number; inFront: boolean } => {
        // 카메라 로컬: dot product
        const cx = wx * right[0] + wy * right[1] + wz * right[2];
        const cy = wx * up[0] + wy * up[1] + wz * up[2];
        const cz = wx * fwd[0] + wy * fwd[1] + wz * fwd[2];

        if (cz <= 0.001) {
            // 카메라 뒤쪽 → 방향만 2D로 반환
            return { x: SCREEN_WIDTH / 2 + cx * 1000, y: SCREEN_HEIGHT / 2 - cy * 1000, inFront: false };
        }

        // Perspective 투영
        return {
            x: SCREEN_WIDTH / 2 + (cx / cz) * FOCAL_X,
            y: SCREEN_HEIGHT / 2 - (cy / cz) * FOCAL_Y,
            inFront: true,
        };
    }, [FOCAL_X, FOCAL_Y]);

    // ── 달 화면 위치 ──
    const moonProj = useMemo(() => {
        const [mx, my, mz] = azAltToWorld(moonPosition.azimuth, moonPosition.altitude);
        const result = worldToScreen(
            mx, my, mz,
            deviceOrientation.forward, deviceOrientation.right, deviceOrientation.up
        );
        const M = 60;
        const onScreen = result.inFront
            && result.x >= -M && result.x <= SCREEN_WIDTH + M
            && result.y >= -M && result.y <= SCREEN_HEIGHT + M;
        return { ...result, onScreen };
    }, [moonPosition, deviceOrientation, azAltToWorld, worldToScreen]);

    const moonScreenX = moonProj.x;
    const moonScreenY = moonProj.y;
    const isVisible = moonProj.onScreen;

    // ════════════════════════════════════════════════════════════════
    // ★ 돔형 천구 그리드 — 3D 투영 (별자리 앱 스타일)
    // ════════════════════════════════════════════════════════════════
    type GridLine = { x1: number; y1: number; x2: number; y2: number; opacity: number; width: number };
    type GridLabel = { x: number; y: number; text: string; size: number; color: string };

    const domeGrid = useMemo(() => {
        const lines: GridLine[] = [];
        const labels: GridLabel[] = [];
        const { forward: fwd, right: rt, up: upv } = deviceOrientation;

        // ── 고도 동심원 (30°, 60° 간격) ──
        const altRings = [0, 30, 60]; // 수평선(0°), 30°, 60°
        for (const altDeg of altRings) {
            const segments = 72; // 360/5° 해상도
            let prevPt: { x: number; y: number; front: boolean } | null = null;
            const isHorizon = altDeg === 0;

            for (let i = 0; i <= segments; i++) {
                const azDeg = (i / segments) * 360;
                const [wx, wy, wz] = azAltToWorld(azDeg, altDeg);
                const p = worldToScreen(wx, wy, wz, fwd, rt, upv);
                const pt = { x: p.x, y: p.y, front: p.inFront };

                if (prevPt && prevPt.front && pt.front) {
                    // 화면 내에 있는 선분만 그림 (너무 먼 것 제외)
                    const dist = Math.sqrt((pt.x - prevPt.x) ** 2 + (pt.y - prevPt.y) ** 2);
                    if (dist < SCREEN_WIDTH) { // 래핑 방지
                        lines.push({
                            x1: prevPt.x, y1: prevPt.y,
                            x2: pt.x, y2: pt.y,
                            opacity: isHorizon ? 0.5 : 0.25,
                            width: isHorizon ? 1.5 : 0.8,
                        });
                    }
                }
                prevPt = pt;
            }
        }

        // ── 방위 방사선 (N/NE/E/SE/S/SW/W/NW + 15° 보조선) ──
        const cardinals: Record<number, string> = {
            0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
            180: 'S', 225: 'SW', 270: 'W', 315: 'NW',
        };

        for (let azDeg = 0; azDeg < 360; azDeg += 15) {
            const isCardinal = azDeg % 90 === 0;
            const isIntercardinal = azDeg % 45 === 0 && !isCardinal;

            // -10° ~ 85° 사이의 세로선
            const segCount = 20;
            let prevPt: { x: number; y: number; front: boolean } | null = null;

            for (let j = 0; j <= segCount; j++) {
                const altDeg = -10 + (j / segCount) * 95; // -10° ~ 85°
                const [wx, wy, wz] = azAltToWorld(azDeg, altDeg);
                const p = worldToScreen(wx, wy, wz, fwd, rt, upv);
                const pt = { x: p.x, y: p.y, front: p.inFront };

                if (prevPt && prevPt.front && pt.front) {
                    const dist = Math.sqrt((pt.x - prevPt.x) ** 2 + (pt.y - prevPt.y) ** 2);
                    if (dist < SCREEN_WIDTH) {
                        lines.push({
                            x1: prevPt.x, y1: prevPt.y,
                            x2: pt.x, y2: pt.y,
                            opacity: isCardinal ? 0.35 : isIntercardinal ? 0.2 : 0.1,
                            width: isCardinal ? 1 : 0.5,
                        });
                    }
                }
                prevPt = pt;
            }

            // 방위 라벨 (수평선 높이에 표시)
            const label = cardinals[azDeg];
            if (label) {
                const [lx, ly, lz] = azAltToWorld(azDeg, 2); // 수평선보다 약간 위
                const lp = worldToScreen(lx, ly, lz, fwd, rt, upv);
                if (lp.inFront && lp.x > 0 && lp.x < SCREEN_WIDTH && lp.y > 0 && lp.y < SCREEN_HEIGHT) {
                    labels.push({
                        x: lp.x, y: lp.y,
                        text: label,
                        size: isCardinal ? 14 : 10,
                        color: isCardinal ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    });
                }
            }
        }

        return { lines, labels };
    }, [deviceOrientation, azAltToWorld, worldToScreen]);

    // ════════════════════════════════════════════════════════════════
    // ★ 달 방향 화살표 — 화면 밖일 때만 표시
    // ════════════════════════════════════════════════════════════════
    const directionGuide = useMemo(() => {
        if (isVisible) return null;

        // 달 방향으로의 스크린 오프셋
        const dx = moonScreenX - SCREEN_WIDTH / 2;
        const dy = moonScreenY - SCREEN_HEIGHT / 2;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;

        const nx = dx / len;
        const ny = dy / len;

        // 방위각/고도각 차이 텍스트
        let diffAz = moonPosition.azimuth - deviceOrientation.azimuth;
        if (diffAz > 180) diffAz -= 360;
        if (diffAz < -180) diffAz += 360;
        const diffAlt = moonPosition.altitude - deviceOrientation.altitude;

        const absDiffAz = Math.abs(Math.round(diffAz));
        const absDiffAlt = Math.abs(Math.round(diffAlt));

        const azText = absDiffAz > 3 ? (diffAz > 0 ? `→ ${absDiffAz}°` : `← ${absDiffAz}°`) : '';
        const altText = absDiffAlt > 3 ? (diffAlt > 0 ? `↑ ${absDiffAlt}°` : `↓ ${absDiffAlt}°`) : '';

        // 화면 가장자리에 배치
        const pad = 50;
        const halfW = SCREEN_WIDTH / 2 - pad;
        const halfH = SCREEN_HEIGHT / 2 - pad;

        let t = Infinity;
        if (Math.abs(nx) > 0.001) t = Math.min(t, halfW / Math.abs(nx));
        if (Math.abs(ny) > 0.001) t = Math.min(t, halfH / Math.abs(ny));

        const edgeX = SCREEN_WIDTH / 2 + nx * t;
        const edgeY = SCREEN_HEIGHT / 2 + ny * t;
        const rotation = Math.atan2(ny, nx) * (180 / Math.PI) + 90;

        return { azText, altText, arrow: { x: edgeX, y: edgeY, rotation } };
    }, [moonPosition, deviceOrientation, isVisible, moonScreenX, moonScreenY]);

    // 정렬 해제 함수
    const handleResetAlignment = useCallback(() => {
        setIsMoonAligned(false);
        setAnchorPosition(null);
        setRotation({ az: 0, el: 0 });
    }, []);

    // 탐사선 선택/해제
    const handleSpacecraftSelect = useCallback((sc: Spacecraft | null) => {
        setSelectedSpacecraft(prev => prev?.id === sc?.id ? null : sc);
    }, []);

    // 실시간 탐사선 데이터 로드 (최초 1회만 호출)
    useEffect(() => {
        async function loadLiveSpacecraft() {
            setIsLoading(true);
            setApiError(null);

            const results: SpacecraftWithPosition[] = [];

            // 궤도 파라미터: 장반경, 타원비, 기울기 (각 탐사선마다 다름)
            const orbitParams = [
                { radius: 1.35, eccentricity: 0.1, tilt: 85, duration: 2 },    // LRO
                { radius: 1.5, eccentricity: 0.1, tilt: 90, duration: 2 },     // 다누리
                { radius: 1.7, eccentricity: 0.1, tilt: 80, duration: 2 },     // 찬드라얀-2
                { radius: 1.6, eccentricity: 0.38, tilt: -75, duration: 6 },   // 찬드라얀-3P
                { radius: 3.0, eccentricity: 0.7, tilt: 45, duration: 24 },    // CAPSTONE
                { radius: 3.5, eccentricity: 0.6, tilt: 30, duration: 24 },    // ARTEMIS-P1
                { radius: 4.0, eccentricity: 0.6, tilt: -30, duration: 24 },   // ARTEMIS-P2
                { radius: 2.5, eccentricity: 0.6, tilt: 30, duration: 12 },    // Queqiao-2
            ];

            let index = 0;
            for (const mission of LIVE_MISSIONS) {
                const params = orbitParams[index % orbitParams.length];
                const orbitRadius = GUIDE_CIRCLE_RADIUS * params.radius;

                if (mission.apiEnabled) {
                    try {
                        const [position, trajectory] = await Promise.all([
                            fetchSpacecraftPosition(mission.id),
                            fetchSpacecraftTrajectory(mission.id, params.duration)
                        ]);

                        results.push({
                            ...mission,
                            position: position || undefined,
                            trajectory: trajectory || undefined,
                            orbitRadius,
                            orbitEccentricity: params.eccentricity,
                            orbitTilt: params.tilt
                        });
                    } catch (error) {
                        console.error(`[AR] Failed to fetch ${mission.name}:`, error);
                        results.push({
                            ...mission,
                            orbitRadius,
                            orbitEccentricity: params.eccentricity,
                            orbitTilt: params.tilt
                        });
                    }
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    results.push({
                        ...mission,
                        orbitRadius,
                        orbitEccentricity: params.eccentricity,
                        orbitTilt: params.tilt
                    });
                }
                index++;
            }

            setLiveSpacecraft(results);
            setIsLoading(false);
        }

        loadLiveSpacecraft();
    }, []);

    // 화면 좌표 변환
    const liveSpacecraftWithScreen = useMemo((): SpacecraftWithPosition[] => {
        if (!isMoonAligned) return [];

        // 항상 AR 시점(moonScreenX, moonScreenY)을 기준으로 회전
        const center = { x: moonScreenX, y: moonScreenY };

        return liveSpacecraft.map((sc, idx) => {
            // 1. API 데이터가 있는 경우 (실제 3D 좌표 사용)
            if (sc.position) {
                // 현재 위치 3D 회전 적용
                const rotatedPos = rotatePoint3D(sc.position, rotation.az, rotation.el);

                const screenPos = convertToScreenCoordinates(
                    rotatedPos,
                    center,
                    GUIDE_CIRCLE_RADIUS
                );

                // 궤적 데이터 회전 및 변환
                let screenTrajectory: { x: number; y: number }[] | undefined;
                if (sc.trajectory) {
                    // 현재 위치를 궤적의 마지막 점으로 추가하여 끊김 방지
                    const trajectoryWithCurrent = [...sc.trajectory, sc.position];

                    // 보간 적용 (점을 10배로 늘려서 부드럽게)
                    const smoothTrajectory = interpolateTrajectory(trajectoryWithCurrent, 10);

                    screenTrajectory = smoothTrajectory.map(pt => {
                        // 궤적 포인트도 3D 회전
                        const rPt = rotatePoint3D(pt, rotation.az, rotation.el);
                        return convertToScreenCoordinates(rPt, center, GUIDE_CIRCLE_RADIUS);
                    })
                        .filter((pt) => pt !== null)
                        .map(pt => ({ x: pt!.x, y: pt!.y, behindMoon: pt!.behindMoon }));
                }

                if (screenPos) {
                    return { ...sc, screenPos, screenTrajectory };
                }
            }

            // 2. API 데이터가 없는 경우 (가상의 3D 점을 만들어 회전 적용)
            // 기존 2D 타원 로직을 3D 포인트 생성 용으로 변환

            // 타원 매개변수 t (각도)
            const angle = (idx * 137.5) * Math.PI / 180;

            const a = sc.orbitRadius || GUIDE_CIRCLE_RADIUS * 1.5; // 장반경
            const b = a * (sc.orbitEccentricity || 0.4);           // 단반경
            const tiltRad = (sc.orbitTilt || 0) * Math.PI / 180;

            // 기본 타원 평면상의 점 (z=0)
            const ex = a * Math.cos(angle);
            const ey = b * Math.sin(angle);

            // 궤도 경사각(tilt) 적용 - Z축 회전(기존 로직)을 유지하되 3D 점으로 간주
            // (화면상에서 타원을 기울이는 것이었으므로 Z축 회전이 맞음)
            const rx = ex * Math.cos(tiltRad) - ey * Math.sin(tiltRad);
            const ry = ex * Math.sin(tiltRad) + ey * Math.cos(tiltRad);
            const rz = 0; // 초기엔 z=0 (달 중심 평면)

            // 이 점을 사용자가 조작한 rotation으로 3D 회전
            // rx, ry는 픽셀 단위이므로 rotatePoint3D 결과도 픽셀 단위로 나옴
            const rotatedPt = rotatePoint3D({ x: rx, y: ry, z: rz }, rotation.az, rotation.el);

            const x = center.x + rotatedPt.x;
            const y = center.y + rotatedPt.y;

            // 간단한 3D 궤적(선) 생성: 전체 타원을 다 계산해서 screenTrajectory로 넣어줌
            const trajectoryPoints: { x: number; y: number }[] = [];
            const segments = 60; // 타원 해상도
            for (let i = 0; i <= segments; i++) {
                const t = (i / segments) * 2 * Math.PI;
                const tx = a * Math.cos(t);
                const ty = b * Math.sin(t);

                // 궤도 Tilt (Z축 회전)
                const t_rx = tx * Math.cos(tiltRad) - ty * Math.sin(tiltRad);
                const t_ry = tx * Math.sin(tiltRad) + ty * Math.cos(tiltRad);

                // 사용자 회전
                const t_rot = rotatePoint3D({ x: t_rx, y: t_ry, z: 0 }, rotation.az, rotation.el);

                trajectoryPoints.push({
                    x: center.x + t_rot.x,
                    y: center.y + t_rot.y
                });
            }

            return {
                ...sc,
                screenPos: {
                    x,
                    y,
                    behindMoon: rotatedPt.z < 0 // z값에 따라 뒤인지 판단 (임의 기준)
                },
                screenTrajectory: trajectoryPoints
            };
        });
    }, [liveSpacecraft, isMoonAligned, moonScreenX, moonScreenY, rotation]);

    // 과거 착륙 지점
    const historicalLandingSites = useMemo(() => {
        if (!isMoonAligned || !showHistoricalMissions) return [];

        // 항상 AR 시점(moonScreenX, moonScreenY)을 기준으로 회전
        const center = { x: moonScreenX, y: moonScreenY };

        return HISTORICAL_MISSIONS.filter(m => m.landingLocation).map(mission => {
            const loc = mission.landingLocation!;
            const lonRad = (loc.lon * Math.PI) / 180;
            const latRad = (loc.lat * Math.PI) / 180;

            // 1. 3D 구면 좌표로 변환 (달 중심 기준)
            // x: 오른쪽, y: 아래쪽(화면상), z: 앞쪽(사용자쪽)
            // lon: 0이 중앙, +가 동쪽(오른쪽)
            // lat: 0이 적도, +가 북쪽(위쪽 -> 화면상은 -y)

            // 구면 좌표계 변환
            const r = GUIDE_CIRCLE_RADIUS;
            const x0 = r * Math.sin(lonRad) * Math.cos(latRad);
            const y0 = -r * Math.sin(latRad); // 화면 좌표계는 y가 아래로 증가하므로 - 부호
            const z0 = r * Math.cos(lonRad) * Math.cos(latRad); // cos(lon)*cos(lat)은 달의 앞면(z>0)

            // 2. 회전 적용
            const rotated = rotatePoint3D({ x: x0, y: y0, z: z0 }, rotation.az, rotation.el);

            // 3. 가시성 판단 (달 뒤로 갔는지)
            // 달의 반지름보다 약간 안쪽으로 보이게 하거나, 뒤로 가면 숨김
            // 정사영에서 z가 양수면 앞면, 음수면 뒷면
            if (rotated.z < 0) return null; // 뒷면은 안 보임

            // 4. 화면 좌표 변환
            const x = center.x + rotated.x;
            const y = center.y + rotated.y;

            return { ...mission, screenX: x, screenY: y };
        }).filter((site): site is NonNullable<typeof site> => site !== null);
    }, [isMoonAligned, showHistoricalMissions, moonScreenX, moonScreenY, rotation]);

    // 권한 체크
    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <Modal visible animationType="slide" statusBarTranslucent>
                <View style={styles.permissionContainer}>
                    <MaterialCommunityIcons name="camera-off" size={64} color="#666" />
                    <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
                    <Text style={styles.permissionText}>
                        달 탐사선 AR 시각화를 위해{'\n'}카메라 접근 권한이 필요합니다
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
                    <View style={styles.overlay} {...panResponder.panHandlers}>
                        {/* ═══ 돔형 천구 그리드 (3D 투영) ═══ */}
                        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gridOpacity }]} pointerEvents="none">
                            <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFillObject}>
                                {/* 그리드 선 (고도 동심원 + 방위 방사선) */}
                                {domeGrid.lines.map((l, i) => (
                                    <Line
                                        key={`gl-${i}`}
                                        x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                                        stroke={`rgba(255,255,255,${l.opacity})`}
                                        strokeWidth={l.width}
                                    />
                                ))}
                                {/* 방위 라벨 (N/E/S/W 등) */}
                                {domeGrid.labels.map((lb, i) => (
                                    <SvgText
                                        key={`lbl-${i}`}
                                        x={lb.x} y={lb.y}
                                        fill={lb.color}
                                        fontSize={lb.size}
                                        fontWeight="700"
                                        textAnchor="middle"
                                    >
                                        {lb.text}
                                    </SvgText>
                                ))}
                                {/* 화면 중앙 십자선 */}
                                <Line x1={SCREEN_WIDTH / 2 - 15} y1={SCREEN_HEIGHT / 2} x2={SCREEN_WIDTH / 2 + 15} y2={SCREEN_HEIGHT / 2} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
                                <Line x1={SCREEN_WIDTH / 2} y1={SCREEN_HEIGHT / 2 - 15} x2={SCREEN_WIDTH / 2} y2={SCREEN_HEIGHT / 2 + 15} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
                                {/* 달 마커 (화면에 보일 때) */}
                                {isVisible && (
                                    <G>
                                        <Circle cx={moonScreenX} cy={moonScreenY} r={22} stroke="rgba(255,220,100,0.8)" strokeWidth={2} strokeDasharray="5,4" fill="none" />
                                        <Circle cx={moonScreenX} cy={moonScreenY} r={4} fill="rgba(255,220,100,0.9)" />
                                        <SvgText x={moonScreenX} y={moonScreenY - 28} fill="rgba(255,220,100,0.9)" fontSize={16} fontWeight="600" textAnchor="middle">🌙</SvgText>
                                    </G>
                                )}
                            </Svg>
                        </Animated.View>

                        {/* ═══ 디버그 오버레이 ═══ */}
                        <View style={styles.debugOverlay} pointerEvents="none">
                            <Text style={styles.debugText}>
                                📷 Az:{deviceOrientation.azimuth.toFixed(1)}° Alt:{deviceOrientation.altitude.toFixed(1)}°
                            </Text>
                            <Text style={styles.debugText}>
                                🌙 Az:{moonPosition.azimuth.toFixed(1)}° Alt:{moonPosition.altitude.toFixed(1)}°
                            </Text>
                            <Text style={styles.debugText}>
                                {isVisible ? '✅ 화면 내' : '❌ 화면 밖'}
                            </Text>
                        </View>

                        {/* ═══ 방향 화살표 (달이 화면 밖일 때) ═══ */}
                        {directionGuide && (
                            <>
                                {directionGuide.arrow && (
                                    <View
                                        style={[
                                            styles.edgeArrowContainer,
                                            {
                                                left: directionGuide.arrow.x - 24,
                                                top: directionGuide.arrow.y - 24,
                                                transform: [{ rotate: `${directionGuide.arrow.rotation}deg` }]
                                            }
                                        ]}
                                    >
                                        <Text style={styles.edgeArrowText}>▲</Text>
                                        <Text style={styles.edgeArrowLabel}>🌙</Text>
                                    </View>
                                )}
                                <View style={styles.directionInfoBox}>
                                    <Text style={styles.directionInfoText}>
                                        {directionGuide.azText}{directionGuide.azText && directionGuide.altText ? '  ' : ''}{directionGuide.altText}
                                    </Text>
                                </View>
                            </>
                        )}

                        {/* Three.js 기반 탐사선 궤도 시각화 (GPU 가속) */}
                        {isMoonAligned && (
                            <ThreeOrbitVisualizer
                                moonCenter={{ x: moonScreenX, y: moonScreenY }}
                                moonRadius={GUIDE_CIRCLE_RADIUS}
                                rotation={rotation}
                                spacecraft={liveSpacecraftWithScreen}
                                selectedId={selectedSpacecraft?.id || null}
                                historicalSites={historicalLandingSites}
                                showLiveMissions={showLiveMissions}
                                showHistoricalMissions={showHistoricalMissions}
                            />
                        )}

                        {/* 달 가이드 원 (정렬 후에만 표시) */}
                        {isMoonAligned && isVisible && (
                            <View
                                style={[
                                    styles.guideContainer,
                                    {
                                        position: 'absolute',
                                        left: moonScreenX - (GUIDE_CIRCLE_RADIUS + 15),
                                        top: moonScreenY - (GUIDE_CIRCLE_RADIUS + 15),
                                        width: (GUIDE_CIRCLE_RADIUS * 2) + 30,
                                        height: (GUIDE_CIRCLE_RADIUS * 2) + 30,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }
                                ]}
                            >
                                <View style={styles.moonImageWrapper}>
                                    <Image
                                        source={require('../assets/moon_texture.png')}
                                        style={[styles.moonGuideImage, { opacity: 0.3 }]}
                                    />
                                </View>

                                <Svg width={GUIDE_CIRCLE_RADIUS * 2 + 30} height={GUIDE_CIRCLE_RADIUS * 2 + 30}>
                                    <Circle
                                        cx={GUIDE_CIRCLE_RADIUS + 15}
                                        cy={GUIDE_CIRCLE_RADIUS + 15}
                                        r={GUIDE_CIRCLE_RADIUS}
                                        stroke="rgba(255,255,255,0.4)"
                                        strokeWidth={1}
                                        fill="transparent"
                                    />
                                    <Line
                                        x1={GUIDE_CIRCLE_RADIUS + 15 - 10}
                                        y1={GUIDE_CIRCLE_RADIUS + 15}
                                        x2={GUIDE_CIRCLE_RADIUS + 15 + 10}
                                        y2={GUIDE_CIRCLE_RADIUS + 15}
                                        stroke="rgba(255,255,255,0.6)"
                                        strokeWidth={1}
                                    />
                                    <Line
                                        x1={GUIDE_CIRCLE_RADIUS + 15}
                                        y1={GUIDE_CIRCLE_RADIUS + 15 - 10}
                                        x2={GUIDE_CIRCLE_RADIUS + 15}
                                        y2={GUIDE_CIRCLE_RADIUS + 15 + 10}
                                        stroke="rgba(255,255,255,0.6)"
                                        strokeWidth={1}
                                    />
                                </Svg>
                            </View>
                        )}

                        {/* 가이드 텍스트 */}
                        {isMoonAligned && isVisible && (
                            <View style={[
                                styles.guideTextContainer,
                                {
                                    top: moonScreenY + GUIDE_CIRCLE_RADIUS + 25,
                                    left: moonScreenX - 150,
                                    width: 300
                                }
                            ]}>
                                <Text style={[styles.guideText, styles.guideTextSuccess]}>
                                    🌙 탐사선을 탭하여 상세 정보 확인
                                </Text>
                                {apiError && (
                                    <Text style={styles.errorText}>{apiError}</Text>
                                )}
                            </View>
                        )}

                        {/* 달 위치 안내 */}
                        {!isMoonAligned && moonPosition.isVisible && (
                            <View style={styles.guideStatusBox}>
                                <Text style={styles.guideStatusText}>
                                    {isVisible ? '🌙 달이 화면 안에 있습니다' : '카메라를 달 방향으로 향해주세요'}
                                </Text>
                            </View>
                        )}

                        {/* 탐사선 마커 */}
                        {isMoonAligned && showLiveMissions && liveSpacecraftWithScreen.map((sc) => {
                            if (!sc.screenPos) return null;
                            const isSelected = selectedSpacecraft?.id === sc.id;

                            return (
                                <TouchableOpacity
                                    key={sc.id}
                                    style={[
                                        styles.spacecraftMarker,
                                        {
                                            left: sc.screenPos.x - (isSelected ? 24 : 18),
                                            top: sc.screenPos.y - (isSelected ? 24 : 18),
                                            width: isSelected ? 48 : 36,
                                            height: isSelected ? 48 : 36,
                                            borderRadius: isSelected ? 24 : 18,
                                            backgroundColor: sc.color,
                                            borderWidth: isSelected ? 3 : 2,
                                            borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.5)',
                                            opacity: sc.screenPos.behindMoon ? 0.3 : 1,
                                            zIndex: isSelected ? 100 : 10
                                        }
                                    ]}
                                    onPress={() => handleSpacecraftSelect(sc)}
                                >
                                    <MaterialCommunityIcons
                                        name="satellite-variant"
                                        size={isSelected ? 24 : 18}
                                        color="#fff"
                                    />
                                </TouchableOpacity>
                            );
                        })}

                        {/* 역사적 착륙 지점 */}
                        {isMoonAligned && historicalLandingSites.map((site: any) => (
                            <TouchableOpacity
                                key={site.id}
                                style={[
                                    styles.landingMarker,
                                    {
                                        left: site.screenX - 14,
                                        top: site.screenY - 14,
                                        backgroundColor: site.color
                                    }
                                ]}
                                onPress={() => handleSpacecraftSelect(site)}
                            >
                                <MaterialCommunityIcons
                                    name={site.missionType === 'impactor' ? 'meteor' : 'flag-variant'}
                                    size={14}
                                    color="#fff"
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                </CameraView>

                {/* 상단 컨트롤 */}
                <SafeAreaView style={styles.topControls} edges={['top']}>
                    {/* 센서 상태 표시 */}
                    <View style={styles.sensorBadge}>
                        <View style={[styles.statusDot, { backgroundColor: deviceOrientation.isAvailable ? '#4CAF50' : '#F44336' }]} />
                        <Text style={styles.statusText}>
                            {moonPosition.isVisible ? `달 고도 ${Math.round(moonPosition.altitude)}°` : '달 ▼'}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    {isMoonAligned && (
                        <TouchableOpacity
                            style={[styles.controlButton, { marginRight: 10 }]}
                            onPress={handleResetAlignment}
                        >
                            <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.controlButton} onPress={onClose}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* 하단 탐사선 목록 */}
                <SafeAreaView style={styles.bottomPanel} edges={['bottom']}>
                    <BlurView intensity={80} tint="dark" style={styles.bottomPanelBlur}>
                        {/* 필터 */}
                        <View style={styles.filterRow}>
                            <TouchableOpacity
                                style={[
                                    styles.filterButton,
                                    showLiveMissions ? styles.filterButtonActive : styles.filterButtonInactive
                                ]}
                                onPress={() => setShowLiveMissions(!showLiveMissions)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons
                                    name="satellite-uplink"
                                    size={16}
                                    color={showLiveMissions ? "#fff" : "#aaa"}
                                />
                                <Text style={[
                                    styles.filterButtonText,
                                    { color: showLiveMissions ? "#fff" : "#aaa" }
                                ]}>
                                    실시간
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.filterButton,
                                    showHistoricalMissions ? styles.filterButtonActive : styles.filterButtonInactive
                                ]}
                                onPress={() => setShowHistoricalMissions(!showHistoricalMissions)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons
                                    name="map-marker"
                                    size={16}
                                    color={showHistoricalMissions ? "#fff" : "#aaa"}
                                />
                                <Text style={[
                                    styles.filterButtonText,
                                    { color: showHistoricalMissions ? "#fff" : "#aaa" }
                                ]}>
                                    착륙지점
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 탐사선 정보를 불러오는 중입니다... (하단에 표시) */}
                        {isLoading && (
                            <View style={styles.inlineLoading}>
                                <ActivityIndicator size="small" color="#3B82F6" />
                                <Text style={styles.inlineLoadingText}>탐사선 정보를 불러오는 중입니다...</Text>
                            </View>
                        )}

                        {/* 탐사선 카드 */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.spacecraftList}
                            contentContainerStyle={styles.spacecraftListContent}
                        >
                            {showLiveMissions && liveSpacecraft.map(sc => {
                                const isSelected = selectedSpacecraft?.id === sc.id;
                                return (
                                    <TouchableOpacity
                                        key={sc.id}
                                        style={[
                                            styles.spacecraftCard,
                                            isSelected && {
                                                borderColor: sc.color,
                                                borderWidth: 2,
                                                backgroundColor: `${sc.color}30`
                                            }
                                        ]}
                                        onPress={() => handleSpacecraftSelect(sc)}
                                    >
                                        <View style={[
                                            styles.cardIndicator,
                                            { backgroundColor: sc.position ? '#4CAF50' : '#888' }
                                        ]}>
                                            <Text style={styles.cardIndicatorText}>
                                                {sc.position ? 'LIVE' : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={[styles.cardIcon, { backgroundColor: sc.color }]}>
                                            <MaterialCommunityIcons name="satellite-variant" size={18} color="#fff" />
                                        </View>
                                        <Text style={styles.cardName} numberOfLines={1}>{sc.nameKo}</Text>
                                        <Text style={styles.cardCountry}>{sc.country}</Text>
                                        {sc.position ? (
                                            <Text style={styles.cardAlt}>고도 {Math.round(sc.position.altitude)}km</Text>
                                        ) : (
                                            <Text style={styles.cardNoData}>
                                                {sc.apiEnabled ? '조회실패' : 'API없음'}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                            {showHistoricalMissions && HISTORICAL_MISSIONS.filter(m => m.landingLocation).map(site => {
                                const isSelected = selectedSpacecraft?.id === site.id;
                                return (
                                    <TouchableOpacity
                                        key={site.id}
                                        style={[
                                            styles.spacecraftCard,
                                            styles.historicalCard,
                                            isSelected && { borderColor: site.color, borderWidth: 2 }
                                        ]}
                                        onPress={() => handleSpacecraftSelect(site)}
                                    >
                                        <View style={[styles.cardIcon, { backgroundColor: site.color }]}>
                                            <MaterialCommunityIcons
                                                name={site.missionType === 'impactor' ? 'meteor' : 'flag-variant'}
                                                size={18}
                                                color="#fff"
                                            />
                                        </View>
                                        <Text style={styles.cardName} numberOfLines={1}>{site.nameKo}</Text>
                                        <Text style={styles.cardCountry}>{site.country}</Text>
                                        <Text style={styles.cardPeriod}>{site.period}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </BlurView>
                </SafeAreaView>

                {/* 상세 정보 패널 */}
                {selectedSpacecraft && (
                    <View style={styles.detailPanel}>
                        <BlurView intensity={95} tint="dark" style={styles.detailPanelBlur}>
                            <View style={styles.detailHeader}>
                                <View style={[styles.detailIcon, { backgroundColor: selectedSpacecraft.color }]}>
                                    <MaterialCommunityIcons
                                        name={selectedSpacecraft.isLive ? "satellite-variant" :
                                            selectedSpacecraft.missionType === 'impactor' ? 'meteor' : 'flag-variant'}
                                        size={28}
                                        color="#fff"
                                    />
                                </View>
                                <View style={styles.detailTitleWrap}>
                                    <Text style={styles.detailTitle}>{selectedSpacecraft.nameKo}</Text>
                                    <Text style={styles.detailSubtitle}>{selectedSpacecraft.name} • {selectedSpacecraft.country}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.detailCloseBtn}
                                    onPress={() => setSelectedSpacecraft(null)}
                                >
                                    <Ionicons name="close" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.detailBody}>
                                {selectedSpacecraft.isLive && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>상태</Text>
                                        <Text style={[styles.detailValue, { color: '#4CAF50' }]}>🟢 활동 중</Text>
                                    </View>
                                )}
                                {(selectedSpacecraft as SpacecraftWithPosition).position && (
                                    <>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>현재 고도</Text>
                                            <Text style={styles.detailValue}>
                                                {Math.round((selectedSpacecraft as SpacecraftWithPosition).position!.altitude).toLocaleString()} km
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>달 중심 거리</Text>
                                            <Text style={styles.detailValue}>
                                                {Math.round((selectedSpacecraft as SpacecraftWithPosition).position!.distance).toLocaleString()} km
                                            </Text>
                                        </View>
                                    </>
                                )}
                                {selectedSpacecraft.landingLocation && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>착륙 위치</Text>
                                        <Text style={styles.detailValue}>{selectedSpacecraft.landingLocation.name}</Text>
                                    </View>
                                )}
                                {selectedSpacecraft.period && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>활동 기간</Text>
                                        <Text style={styles.detailValue}>{selectedSpacecraft.period}</Text>
                                    </View>
                                )}
                                {selectedSpacecraft.description && (
                                    <Text style={styles.detailDesc}>{selectedSpacecraft.description}</Text>
                                )}
                            </View>
                        </BlurView>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

    guideContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center'
    },
    guideTextContainer: {
        position: 'absolute',
        alignItems: 'center'
    },
    guideText: {
        color: '#40e0d0',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
    },
    guideTextSuccess: { color: '#FFD700' },
    errorText: { color: '#FF5722', fontSize: 11, marginTop: 4 },

    // 수평선 아래 안내 배너
    belowHorizonBanner: {
        position: 'absolute',
        top: SCREEN_HEIGHT / 2 - 60,
        left: 30,
        right: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 16,
        padding: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(64,224,208,0.2)'
    },
    belowHorizonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22
    },

    // 화면 밖 방향 화살표
    edgeArrowContainer: {
        position: 'absolute',
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center'
    },
    edgeArrowText: {
        color: '#40e0d0',
        fontSize: 22,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4
    },
    edgeArrowLabel: {
        fontSize: 16,
        marginTop: -4
    },

    // 정렬 진행 바
    alignProgressBar: {
        width: 120,
        height: 3,
        backgroundColor: 'rgba(64,224,208,0.15)',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden'
    },
    alignProgressFill: {
        width: '100%',
        height: '100%',
        backgroundColor: '#40e0d0',
        borderRadius: 2
    },

    // 정렬 전 상태 안내 박스
    guideStatusBox: {
        position: 'absolute',
        bottom: 220,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(100,200,255,0.15)'
    },
    guideStatusText: {
        color: 'rgba(100,200,255,0.9)',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center'
    },

    // 센서 상태 배지
    sensorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14
    },

    // 방향 안내 텍스트 박스
    directionInfoBox: {
        position: 'absolute',
        bottom: 160,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)'
    },
    directionInfoText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 1,
        textAlign: 'center'
    },

    // 디버그 오버레이
    debugOverlay: {
        position: 'absolute',
        top: 60,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    debugText: {
        color: '#0f0',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        lineHeight: 18,
    },
    spacecraftMarker: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4
    },
    landingMarker: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.5)'
    },

    topControls: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 30, // 노치/다이내믹 아일랜드 고려하여 확실히 내림
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    controlButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '500' },

    inlineLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
        gap: 8
    },
    inlineLoadingText: {
        color: '#fff',
        fontSize: 13,
        opacity: 0.8
    },

    moonImageWrapper: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: -1
    },
    moonGuideImage: {
        width: GUIDE_CIRCLE_RADIUS * 2,
        height: GUIDE_CIRCLE_RADIUS * 2,
        borderRadius: GUIDE_CIRCLE_RADIUS
    },

    bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    bottomPanelBlur: {
        paddingTop: 12,
        paddingBottom: 6,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        overflow: 'hidden'
    },
    filterRow: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 10, gap: 10 },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 5
    },
    filterButtonInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
    filterButtonActive: { backgroundColor: '#3B82F6' },
    filterButtonText: { fontSize: 12, fontWeight: '700' },

    spacecraftList: { maxHeight: 130 },
    spacecraftListContent: { paddingHorizontal: 10, gap: 8 },
    spacecraftCard: {
        width: 95,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center'
    },
    historicalCard: { opacity: 0.85 },
    cardIndicator: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6
    },
    cardIndicatorText: { color: '#fff', fontSize: 8, fontWeight: '700' },
    cardIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    cardName: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
    cardCountry: { color: '#888', fontSize: 9, marginTop: 2 },
    cardAlt: { color: '#4CAF50', fontSize: 9, marginTop: 3, fontWeight: '500' },
    cardNoData: { color: '#FF9800', fontSize: 8, marginTop: 3, fontStyle: 'italic' },
    cardPeriod: { color: '#888', fontSize: 8, marginTop: 3 },

    detailPanel: {
        position: 'absolute',
        top: 100,
        left: 16,
        right: 16,
        zIndex: 200
    },
    detailPanelBlur: {
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden'
    },
    detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    detailIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    detailTitleWrap: { flex: 1 },
    detailTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    detailSubtitle: { color: '#999', fontSize: 12, marginTop: 2 },
    detailCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailBody: { gap: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    detailLabel: { color: '#888', fontSize: 13 },
    detailValue: { color: '#fff', fontSize: 13, fontWeight: '500' },
    detailDesc: { color: '#aaa', fontSize: 12, lineHeight: 18, marginTop: 8 },

    permissionContainer: {
        flex: 1,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20, marginBottom: 10 },
    permissionText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    permissionButton: {
        marginTop: 28,
        paddingHorizontal: 28,
        paddingVertical: 12,
        backgroundColor: '#3B82F6',
        borderRadius: 10
    },
    permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    }
});
