// lunar_features_updated.csv 기반 대표 지형 데이터

export interface LunarFeature {
  id: string;
  nameEn: string;
  nameKr: string;
  typeEn: string;
  typeKr: string;
  lat: number;
  lng: number;
  diameterKm: number;
  depthKm: number | null;
  areaKm2: number | null;
  angle: number;
  widthKm: number;
  description: string;
}

export const LUNAR_FEATURES: LunarFeature[] = [
  { id: 'FC-01', nameEn: 'Tycho', nameKr: '티코', typeEn: 'Crater', typeKr: '충돌구', lat: -43.3, lng: -11.2, diameterKm: 85, depthKm: 4.8, areaKm2: 5670, angle: 0, widthKm: 85, description: '보름달 때 수천 km로 뻗어 나가는 하얀 광조(Ray)가 뿜어져 나오는 달 남반구 최고의 랜드마크입니다.' },
  { id: 'FC-02', nameEn: 'Copernicus', nameKr: '코페르니쿠스', typeEn: 'Crater', typeKr: '충돌구', lat: 9.6, lng: -20.1, diameterKm: 93, depthKm: 3.8, areaKm2: 6792, angle: 0, widthKm: 93, description: '폭풍의 대양 동쪽에 위치하며, 뚜렷한 계단식 성벽과 중앙봉을 가진 가장 아름다운 적도 부근의 충돌구입니다.' },
  { id: 'FC-03', nameEn: 'Plato', nameKr: '플라톤', typeEn: 'Crater', typeKr: '충돌구', lat: 51.6, lng: -9.4, diameterKm: 101, depthKm: 1.0, areaKm2: 8012, angle: 0, widthKm: 101, description: "추위의 바다 남쪽(북반구)에 위치. 바닥이 짙은 현무암으로 아주 평평하게 채워져 '검은 호수'처럼 보입니다." },
  { id: 'FC-04', nameEn: 'Aristarchus', nameKr: '아리스타르코스', typeEn: 'Crater', typeKr: '충돌구', lat: 23.7, lng: -47.4, diameterKm: 40, depthKm: 3.0, areaKm2: 1257, angle: 0, widthKm: 40, description: '달 표면에서 반사율이 가장 높아 유독 하얗게 빛나며, 화산 가스 방출이 빈번히 관측되는 서북부 핫스팟입니다.' },
  { id: 'FS-01', nameEn: 'Sinus Iridum', nameKr: '무지개 만', typeEn: 'Sinus', typeKr: '만', lat: 44.1, lng: -31.5, diameterKm: 236, depthKm: null, areaKm2: 43736, angle: 0, widthKm: 236, description: '비의 바다 북서쪽에 자리 잡은 거대한 반원형 평원으로, 해안선 같은 유려한 곡선미가 압권입니다.' },
  { id: 'FM-01', nameEn: 'Mare Tranquillitatis', nameKr: '고요의 바다', typeEn: 'Mare', typeKr: '바다', lat: 8.5, lng: 31.4, diameterKm: 873, depthKm: null, areaKm2: 598000, angle: 0, widthKm: 873, description: '아폴로 11호가 최초로 착륙한 역사적인 장소이며, 동반구 적도 부근에서 육안으로 잘 보이는 짙은 평원입니다.' },
  { id: 'FC-05', nameEn: 'Clavius', nameKr: '클라비우스', typeEn: 'Crater', typeKr: '충돌구', lat: -58.4, lng: -14.4, diameterKm: 231, depthKm: 3.5, areaKm2: 41900, angle: 0, widthKm: 231, description: '남반구의 거대 구덩이로, 내부에 크기가 순차적으로 줄어드는 분화구들이 반원형으로 배열되어 있습니다.' },
  { id: 'FM-02', nameEn: 'Montes Apenninus', nameKr: '아펜닌 산맥', typeEn: 'Montes', typeKr: '산맥', lat: 18.9, lng: -3.7, diameterKm: 600, depthKm: null, areaKm2: null, angle: 50, widthKm: 100, description: '5,000m 이상의 고봉들이 부채꼴로 늘어선 장엄한 산맥으로 비의 바다 남동쪽 경계를 형성합니다.' },
  { id: 'FR-01', nameEn: 'Rupes Recta', nameKr: '직선의 벽', typeEn: 'Rupes', typeKr: '단층', lat: -21.67, lng: -7.70, diameterKm: 134, depthKm: 0.3, areaKm2: null, angle: 163, widthKm: 2, description: '구름의 바다에 위치한 거대 단층으로, 마치 인공적으로 칼로 그은 듯한 완벽한 직선 절벽입니다.' },
  { id: 'FC-06', nameEn: 'Gassendi', nameKr: '가상디', typeEn: 'Crater', typeKr: '충돌구', lat: -17.5, lng: -39.9, diameterKm: 110, depthKm: 2.7, areaKm2: 9503, angle: 0, widthKm: 110, description: '습기의 바다 북쪽에 위치하며 바닥 전체에 미세한 거미줄 모양 균열이 가득해 매우 아름답습니다.' },
  { id: 'FC-07', nameEn: 'Messier', nameKr: '메시에', typeEn: 'Crater', typeKr: '충돌구', lat: -1.9, lng: 47.6, diameterKm: 11, depthKm: 0.8, areaKm2: 95, angle: 0, widthKm: 11, description: '풍요의 바다에 있는 쌍둥이 분화구로, 한쪽 방향으로만 길게 뻗은 두 줄기 광조가 혜성을 닮았습니다.' },
  { id: 'FS-02', nameEn: 'Reiner Gamma', nameKr: '라이너 감마', typeEn: 'Swirl', typeKr: '소용돌이', lat: 7.5, lng: -59.0, diameterKm: 70, depthKm: null, areaKm2: 3848, angle: 0, widthKm: 70, description: '서쪽 극단 평지에 그려진 신비한 하얀 소용돌이 무늬로 강력한 국소 자기장이 우주 방사선을 막아줍니다.' },
  { id: 'FV-01', nameEn: 'Vallis Alpes', nameKr: '알프스 계곡', typeEn: 'Vallis', typeKr: '계곡', lat: 49.21, lng: 3.63, diameterKm: 166, depthKm: 0.7, areaKm2: null, angle: 63, widthKm: 10, description: '알프스 산맥을 일직선으로 관통하는 거대한 협곡으로 과거 용암이 강처럼 흐르며 깎아 만든 지형입니다.' },
  { id: 'FC-08', nameEn: 'Grimaldi', nameKr: '그리말디', typeEn: 'Crater', typeKr: '충돌구', lat: -5.2, lng: -68.6, diameterKm: 173, depthKm: 2.6, areaKm2: 23500, angle: 0, widthKm: 173, description: '달 서쪽 끝에 위치. 반사율이 매우 낮은 검은 현무암 바닥을 가지고 있어 거대한 눈동자처럼 보입니다.' },
  { id: 'FC-09', nameEn: 'Theophilus', nameKr: '테오필루스', typeEn: 'Crater', typeKr: '충돌구', lat: -11.4, lng: 26.4, diameterKm: 100, depthKm: 4.4, areaKm2: 7854, angle: 0, widthKm: 100, description: '감로주의 바다 북서쪽. 인접한 두 분화구와 함께 꽃잎 모양을 형성하며, 중앙봉이 매우 높고 선명합니다.' },
  { id: 'FV-02', nameEn: 'Vallis Schröteri', nameKr: '슈뢰터 계곡', typeEn: 'Vallis', typeKr: '계곡', lat: 26.2, lng: -50.8, diameterKm: 168, depthKm: 1.0, areaKm2: null, angle: 310, widthKm: 10, description: '아리스타르코스 고원에 위치한 달 최대의 구불구불한 용암 협곡으로 뱀이 지나간 선명한 자국 같습니다.' },
  { id: 'FM-03', nameEn: 'Mare Crisium', nameKr: '위기의 바다', typeEn: 'Mare', typeKr: '바다', lat: 17.0, lng: 59.1, diameterKm: 556, depthKm: null, areaKm2: 242744, angle: 0, widthKm: 556, description: '동쪽 끝에 완벽한 타원형으로 홀로 떨어져 있어 다른 바다들과 섞이지 않는 독립된 어두운 평원입니다.' },
  { id: 'FC-10', nameEn: 'Petavius', nameKr: '페타비우스', typeEn: 'Crater', typeKr: '충돌구', lat: -25.3, lng: 60.4, diameterKm: 182, depthKm: 3.3, areaKm2: 26012, angle: 0, widthKm: 182, description: '남동쪽 가장자리에 위치하며, 중앙봉에서 성벽까지 직선으로 뻗은 거대한 바닥 균열이 인상적입니다.' },
  { id: 'FC-11', nameEn: 'Kepler', nameKr: '케플러', typeEn: 'Crater', typeKr: '충돌구', lat: 8.1, lng: -38.0, diameterKm: 31, depthKm: 2.6, areaKm2: 754, angle: 0, widthKm: 31, description: '폭풍의 대양에 위치. 크기는 작지만 티코, 코페르니쿠스와 함께 화려한 광조 시스템을 뿜어냅니다.' },
  { id: 'FS-03', nameEn: 'Sinus Medii', nameKr: '중앙 만', typeEn: 'Sinus', typeKr: '만', lat: 2.4, lng: 1.7, diameterKm: 335, depthKm: null, areaKm2: 88125, angle: 0, widthKm: 335, description: '달 앞면의 정확한 십자선(적도와 본초 자오선 교차점)에 위치하여 지구 통신 중계기지 건설의 최적지입니다.' },
  { id: 'FR-02', nameEn: 'Rima Ariadaeus', nameKr: '아리아데우스 열구', typeEn: 'Rima', typeKr: '열구', lat: 6.4, lng: 14.0, diameterKm: 250, depthKm: 0.5, areaKm2: null, angle: 97, widthKm: 5, description: '고요의 바다 서쪽에서 시작되는 길고 깊은 직선형 협곡으로 달 지각이 양옆으로 갈라진 흔적입니다.' },
  { id: 'FC-12', nameEn: 'Ptolemaeus', nameKr: '프톨레마이오스', typeEn: 'Crater', typeKr: '충돌구', lat: -9.2, lng: -1.8, diameterKm: 153, depthKm: 2.4, areaKm2: 18380, angle: 0, widthKm: 153, description: '달의 정중앙 부근에 위치한 거대 다각형 구덩이로, 내부 바닥이 거대한 거울처럼 완벽하게 평면입니다.' },
  { id: 'FC-13', nameEn: 'Moretus', nameKr: '모레투스', typeEn: 'Crater', typeKr: '충돌구', lat: -70.6, lng: -5.8, diameterKm: 111, depthKm: 5.0, areaKm2: 9676, angle: 0, widthKm: 111, description: '앞면 남극 가까이에 위치하며, 달 전체에서 손꼽히게 높고 뾰족한 중앙봉을 가져 남극 탐사의 이정표가 됩니다.' },
  { id: 'FM-04', nameEn: 'Mons Rümker', nameKr: '륌케르 산', typeEn: 'Mons', typeKr: '산', lat: 40.8, lng: -58.1, diameterKm: 70, depthKm: 1.1, areaKm2: 3848, angle: 0, widthKm: 70, description: '폭풍의 대양 북서쪽 융기 지대. 돔 형태의 작은 화산 수십 개가 모여 있어 비교적 최근의 화산 활동을 증명합니다.' },
  { id: 'FM-05', nameEn: 'Mare Frigoris', nameKr: '추위의 바다', typeEn: 'Mare', typeKr: '바다', lat: 56.0, lng: 0.0, diameterKm: 1596, depthKm: null, areaKm2: 2000000, angle: 0, widthKm: 1596, description: '달 최북단을 동서로 길게 가로지르는 띠 모양의 바다로, 달 앞면 전체의 북쪽 지붕 역할을 하는 지형입니다.' },
  { id: 'BB-01', nameEn: 'South Pole-Aitken', nameKr: '남극-에이트킨 분지', typeEn: 'Basin', typeKr: '분지', lat: -53.0, lng: 191.0, diameterKm: 2500, depthKm: 13.0, areaKm2: 4908738, angle: 0, widthKm: 2500, description: '태양계 최대 규모의 충돌 분지로, 뒷면 남반구 대부분을 차지하며 깊은 맨틀 물질이 노출된 과학적 성지입니다.' },
  { id: 'BC-01', nameEn: 'Tsiolkovskiy', nameKr: '치올콥스키', typeEn: 'Crater', typeKr: '충돌구', lat: -20.4, lng: 129.1, diameterKm: 185, depthKm: 3.2, areaKm2: 26877, angle: 0, widthKm: 185, description: '뒷면 동반구에서 가장 아름다운 분화구 중 하나로, 밝은 고지대 한복판에 검고 평탄한 현무암 바닥이 돋보입니다.' },
  { id: 'BB-02', nameEn: 'Orientale Basin', nameKr: '동쪽의 바다', typeEn: 'Basin', typeKr: '분지', lat: -19.4, lng: 267.2, diameterKm: 930, depthKm: 7.0, areaKm2: 679600, angle: 0, widthKm: 930, description: '앞면과 뒷면 서쪽 경계에 위치하며, 거대한 황소의 눈처럼 생겨 압도적인 기하학적 미학을 자랑합니다.' },
  { id: 'BM-01', nameEn: 'Mare Moscoviense', nameKr: '모스크바의 바다', typeEn: 'Mare', typeKr: '바다', lat: 27.3, lng: 147.9, diameterKm: 277, depthKm: null, areaKm2: 60237, angle: 0, widthKm: 277, description: '뒷면 북반구에서 드물게 발견되는 바다 지형으로, 충돌 분지 내부에 현무암이 차올라 형성된 원형 평원입니다.' },
  { id: 'BC-02', nameEn: 'Von Kármán', nameKr: '폰 카르만', typeEn: 'Crater', typeKr: '충돌구', lat: -44.5, lng: 175.9, diameterKm: 186, depthKm: 3.2, areaKm2: 27174, angle: 0, widthKm: 186, description: '남극-에이트킨 분지 내부에 위치하며, 2019년 중국 창어 4호가 인류 최초로 뒷면에 착륙한 역사적 장소입니다.' },
  { id: 'BB-03', nameEn: 'Apollo', nameKr: '아폴로', typeEn: 'Basin', typeKr: '분지', lat: -35.7, lng: 208.1, diameterKm: 524, depthKm: 5.2, areaKm2: 215573, angle: 0, widthKm: 524, description: '남극-에이트킨 분지 북동쪽에 위치한 거대한 이중 고리 분지로, 뒷면 남반구의 지형적 스케일을 보여줍니다.' },
  { id: 'BC-03', nameEn: 'Korolev', nameKr: '코롤료프', typeEn: 'Crater', typeKr: '충돌구', lat: 4.2, lng: 202.6, diameterKm: 417, depthKm: 3.2, areaKm2: 136600, angle: 0, widthKm: 417, description: '뒷면 적도 서반구의 거대 분화구로, 내부가 얼음으로 찬 듯 매우 밝은 하얀 물질로 덮여 시각적으로 돋보입니다.' },
  { id: 'BC-04', nameEn: 'Gagarin', nameKr: '가가린', typeEn: 'Crater', typeKr: '충돌구', lat: -19.7, lng: 149.3, diameterKm: 262, depthKm: 6.0, areaKm2: 53900, angle: 0, widthKm: 262, description: '인류 최초의 우주비행사를 기린 거대 분화구로, 세월에 마모되고 작은 분화구들이 겹쳐진 험준한 모습입니다.' },
  { id: 'BB-04', nameEn: 'Hertzsprung', nameKr: '헤르츠스프룽', typeEn: 'Basin', typeKr: '분지', lat: 1.4, lng: 231.4, diameterKm: 570, depthKm: 4.2, areaKm2: 255000, angle: 0, widthKm: 570, description: '적도 부근 서쪽에 위치한 거대한 다중 고리 분지로, 달 뒷면 거친 대륙 지형의 웅장함을 대표합니다.' },
  { id: 'BC-05', nameEn: 'Mendeleev', nameKr: '멘델레예프', typeEn: 'Crater', typeKr: '충돌구', lat: 5.7, lng: 140.9, diameterKm: 323, depthKm: 3.0, areaKm2: 81900, angle: 0, widthKm: 323, description: '적도 동반구에 위치. 사슬처럼 이어진 작은 분화구 무리(Catena)가 내부를 가로지르는 독특한 경관을 가집니다.' },
  { id: 'BB-05', nameEn: 'Milne', nameKr: '밀른', typeEn: 'Basin', typeKr: '분지', lat: -31.0, lng: 112.8, diameterKm: 262, depthKm: 4.0, areaKm2: 53900, angle: 0, widthKm: 262, description: '뒷면 남동쪽의 고대 분지로, 성벽이 마모되어 부드러운 곡선을 그리며 거대한 원형 경기장 같은 느낌을 줍니다.' },
  { id: 'BC-06', nameEn: 'Birkhoff', nameKr: '버코프', typeEn: 'Crater', typeKr: '충돌구', lat: 58.7, lng: 245.3, diameterKm: 330, depthKm: 3.5, areaKm2: 85500, angle: 0, widthKm: 330, description: '북극에 가까운 고위도 분화구로, 내부 바닥에 분화구들이 다수 겹쳐 있어 북반구 충돌 역사를 한눈에 보여줍니다.' },
  { id: 'BB-06', nameEn: 'Poincaré', nameKr: '푸앵카레', typeEn: 'Basin', typeKr: '분지', lat: -56.7, lng: 163.6, diameterKm: 319, depthKm: 4.0, areaKm2: 79900, angle: 0, widthKm: 319, description: '남극 부근의 거대 분지로, 외부 고리가 마모되었지만 깊고 험준한 내부 지형은 웅장함을 그대로 유지하고 있습니다.' },
  { id: 'BB-07', nameEn: 'Planck', nameKr: '플랑크', typeEn: 'Basin', typeKr: '분지', lat: -57.9, lng: 135.1, diameterKm: 319, depthKm: 3.0, areaKm2: 79900, angle: 0, widthKm: 319, description: '푸앵카레 분지 바로 옆에 위치하여, 두 거대 지형이 남반구 고지대에서 압도적인 장관을 연출합니다.' },
  { id: 'BC-07', nameEn: 'Compton', nameKr: '콤프턴', typeEn: 'Crater', typeKr: '충돌구', lat: 55.3, lng: 103.8, diameterKm: 162, depthKm: 3.2, areaKm2: 20600, angle: 0, widthKm: 162, description: '북동쪽 극지방에 위치하며, 중앙봉이 매우 높고 선명하게 솟아 있어 입체감을 자랑하는 전형적인 분화구입니다.' },
  { id: 'BB-08', nameEn: 'Schrödinger', nameKr: '슈뢰딩거', typeEn: 'Basin', typeKr: '분지', lat: -75.0, lng: 132.4, diameterKm: 316, depthKm: 2.7, areaKm2: 78400, angle: 0, widthKm: 316, description: '달 남극 근처의 다중 고리 분지로, 보존 상태가 매우 뛰어나 미래 뒷면 남극 기지 건설의 핵심 지역입니다.' },
  { id: 'BC-08', nameEn: 'Antoniadi', nameKr: '안토니아디', typeEn: 'Crater', typeKr: '충돌구', lat: -69.7, lng: 188.0, diameterKm: 138, depthKm: 6.0, areaKm2: 14950, angle: 0, widthKm: 138, description: '남극-에이트킨 가장자리에 겹쳐져 있으며, 뒷면에서 가장 깊은 지점을 포함하고 있어 지각 연구 가치가 큽니다.' },
  { id: 'BC-09', nameEn: 'Aitken', nameKr: '에이트킨', typeEn: 'Crater', typeKr: '충돌구', lat: -16.8, lng: 173.0, diameterKm: 135, depthKm: 3.0, areaKm2: 14300, angle: 0, widthKm: 135, description: '거대 분지의 북쪽 경계를 이루며, 바닥이 평탄하여 남극-에이트킨 탐사의 적도 부근 전초기지 역할을 합니다.' },
  { id: 'BC-10', nameEn: 'Daedalus', nameKr: '데달루스', typeEn: 'Crater', typeKr: '충돌구', lat: -5.9, lng: 179.4, diameterKm: 93, depthKm: 3.0, areaKm2: 6792, angle: 0, widthKm: 93, description: '뒷면 적도 한복판에 위치. 보존 상태가 완벽에 가까운 계단식 성벽과 중앙봉을 가진 뒷면 최고의 미남 분화구입니다.' },
  { id: 'BC-11', nameEn: 'Van de Graaff', nameKr: '반 데 그라프', typeEn: 'Crater', typeKr: '충돌구', lat: -27.4, lng: 172.2, diameterKm: 233, depthKm: 3.0, areaKm2: 42600, angle: 0, widthKm: 233, description: "8'자 모양으로 두 분화구가 겹쳐진 매우 독특한 형태로, 강력한 국소 자기 이상 현상이 관측되는 곳입니다." },
  { id: 'BC-12', nameEn: 'Amundsen', nameKr: '아문센', typeEn: 'Crater', typeKr: '충돌구', lat: -84.5, lng: 82.8, diameterKm: 101, depthKm: 3.0, areaKm2: 8012, angle: 0, widthKm: 101, description: '달 남극 극단에 위치하며, 테두리가 매우 험준하고 영구 음영 지역을 포함하고 있어 수자원 탐사의 1순위입니다.' },
  { id: 'BC-13', nameEn: 'Byrd', nameKr: '버드', typeEn: 'Crater', typeKr: '충돌구', lat: 85.3, lng: 9.8, diameterKm: 93, depthKm: 2.0, areaKm2: 6792, angle: 0, widthKm: 93, description: '달 북극 근처의 거대 분화구로, 내부 바닥이 평탄하게 메워져 있어 북극 기지 건설의 전략적 요충지입니다.' },
  { id: 'BC-14', nameEn: 'Peary', nameKr: '피어리', typeEn: 'Crater', typeKr: '충돌구', lat: 88.6, lng: 33.0, diameterKm: 73, depthKm: 1.5, areaKm2: 4185, angle: 0, widthKm: 73, description: "달의 북극점에 위치하여 가장자리에 항상 태양빛이 드는 '영구 일조 봉우리'가 존재하는 최상급 탐사지입니다." },
  { id: 'BC-15', nameEn: 'Jules Verne', nameKr: '쥘 베른', typeEn: 'Crater', typeKr: '충돌구', lat: -2.1, lng: 147.2, diameterKm: 143, depthKm: 3.0, areaKm2: 16060, angle: 0, widthKm: 143, description: '적도 동반구에 위치하며, 중앙봉이 크고 선명하게 발달하여 뒷면 적도 부근에서 시각적으로 매우 돋보입니다.' },
  { id: 'BC-16', nameEn: 'Lomonosov', nameKr: '로모노소프', typeEn: 'Crater', typeKr: '충돌구', lat: 27.2, lng: 98.3, diameterKm: 92, depthKm: 3.0, areaKm2: 6646, angle: 0, widthKm: 92, description: '뒷면 북동쪽 가장자리에 위치하며, 중앙봉이 매우 높고 선명하게 솟아 있어 아름다운 입체감을 자랑합니다.' },
];

// 유형별 색상
export function getFeatureTypeColor(typeKr: string): string {
  switch (typeKr) {
    case '충돌구': return '#60A5FA';
    case '바다': return '#818CF8';
    case '분지': return '#F472B6';
    case '산맥': case '산': return '#34D399';
    case '계곡': return '#FBBF24';
    case '단층': case '열구': return '#F97316';
    case '만': return '#A78BFA';
    case '소용돌이': return '#2DD4BF';
    default: return '#9CA3AF';
  }
}

// 유형별 이모지
export function getFeatureTypeEmoji(typeKr: string): string {
  switch (typeKr) {
    case '충돌구': return '🕳️';
    case '바다': return '🌊';
    case '분지': return '🏟️';
    case '산맥': case '산': return '⛰️';
    case '계곡': return '🏜️';
    case '단층': case '열구': return '🪨';
    case '만': return '🌙';
    case '소용돌이': return '🌀';
    default: return '📍';
  }
}

// 유형순 정렬 (앞면 F → 뒷면 B)
export function sortByType(features: LunarFeature[]): LunarFeature[] {
  const typeOrder: Record<string, number> = {
    '바다': 0, '분지': 1, '만': 2, '충돌구': 3, '산맥': 4, '산': 5, '계곡': 6, '단층': 7, '열구': 8, '소용돌이': 9,
  };
  return [...features].sort((a, b) => (typeOrder[a.typeKr] ?? 99) - (typeOrder[b.typeKr] ?? 99));
}

// 크기순 정렬 (직경 기준 내림차순)
export function sortBySize(features: LunarFeature[]): LunarFeature[] {
  return [...features].sort((a, b) => b.diameterKm - a.diameterKm);
}

// 앞면/뒷면 분류
export function isFarSide(feature: LunarFeature): boolean {
  return feature.id.startsWith('B');
}

// 면적 포맷팅
export function formatArea(areaKm2: number | null): string {
  if (!areaKm2) return '-';
  if (areaKm2 >= 1000000) return `${(areaKm2 / 1000000).toFixed(1)}M km²`;
  if (areaKm2 >= 1000) return `${(areaKm2 / 1000).toFixed(1)}K km²`;
  return `${areaKm2.toFixed(0)} km²`;
}
