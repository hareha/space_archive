// 달 위치 계산 훅
// Jean Meeus "Astronomical Algorithms" 기반 정밀 계산
// GPS 좌표 + UTC 시간 → 달의 방위각/고도각 (오차 ~0.3°~0.5°)

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface MoonPosition {
    azimuth: number;      // 방위각 (0-360도, 북=0, 동=90, 남=180, 서=270)
    altitude: number;     // 고도각 (-90 ~ 90도, 수평=0)
    distance: number;     // 지심 거리 (km)
    phase: number;        // 위상 (0-1, 0=새달, 0.5=보름달)
    illumination: number; // 조명 비율 (0-1)
    isVisible: boolean;   // 수평선 위인지
    error?: string;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function useMoonPosition(updateInterval: number = 60000): MoonPosition {
    const [moonPosition, setMoonPosition] = useState<MoonPosition>({
        azimuth: 0,
        altitude: 0,
        distance: 384400,
        phase: 0.5,
        illumination: 1,
        isVisible: false
    });

    useEffect(() => {
        let isMounted = true;

        async function calculateMoonPosition() {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setMoonPosition(prev => ({
                        ...prev,
                        error: '위치 권한이 필요합니다'
                    }));
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced
                });

                const { latitude, longitude } = location.coords;
                const now = new Date();

                const moonPos = calculateMoonAltAz(latitude, longitude, now);

                if (isMounted) {
                    setMoonPosition({
                        ...moonPos,
                        isVisible: moonPos.altitude > -0.5, // 대기 굴절 보정 (~0.5°)
                        error: undefined
                    });
                }
            } catch (error) {
                console.error('[useMoonPosition] Error:', error);
                if (isMounted) {
                    setMoonPosition(prev => ({
                        ...prev,
                        error: '달 위치 계산 실패'
                    }));
                }
            }
        }

        calculateMoonPosition();
        const interval = setInterval(calculateMoonPosition, updateInterval);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [updateInterval]);

    return moonPosition;
}

/**
 * 달의 고도/방위각 정밀 계산
 * 
 * 알고리즘 출처: Jean Meeus, "Astronomical Algorithms" (2nd ed.)
 * Chapter 47: Position of the Moon
 * 
 * 계산 흐름:
 * 1. Julian Date → Julian Centuries (T)
 * 2. 달의 기본 인자 계산 (L', D, M, M', F)
 * 3. 주요 섭동항 적용 (경도 보정 ~6개, 위도 보정 ~4개)
 * 4. 황도 좌표 → 적도 좌표 (RA, Dec)
 * 5. 시간각(HA) 계산
 * 6. 적도 좌표 → 수평 좌표 (Azimuth, Altitude)
 */
export function calculateMoonAltAz(
    latitude: number,
    longitude: number,
    date: Date
): Omit<MoonPosition, 'isVisible' | 'error'> {
    // ─── 1. Julian Date & Century ───
    const jd = getJulianDate(date);
    const T = (jd - 2451545.0) / 36525;

    // ─── 2. 달의 기본 인자 (Meeus Ch.47, 도 단위) ───
    // L' : 달의 평균 경도 (mean longitude)
    const Lp = norm360(
        218.3164477 +
        481267.88123421 * T -
        0.0015786 * T * T +
        T * T * T / 538841 -
        T * T * T * T / 65194000
    );

    // D : 달-태양 평균 이각 (mean elongation)
    const D = norm360(
        297.8501921 +
        445267.1114034 * T -
        0.0018819 * T * T +
        T * T * T / 545868 -
        T * T * T * T / 113065000
    );

    // M : 태양의 평균 근점이각 (Sun's mean anomaly)
    const M = norm360(
        357.5291092 +
        35999.0502909 * T -
        0.0001536 * T * T +
        T * T * T / 24490000
    );

    // M' : 달의 평균 근점이각 (Moon's mean anomaly)
    const Mp = norm360(
        134.9633964 +
        477198.8675055 * T +
        0.0087414 * T * T +
        T * T * T / 69699 -
        T * T * T * T / 14712000
    );

    // F : 달의 위도 인자 (argument of latitude)
    const F = norm360(
        93.2720950 +
        483202.0175233 * T -
        0.0036539 * T * T -
        T * T * T / 3526000 +
        T * T * T * T / 863310000
    );

    // ─── 3. 주요 섭동항 (경도 & 위도 보정) ───
    // 이심률 보정 계수
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const E2 = E * E;

    // 경도 섭동 (Σl, 0.001° 단위) — 주요 14개 항
    const sumL =
        6288774 * sin(Mp) +
        1274027 * sin(2 * D - Mp) +
        658314 * sin(2 * D) +
        213618 * sin(2 * Mp) +
        -185116 * E * sin(M) +
        -114332 * sin(2 * F) +
        58793 * sin(2 * D - 2 * Mp) +
        57066 * E * sin(2 * D - M - Mp) +
        53322 * sin(2 * D + Mp) +
        45758 * E * sin(2 * D - M) +
        -40923 * E * sin(M - Mp) +
        -34720 * sin(D) +
        -30383 * E * sin(M + Mp) +
        15327 * sin(2 * D - 2 * F);

    // 위도 섭동 (Σb, 0.001° 단위) — 주요 10개 항
    const sumB =
        5128122 * sin(F) +
        280602 * sin(Mp + F) +
        277693 * sin(Mp - F) +
        173237 * sin(2 * D - F) +
        55413 * sin(2 * D - Mp + F) +
        46271 * sin(2 * D - Mp - F) +
        32573 * sin(2 * D + F) +
        17198 * sin(2 * Mp + F) +
        9266 * sin(2 * D + Mp - F) +
        8822 * sin(2 * Mp - F);

    // 거리 섭동 (Σr, 0.001 km 단위) — 주요 8개 항
    const sumR =
        -20905355 * cos(Mp) +
        -3699111 * cos(2 * D - Mp) +
        -2955968 * cos(2 * D) +
        -569925 * cos(2 * Mp) +
        48888 * E * cos(M) +
        -3149 * cos(2 * F) +
        246158 * E * cos(2 * D - M - Mp) +
        -152138 * cos(2 * D - 2 * Mp);

    // ─── 4. 황도 좌표 ───
    const lonMoon = Lp + sumL / 1000000; // 도
    const latMoon = sumB / 1000000;       // 도
    const distance = 385000.56 + sumR / 1000; // km

    // ─── 5. 황도 → 적도 변환 (RA, Dec) ───
    // 황도 경사각 (obliquity of ecliptic)
    const eps = 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;

    const lonRad = lonMoon * DEG2RAD;
    const latRad = latMoon * DEG2RAD;
    const epsRad = eps * DEG2RAD;

    // 적경 (Right Ascension)
    const ra = Math.atan2(
        Math.sin(lonRad) * Math.cos(epsRad) - Math.tan(latRad) * Math.sin(epsRad),
        Math.cos(lonRad)
    );

    // 적위 (Declination)
    const dec = Math.asin(
        Math.sin(latRad) * Math.cos(epsRad) +
        Math.cos(latRad) * Math.sin(epsRad) * Math.sin(lonRad)
    );

    // ─── 6. 지방 항성시각 (Local Sidereal Time) ───
    const utcHours = date.getUTCHours() +
        date.getUTCMinutes() / 60 +
        date.getUTCSeconds() / 3600;

    // Greenwich Mean Sidereal Time (도 단위)
    let gmst = 280.46061837 +
        360.98564736629 * (jd - 2451545.0) +
        0.000387933 * T * T -
        T * T * T / 38710000;
    gmst = norm360(gmst);

    // Local Sidereal Time
    const lst = norm360(gmst + longitude);

    // ─── 7. 시간각 (Hour Angle) ───
    const ha = (lst * DEG2RAD) - ra;

    // ─── 8. 적도 → 수평 좌표 (Azimuth, Altitude) ───
    const latRad2 = latitude * DEG2RAD;

    const sinAlt = Math.sin(latRad2) * Math.sin(dec) +
        Math.cos(latRad2) * Math.cos(dec) * Math.cos(ha);
    const altitude = Math.asin(sinAlt) * RAD2DEG;

    // 방위각: 북=0°, 동=90° 관례
    let azimuth = Math.atan2(
        Math.sin(ha),
        Math.cos(ha) * Math.sin(latRad2) - Math.tan(dec) * Math.cos(latRad2)
    ) * RAD2DEG;
    azimuth = norm360(azimuth + 180); // 남→북 관례 보정

    // ─── 9. 위상 & 조명 ───
    const sunLon = norm360(
        280.46646 + 36000.76983 * T + 0.0003032 * T * T
    );
    let phase = norm360(lonMoon - sunLon) / 360;
    const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

    return {
        azimuth,
        altitude,
        distance,
        phase,
        illumination
    };
}

// ─── 헬퍼 함수 ───

function getJulianDate(date: Date): number {
    // Meeus 표준 방식 (Astronomical Algorithms, Ch.7)
    let y = date.getUTCFullYear();
    let m = date.getUTCMonth() + 1;
    const day = date.getUTCDate() +
        (date.getUTCHours() + date.getUTCMinutes() / 60 +
            date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000) / 24;

    if (m <= 2) {
        y -= 1;
        m += 12;
    }

    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);

    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/** 각도를 0~360 범위로 정규화 */
function norm360(angle: number): number {
    angle = angle % 360;
    return angle < 0 ? angle + 360 : angle;
}

/** sin (도 단위 입력) */
function sin(deg: number): number {
    return Math.sin(deg * DEG2RAD);
}

/** cos (도 단위 입력) */
function cos(deg: number): number {
    return Math.cos(deg * DEG2RAD);
}
