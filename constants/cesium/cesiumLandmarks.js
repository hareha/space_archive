// cesiumLandmarks.js — 주요 달 지점 랜드마크 모듈
// Entity API 사용: heightReference로 지형 위에 자동 배치
// 착륙지/지형 분리 토글 지원

export const CESIUM_LANDMARKS = `

      // ─── NASA 3D 모델 URL (jsdelivr CDN) ───
      var APOLLO_LM_GLB = 'https://cdn.jsdelivr.net/gh/nasa/NASA-3D-Resources@master/3D%20Models/Apollo%20Lunar%20Module/Apollo%20Lunar%20Module.glb';
      var ASTRONAUT_GLB = 'https://cdn.jsdelivr.net/gh/nasa/NASA-3D-Resources@master/3D%20Models/Astronaut/Astronaut.glb';

      var APOLLO_SITES = [
          { id: 'apollo11', name: 'Apollo 11', lat: 0.6744, lng: 23.4731,
            desc: '1969.07.20 — 인류 최초 달 착륙. 고요의 바다.',
            crew: '닐 암스트롱 · 버즈 올드린 · 마이클 콜린스', date: '1969.07.20',
            hasLRV: false, astronautCount: 2 },
          { id: 'apollo12', name: 'Apollo 12', lat: -3.0128, lng: -23.4219,
            desc: '1969.11.19 — 폭풍의 대양 정밀 착륙. Surveyor 3 탐사선 옆 착륙.',
            crew: '피트 콘래드 · 앨런 빈 · 리처드 고든', date: '1969.11.19',
            hasLRV: false, astronautCount: 1 },
          { id: 'apollo14', name: 'Apollo 14', lat: -3.6453, lng: -17.4714,
            desc: '1971.02.05 — 프라 마우로 고지. 앨런 셰퍼드 달 골프.',
            crew: '앨런 셰퍼드 · 에드거 미첼 · 스튜어트 루사', date: '1971.02.05',
            hasLRV: false, astronautCount: 1 },
          { id: 'apollo15', name: 'Apollo 15', lat: 26.1322, lng: 3.6339,
            desc: '1971.07.30 — 하들리 산. 최초 월면 로버(LRV) 사용.',
            crew: '데이비드 스콧 · 제임스 어윈 · 앨프레드 워든', date: '1971.07.30',
            hasLRV: true, astronautCount: 2 },
          { id: 'apollo16', name: 'Apollo 16', lat: -8.9734, lng: 15.5011,
            desc: '1972.04.21 — 데카르트 고지. 달 고지대 최초 과학 탐사.',
            crew: '존 영 · 찰스 듀크 · 토머스 매팅글리', date: '1972.04.21',
            hasLRV: true, astronautCount: 2 },
          { id: 'apollo17', name: 'Apollo 17', lat: 20.1911, lng: 30.7723,
            desc: '1972.12.11 — 타우루스 리트로우. 마지막 유인 달 탐사.',
            crew: '유진 서넌 · 해리슨 슈밋 · 로널드 에반스', date: '1972.12.11',
            hasLRV: true, astronautCount: 2 },
      ];

      var LANDMARK_SITES = [
          { id: 'mare-tranquillitatis', name: '고요의 바다', lat: 8.5, lng: 31.4,
            desc: '달 앞면 현무암질 용암 평원. 직경 약 873km. Apollo 11 착륙지 포함.' },
          { id: 'mare-serenitatis', name: '맑음의 바다', lat: 28.0, lng: 17.5,
            desc: '달 앞면 북동부 원형 용암 평원. 직경 약 707km.' },
          { id: 'oceanus-procellarum', name: '폭풍의 대양', lat: 18.4, lng: -57.4,
            desc: '달에서 가장 큰 "바다". 면적 약 250만 km².' },
          { id: 'tycho', name: '티코 크레이터', lat: -43.3, lng: -11.2,
            desc: '직경 85km, 깊이 4.8km. 밝은 광조가 수백 km 뻗어있는 대형 충돌구.' },
          { id: 'copernicus', name: '코페르니쿠스 크레이터', lat: 9.62, lng: -20.08,
            desc: '직경 93km. 계단식 벽면과 중앙 봉우리가 특징인 젊은 충돌구.' },
          { id: 'aristarchus', name: '아리스타르쿠스 크레이터', lat: 23.7, lng: -47.4,
            desc: '달에서 가장 밝은 크레이터. 직경 40km. 지구에서 맨눈 관측 가능.' },
          { id: 'shackleton', name: '섀클턴 크레이터', lat: -89.9, lng: 0.0,
            desc: '달 남극. 영구 음영지역으로 물 얼음 존재 가능. 아르테미스 계획 후보지.' },
          { id: 'change5', name: "창어 5호 착륙지", lat: 43.06, lng: -51.92,
            desc: "2020.12 — 중국 창어 5호. 폭풍의 대양 북부. 달 샘플 1.73kg 귀환." },
      ];

      // ─── 전체 리스트를 RN에 전달 ───
      function sendLandmarkList() {
          var allSites = APOLLO_SITES.map(function(s) { return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, type: 'apollo', crew: s.crew, date: s.date, desc: s.desc }; });
          var landmarkList = LANDMARK_SITES.map(function(s) { return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, type: 'landmark', desc: s.desc }; });
          window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LANDMARK_LIST',
              payload: { apollo: allSites, landmarks: landmarkList }
          }));
      }

      // ─── 깃발 Billboard 이미지 생성 (Canvas) ───
      function createFlagImage(color, width, height) {
          var canvas = document.createElement('canvas');
          canvas.width = width || 64;
          canvas.height = height || 80;
          var ctx = canvas.getContext('2d');
          // 폴 (회색 막대)
          ctx.fillStyle = '#CCCCCC';
          ctx.fillRect(2, 0, 4, canvas.height);
          // 깃발 (색상 사각형)
          ctx.fillStyle = color || '#FFFFFF';
          ctx.fillRect(6, 2, canvas.width - 8, Math.floor(canvas.height * 0.4));
          // 깃발 테두리
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(6, 2, canvas.width - 8, Math.floor(canvas.height * 0.4));
          return canvas.toDataURL();
      }

      // ─── 상태 ───
      var apolloEntities = [];    // 착륙지 엔티티 배열
      var terrainEntities = [];   // 지형 엔티티 배열
      var landmarksLoaded = false;
      var landingSitesVisible = false;
      var terrainVisible = false;

      // ─── 달 좌표 → Cartesian3 ───
      function moonPos(latDeg, lngDeg, heightM) {
          return Cesium.Cartesian3.fromRadians(
              Cesium.Math.toRadians(lngDeg),
              Cesium.Math.toRadians(latDeg),
              heightM || 0,
              Cesium.Ellipsoid.MOON
          );
      }

      // 깃발 이미지 캐시
      var _whiteFlagImg = null;
      var _redFlagImg = null;
      function getWhiteFlagImg() {
          if (!_whiteFlagImg) _whiteFlagImg = createFlagImage('#FFFFFF', 64, 80);
          return _whiteFlagImg;
      }
      function getRedFlagImg() {
          if (!_redFlagImg) _redFlagImg = createFlagImage('#CC0000', 64, 80);
          return _redFlagImg;
      }

      // ─── 랜드마크 로드 ───
      function loadLandmarkModels() {
          if (landmarksLoaded) return;
          landmarksLoaded = true;

          // ── 1. 유명 지형: 깃발 + 라벨 (Entity API) ──
          for (var i = 0; i < LANDMARK_SITES.length; i++) {
              var ls = LANDMARK_SITES[i];
              // 깃발 Billboard
              var flagEntity = viewer.entities.add({
                  position: moonPos(ls.lat, ls.lng, 0),
                  billboard: {
                      image: getWhiteFlagImg(),
                      scale: 1.0,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 500000, 0.3),
                  },
                  label: {
                      text: ls.name,
                      font: '13px sans-serif',
                      fillColor: Cesium.Color.WHITE,
                      outlineColor: Cesium.Color.BLACK,
                      outlineWidth: 3,
                      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      pixelOffset: new Cesium.Cartesian2(0, -85),
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 500000, 0.25),
                      showBackground: true,
                      backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                      backgroundPadding: new Cesium.Cartesian2(8, 5),
                  },
                  show: terrainVisible,
              });
              flagEntity._lmId = ls.id;
              terrainEntities.push(flagEntity);
          }

          // ── 2. Apollo 착륙지: GLB 모델 + 깃발 + 라벨 ──
          for (var j = 0; j < APOLLO_SITES.length; j++) {
              var as = APOLLO_SITES[j];

              // 라벨 + 깃발 Billboard
              var labelEntity = viewer.entities.add({
                  position: moonPos(as.lat, as.lng, 0),
                  billboard: {
                      image: getRedFlagImg(),
                      scale: 1.2,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.5, 500000, 0.3),
                  },
                  label: {
                      text: as.name,
                      font: 'bold 14px sans-serif',
                      fillColor: Cesium.Color.fromCssColorString('#60A5FA'),
                      outlineColor: Cesium.Color.BLACK,
                      outlineWidth: 3,
                      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      pixelOffset: new Cesium.Cartesian2(0, -85),
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 500000, 0.25),
                      showBackground: true,
                      backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                      backgroundPadding: new Cesium.Cartesian2(8, 5),
                  },
                  show: landingSitesVisible,
              });
              labelEntity._lmId = as.id;
              apolloEntities.push(labelEntity);

              // LM 모델 (Entity API — heightReference 지원)
              var lmEntity = viewer.entities.add({
                  position: moonPos(as.lat, as.lng, 5),
                  model: {
                      uri: APOLLO_LM_GLB,
                      scale: 1.5,
                      minimumPixelSize: 48,
                      maximumScale: 20000,
                      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                      silhouetteColor: Cesium.Color.fromCssColorString('#60A5FA'),
                      silhouetteSize: 1.0,
                  },
                  show: landingSitesVisible,
              });
              lmEntity._lmId = as.id + '_lm';
              apolloEntities.push(lmEntity);

              // Astronaut 모델
              for (var ai = 0; ai < as.astronautCount; ai++) {
                  var astLat = as.lat + (ai === 0 ? 0.0001 : -0.0001);
                  var astLng = as.lng + 0.0002 + ai * 0.0001;
                  var astEntity = viewer.entities.add({
                      position: moonPos(astLat, astLng, 0),
                      model: {
                          uri: ASTRONAUT_GLB,
                          scale: 0.8,
                          minimumPixelSize: 32,
                          maximumScale: 15000,
                          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      },
                      show: landingSitesVisible,
                  });
                  astEntity._lmId = as.id + '_ast' + ai;
                  apolloEntities.push(astEntity);
              }

              // LRV — Apollo 15, 16, 17 (간단한 박스 Billboard)
              if (as.hasLRV) {
                  var lrvEntity = viewer.entities.add({
                      position: moonPos(as.lat - 0.0002, as.lng + 0.0003, 1),
                      model: {
                          uri: APOLLO_LM_GLB,
                          scale: 0.3,
                          minimumPixelSize: 20,
                          maximumScale: 5000,
                          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                          color: Cesium.Color.fromCssColorString('#A0A0A0'),
                      },
                      label: {
                          text: 'LRV',
                          font: '10px sans-serif',
                          fillColor: Cesium.Color.WHITE,
                          outlineColor: Cesium.Color.BLACK,
                          outlineWidth: 2,
                          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                          pixelOffset: new Cesium.Cartesian2(0, -30),
                          disableDepthTestDistance: Number.POSITIVE_INFINITY,
                          scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 100000, 0.0),
                      },
                      show: landingSitesVisible,
                  });
                  lrvEntity._lmId = as.id + '_lrv';
                  apolloEntities.push(lrvEntity);
              }
          }
      }

      // ─── 전체 토글 (호환용) ───
      function toggleLandmarks(enabled) {
          landingSitesVisible = enabled;
          terrainVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var i = 0; i < apolloEntities.length; i++) apolloEntities[i].show = enabled;
          for (var j = 0; j < terrainEntities.length; j++) terrainEntities[j].show = enabled;
          if (enabled) sendLandmarkList();
      }

      // ─── 착륙지만 토글 ───
      function toggleLandingSites(enabled) {
          landingSitesVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var i = 0; i < apolloEntities.length; i++) apolloEntities[i].show = enabled;
      }

      // ─── 지형만 토글 ───
      function toggleTerrainFlags(enabled) {
          terrainVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var j = 0; j < terrainEntities.length; j++) terrainEntities[j].show = enabled;
      }
`;
