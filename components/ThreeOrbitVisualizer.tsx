// Three.js 기반 궤도 시각화 컴포넌트
// expo-gl + expo-three를 사용하여 탐사선 궤적을 GPU 가속으로 렌더링

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 탐사선 데이터 타입 (ARMoonViewer와 호환)
interface TrajectorySpacecraft {
    id: string;
    color: string;
    nameKo: string;
    screenPos?: { x: number; y: number; behindMoon: boolean };
    screenTrajectory?: { x: number; y: number; behindMoon?: boolean }[];
    orbitRadius?: number;
    orbitEccentricity?: number;
    orbitTilt?: number;
}

// 역사적 착륙 지점 타입
interface HistoricalSite {
    id: string;
    color: string;
    screenX: number;
    screenY: number;
}

interface Props {
    moonCenter: { x: number; y: number };
    moonRadius: number;
    rotation: { az: number; el: number };
    spacecraft: TrajectorySpacecraft[];
    selectedId: string | null;
    historicalSites: HistoricalSite[];
    showLiveMissions: boolean;
    showHistoricalMissions: boolean;
}

export default function ThreeOrbitVisualizer({
    moonCenter,
    moonRadius,
    rotation,
    spacecraft,
    selectedId,
    historicalSites,
    showLiveMissions,
    showHistoricalMissions
}: Props) {
    const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const isInitializedRef = useRef(false);

    // Scene에 객체들을 추가하는 함수
    const buildScene = useCallback(() => {
        if (!sceneRef.current) return;

        const scene = sceneRef.current;

        // 기존 객체들 모두 제거
        while (scene.children.length > 0) {
            const obj = scene.children[0];
            scene.remove(obj);
            if ((obj as any).geometry) (obj as any).geometry.dispose();
            if ((obj as any).material) (obj as any).material.dispose();
        }

        const hasSelection = selectedId !== null;

        // 실시간 미션 궤적/궤도 추가
        if (showLiveMissions && spacecraft.length > 0) {
            spacecraft.forEach(sc => {
                const isSelected = sc.id === selectedId;
                const baseOpacity = isSelected ? 1.0 : (hasSelection ? 0.2 : 0.6);

                // 1. 실제 궤적 데이터가 있는 경우 - LineSegments (관통 방지 필터링)
                if (sc.screenTrajectory && sc.screenTrajectory.length >= 2) {
                    const trajectory = sc.screenTrajectory;
                    const baseColor = new THREE.Color(sc.color);

                    const positions: number[] = [];
                    const colors: number[] = [];

                    for (let i = 0; i < trajectory.length - 1; i++) {
                        const pt1 = trajectory[i];
                        const pt2 = trajectory[i + 1];

                        // 둘 중 하나라도 달 뒤쪽에 있으면 해당 세그먼트는 그리지 않음 (관통 방지)
                        if (pt1.behindMoon || pt2.behindMoon) continue;

                        // progress: 0(과거) → 1(최근)
                        const prog1 = i / Math.max(1, trajectory.length - 1);
                        const prog2 = (i + 1) / Math.max(1, trajectory.length - 1);

                        // 페이드인 및 밝기 계산
                        const fadeIn1 = prog1 < 0.2 ? (prog1 / 0.2) * 0.9 : 0.9;
                        const fadeIn2 = prog2 < 0.2 ? (prog2 / 0.2) * 0.9 : 0.9;

                        const bright1 = (0.3 + 0.7 * Math.pow(prog1, 1.2)) * (fadeIn1 / 0.9);
                        const bright2 = (0.3 + 0.7 * Math.pow(prog2, 1.2)) * (fadeIn2 / 0.9);

                        // 점 1
                        positions.push(pt1.x, SCREEN_HEIGHT - pt1.y, 0);
                        colors.push(baseColor.r * bright1, baseColor.g * bright1, baseColor.b * bright1);

                        // 점 2
                        positions.push(pt2.x, SCREEN_HEIGHT - pt2.y, 0);
                        colors.push(baseColor.r * bright2, baseColor.g * bright2, baseColor.b * bright2);
                    }

                    if (positions.length > 0) {
                        const geometry = new THREE.BufferGeometry();
                        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

                        const material = new THREE.LineBasicMaterial({
                            vertexColors: true,
                            transparent: true,
                            opacity: baseOpacity
                        });

                        const line = new THREE.LineSegments(geometry, material);
                        scene.add(line);
                    }
                }
                // 2. 궤적 데이터가 없으면 추정 타원 궤도
                else if (sc.orbitRadius) {
                    const rx = sc.orbitRadius;
                    const ry = rx * (sc.orbitEccentricity || 0.4);
                    const tilt = sc.orbitTilt || 0;
                    const tiltRad = (tilt * Math.PI) / 180;

                    // 타원 포인트 생성
                    const ellipsePoints: THREE.Vector3[] = [];
                    const segments = 64;

                    for (let i = 0; i <= segments; i++) {
                        const angle = (i / segments) * 2 * Math.PI;
                        const ex = rx * Math.cos(angle);
                        const ey = ry * Math.sin(angle);

                        // 기울기 적용
                        const rotatedX = ex * Math.cos(tiltRad) - ey * Math.sin(tiltRad);
                        const rotatedY = ex * Math.sin(tiltRad) + ey * Math.cos(tiltRad);

                        ellipsePoints.push(new THREE.Vector3(
                            moonCenter.x + rotatedX,
                            SCREEN_HEIGHT - (moonCenter.y + rotatedY),
                            0
                        ));
                    }

                    const geometry = new THREE.BufferGeometry().setFromPoints(ellipsePoints);
                    const material = new THREE.LineDashedMaterial({
                        color: new THREE.Color(sc.color),
                        transparent: true,
                        opacity: baseOpacity,
                        dashSize: 5,
                        gapSize: 5
                    });

                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances();
                    scene.add(line);
                }
            });
        }

        // 역사적 착륙 지점 (점으로 표시)
        if (showHistoricalMissions && historicalSites.length > 0) {
            historicalSites.forEach(site => {
                const geometry = new THREE.CircleGeometry(8, 16);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(site.color),
                    transparent: true,
                    opacity: 0.8
                });
                const circle = new THREE.Mesh(geometry, material);
                circle.position.set(site.screenX, SCREEN_HEIGHT - site.screenY, 0);
                scene.add(circle);
            });
        }
    }, [spacecraft, selectedId, historicalSites, moonCenter, showLiveMissions, showHistoricalMissions]);

    // 렌더 함수
    const renderScene = useCallback(() => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !glRef.current) {
            return;
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
        glRef.current.endFrameEXP();
    }, []);

    // GL 컨텍스트 생성 시 호출
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        glRef.current = gl;

        // Renderer 생성
        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(0x000000, 0); // 투명 배경
        rendererRef.current = renderer;

        // Scene 생성
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Orthographic Camera (화면 픽셀 좌표계)
        const camera = new THREE.OrthographicCamera(
            0,              // left
            SCREEN_WIDTH,   // right
            SCREEN_HEIGHT,  // top
            0,              // bottom
            -1000,
            1000
        );
        camera.position.z = 10;
        cameraRef.current = camera;

        isInitializedRef.current = true;

        // 초기 씬 구성 및 렌더
        buildScene();
        renderScene();
    }, [buildScene, renderScene]);

    // 데이터 변경 시 씬 업데이트
    useEffect(() => {
        if (isInitializedRef.current) {
            buildScene();
            renderScene();
        }
    }, [buildScene, renderScene]);

    // 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, []);

    return (
        <View style={styles.container} pointerEvents="none">
            <GLView
                style={StyleSheet.absoluteFill}
                onContextCreate={onContextCreate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent'
    }
});
