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
    x: number;
    y: number;
    z: number;
}

const MOON_RADIUS_KM = 1737.4; // 달 평균 반지름

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

        const x = parseFloat(parts[2]);
        const y = parseFloat(parts[3]);
        const z = parseFloat(parts[4]);

        // 거리 및 고도 계산
        const distance = Math.sqrt(x * x + y * y + z * z);
        const altitude = distance - MOON_RADIUS_KM;

        return {
            timestamp: parts[1],
            x,
            y,
            z,
            vx: parseFloat(parts[5]),
            vy: parseFloat(parts[6]),
            vz: parseFloat(parts[7]),
            lightTime: 0, // 계산 생략
            distance,
            altitude
        };

    } catch (error) {
        console.error(`[HorizonsApi] Error fetching position for ${designator}:`, error);
        return null;
    }
};

/**
 * 탐사선의 미래/과거 궤적 데이터를 가져옵니다. (현재 기준 ±durationHours, 1시간 간격)
 * @param designator 탐사선 ID
 * @param durationHours 조회할 시간 범위 (기본값 24시간). 저궤도 위성은 짧게, 고궤도 위성은 길게 설정 권장.
 */
export const fetchSpacecraftTrajectory = async (designator: string, durationHours: number = 24): Promise<TrajectoryPoint[]> => {
    try {
        const now = new Date();
        // durationHours 전부터
        const startTime = new Date(now.getTime() - durationHours * 60 * 60 * 1000).toISOString();
        // durationHours 후까지
        const stopTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();

        const params = {
            format: 'text',
            COMMAND: `'${designator}'`,
            OBJ_DATA: 'NO',
            MAKE_EPHEM: 'YES',
            EPHEM_TYPE: 'VECTORS',
            CENTER: '500@301', // 달 중심
            START_TIME: `'${startTime}'`,
            STOP_TIME: `'${stopTime}'`,
            STEP_SIZE: `'15 m'`, // 15분 간격 (더 부드러운 궤도)
            CSV_FORMAT: 'YES'
        };

        const response = await axiosGetWithRetry(BASE_URL, params);
        const data = response.data;

        if (typeof data !== 'string') return [];

        const startMarker = '$$SOE';
        const endMarker = '$$EOE';
        const startIndex = data.indexOf(startMarker);
        const endIndex = data.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) return [];

        const dataContent = data.substring(startIndex + startMarker.length, endIndex).trim();
        const lines = dataContent.split('\n');

        return lines.map(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length < 5) return null;
            return {
                timestamp: parts[1],
                x: parseFloat(parts[2]),
                y: parseFloat(parts[3]),
                z: parseFloat(parts[4])
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
