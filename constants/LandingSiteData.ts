// spaceship.csv 기반 착륙지점 데이터

export interface LandingSite {
  officialName: string;
  nameKr: string;
  country: string;
  agency: string;
  regionName: string;
  lat: number;
  lng: number;
  landingDate: string;
  year: number;
  mode: 'Manned' | 'Unmanned';
  missionType: string;
  description: string;
  contactType: string;
}

export const LANDING_SITES: LandingSite[] = [
  { officialName: 'Apollo 11', nameKr: '아폴로 11호', country: 'USA', agency: 'NASA', regionName: '고요의 바다', lat: 0.674, lng: 23.473, landingDate: '1969.7.20', year: 1969, mode: 'Manned', missionType: '착륙선', description: '인류 최초 유인 착륙하여 닐 암스트롱이 발자국을 남긴 임무.', contactType: '정상 연착륙' },
  { officialName: 'Apollo 12', nameKr: '아폴로 12호', country: 'USA', agency: 'NASA', regionName: '폭풍의 대양', lat: -3.0124, lng: -23.4216, landingDate: '1969.11.19', year: 1969, mode: 'Manned', missionType: '착륙선', description: '두 번째 유인 착륙 미션으로 최초의 정밀 타겟 착륙 성공.', contactType: '정상 연착륙' },
  { officialName: 'Apollo 14', nameKr: '아폴로 14호', country: 'USA', agency: 'NASA', regionName: '프라 마우로 고지', lat: -3.6453, lng: -17.4714, landingDate: '1971.2.5', year: 1971, mode: 'Manned', missionType: '착륙선', description: '앨런 셰퍼드가 달 표면에서 골프를 친 것으로 유명한 미션.', contactType: '정상 연착륙' },
  { officialName: 'Apollo 15', nameKr: '아폴로 15호', country: 'USA', agency: 'NASA', regionName: '해들리-아펜닌', lat: 26.1322, lng: 3.6339, landingDate: '1971.7.30', year: 1971, mode: 'Manned', missionType: '로버', description: '최초로 월면차(로버)를 사용하여 탐사 반경을 획기적으로 넓힘.', contactType: '정상 연착륙' },
  { officialName: 'Apollo 16', nameKr: '아폴로 16호', country: 'USA', agency: 'NASA', regionName: '데카르트 고지대', lat: -8.973, lng: 15.5002, landingDate: '1972.4.21', year: 1972, mode: 'Manned', missionType: '로버', description: '바다가 아닌 고지대 지역에 최초 착륙하여 지질을 탐사함.', contactType: '정상 연착륙' },
  { officialName: 'Apollo 17', nameKr: '아폴로 17호', country: 'USA', agency: 'NASA', regionName: '타우루스-리트로', lat: 20.1908, lng: 30.7717, landingDate: '1972.12.11', year: 1972, mode: 'Manned', missionType: '로버', description: '아폴로 계획의 마지막 유인 탐사로 가장 많은 월석을 채집함.', contactType: '정상 연착륙' },
  { officialName: 'Beresheet', nameKr: '베레시트', country: 'ISR', agency: 'SpaceIL / IAI', regionName: '맑음의 바다', lat: 32.59, lng: 19.34, landingDate: '2019.4.11', year: 2019, mode: 'Unmanned', missionType: '착륙선', description: '민간 자금 이스라엘 탐사선이나 엔진 고장으로 착륙 직전 추락.', contactType: '실패(추락)' },
  { officialName: 'Blue Ghost M1', nameKr: '블루고스트 M1', country: 'USA', agency: 'Firefly Aerospace', regionName: '위기의 바다', lat: 18.56, lng: 61.81, landingDate: '2025.3.2', year: 2025, mode: 'Unmanned', missionType: '착륙선', description: '미국의 민간 CLPS 계획 일환으로 성공적으로 연착륙함.', contactType: '정상 연착륙' },
  { officialName: 'Chandrayaan-2', nameKr: '비크람 착륙선', country: 'IND', agency: 'ISRO', regionName: '보구슬라프스키', lat: -70.88, lng: 22.78, landingDate: '2019.9.6', year: 2019, mode: 'Unmanned', missionType: '착륙선', description: '착륙 직전 제동 실패로 추락했으나 이후 LRO가 위치 확인.', contactType: '실패(추락)' },
  { officialName: 'Chandrayaan-3', nameKr: '찬드라얀 3호', country: 'IND', agency: 'ISRO', regionName: '시브 샤크티', lat: -69.373, lng: 32.319, landingDate: '2023.8.23', year: 2023, mode: 'Unmanned', missionType: '로버', description: '세계 최초로 달 남극 고위도 지역에 착륙하여 얼음 탐사 성공.', contactType: '정상 연착륙' },
  { officialName: "Chang'e 1", nameKr: '창어 1호', country: 'CHN', agency: 'CNSA', regionName: '풍요의 바다', lat: -1.5, lng: 52.36, landingDate: '2009.3.1', year: 2009, mode: 'Unmanned', missionType: '충돌선', description: '중국 최초의 달 궤도 도달 탐사선. 임무 종료 후 의도적 충돌 성공.', contactType: '의도적 충돌' },
  { officialName: "Chang'e 3", nameKr: '창어 3호', country: 'CHN', agency: 'CNSA', regionName: '비의 바다', lat: 44.12, lng: -19.51, landingDate: '2013.12.14', year: 2013, mode: 'Unmanned', missionType: '로버', description: '1976년 이후 37년 만에 달에 연착륙한 탐사선(위투 로버).', contactType: '정상 연착륙' },
  { officialName: "Chang'e 4", nameKr: '창어 4호', country: 'CHN', agency: 'CNSA', regionName: '폰 카르만', lat: -45.457, lng: 177.588, landingDate: '2019.1.3', year: 2019, mode: 'Unmanned', missionType: '로버', description: '인류 역사상 최초로 지구에서 보이지 않는 달 뒷면 착륙 성공.', contactType: '정상 연착륙' },
  { officialName: "Chang'e 5", nameKr: '창어 5호', country: 'CHN', agency: 'CNSA', regionName: '폭풍의 대양', lat: 43.099, lng: -51.837, landingDate: '2020.12.1', year: 2020, mode: 'Unmanned', missionType: '샘플귀환', description: '44년 만에 달의 토양 샘플을 직접 채취하여 지구로 가져온 미션.', contactType: '정상 연착륙' },
  { officialName: "Chang'e 6", nameKr: '창어 6호', country: 'CHN', agency: 'CNSA', regionName: '아폴로 분지', lat: -41.638, lng: -153.986, landingDate: '2024.6.1', year: 2024, mode: 'Unmanned', missionType: '샘플귀환', description: '인류 역사상 최초로 달 뒷면 토양 샘플을 채취하여 귀환 성공.', contactType: '정상 연착륙' },
  { officialName: 'GRAIL (Ebb)', nameKr: '그레일(에브)', country: 'USA', agency: 'NASA', regionName: '북극 산악', lat: 75.61, lng: 33.4, landingDate: '2012.12.17', year: 2012, mode: 'Unmanned', missionType: '충돌선', description: '중력 지도 작성 후 임무 마감을 위해 북극 산악지대 충돌.', contactType: '의도적 충돌' },
  { officialName: 'GRAIL (Flow)', nameKr: '그레일(플로우)', country: 'USA', agency: 'NASA', regionName: '북극 산악', lat: 75.61, lng: 33.41, landingDate: '2012.12.17', year: 2012, mode: 'Unmanned', missionType: '충돌선', description: '에브와 함께 비행하던 쌍둥이 위성. 수초 차이로 함께 충돌.', contactType: '의도적 충돌' },
  { officialName: 'Hakuto-R M1', nameKr: '하쿠토-R M1', country: 'JPN', agency: 'ispace', regionName: '아틀라스', lat: 47.58, lng: 44.09, landingDate: '2023.4.25', year: 2023, mode: 'Unmanned', missionType: '착륙선', description: '일본 민간 기업 착륙선이나 고도 계산 오류로 추락 파괴됨.', contactType: '실패(추락)' },
  { officialName: 'Hiten', nameKr: '히텐', country: 'JPN', agency: 'JAXA / ISAS', regionName: '퍼네리우스', lat: -34.3, lng: 55.6, landingDate: '1993.4.10', year: 1993, mode: 'Unmanned', missionType: '충돌선', description: '일본 최초 달 탐사선. 임무 종료 후 표면에 의도적 충돌함.', contactType: '의도적 충돌' },
  { officialName: 'IM-2 (Athena)', nameKr: 'IM-2 아테나', country: 'USA', agency: 'Intuitive Machines', regionName: '몬스 무통', lat: -85, lng: -31, landingDate: '2025.3.6', year: 2025, mode: 'Unmanned', missionType: '착륙선', description: '하강 도중 통신이 단절되었으나 달 표면에 전도된 상태로 착륙하여 짧은 데이터를 전송함.', contactType: '전도 착륙' },
  { officialName: 'Kaguya', nameKr: '카구야', country: 'JPN', agency: 'JAXA', regionName: '길(Gill) 분화구', lat: -65.5, lng: 80.4, landingDate: '2009.6.10', year: 2009, mode: 'Unmanned', missionType: '충돌선', description: '일본 대형 궤도선 임무 종료 후 표면에 정밀 충돌하며 마감.', contactType: '의도적 충돌' },
  { officialName: 'LADEE', nameKr: '라디', country: 'USA', agency: 'NASA', regionName: '선드만 V', lat: 11.85, lng: -93.25, landingDate: '2014.4.18', year: 2014, mode: 'Unmanned', missionType: '충돌선', description: '달 대기 분석 임무 종료 후 뒷면 선드만 분화구에 충돌함.', contactType: '의도적 충돌' },
  { officialName: 'LCROSS', nameKr: '엘크로스', country: 'USA', agency: 'NASA', regionName: '카베우스', lat: -84.67, lng: -48.72, landingDate: '2009.10.9', year: 2009, mode: 'Unmanned', missionType: '충돌선', description: '남극 영구 음영 지역 충돌로 다량의 물 존재를 최초 확인함.', contactType: '의도적 충돌' },
  { officialName: 'Luna 13', nameKr: '루나 13호', country: 'URS', agency: 'Soviet Space Program', regionName: '폭풍의 대양', lat: 18.87, lng: -62.05, landingDate: '1966.12.24', year: 1966, mode: 'Unmanned', missionType: '착륙선', description: '소련의 두 번째 연착륙 성공. 토양의 기계적 특성을 측정함.', contactType: '정상 연착륙' },
  { officialName: 'Luna 15', nameKr: '루나 15호', country: 'URS', agency: 'Soviet Space Program', regionName: '위기의 바다', lat: 17, lng: 60, landingDate: '1969.7.21', year: 1969, mode: 'Unmanned', missionType: '샘플귀환', description: '아폴로 11호 활동 중 샘플 채취 경쟁하다 하강 도중 추락.', contactType: '실패(추락)' },
  { officialName: 'Luna 16', nameKr: '루나 16호', country: 'URS', agency: 'Soviet Space Program', regionName: '풍요의 바다', lat: -0.51, lng: 56.3, landingDate: '1970.9.20', year: 1970, mode: 'Unmanned', missionType: '샘플귀환', description: '소련 최초이자 무인선으로 세계 최초 달 샘플 채취 귀환 성공.', contactType: '정상 연착륙' },
  { officialName: 'Luna 17', nameKr: '루나 17호', country: 'URS', agency: 'Soviet Space Program', regionName: '비의 바다', lat: 38.28, lng: -35, landingDate: '1970.11.17', year: 1970, mode: 'Unmanned', missionType: '로버', description: "인류 최초의 무인 월면차 '루노호트 1호'를 성공적 운용함.", contactType: '정상 연착륙' },
  { officialName: 'Luna 18', nameKr: '루나 18호', country: 'URS', agency: 'Soviet Space Program', regionName: '풍요의 바다', lat: 3.57, lng: 56.3, landingDate: '1971.9.11', year: 1971, mode: 'Unmanned', missionType: '샘플귀환', description: '험준한 지형에 착륙 시도 중 통신 두절 및 추락한 사례.', contactType: '실패(추락)' },
  { officialName: 'Luna 2', nameKr: '루나 2호', country: 'URS', agency: 'Soviet Space Program', regionName: '부패의 늪', lat: 29.1, lng: 0, landingDate: '1959.9.14', year: 1959, mode: 'Unmanned', missionType: '충돌선', description: '인류가 만든 인공물 최초로 달 표면에 도달(의도적 충돌)함.', contactType: '의도적 충돌' },
  { officialName: 'Luna 20', nameKr: '루나 20호', country: 'URS', agency: 'Soviet Space Program', regionName: '아폴로니우스 고원', lat: 3.78, lng: 56.55, landingDate: '1972.2.21', year: 1972, mode: 'Unmanned', missionType: '샘플귀환', description: '루나 18호 실패 지점 인근에서 무인 샘플 귀환에 성공함.', contactType: '정상 연착륙' },
  { officialName: 'Luna 21', nameKr: '루나 21호', country: 'URS', agency: 'Soviet Space Program', regionName: '르 모니에', lat: 25.85, lng: 30.45, landingDate: '1973.1.15', year: 1973, mode: 'Unmanned', missionType: '로버', description: "무인 월면차 '루노호트 2호'를 운용하며 장거리 탐사 수행.", contactType: '정상 연착륙' },
  { officialName: 'Luna 23', nameKr: '루나 23호', country: 'URS', agency: 'Soviet Space Program', regionName: '위기의 바다', lat: 12.66, lng: 62.15, landingDate: '1974.11.6', year: 1974, mode: 'Unmanned', missionType: '샘플귀환', description: '착륙 중 전도되어 샘플 채취용 드릴 작동에 실패한 임무.', contactType: '실패(추락)' },
  { officialName: 'Luna 24', nameKr: '루나 24호', country: 'URS', agency: 'Soviet Space Program', regionName: '위기의 바다', lat: 12.71, lng: 62.22, landingDate: '1976.8.18', year: 1976, mode: 'Unmanned', missionType: '샘플귀환', description: '소련 루나 계획의 마지막으로 2m 깊이 땅굴 파서 샘플 채취.', contactType: '정상 연착륙' },
  { officialName: 'Luna 25', nameKr: '루나 25호', country: 'RUS', agency: 'Roscosmos', regionName: '퐁테쿨랑 G', lat: -57.865, lng: 61.36, landingDate: '2023.8.19', year: 2023, mode: 'Unmanned', missionType: '착륙선', description: '러시아가 47년 만에 쏘았으나 궤도 이탈로 달 표면에 추락함.', contactType: '실패(추락)' },
  { officialName: 'Luna 7', nameKr: '루나 7호', country: 'URS', agency: 'Soviet Space Program', regionName: '폭풍의 대양', lat: 9.8, lng: -47.8, landingDate: '1965.10.7', year: 1965, mode: 'Unmanned', missionType: '착륙선', description: '착륙 직전 역추진 타이밍 오류로 추락.', contactType: '실패(추락)' },
  { officialName: 'Luna 8', nameKr: '루나 8호', country: 'URS', agency: 'Soviet Space Program', regionName: '폭풍의 대양', lat: 9.1, lng: -63.3, landingDate: '1965.12.6', year: 1965, mode: 'Unmanned', missionType: '착륙선', description: '착륙 에어백 파손으로 추락.', contactType: '실패(추락)' },
  { officialName: 'Luna 9', nameKr: '루나 9호', country: 'URS', agency: 'Soviet Space Program', regionName: '폭풍의 대양', lat: 7.03, lng: -64.33, landingDate: '1966.2.3', year: 1966, mode: 'Unmanned', missionType: '착륙선', description: "에어백을 활용해 인류 최초로 달 표면에 파괴되지 않고 '연착륙'에 성공함.", contactType: '정상 연착륙' },
  { officialName: 'Lunar Prospector', nameKr: '루나 프로스펙터', country: 'USA', agency: 'NASA', regionName: '슈메이커', lat: -87.7, lng: 42.1, landingDate: '1999.7.31', year: 1999, mode: 'Unmanned', missionType: '충돌선', description: '남극 영구 음영 지역에 충돌하여 물(얼음) 존재를 탐색함.', contactType: '의도적 충돌' },
  { officialName: 'Moon Impact Probe', nameKr: '달 충돌 탐사선', country: 'IND', agency: 'ISRO', regionName: '섀클턴', lat: -89.76, lng: -39.4, landingDate: '2008.11.14', year: 2008, mode: 'Unmanned', missionType: '충돌선', description: '인도 찬드라얀 1호에서 분리되어 남극 충돌하며 물 분자 발견.', contactType: '의도적 충돌' },
  { officialName: 'Odysseus', nameKr: '오디세우스', country: 'USA', agency: 'Intuitive Machines', regionName: '말라퍼트 A', lat: -80.13, lng: 1.44, landingDate: '2024.2.22', year: 2024, mode: 'Unmanned', missionType: '착륙선', description: '전도에도 불구하고 민간 최초 착륙 및 데이터 전송 성공.', contactType: '성공 착륙' },
  { officialName: 'Okina', nameKr: '오키나', country: 'JPN', agency: 'JAXA', regionName: '달 뒷면', lat: 28.2, lng: -159, landingDate: '2009.2.12', year: 2009, mode: 'Unmanned', missionType: '자위성', description: '가구야의 통신 중계용 위성으로 임무 종료 후 뒷면 충돌.', contactType: '의도적 충돌' },
  { officialName: 'Ranger 4', nameKr: '레인저 4호', country: 'USA', agency: 'NASA', regionName: '달 뒷면', lat: -15.5, lng: -130.7, landingDate: '1962.4.26', year: 1962, mode: 'Unmanned', missionType: '충돌선', description: '제어 장치 고장으로 달 뒷면에 추락. 미국 최초의 달 접촉.', contactType: '실패(추락)' },
  { officialName: 'Ranger 6', nameKr: '레인저 6호', country: 'USA', agency: 'NASA', regionName: '고요의 바다', lat: 9.358, lng: 21.48, landingDate: '1964.2.2', year: 1964, mode: 'Unmanned', missionType: '충돌선', description: '카메라 고장으로 사진 촬영 실패 후 고속 충돌하며 파괴됨.', contactType: '의도적 충돌' },
  { officialName: 'Ranger 7', nameKr: '레인저 7호', country: 'USA', agency: 'NASA', regionName: '인식의 바다', lat: -10.63, lng: -20.6, landingDate: '1964.7.31', year: 1964, mode: 'Unmanned', missionType: '충돌선', description: '미국 최초로 달 표면 근접 사진 수천 장을 전송하고 충돌함.', contactType: '의도적 충돌' },
  { officialName: 'Ranger 8', nameKr: '레인저 8호', country: 'USA', agency: 'NASA', regionName: '고요의 바다', lat: 2.67, lng: 24.65, landingDate: '1965.2.20', year: 1965, mode: 'Unmanned', missionType: '충돌선', description: '아폴로 11호 착륙지 선정을 위해 지형 사진을 찍고 충돌.', contactType: '의도적 충돌' },
  { officialName: 'Ranger 9', nameKr: '레인저 9호', country: 'USA', agency: 'NASA', regionName: '알폰서스 분화구', lat: -12.83, lng: -2.37, landingDate: '1965.3.24', year: 1965, mode: 'Unmanned', missionType: '충돌선', description: '충돌 직전까지 실시간 TV 중계를 성공적으로 수행함.', contactType: '의도적 충돌' },
  { officialName: 'SLIM', nameKr: '슬림', country: 'JPN', agency: 'JAXA', regionName: '시오리', lat: -13.316, lng: 25.251, landingDate: '2024.1.19', year: 2024, mode: 'Unmanned', missionType: '착륙선', description: '전도되었으나 통신 재개 및 전력을 확보하여 임무를 완수함.', contactType: '성공 착륙' },
  { officialName: 'SMART-1', nameKr: '스마트 1호', country: 'EUR', agency: 'ESA', regionName: '탁월의 호수', lat: -34.24, lng: -46.2, landingDate: '2006.9.3', year: 2006, mode: 'Unmanned', missionType: '충돌선', description: '유럽우주국 첫 달 탐사선. 이온 엔진 검증 후 의도적 충돌.', contactType: '의도적 충돌' },
  { officialName: 'Surveyor 1', nameKr: '서베이어 1호', country: 'USA', agency: 'NASA', regionName: '폭풍의 대양', lat: -2.474, lng: -43.339, landingDate: '1966.6.2', year: 1966, mode: 'Unmanned', missionType: '착륙선', description: '아폴로 유인 착륙 대비 지형을 정찰한 미국 최초 연착륙선.', contactType: '정상 연착륙' },
  { officialName: 'Surveyor 2', nameKr: '서베이어 2호', country: 'USA', agency: 'NASA', regionName: '섬의 바다', lat: 4, lng: -11, landingDate: '1966.9.23', year: 1966, mode: 'Unmanned', missionType: '착륙선', description: '추진기 고장으로 통제 불능 상태로 달 표면에 추락함.', contactType: '실패(추락)' },
  { officialName: 'Surveyor 3', nameKr: '서베이어 3호', country: 'USA', agency: 'NASA', regionName: '폭풍의 대양', lat: -3.015, lng: -23.418, landingDate: '1967.4.20', year: 1967, mode: 'Unmanned', missionType: '착륙선', description: '훗날 아폴로 12호가 옆에 착륙하여 이 탐사선의 부품을 회수함.', contactType: '정상 연착륙' },
  { officialName: 'Surveyor 4', nameKr: '서베이어 4호', country: 'USA', agency: 'NASA', regionName: '중앙만', lat: 0.45, lng: -1.39, landingDate: '1967.7.17', year: 1967, mode: 'Unmanned', missionType: '착륙선', description: '착륙 직전 신호가 두절되어 달 표면에 추락한 미션.', contactType: '실패(추락)' },
  { officialName: 'Surveyor 5', nameKr: '서베이어 5호', country: 'USA', agency: 'NASA', regionName: '고요의 바다', lat: 1.41, lng: 23.18, landingDate: '1967.9.11', year: 1967, mode: 'Unmanned', missionType: '착륙선', description: '최초로 현지에서 토양의 화학 분석을 수행한 연착륙선.', contactType: '정상 연착륙' },
  { officialName: 'Surveyor 6', nameKr: '서베이어 6호', country: 'USA', agency: 'NASA', regionName: '중앙만', lat: 0.49, lng: -1.4, landingDate: '1967.11.10', year: 1967, mode: 'Unmanned', missionType: '착륙선', description: '달 표면에서 엔진을 재점화하여 위치를 이동하는 데 성공함.', contactType: '정상 연착륙' },
  { officialName: 'Surveyor 7', nameKr: '서베이어 7호', country: 'USA', agency: 'NASA', regionName: '티코 크레이터 외곽', lat: -40.86, lng: -11.47, landingDate: '1968.1.10', year: 1968, mode: 'Unmanned', missionType: '착륙선', description: '서베이어 계획 마지막 우주선으로 험준한 고지대 탐사 성공.', contactType: '정상 연착륙' },
];

// 국가 이름 풀네임 매핑
export const COUNTRY_NAMES: Record<string, string> = {
  USA: '미국',
  URS: '소련',
  RUS: '러시아',
  CHN: '중국',
  IND: '인도',
  JPN: '일본',
  ISR: '이스라엘',
  EUR: '유럽',
};

// 연도순 정렬
export function sortByYear(sites: LandingSite[]): LandingSite[] {
  return [...sites].sort((a, b) => a.year - b.year);
}

// 국가순 정렬
export function sortByCountry(sites: LandingSite[]): LandingSite[] {
  return [...sites].sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);
}

// 인근 착륙지 찾기 (위경도 유클리드 거리 기준, 자기 자신 제외)
export function findNearbySites(site: LandingSite, count = 2): LandingSite[] {
  return LANDING_SITES
    .filter(s => s.officialName !== site.officialName)
    .map(s => ({
      site: s,
      dist: Math.sqrt(Math.pow(s.lat - site.lat, 2) + Math.pow(s.lng - site.lng, 2)),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map(item => item.site);
}

// 착륙 상태 색상
export function getContactColor(contactType: string): string {
  if (contactType.includes('정상') || contactType.includes('성공')) return '#34D399';
  if (contactType.includes('실패')) return '#EF4444';
  if (contactType.includes('의도적')) return '#FBBF24';
  if (contactType.includes('전도')) return '#F97316';
  return '#9CA3AF';
}
