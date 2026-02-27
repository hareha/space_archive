// 달 탐사선 메타데이터
// NASA JPL Horizons COMMAND IDs

export type MissionType = 'orbiter' | 'lander' | 'impactor' | 'flyby';

export interface Spacecraft {
    id: string;          // COMMAND ID (e.g., '-151')
    name: string;        // 탐사선 이름
    nameKo: string;      // 한국어 이름
    country: string;     // 운영 국가
    color: string;       // 시각화 색상
    isLive: boolean;     // 현재 운영 중 여부
    description?: string;
    period?: string;     // 과거 미션의 경우 활동 기간
    apiEnabled?: boolean; // JPL Horizons API 지원 여부
    missionType?: MissionType; // 미션 유형
    // 착륙/충돌 미션의 경우 위치 정보
    landingLocation?: {
        lat: number;
        lon: number;
        name: string;
    };
    // 실시간 데이터 피드 (JPL Horizons)
    x?: number;
    y?: number;
    z?: number;
    altitude?: number;
    trajectory?: any[];
}

// 현재 운영 중인 미션 (Live Layers) - API 기반 실시간 위치
// JPL Horizons API에서 지원하는 탐사선만 apiEnabled: true
export const LIVE_MISSIONS: Spacecraft[] = [
    {
        id: '-85',
        name: 'LRO',
        nameKo: 'LRO',
        country: 'USA (NASA)',
        color: '#FF5722',
        isLive: true,
        description: '2009년 발사, 달 표면 고해상도 매핑 궤도선 (50km 극궤도)',
        apiEnabled: true,
        missionType: 'orbiter'
    },
    {
        id: '-155',
        name: 'KPLO',
        nameKo: '다누리',
        country: 'KOR (KARI)',
        color: '#0D47A1',
        isLive: true,
        description: '2022년 발사, 100km 원형 극궤도',
        apiEnabled: true,
        missionType: 'orbiter'
    },
    {
        id: '-152',
        name: 'Chandrayaan-2 Orbiter',
        nameKo: '찬드라얀-2',
        country: 'IND (ISRO)',
        color: '#FF9800',
        isLive: true,
        description: '2019년 발사, 100km 극궤도, 2026년까지 운영 예정',
        apiEnabled: true,
        missionType: 'orbiter'
    },
    {
        id: '-169',
        name: 'Chandrayaan-3P',
        nameKo: '찬드라얀-3P',
        country: 'IND (ISRO)',
        color: '#FFC107',
        isLive: true,
        description: '2023년 발사, 착륙 후 추진 모듈 궤도 운용 중',
        apiEnabled: false, // 2023년 11월 이후 데이터 끊김
        missionType: 'orbiter'
    },
    {
        id: '-1176',
        name: 'CAPSTONE',
        nameKo: 'CAPSTONE',
        country: 'USA (NASA)',
        color: '#9C27B0',
        isLive: true,
        description: '2022년 발사, NRHO (Near-Rectilinear Halo Orbit)',
        apiEnabled: true,
        missionType: 'orbiter'
    },
    {
        id: '-192',
        name: 'ARTEMIS-P1',
        nameKo: 'ARTEMIS-P1',
        country: 'USA (NASA)',
        color: '#673AB7',
        isLive: true,
        description: '달 주변 L1/L2 라그랑주 점 궤도 탐사선 (THEMIS-B)',
        apiEnabled: true,
        missionType: 'orbiter'
    },
    {
        id: '-193',
        name: 'ARTEMIS-P2',
        nameKo: 'ARTEMIS-P2',
        country: 'USA (NASA)',
        color: '#3F51B5',
        isLive: true,
        description: 'P1과 함께 달-태양풍 상호작용 연구 (THEMIS-C)',
        apiEnabled: true,
        missionType: 'orbiter'
    },

    {
        id: 'queqiao2',
        name: 'Queqiao-2',
        nameKo: '췌차오-2',
        country: 'CHN (CNSA)',
        color: '#E91E63',
        isLive: true,
        description: '2024년 발사, 달 뒷면 통신 중계위성 (헤일로 궤도)',
        apiEnabled: false, // JPL ID 미확인 (중국 미션)
        missionType: 'orbiter'
    }
];

// 과거 종료된 미션 - 착륙/충돌 지점만 표시 (궤도 표시 불가)
export const HISTORICAL_MISSIONS: Spacecraft[] = [
    {
        id: 'luna2',
        name: 'Luna 2',
        nameKo: '루나 2호',
        country: 'USSR',
        color: '#B71C1C',
        isLive: false,
        period: '1959-09-13 ~ 14',
        description: '인류 최초 달 표면 도달 (충돌)',
        missionType: 'impactor',
        landingLocation: {
            lat: 29.1,
            lon: 0.0,
            name: '팔루스 푸트레디니스 부근'
        }
    },
    {
        id: 'luna9',
        name: 'Luna 9',
        nameKo: '루나 9호',
        country: 'USSR',
        color: '#C62828',
        isLive: false,
        period: '1966-02-03 ~ 06',
        description: '인류 최초 달 연착륙',
        missionType: 'lander',
        landingLocation: {
            lat: 7.13,
            lon: -64.37,
            name: '폭풍의 대양'
        }
    },
    {
        id: 'apollo11',
        name: 'Apollo 11',
        nameKo: '아폴로 11호',
        country: 'USA (NASA)',
        color: '#FFC107',
        isLive: false,
        period: '1969-07-16 ~ 24',
        description: '인류 최초 유인 달 착륙',
        missionType: 'lander',
        landingLocation: {
            lat: 0.67,
            lon: 23.47,
            name: '고요의 바다'
        }
    },
    {
        id: 'apollo15',
        name: 'Apollo 15',
        nameKo: '아폴로 15호',
        country: 'USA (NASA)',
        color: '#FF8F00',
        isLive: false,
        period: '1971-07-26 ~ 08-07',
        description: '최초 월면차 사용',
        missionType: 'lander',
        landingLocation: {
            lat: 26.13,
            lon: 3.63,
            name: '하들리-아페닌 지역'
        }
    },
    {
        id: 'chang-e3',
        name: "Chang'e 3",
        nameKo: '창어 3호',
        country: 'CHN (CNSA)',
        color: '#4CAF50',
        isLive: false,
        period: '2013-12-14 ~',
        description: '중국 최초 달 착륙선 + 옥토끼 로버',
        missionType: 'lander',
        landingLocation: {
            lat: 44.12,
            lon: -19.51,
            name: '비의 바다'
        }
    },
    {
        id: 'chang-e4',
        name: "Chang'e 4",
        nameKo: '창어 4호',
        country: 'CHN (CNSA)',
        color: '#2E7D32',
        isLive: false,
        period: '2019-01-03 ~',
        description: '인류 최초 달 뒷면 착륙',
        missionType: 'lander',
        landingLocation: {
            lat: -45.46,
            lon: 177.60,
            name: '폰 카르만 크레이터'
        }
    }
];

// 모든 미션
export const ALL_MISSIONS = [...LIVE_MISSIONS, ...HISTORICAL_MISSIONS];

// 달 반지름 (km)
export const MOON_RADIUS_KM = 1737.4;
