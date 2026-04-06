// 달 탐사선 메타데이터
// NASA JPL Horizons COMMAND IDs

export type MissionType = 'orbiter' | 'lander' | 'impactor' | 'flyby';

export interface Spacecraft {
    id: string;          // COMMAND ID (e.g., '-151')
    name: string;        // 탐사선 이름 (약어)
    nameKo: string;      // 한국어 이름
    fullName?: string;   // 영문 정식명칭
    country: string;     // 운영 국가
    color: string;       // 시각화 색상
    isLive: boolean;     // 현재 운영 중 여부
    description?: string;
    period?: string;     // 과거 미션의 경우 활동 기간
    apiEnabled?: boolean; // JPL Horizons API 지원 여부
    missionType?: MissionType; // 미션 유형
    orbitHours?: number; // 궤도 1주기 시간 (시간 단위)
    // 상세 정보
    launchDate?: string;       // 발사 시점
    agency?: string;           // 운영 기관
    agencyCode?: string;       // 기관 코드
    missionStatus?: string;    // Active / Completed
    missionObjective?: string; // 임무 목적
    instruments?: string[];    // 탑재 장비 목록
    instrumentDetails?: { [key: string]: string }; // 장비명 → 설명
    orbitInclination?: number; // 궤도 경사각 (도)
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
        fullName: 'Lunar Reconnaissance Orbiter',
        country: 'USA (NASA)',
        color: '#FF5722',
        isLive: true,
        description: '2009년 발사, 달 표면 고해상도 매핑 궤도선 (50km 극궤도)',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 2,
        launchDate: '2009.06.18',
        agency: 'NASA 고다드 우주비행센터',
        agencyCode: 'NASA',
        missionStatus: 'Active',
        missionObjective: '달 표면 고해상도 3D 매핑, 방사선 환경 측정, 극지방 영구 음영 지역 탐사, 착륙 후보지 탐색',
        instruments: ['LROC (카메라)', 'LAMP (자외선 분광기)', 'LEND (중성자 탐지기)', 'CRaTER (우주선 탐지)', 'DLRE (열복사계)', 'Mini-RF (레이더)'],
        instrumentDetails: {
            'LROC (카메라)': '달 표면 고해상도 영상 촬영, 착륙 후보지 선정용 지형 분석',
            'LAMP (자외선 분광기)': '영구 음영 지역의 자외선 반사 관측, 물 얼음 탐지',
            'LEND (중성자 탐지기)': '달 표면 수소 분포 매핑, 물 존재 가능성 분석',
            'CRaTER (우주선 탐지)': '달 궤도 우주방사선 환경 측정, 유인 탐사 방사선 위험 평가',
            'DLRE (열복사계)': '달 표면 열 환경 측정, 온도 분포 매핑',
            'Mini-RF (레이더)': '극지방 레이더 영상, 영구 음영 지역 얼음 탐지',
        },
        orbitInclination: 90.0,
    },
    {
        id: '-155',
        name: 'KPLO',
        nameKo: '다누리호',
        fullName: 'Korea Pathfinder Lunar Orbiter',
        country: 'KOR (KARI)',
        color: '#0D47A1',
        isLive: true,
        description: '2022년 발사, 100km 원형 극궤도',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 2,
        launchDate: '2022.08.05',
        agency: '한국항공우주연구원 (KARI)',
        agencyCode: 'KARI',
        missionStatus: 'Active',
        missionObjective: '달 표면 광물·자원 분포 탐사, 자기장 측정, 달 착륙 후보지 조사 및 우주 인터넷 기술 검증',
        instruments: ['고해상도 카메라 (LUTI)', '광시야 편광 카메라 (PolCam)', '자기장 측정기 (KMAG)', '감마선 분광기 (KGRS)', '새도우캠 (ShadowCam · NASA)'],
        instrumentDetails: {
            '고해상도 카메라 (LUTI)': '달 표면 지형 지도 제작, 착륙 후보지 탐색 및 자원 분포 조사',
            '광시야 편광 카메라 (PolCam)': '달 표면 물질의 종류와 입자 크기 분석을 위한 편광 이미지 촬영',
            '자기장 측정기 (KMAG)': '달 지각 및 유도 자기장 측정, 달 내부 구조 연구',
            '감마선 분광기 (KGRS)': '달 표면에서 방출되는 감마선 스펙트럼을 측정해 물, 우라늄, 헬륨-3, 알루미늄 등 자원 구성 파악',
            '새도우캠 (ShadowCam · NASA)': '달의 양극에 있는 영구음영지역(PSR)을 촬영하기 위해 NASA가 제공한 초고감도 광학 카메라',
        },
        orbitInclination: 90.0,
    },
    {
        id: '-152',
        name: 'Chandrayaan-2 Orbiter',
        nameKo: 'Chandrayaan-2 Orbiter',
        fullName: 'Chandrayaan-2 Lunar Orbiter',
        country: 'IND (ISRO)',
        color: '#FF9800',
        isLive: true,
        description: '2019년 발사, 100km 극궤도, 2026년까지 운영 예정',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 2,
        launchDate: '2019.07.22',
        agency: '인도우주연구기구 (ISRO)',
        agencyCode: 'ISRO',
        missionStatus: 'Active',
        missionObjective: '달 표면 광물학적 매핑, 물 분자 탐지, 달 외기권 연구, 표면 지형 분석',
        instruments: ['TMC-2 (지형 매핑 카메라)', 'CLASS (X선 분광기)', 'CHACE-2 (질량 분석기)', 'DFSAR (레이더)', 'OHRC (고해상도 카메라)', 'IIRS (적외선 분광기)'],
        instrumentDetails: {
            'TMC-2 (지형 매핑 카메라)': '달 표면 3D 지형도 제작, 고해상도 지형 매핑',
            'CLASS (X선 분광기)': '달 표면 원소 조성 분석, 광물 분포 매핑',
            'CHACE-2 (질량 분석기)': '달 외기권 구성 분석, 희박 대기 중 가스 성분 측정',
            'DFSAR (레이더)': 'L/S 대역 합성개구레이더, 극지방 얼음 분포 탐지',
            'OHRC (고해상도 카메라)': '착륙 후보지 0.25m 해상도 정밀 촬영',
            'IIRS (적외선 분광기)': '달 표면 광물 및 물 분자 분포 적외선 분석',
        },
        orbitInclination: 90.0,
    },
    {
        id: '-1176',
        name: 'CAPSTONE',
        nameKo: 'CAPSTONE',
        fullName: 'Cislunar Autonomous Positioning System Technology Operations and Navigation Experiment',
        country: 'USA (NASA)',
        color: '#9C27B0',
        isLive: true,
        description: '2022년 발사, NRHO (Near-Rectilinear Halo Orbit)',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 156,
        launchDate: '2022.06.28',
        agency: 'NASA / Advanced Space',
        agencyCode: 'NASA',
        missionStatus: 'Active',
        missionObjective: 'Gateway 우주정거장용 NRHO 궤도 검증, 궤도 유지 및 항법 기술 실증',
        instruments: ['CAPS (궤도 결정 시스템)', 'EPS (전력 시스템 모니터)'],
        instrumentDetails: {
            'CAPS (궤도 결정 시스템)': 'NRHO 궤도 정밀 결정 및 유지 기술 검증',
            'EPS (전력 시스템 모니터)': '큐브위성 전력 시스템 성능 모니터링',
        },
    },
    {
        id: '-192',
        name: 'ARTEMIS-P1',
        nameKo: 'ARTEMIS-P1',
        fullName: 'Acceleration, Reconnection, Turbulence and Electrodynamics of the Moon\'s Interaction with the Sun',
        country: 'USA (NASA)',
        color: '#673AB7',
        isLive: true,
        description: '달 주변 L1/L2 라그랑주 점 궤도 탐사선 (THEMIS-B)',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 26,
        launchDate: '2007.02.17',
        agency: 'NASA / UC 버클리',
        agencyCode: 'NASA',
        missionStatus: 'Active',
        missionObjective: '달-태양풍 상호작용 연구, 자기권 꼬리 입자 가속 관측, 달 주변 플라즈마 환경 분석',
        instruments: ['FGM (플럭스게이트 자력계)', 'ESA (정전 분석기)', 'SST (고에너지 입자 검출기)'],
        instrumentDetails: {
            'FGM (플럭스게이트 자력계)': '달 주변 자기장 3축 정밀 측정',
            'ESA (정전 분석기)': '달-태양풍 상호작용 플라즈마 입자 에너지/방향 분석',
            'SST (고에너지 입자 검출기)': '고에너지 전자 및 이온 검출, 입자 가속 현상 연구',
        },
    },
    {
        id: '-193',
        name: 'ARTEMIS-P2',
        nameKo: 'ARTEMIS-P2',
        fullName: 'Acceleration, Reconnection, Turbulence and Electrodynamics of the Moon\'s Interaction with the Sun',
        country: 'USA (NASA)',
        color: '#3F51B5',
        isLive: true,
        description: 'P1과 함께 달-태양풍 상호작용 연구 (THEMIS-C)',
        apiEnabled: true,
        missionType: 'orbiter',
        orbitHours: 26,
        launchDate: '2007.02.17',
        agency: 'NASA / UC 버클리',
        agencyCode: 'NASA',
        missionStatus: 'Active',
        missionObjective: '달-태양풍 상호작용 2점 관측, 달 후미(wake) 영역 특성 분석',
        instruments: ['FGM (플럭스게이트 자력계)', 'ESA (정전 분석기)', 'SST (고에너지 입자 검출기)'],
        instrumentDetails: {
            'FGM (플럭스게이트 자력계)': '달 주변 자기장 3축 정밀 측정',
            'ESA (정전 분석기)': '달-태양풍 상호작용 플라즈마 입자 에너지/방향 분석',
            'SST (고에너지 입자 검출기)': '고에너지 전자 및 이온 검출, 입자 가속 현상 연구',
        },
    },
    {
        id: '-1024',
        name: 'Artemis II',
        nameKo: 'Artemis II',
        fullName: 'Artemis II / Orion "Integrity"',
        country: 'USA (NASA)',
        color: '#00BCD4',
        isLive: true,
        description: '2026년 발사, 유인 달 궤도 비행 (10일 미션)',
        apiEnabled: true,
        missionType: 'flyby',
        orbitHours: 240,
        launchDate: '2026.04.02T03:00:00Z',
        agency: 'NASA',
        agencyCode: 'NASA',
        missionStatus: 'Active',
        missionObjective: '유인 달 궤도 비행, Orion 우주선 생명유지·추진 시스템 검증, 심우주 유인 탐사 기술 실증',
        instruments: ['ECLSS (생명유지 시스템)', 'Orion 추진 모듈', '태양전지 어레이', '통신 시스템'],
        instrumentDetails: {
            'ECLSS (생명유지 시스템)': '4인 승무원 생명유지, 이산화탄소 제거 및 산소 공급',
            'Orion 추진 모듈': 'ESA 제작, 궤도 수정 및 귀환 추진',
            '태양전지 어레이': '심우주 환경 전력 공급 (11kW)',
            '통신 시스템': '심우주 네트워크(DSN) 기반 지구-달 고속 통신',
        },
    },
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
