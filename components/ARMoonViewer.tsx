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
    // 달 위치 고정 앵커 (확인 시점의 기기 방향)
    const [anchorPosition, setAnchorPosition] = useState<{ azimuth: number; altitude: number } | null>(null);

    const [liveSpacecraft, setLiveSpacecraft] = useState<SpacecraftWithPosition[]>([]);
    const [selectedSpacecraft, setSelectedSpacecraft] = useState<Spacecraft | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLiveMissions, setShowLiveMissions] = useState(true);
    const [showHistoricalMissions, setShowHistoricalMissions] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // 부드러운 AR 추적을 위해 센서 업데이트 속도 20ms로 증가
    const deviceOrientation = useDeviceOrientation(20);
    const moonPosition = useMoonPosition(60000);

    // 애니메이션
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const orbitRotation = useRef(new Animated.Value(0)).current;

    // 3D 회전 상태
    const [rotation, setRotation] = useState({ az: 0, el: 0 });
    const isInteracting = useRef(false);

    // PanResponder: 스와이프 제스처 처리
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                isInteracting.current = true;
            },
            onPanResponderMove: (_, gestureState) => {
                // 감도 조절
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

    // FOV 상수는 (대략적인 값, 아이폰 와이드 렌즈 기준)
    const PIXELS_PER_DEGREE_X = SCREEN_WIDTH / 60;
    const PIXELS_PER_DEGREE_Y = SCREEN_HEIGHT / 80;

    // 현재 달의 화면상 좌표 계산 (AR 앵커링)
    const { moonScreenX, moonScreenY, isVisible } = useMemo(() => {
        if (!isMoonAligned || !anchorPosition) {
            // 정렬 전에는 화면 중앙에 고정
            return {
                moonScreenX: SCREEN_WIDTH / 2,
                moonScreenY: SCREEN_HEIGHT / 2 - 80,
                isVisible: true
            };
        }

        // 앵커 기준 현재 기기 방향과의 차이 계산
        let diffAz = deviceOrientation.azimuth - anchorPosition.azimuth;
        // -180 ~ 180도 사이로 정규화
        if (diffAz > 180) diffAz -= 360;
        if (diffAz < -180) diffAz += 360;

        const diffAlt = deviceOrientation.altitude - anchorPosition.altitude;

        // 화면 좌표 계산 (AR 앵커링)
        // 센서 값과 화면 이동 방향 보정 (1 or -1)
        const INVERT_X = 1;  // 좌우 반전 여부 (1: 그대로, -1: 반전)
        const INVERT_Y = 1;  // 상하 반전 여부

        // 기기가 오른쪽(Azimuth 증가)으로 돌면 -> 물체는 화면 왼쪽(X 감소)으로 이동해야 함
        // 기기가 위쪽(Altitude 변화)으로 돌면 -> 물체는 화면 아래쪽(Y 증가)으로 이동해야 함

        // 사용자 피드백 반영:
        // 좌우: + 사용 (step 514 요청)
        // 상하: + 사용 (현재 - 상태에서 반전 요청)

        const xOffset = (diffAz * PIXELS_PER_DEGREE_X) * INVERT_X;
        const yOffset = (diffAlt * PIXELS_PER_DEGREE_Y) * INVERT_Y;

        const x = (SCREEN_WIDTH / 2) + xOffset;
        const y = (SCREEN_HEIGHT / 2 - 80) + yOffset;

        // 화면 범위 내에 있는지 확인 (여유 200px)
        const margin = 200;
        const visible = (
            x >= -margin &&
            x <= SCREEN_WIDTH + margin &&
            y >= -margin &&
            y <= SCREEN_HEIGHT + margin
        );

        return { moonScreenX: x, moonScreenY: y, isVisible: visible };
    }, [isMoonAligned, anchorPosition, deviceOrientation]);

    // 달 확인 토글
    const handleMoonConfirm = useCallback(() => {
        if (!isMoonAligned) {
            // 정렬 시작: 현재 기기 방향을 앵커로 저장
            setAnchorPosition({
                azimuth: deviceOrientation.azimuth,
                altitude: deviceOrientation.altitude
            });
            setIsMoonAligned(true);
        } else {
            // 정렬 해제
            setIsMoonAligned(false);
            setAnchorPosition(null);
        }
    }, [isMoonAligned, deviceOrientation]);

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

                        {/* 달 가이드 원 */}
                        {isVisible && (
                            <TouchableOpacity
                                style={[
                                    styles.guideContainer,
                                    {
                                        position: 'absolute',
                                        left: moonScreenX - (GUIDE_CIRCLE_RADIUS + 15),
                                        top: moonScreenY - (GUIDE_CIRCLE_RADIUS + 15),
                                        // 기존 중앙 정렬 스타일 무시를 위해 width/height 명시가 필요할 수 있음
                                        width: (GUIDE_CIRCLE_RADIUS * 2) + 30,
                                        height: (GUIDE_CIRCLE_RADIUS * 2) + 30,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }
                                ]}
                                onPress={handleMoonConfirm}
                                activeOpacity={0.9}
                            >
                                <Animated.View style={{ transform: [{ scale: isMoonAligned ? 1 : pulseAnim }] }}>
                                    {/* 반투명 달 이미지 가이드 */}
                                    <View style={styles.moonImageWrapper}>
                                        <Image
                                            source={require('../assets/moon_texture.png')}
                                            style={[
                                                styles.moonGuideImage,
                                                { opacity: isMoonAligned ? 0.3 : 0.6 }
                                            ]}
                                        />
                                    </View>

                                    <Svg width={GUIDE_CIRCLE_RADIUS * 2 + 30} height={GUIDE_CIRCLE_RADIUS * 2 + 30}>
                                        <Circle
                                            cx={GUIDE_CIRCLE_RADIUS + 15}
                                            cy={GUIDE_CIRCLE_RADIUS + 15}
                                            r={GUIDE_CIRCLE_RADIUS}
                                            stroke={isMoonAligned ? "rgba(255,255,255,0.4)" : "#3B82F6"}
                                            strokeWidth={1}
                                            strokeDasharray={isMoonAligned ? "0" : "8,6"}
                                            fill="transparent"
                                        />

                                        {/* 십자선 */}
                                        <Line
                                            x1={GUIDE_CIRCLE_RADIUS + 15 - 10}
                                            y1={GUIDE_CIRCLE_RADIUS + 15}
                                            x2={GUIDE_CIRCLE_RADIUS + 15 + 10}
                                            y2={GUIDE_CIRCLE_RADIUS + 15}
                                            stroke={isMoonAligned ? "rgba(255,255,255,0.6)" : "#3B82F6"}
                                            strokeWidth={1}
                                        />
                                        <Line
                                            x1={GUIDE_CIRCLE_RADIUS + 15}
                                            y1={GUIDE_CIRCLE_RADIUS + 15 - 10}
                                            x2={GUIDE_CIRCLE_RADIUS + 15}
                                            y2={GUIDE_CIRCLE_RADIUS + 15 + 10}
                                            stroke={isMoonAligned ? "rgba(255,255,255,0.6)" : "#3B82F6"}
                                            strokeWidth={1}
                                        />
                                    </Svg>
                                </Animated.View>
                            </TouchableOpacity>
                        )}

                        {/* 가이드 텍스트 */}
                        {isVisible && (
                            <View style={[
                                styles.guideTextContainer,
                                {
                                    top: moonScreenY + GUIDE_CIRCLE_RADIUS + 25,
                                    left: moonScreenX - 150, // 중앙 정렬을 위한 오프셋
                                    width: 300
                                }
                            ]}>
                                <Text style={[styles.guideText, isMoonAligned && styles.guideTextSuccess]}>
                                    {isMoonAligned ? '🌙 탐사선을 탭하여 상세 정보 확인' : '달을 원에 맞추고 탭하세요'}
                                </Text>
                                {apiError && isMoonAligned && (
                                    <Text style={styles.errorText}>{apiError}</Text>
                                )}
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
                    <TouchableOpacity
                        style={[styles.controlButton, { marginRight: 10 }]}
                        onPress={() => setRotation({ az: 0, el: 0 })}
                    >
                        <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
                    </TouchableOpacity>
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
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
    },
    guideTextSuccess: { color: '#FFD700' },
    errorText: { color: '#FF5722', fontSize: 11, marginTop: 4 },

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
