export interface NewsItem {
    id: string;
    category: string;
    title: string;
    summary: string;
    date: string;
    source: string;
    publishDate: string;
    imageUrl: string;
    body: string[];
    location?: {
        name: string;
        lat: number;
        lng: number;
    };
}

export const NEWS_DATA: NewsItem[] = [
    {
        id: '1',
        category: '탐사',
        title: '고요의 바다 남쪽 구역에서 희토류 매장 가능성 확인',
        summary: '최근 루나 게이트웨이(Lunar Gateway)의 고해상도 분광계 분석 결과, 달의 고요의 바다 남부에서 이례적인 밀도의 희토류 원소 신호가 포착되었습니다.',
        date: '2시간 전',
        source: 'Lunar Times',
        publishDate: '2024. 05. 24',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop',
        body: [
            '최근 루나 게이트웨이(Lunar Gateway)의 고해상도 분광계 분석 결과, 달의 북위 14.5도, 동경 20.3도 부근의 지표면 아래에서 이례적인 밀도의 희토류 원소 신호가 포착되었습니다. 이는 향후 달 기지 건설 및 자원 확보 경쟁에서 매우 중요한 전환점이 될 것으로 보입니다.',
            '이번에 발견된 매장지는 과거 아폴로 11호의 착륙 지점에서 그리 멀지 않은 곳으로, 초기 탐사 결과에 따르면 지표면 2미터 이내의 비교적 얕은 곳에 위치한 것으로 추정됩니다. 루나 탐사 연합(LEA)은 해당 구역을 \'골든 호라이즌\'으로 명명하고 상세 탐사 계획을 수립 중입니다.',
            '전문가들은 이번 발견이 단순한 자원 확보를 넘어, 달 영유권 주장 및 토지 소유권 가치에 지대한 영향을 미칠 것으로 내다보고 있습니다. 현재 해당 좌표 주변의 점유권 거래량은 평소 대비 400% 이상 급증한 상태입니다.',
        ],
        location: {
            name: '고요의 바다 남부 (골든 호라이즌)',
            lat: 14.5,
            lng: 20.3,
        },
    },
    {
        id: '2',
        category: '기술',
        title: '제3세대 월면 거주 모듈 테스트 성공적 마무리',
        summary: '월면토(Regolith)를 활용한 자율 주행 3D 프린팅 로봇의 지상 시연이 성공적으로 마무리되었습니다.',
        date: '5시간 전',
        source: 'Space Tech Weekly',
        publishDate: '2024. 05. 23',
        imageUrl: 'https://images.unsplash.com/photo-1541873676-a18131494184?q=80&w=1080&auto=format&fit=crop',
        body: [
            '현대건설과 한국항공우주연구원이 공동 개발한 제3세대 월면 거주 모듈이 6개월간의 혹한/진공 시뮬레이션 테스트를 성공적으로 통과했습니다.',
            '이번 모듈은 월면토(Regolith)를 원료로 사용하는 3D 프린팅 로봇이 자율적으로 건축하는 방식으로, 기존 대비 건설 시간을 70% 단축하고 내구성을 3배 향상시켰습니다.',
            '특히 방사선 차폐 성능이 크게 개선되어, 실제 달 환경에서 최대 4명의 우주인이 6개월 이상 거주할 수 있을 것으로 기대됩니다. 2027년 첫 실제 달 표면 건설이 계획되어 있습니다.',
        ],
    },
    {
        id: '3',
        category: '자원',
        title: '민간 기업의 달 광물 채굴권 입찰 가이드라인 발표',
        summary: '폭풍의 대양 북부 섹터의 헬륨-3 채굴권이 어제 마감된 우주 자원 경매에서 사상 최고가를 기록하며 낙찰되었습니다.',
        date: '어제',
        source: 'Moon Economy',
        publishDate: '2024. 05. 22',
        imageUrl: 'https://images.unsplash.com/photo-1614728853913-1e2203d9d70e?q=80&w=1080&auto=format&fit=crop',
        body: [
            '국제 우주 자원 관리국(ISRMA)이 민간 기업의 달 광물 채굴권 입찰에 대한 공식 가이드라인을 발표했습니다. 이번 가이드라인은 폭풍의 대양(Oceanus Procellarum) 북부 섹터를 중심으로 적용됩니다.',
            '채굴권은 10km² 단위로 분할되며, 최소 입찰가는 구역당 500만 달러로 책정되었습니다. 헬륨-3 매장량이 확인된 구역은 프리미엄이 붙어 최대 5,000만 달러까지 치솟을 것으로 예상됩니다.',
            '업계에서는 이번 가이드라인이 달 자원 경제의 본격적인 시작을 알리는 신호탄으로 평가하고 있습니다.',
        ],
        location: {
            name: '폭풍의 대양 북부',
            lat: 18.2,
            lng: -54.3,
        },
    },
    {
        id: '4',
        category: '탐사',
        title: '달 뒷면 심우주 관측소 건설 계획',
        summary: '국제 공동 연구팀이 달 뒷면에 심우주 관측소를 건설하는 계획을 발표했습니다.',
        date: '어제',
        source: 'Deep Space Journal',
        publishDate: '2024. 05. 21',
        imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1080&auto=format&fit=crop',
        body: [
            '유럽우주국(ESA)과 중국국가항천국(CNSA)이 달 뒷면 남위 45도, 서경 170도 지점에 심우주 전파 관측소를 건설하는 공동 프로젝트를 발표했습니다.',
            '달 뒷면은 지구의 전파 간섭이 없어 심우주 관측에 최적의 환경을 제공합니다. 이 관측소는 빅뱅 직후의 우주 신호를 탐지하는 것을 목표로 합니다.',
            '건설은 2028년 시작될 예정이며, 완공 후에는 인류 역사상 가장 민감한 전파 망원경이 될 것입니다.',
        ],
        location: {
            name: '달 뒷면 남부',
            lat: -45.0,
            lng: -170.0,
        },
    },
    {
        id: '5',
        category: '분석',
        title: '2026년 달 경제 시장 전망 보고서',
        summary: '달 기반 경제 생태계의 성장세를 분석하고 향후 5년간의 시장 규모와 투자 전망을 다룹니다.',
        date: '2일 전',
        source: 'Cosmos Analytics',
        publishDate: '2024. 05. 20',
        imageUrl: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=1080&auto=format&fit=crop',
        body: [
            '글로벌 투자은행 모건스탠리의 최신 보고서에 따르면, 달 경제 시장 규모는 2030년까지 연간 1조 달러를 돌파할 것으로 전망됩니다.',
            '주요 성장 동력은 헬륨-3 에너지, 희토류 채굴, 우주 관광, 그리고 달 토지 점유권 거래입니다. 특히 토지 점유권 시장은 연평균 280% 성장률을 기록하고 있습니다.',
            '보고서는 달 경제가 초기 투기적 단계에서 실물 경제 기반의 산업 단계로 전환되고 있다고 분석했습니다. 다만 국제법적 불확실성이 여전히 리스크 요인으로 남아있다고 경고했습니다.',
        ],
    },
    {
        id: '6',
        category: '자원',
        title: '헬륨-3 추출 효율 30% 향상 기술 특허 출원',
        summary: '한국원자력연구원이 월면토에서 헬륨-3를 기존 대비 30% 효율적으로 추출하는 신기술을 개발, 국제 특허를 출원했습니다.',
        date: '3일 전',
        source: 'Korea Science Daily',
        publishDate: '2024. 05. 19',
        imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1080&auto=format&fit=crop',
        body: [
            '한국원자력연구원이 마이크로웨이브 가열 방식을 활용한 새로운 헬륨-3 추출 기술을 개발, 국제 특허를 출원했습니다. 기존 기술 대비 추출 효율이 30% 향상되었습니다.',
            '이 기술은 월면토를 800도까지 가열하는 기존 방식 대신, 마이크로웨이브로 선택적으로 가열하여 에너지 소모를 절반으로 줄이면서도 수율을 높이는 방식입니다.',
            '상용화 시 달 현지에서의 핵융합 연료 생산 비용을 획기적으로 낮출 수 있어, 달 에너지 자립의 핵심 기술로 주목받고 있습니다.',
        ],
    },
];

export const MY_LANDS = [
    {
        id: 'L-2024-001',
        location: 'Mare Tranquillitatis (고요의 바다)',
        coordinates: 'Lat 0.67N, Lon 23.47E',
        area: '100',
        purchaseDate: '2025.12.15',
        imageUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1080&auto=format&fit=crop',
    },
    {
        id: 'L-2025-042',
        location: 'Oceanus Procellarum (폭풍의 대양)',
        coordinates: 'Lat 18.2N, Lon 54.3W',
        area: '50',
        purchaseDate: '2026.01.10',
        imageUrl: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=1080&auto=format&fit=crop',
    },
];

export const SCRAPPED_NEWS: NewsItem[] = [
    {
        id: 'S-1',
        category: '탐사',
        title: '달 남극의 영구음영지역, 생명체 흔적 찾기',
        summary: '달 남극의 영구음영지역(PSR)은 수십 억 년 동안 햇빛이 닿지 않아 태양계 초기 역사를 간직하고 있습니다.',
        date: '2025.12.20',
        source: 'Lunar Times',
        publishDate: '2025. 12. 20',
        imageUrl: 'https://images.unsplash.com/photo-1614728853913-1e2203d9d70e?q=80&w=300&auto=format&fit=crop',
        body: ['달 남극의 영구음영지역(PSR)은 수십 억 년 동안 햇빛이 닿지 않아 태양계 초기 역사를 간직하고 있습니다. 이곳에서 생명체의 흔적을 찾기 위한 탐사가 시작됩니다.'],
        location: { name: '달 남극', lat: -89.5, lng: 0 },
    },
    {
        id: 'S-2',
        category: '분석',
        title: '우주 부동산: 달 토지 소유권의 법적 쟁점',
        summary: '민간 우주 기업들의 달 진출이 가속화되면서 달 토지 소유권에 대한 국제법적 논쟁이 뜨거워지고 있습니다.',
        date: '2025.11.15',
        source: 'Space Law Review',
        publishDate: '2025. 11. 15',
        imageUrl: 'https://images.unsplash.com/photo-1541873676-a18131494184?q=80&w=300&auto=format&fit=crop',
        body: ['민간 우주 기업들의 달 진출이 가속화되면서 달 토지 소유권에 대한 국제법적 논쟁이 뜨거워지고 있습니다.'],
    },
    {
        id: 'S-3',
        category: '기술',
        title: '테라포밍의 첫걸음: 월면 기지 건설 기술',
        summary: '달 표면의 가혹한 환경을 극복하고 인간이 거주할 수 있는 기지를 건설하기 위한 첨단 기술들이 개발되고 있습니다.',
        date: '2025.10.05',
        source: 'Space Tech Weekly',
        publishDate: '2025. 10. 05',
        imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=300&auto=format&fit=crop',
        body: ['달 표면의 가혹한 환경을 극복하고 인간이 거주할 수 있는 기지를 건설하기 위한 첨단 기술들이 개발되고 있습니다.'],
    },
];
