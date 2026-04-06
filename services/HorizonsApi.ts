import axios from 'axios';

const BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// 재시도 딜레이 헬퍼
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 재시도 포함 GET 요청 (최대 maxRetries회, 지수 백오프)
const axiosGetWithRetry = async (url: string, params: object, maxRetries = 2): Promise<any> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await axios.get(url, { params, timeout: 10000 });
        } catch (error: any) {
            const status = error?.response?.status;
            const isRetryable = status === 503 || status === 429 || !status; // 503, 429, 네트워크 오류
            if (isRetryable && attempt < maxRetries) {
                const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
                console.warn(`[HorizonsApi] ${status ?? 'Network'} error, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
};

// 좌표 데이터 인터페이스
export interface SpacecraftPosition {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    lightTime: number;
    timestamp: string;
    distance: number; // 달 중심 거리 (km)
    altitude: number; // 고도 (km)
}

// 궤적 데이터 인터페이스
export interface TrajectoryPoint {
    timestamp: string;
    epochMs: number; // Unix timestamp (ms)
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
}

const MOON_RADIUS_KM = 1737.4; // 달 평균 반지름

/**
 * ICRF → Moon Body-Fixed (PA) 좌표 변환
 * IAU 2015 달 방위 모델 (libration 미포함 간소화)
 * @param x,y,z - ICRF 좌표 (km)
 * @param jd - Julian Date (TDB)
 * @returns body-fixed 좌표 (km)
 */
function icrfToMoonBodyFixed(x: number, y: number, z: number, jd: number): { x: number; y: number; z: number } {
    const d = jd - 2451545.0;       // J2000.0 기준 일수
    const T = d / 36525.0;          // J2000.0 기준 세기

    // 달 자전축 방향 (ICRF) - IAU 2015
    const alpha0 = (269.9949 + 0.0031 * T) * Math.PI / 180;  // 극 RA
    const delta0 = (66.5392 + 0.0130 * T) * Math.PI / 180;   // 극 Dec
    // 본초자오선 각도
    let WDeg = 38.3213 + 13.17635815 * d;
    WDeg = ((WDeg % 360) + 360) % 360;
    const W = WDeg * Math.PI / 180;

    // R_bf = R3(W) · R1(π/2 - δ0) · R3(α0 + π/2)
    // Step 1: R3(α0 + π/2)
    const a = alpha0 + Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x1 = ca * x + sa * y;
    const y1 = -sa * x + ca * y;
    const z1 = z;

    // Step 2: R1(π/2 - δ0)
    const b = Math.PI / 2 - delta0;
    const cb = Math.cos(b), sb = Math.sin(b);
    const x2 = x1;
    const y2 = cb * y1 + sb * z1;
    const z2 = -sb * y1 + cb * z1;

    // Step 3: R3(W)
    const cw = Math.cos(W), sw = Math.sin(W);
    const x3 = cw * x2 + sw * y2;
    const y3 = -sw * x2 + cw * y2;
    const z3 = z2;

    return { x: x3, y: y3, z: z3 };
}

/**
 * JPL Horizons API에서 탐사선의 현재 위치를 가져옵니다.
 * @param designator 탐사선 ID (예: '-85' for LRO)
 */
export const fetchSpacecraftPosition = async (designator: string): Promise<SpacecraftPosition | null> => {
    try {
        const now = new Date();
        const startTime = now.toISOString();
        // 1분 후까지 (단일 포인트)
        const stopTime = new Date(now.getTime() + 60000).toISOString();

        const params = {
            format: 'text',
            COMMAND: `'${designator}'`,
            OBJ_DATA: 'NO',
            MAKE_EPHEM: 'YES',
            EPHEM_TYPE: 'VECTORS',
            CENTER: '500@301', // 달 중심
            START_TIME: `'${startTime}'`,
            STOP_TIME: `'${stopTime}'`,
            STEP_SIZE: `'1 m'`, // 1분 간격
            CSV_FORMAT: 'YES'
        };

        const response = await axiosGetWithRetry(BASE_URL, params);
        const data = response.data;

        if (typeof data !== 'string') return null;

        // $$SOE 와 $$EOE 사이의 데이터 파싱
        const startMarker = '$$SOE';
        const endMarker = '$$EOE';
        const startIndex = data.indexOf(startMarker);
        const endIndex = data.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            console.warn(`[HorizonsApi] No data markers for ${designator}. Data snippet:`, data.substring(0, 200));
            return null;
        }

        const dataContent = data.substring(startIndex + startMarker.length, endIndex).trim();
        const lines = dataContent.split('\n');

        if (lines.length === 0) return null;

        // CSV 포맷: JDT, Calendar Date, X, Y, Z, VX, VY, VZ, ...
        const parts = lines[0].split(',').map(s => s.trim());

        // 인덱스 (VECTORS 모드, CSV_FORMAT='YES' 기준)
        // 보통: 0:JDT, 1:Date, 2:X, 3:Y, 4:Z, ...

        if (parts.length < 5) return null;

        const jd = parseFloat(parts[0]);
        const xIcrf = parseFloat(parts[2]);
        const yIcrf = parseFloat(parts[3]);
        const zIcrf = parseFloat(parts[4]);

        // ICRF → Moon Body-Fixed 변환
        const bf = icrfToMoonBodyFixed(xIcrf, yIcrf, zIcrf, jd);

        // 거리 및 고도 계산 (body-fixed에서도 달 중심 거리 동일)
        const distance = Math.sqrt(bf.x * bf.x + bf.y * bf.y + bf.z * bf.z);
        const altitude = distance - MOON_RADIUS_KM;

        return {
            timestamp: parts[1],
            x: bf.x,
            y: bf.y,
            z: bf.z,
            vx: parseFloat(parts[5]),
            vy: parseFloat(parts[6]),
            vz: parseFloat(parts[7]),
            lightTime: 0,
            distance,
            altitude
        };

    } catch (error) {
        console.error(`[HorizonsApi] Error fetching position for ${designator}:`, error);
        return null;
    }
};

/**
 * 탐사선의 과거+미래 궤적 데이터를 가져옵니다. (현재 기준 ±durationHours)
 * @param designator 탐사선 ID
 * @param durationHours 조회할 시간 범위 (기본값 24시간). 과거 durationHours + 미래 durationHours
 */
export const fetchSpacecraftTrajectory = async (designator: string, durationHours: number = 24, stepMinutes: number = 5, launchDate?: string): Promise<TrajectoryPoint[]> => {
    try {
        const now = new Date();
        // 과거 durationHours ~ 미래 durationHours/2
        let startMs = now.getTime() - durationHours * 60 * 60 * 1000;
        // 발사일이 있으면 그 이후로 클램핑 (발사 전 데이터 요청 방지)
        if (launchDate) {
            const launchMs = new Date(launchDate.replace(/\./g, '-')).getTime();
            if (!isNaN(launchMs) && startMs < launchMs) {
                startMs = launchMs;
            }
        }
        const startTime = new Date(startMs).toISOString();
        const stopTime = new Date(now.getTime() + (durationHours / 2) * 60 * 60 * 1000).toISOString();

        const params = {
            format: 'text',
            COMMAND: `'${designator}'`,
            OBJ_DATA: 'NO',
            MAKE_EPHEM: 'YES',
            EPHEM_TYPE: 'VECTORS',
            CENTER: '500@301', // 달 중심
            START_TIME: `'${startTime}'`,
            STOP_TIME: `'${stopTime}'`,
            STEP_SIZE: `'${stepMinutes} m'`, // 분 단위 간격
            CSV_FORMAT: 'YES'
        };

        const response = await axiosGetWithRetry(BASE_URL, params);
        const data = response.data;

        if (typeof data !== 'string') return [];

        // 'No ephemeris prior to ...' 에러 감지 → 실제 시작 가능 시간으로 재시도
        const noEphMatch = data.match(/No ephemeris.*prior to A\.D\.\s+(\d{4})-([A-Z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/i);
        if (noEphMatch) {
            // 월 약어 → 숫자 변환 (Hermes에서 'APR' 등 직접 파싱 불가)
            const monthMap: Record<string, string> = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' };
            const [, yr, monStr, day, hr, mn, sc] = noEphMatch;
            const mon = monthMap[monStr.toUpperCase()] || '01';
            const isoStr = `${yr}-${mon}-${day}T${hr}:${mn}:${sc}Z`;
            const availStart = new Date(isoStr);
            
            if (!isNaN(availStart.getTime())) {
                // 2분 후부터 재요청 (TDB/UTC 오차 감안)
                const retryStart = new Date(availStart.getTime() + 120000).toISOString();
                console.log(`[HorizonsApi] Retrying trajectory for ${designator} from ${retryStart}`);
                const retryParams = { ...params, START_TIME: `'${retryStart}'` };
                const retryRes = await axiosGetWithRetry(BASE_URL, retryParams);
                const retryData = retryRes.data;
                if (typeof retryData === 'string') {
                    const rsi = retryData.indexOf('$$SOE');
                    const rei = retryData.indexOf('$$EOE');
                    if (rsi !== -1 && rei !== -1) {
                        const rc = retryData.substring(rsi + 5, rei).trim();
                        return rc.split('\n').map(line => {
                            const parts = line.split(',').map(s => s.trim());
                            if (parts.length < 8) return null;
                            const jd = parseFloat(parts[0]);
                            const epochMs = (jd - 2440587.5) * 86400000;
                            const bf = icrfToMoonBodyFixed(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), jd);
                            return { timestamp: parts[1], epochMs, x: bf.x, y: bf.y, z: bf.z, vx: parseFloat(parts[5]), vy: parseFloat(parts[6]), vz: parseFloat(parts[7]) };
                        }).filter((p): p is TrajectoryPoint => p !== null);
                    }
                }
            }
            // 파싱 실패 시: startTime을 3시간 뒤로 밀어서 한번 더 시도
            const fallbackStart = new Date(startMs + 3 * 60 * 60 * 1000).toISOString();
            console.log(`[HorizonsApi] Fallback retry for ${designator} from ${fallbackStart}`);
            const fbParams = { ...params, START_TIME: `'${fallbackStart}'` };
            try {
                const fbRes = await axiosGetWithRetry(BASE_URL, fbParams);
                const fbData = fbRes.data;
                if (typeof fbData === 'string') {
                    const fsi = fbData.indexOf('$$SOE');
                    const fei = fbData.indexOf('$$EOE');
                    if (fsi !== -1 && fei !== -1) {
                        const fc = fbData.substring(fsi + 5, fei).trim();
                        return fc.split('\n').map(line => {
                            const parts = line.split(',').map(s => s.trim());
                            if (parts.length < 8) return null;
                            const jd = parseFloat(parts[0]);
                            const epochMs = (jd - 2440587.5) * 86400000;
                            const bf = icrfToMoonBodyFixed(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), jd);
                            return { timestamp: parts[1], epochMs, x: bf.x, y: bf.y, z: bf.z, vx: parseFloat(parts[5]), vy: parseFloat(parts[6]), vz: parseFloat(parts[7]) };
                        }).filter((p): p is TrajectoryPoint => p !== null);
                    }
                }
            } catch (e) { /* 폴백도 실패 */ }
            return [];
        }

        // 'No ephemeris ... after ...' 에러 감지 → STOP_TIME을 사용 가능 마지막 시간으로 클램핑하여 재시도
        const noEphAfterMatch = data.match(/No ephemeris.*after A\.D\.\s+(\d{4})-([A-Z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/i);
        if (noEphAfterMatch) {
            const monthMap2: Record<string, string> = { JAN:'01', FEB:'02', MAR:'03', APR:'04', MAY:'05', JUN:'06', JUL:'07', AUG:'08', SEP:'09', OCT:'10', NOV:'11', DEC:'12' };
            const [, yr2, monStr2, day2, hr2, mn2, sc2] = noEphAfterMatch;
            const mon2 = monthMap2[monStr2.toUpperCase()] || '01';
            const isoStr2 = `${yr2}-${mon2}-${day2}T${hr2}:${mn2}:${sc2}Z`;
            const availEnd = new Date(isoStr2);

            if (!isNaN(availEnd.getTime())) {
                // 2분 전까지로 STOP_TIME 클램핑
                const clampedStop = new Date(availEnd.getTime() - 120000).toISOString();
                console.log(`[HorizonsApi] "after" limit hit for ${designator}, retrying with stop=${clampedStop}`);
                const retryParams2 = { ...params, STOP_TIME: `'${clampedStop}'` };
                try {
                    const retryRes2 = await axiosGetWithRetry(BASE_URL, retryParams2);
                    const retryData2 = retryRes2.data;
                    if (typeof retryData2 === 'string') {
                        const rsi2 = retryData2.indexOf('$$SOE');
                        const rei2 = retryData2.indexOf('$$EOE');
                        if (rsi2 !== -1 && rei2 !== -1) {
                            const rc2 = retryData2.substring(rsi2 + 5, rei2).trim();
                            return rc2.split('\n').map(line => {
                                const parts = line.split(',').map(s => s.trim());
                                if (parts.length < 8) return null;
                                const jd = parseFloat(parts[0]);
                                const epochMs = (jd - 2440587.5) * 86400000;
                                const bf = icrfToMoonBodyFixed(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), jd);
                                return { timestamp: parts[1], epochMs, x: bf.x, y: bf.y, z: bf.z, vx: parseFloat(parts[5]), vy: parseFloat(parts[6]), vz: parseFloat(parts[7]) };
                            }).filter((p): p is TrajectoryPoint => p !== null);
                        }
                    }
                } catch (e) {
                    console.warn(`[HorizonsApi] "after" retry also failed for ${designator}:`, e);
                }
            }
            return [];
        }

        const startMarker = '$$SOE';
        const endMarker = '$$EOE';
        const startIndex = data.indexOf(startMarker);
        const endIndex = data.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) return [];

        const dataContent = data.substring(startIndex + startMarker.length, endIndex).trim();
        const lines = dataContent.split('\n');

        return lines.map(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length < 8) return null;

            // JD -> epoch ms 변환
            const jd = parseFloat(parts[0]);
            const epochMs = (jd - 2440587.5) * 86400000; // JD to Unix ms

            // ICRF → Moon Body-Fixed 변환
            const bf = icrfToMoonBodyFixed(
                parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), jd
            );

            return {
                timestamp: parts[1],
                epochMs,
                x: bf.x,
                y: bf.y,
                z: bf.z,
                vx: parseFloat(parts[5]),
                vy: parseFloat(parts[6]),
                vz: parseFloat(parts[7]),
            };
        }).filter((p): p is TrajectoryPoint => p !== null);

    } catch (error) {
        console.error(`[HorizonsApi] Error fetching trajectory for ${designator}:`, error);
        return [];
    }
};

// 화면 좌표 변환 헬퍼
export const convertToScreenCoordinates = (
    position: { x: number, y: number, z: number },
    center: { x: number, y: number },
    radiusPixel: number
) => {
    // 달 반지름(km)
    const MOON_RADIUS_KM = 1737.4;

    // Scale: 1px당 km
    // radiusPixel은 화면상 달의 반지름(px)
    const scale = radiusPixel / MOON_RADIUS_KM;

    // JPL 좌표계 (Mean Earth/Polar Axis): 
    // +Z: North Pole
    // +Y: East (90 deg lon)
    // +X: Prime Meridian (Earth direction)

    // 화면 좌표계: 
    // +X: Right
    // +Y: Down

    // 매핑:
    // Y (East) -> Screen X (+)
    // Z (North) -> Screen Y (-)

    const screenX = center.x + position.y * scale;
    const screenY = center.y - position.z * scale;

    // X가 양수면 지구 방향(앞면), 음수면 뒷면(Far side)
    const behindMoon = position.x < 0;

    return {
        x: screenX,
        y: screenY,
        behindMoon
    };
};
