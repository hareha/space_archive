// 달 위치 계산 훅
// 사용자 GPS + 현재 시간 → 달의 고도/방위각 계산

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface MoonPosition {
    azimuth: number;      // 방위각 (0-360도, 북쪽 기준)
    altitude: number;     // 고도각 (-90 ~ 90도, 수평 기준)
    distance: number;     // 거리 (km)
    phase: number;        // 위상 (0-1, 0=새달, 0.5=보름달)
    illumination: number; // 조명 비율 (0-1)
    isVisible: boolean;   // 현재 하늘에 보이는지
    error?: string;
}

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
                // 위치 권한 요청
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setMoonPosition(prev => ({
                        ...prev,
                        error: '위치 권한이 필요합니다'
                    }));
                    return;
                }

                // 현재 위치 가져오기
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced
                });

                const { latitude, longitude } = location.coords;
                const now = new Date();

                // 달 위치 계산 (간단한 근사치)
                const moonPos = calculateMoonAltAz(latitude, longitude, now);

                if (isMounted) {
                    setMoonPosition({
                        ...moonPos,
                        isVisible: moonPos.altitude > 0,
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
 * 달의 고도/방위각 계산 (간단한 천문학적 근사)
 * 참고: 정밀한 계산을 위해서는 JPL Ephemeris 사용 권장
 */
function calculateMoonAltAz(
    latitude: number,
    longitude: number,
    date: Date
): Omit<MoonPosition, 'isVisible' | 'error'> {
    // Julian Date 계산
    const jd = getJulianDate(date);
    const T = (jd - 2451545.0) / 36525; // Julian centuries from J2000.0

    // 달의 평균 경도 (degrees)
    let L = 218.316 + 13.176396 * (jd - 2451545.0);
    L = normalizeAngle(L);

    // 달의 평균 근점이각
    let M = 134.963 + 13.064993 * (jd - 2451545.0);
    M = normalizeAngle(M);

    // 달의 평균 이심거리
    let F = 93.272 + 13.229350 * (jd - 2451545.0);
    F = normalizeAngle(F);

    // 경도 보정
    const dL = 6.289 * Math.sin(toRadians(M));
    const lonMoon = L + dL;

    // 위도
    const latMoon = 5.128 * Math.sin(toRadians(F));

    // 거리 (km)
    const distance = 385001 - 20905 * Math.cos(toRadians(M));

    // 적경/적위 계산 (간단한 근사)
    const eps = 23.439 - 0.00000036 * (jd - 2451545.0); // 황도 경사각

    const ra = Math.atan2(
        Math.sin(toRadians(lonMoon)) * Math.cos(toRadians(eps)) -
        Math.tan(toRadians(latMoon)) * Math.sin(toRadians(eps)),
        Math.cos(toRadians(lonMoon))
    );

    const dec = Math.asin(
        Math.sin(toRadians(latMoon)) * Math.cos(toRadians(eps)) +
        Math.cos(toRadians(latMoon)) * Math.sin(toRadians(eps)) * Math.sin(toRadians(lonMoon))
    );

    // 지방 항성시각 계산
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    let lst = 100.46 + 0.985647 * (jd - 2451545.0) + longitude + 15 * utcHours;
    lst = normalizeAngle(lst);

    // 시간각
    const ha = toRadians(lst) - ra;

    // 고도/방위각 계산
    const latRad = toRadians(latitude);

    const altitude = Math.asin(
        Math.sin(latRad) * Math.sin(dec) +
        Math.cos(latRad) * Math.cos(dec) * Math.cos(ha)
    );

    const azimuth = Math.atan2(
        Math.sin(ha),
        Math.cos(ha) * Math.sin(latRad) - Math.tan(dec) * Math.cos(latRad)
    );

    // 위상 계산 (간단한 근사)
    const sunLon = normalizeAngle(280.466 + 0.985647 * (jd - 2451545.0));
    let phase = (lonMoon - sunLon) / 360;
    phase = phase - Math.floor(phase);

    // 조명 계산
    const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

    return {
        azimuth: normalizeAngle(toDegrees(azimuth) + 180), // 북쪽이 0도
        altitude: toDegrees(altitude),
        distance,
        phase,
        illumination
    };
}

// 헬퍼 함수
function getJulianDate(date: Date): number {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate() +
        (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;

    const a = Math.floor((14 - m) / 12);
    const y1 = y + 4800 - a;
    const m1 = m + 12 * a - 3;

    return d + Math.floor((153 * m1 + 2) / 5) + 365 * y1 +
        Math.floor(y1 / 4) - Math.floor(y1 / 100) + Math.floor(y1 / 400) - 32045;
}

function normalizeAngle(angle: number): number {
    angle = angle % 360;
    return angle < 0 ? angle + 360 : angle;
}

function toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

function toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
}
