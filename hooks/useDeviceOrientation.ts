// ═══════════════════════════════════════════════════════════
// 디바이스 방향 추적 훅 (중력 가속도 + 자력계 기반)
// ═══════════════════════════════════════════════════════════
// 적응형(Adaptive) 스무딩: 기기가 정지 상태일 때는 강한 스무딩,
// 움직일 때는 빠른 반응으로 떨림과 딜레이를 동시에 해결합니다.

import { useState, useEffect, useRef } from 'react';
import { Magnetometer, DeviceMotion } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

export type Vec3 = [number, number, number];

export interface DeviceOrientation {
    azimuth: number;
    altitude: number;
    roll: number;
    forward: Vec3;
    right: Vec3;
    up: Vec3;
    isAvailable: boolean;
}

const DEG = 180 / Math.PI;

// ─── 벡터 유틸 ───
function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len < 0.0001) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerpAngle360(prev: number, next: number, t: number): number {
    let d = next - prev;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return ((prev + t * d) + 360) % 360;
}

/** 두 벡터 사이의 각도 차이 (degrees) */
function angleBetween(a: Vec3, b: Vec3): number {
    const d = dot(a, b);
    // clamp for acos safety
    return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
}

// ═══════════════════════════════════════════════════════════
// 설정 상수
// ═══════════════════════════════════════════════════════════
const SENSOR_INTERVAL = 16;       // 센서 폴링 간격 (ms)
const COMPUTE_INTERVAL = 16;      // compute 호출 간격 (ms) — ~60fps 출력

// 적응형 스무딩 파라미터
const INPUT_ALPHA = 0.5;          // 센서 입력 low-pass (고정, 원시 노이즈 제거용)
const ALPHA_MIN = 0.04;           // 정지 시 스무딩 강도 (매우 부드러움, 떨림 억제)
const ALPHA_MAX = 0.6;            // 이동 시 스무딩 강도 (빠른 반응)
const DEAD_ZONE_DEG = 0.3;        // 이 각도 미만의 변화는 무시 (떨림 차단)
const MOTION_THRESHOLD_DEG = 2.0; // 이 각도 이상 변화하면 "움직이는 중"으로 판단

// ═══════════════════════════════════════════════════════════
export function useDeviceOrientation(updateInterval: number = SENSOR_INTERVAL): DeviceOrientation {
    const [orientation, setOrientation] = useState<DeviceOrientation>({
        azimuth: 0, altitude: 0, roll: 0,
        forward: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1],
        isAvailable: false,
    });

    const magnetometerSub = useRef<Subscription | null>(null);
    const deviceMotionSub = useRef<Subscription | null>(null);
    const computeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // 1단계: 센서 원시 데이터 (low-pass filtered)
    const smoothAccel = useRef<Vec3>([0, 0, -9.81]);
    const smoothMag = useRef<Vec3>([0, 1, 0]);
    const accelInit = useRef(false);
    const magInit = useRef(false);

    // 2단계: 스무딩된 Forward/Right 벡터
    const vSm = useRef({
        fwd: [0, 1, 0] as Vec3,
        rt: [1, 0, 0] as Vec3,
        init: false,
    });

    // 3단계: 스무딩된 각도 출력
    const aSm = useRef({ az: 0, alt: 0, roll: 0, init: false });

    useEffect(() => {
        let alive = true;

        async function start() {
            try {
                const motionOk = await DeviceMotion.isAvailableAsync();
                if (motionOk) {
                    DeviceMotion.setUpdateInterval(updateInterval);
                    deviceMotionSub.current = DeviceMotion.addListener(data => {
                        if (data.accelerationIncludingGravity) {
                            const { x, y, z } = data.accelerationIncludingGravity;
                            if (!accelInit.current) {
                                smoothAccel.current = [x, y, z];
                                accelInit.current = true;
                            } else {
                                smoothAccel.current = lerpVec3(smoothAccel.current, [x, y, z], INPUT_ALPHA);
                            }
                        }
                    });
                }

                const magOk = await Magnetometer.isAvailableAsync();
                if (magOk) {
                    Magnetometer.setUpdateInterval(updateInterval);
                    magnetometerSub.current = Magnetometer.addListener(data => {
                        const { x, y, z } = data;
                        if (!magInit.current) {
                            smoothMag.current = [x, y, z];
                            magInit.current = true;
                        } else {
                            smoothMag.current = lerpVec3(smoothMag.current, [x, y, z], INPUT_ALPHA);
                        }
                    });
                }

                computeTimer.current = setInterval(() => {
                    if (alive) compute();
                }, COMPUTE_INTERVAL);

                if (alive) {
                    setOrientation(prev => ({ ...prev, isAvailable: motionOk || magOk }));
                }
            } catch (e) {
                console.error('[useDeviceOrientation] sensor error:', e);
            }
        }

        function compute() {
            if (!alive) return;

            const LOCAL_FWD: Vec3 = [0, 0, -1];
            const LOCAL_RT: Vec3 = [1, 0, 0];

            // ── 월드 좌표계 구성 ──
            let wUp = normalize([
                -smoothAccel.current[0],
                -smoothAccel.current[1],
                -smoothAccel.current[2],
            ]);
            if (wUp[0] === 0 && wUp[1] === 0 && wUp[2] === 0) wUp = [0, 0, 1];

            const mag = normalize(smoothMag.current);
            let wEast = normalize(cross(mag, wUp));
            if (wEast[0] === 0 && wEast[1] === 0 && wEast[2] === 0) wEast = [1, 0, 0];
            let wNorth = normalize(cross(wUp, wEast));

            const toWorld = (v: Vec3): Vec3 => [
                dot(v, wEast), dot(v, wNorth), dot(v, wUp),
            ];

            const curFwd = normalize(toWorld(LOCAL_FWD));
            const curRt = normalize(toWorld(LOCAL_RT));

            // ── 적응형 스무딩 ──
            if (!vSm.current.init) {
                vSm.current = { fwd: curFwd, rt: curRt, init: true };
            } else {
                // Forward 벡터의 변화량 (degrees)으로 동적 alpha 결정
                const delta = angleBetween(vSm.current.fwd, curFwd);

                if (delta < DEAD_ZONE_DEG) {
                    // 데드존 이내: 변화를 완전히 무시 → 떨림 제거
                    // (아무 것도 안 함)
                } else {
                    // 변화량에 비례하여 alpha를 조절
                    // delta가 MOTION_THRESHOLD 이상이면 ALPHA_MAX, 아래면 보간
                    const t = Math.min(1, (delta - DEAD_ZONE_DEG) / (MOTION_THRESHOLD_DEG - DEAD_ZONE_DEG));
                    const alpha = lerp(ALPHA_MIN, ALPHA_MAX, t);

                    vSm.current.fwd = normalize(lerpVec3(vSm.current.fwd, curFwd, alpha));
                    vSm.current.rt = normalize(lerpVec3(vSm.current.rt, curRt, alpha));
                }
            }

            // Gram-Schmidt 직교화
            let fwd = vSm.current.fwd;
            let rt = vSm.current.rt;
            const d = dot(rt, fwd);
            rt = normalize([
                rt[0] - d * fwd[0],
                rt[1] - d * fwd[1],
                rt[2] - d * fwd[2],
            ]);
            const up = cross(rt, fwd);

            // ── 각도 추출 ──
            let rawAz = Math.atan2(fwd[0], fwd[1]) * DEG;
            rawAz = (rawAz + 360) % 360;
            const rawAlt = Math.asin(Math.max(-1, Math.min(1, fwd[2]))) * DEG;
            const rawRoll = Math.asin(Math.max(-1, Math.min(1, rt[2]))) * DEG;

            // 각도 스무딩도 적응형 적용
            if (!aSm.current.init) {
                aSm.current = { az: rawAz, alt: rawAlt, roll: rawRoll, init: true };
            } else {
                const azDelta = Math.abs(rawAz - aSm.current.az);
                const altDelta = Math.abs(rawAlt - aSm.current.alt);
                const maxDelta = Math.max(azDelta > 180 ? 360 - azDelta : azDelta, altDelta);

                const t = Math.min(1, maxDelta / MOTION_THRESHOLD_DEG);
                const aAlpha = lerp(ALPHA_MIN, ALPHA_MAX, t);

                aSm.current.az = lerpAngle360(aSm.current.az, rawAz, aAlpha);
                aSm.current.alt = lerp(aSm.current.alt, rawAlt, aAlpha);
                aSm.current.roll = lerp(aSm.current.roll, rawRoll, aAlpha);
            }

            setOrientation({
                azimuth: Math.round(aSm.current.az * 10) / 10,
                altitude: Math.round(aSm.current.alt * 10) / 10,
                roll: Math.round(aSm.current.roll * 10) / 10,
                forward: fwd,
                right: rt,
                up,
                isAvailable: true,
            });
        }

        start();
        return () => {
            alive = false;
            magnetometerSub.current?.remove();
            deviceMotionSub.current?.remove();
            if (computeTimer.current) clearInterval(computeTimer.current);
        };
    }, [updateInterval]);

    return orientation;
}
