// cesiumLandmarks.js — 달 착륙지점 + 지형 마커 모듈
// 새 데이터베이스(spaceship.csv) 55개 착륙지점 기반
// 간결한 점(Point) + 라벨 표시

export const CESIUM_LANDMARKS = `

      // ── 55개 착륙지점 데이터 (spaceship.csv 기반) ──
      var LANDING_SITES = [
        { id:'apollo11', name:'아폴로 11호', lat:0.674, lng:23.473, year:1969, country:'USA', ok:true },
        { id:'apollo12', name:'아폴로 12호', lat:-3.0124, lng:-23.4216, year:1969, country:'USA', ok:true },
        { id:'apollo14', name:'아폴로 14호', lat:-3.6453, lng:-17.4714, year:1971, country:'USA', ok:true },
        { id:'apollo15', name:'아폴로 15호', lat:26.1322, lng:3.6339, year:1971, country:'USA', ok:true },
        { id:'apollo16', name:'아폴로 16호', lat:-8.973, lng:15.5002, year:1972, country:'USA', ok:true },
        { id:'apollo17', name:'아폴로 17호', lat:20.1908, lng:30.7717, year:1972, country:'USA', ok:true },
        { id:'beresheet', name:'베레시트', lat:32.59, lng:19.34, year:2019, country:'ISR', ok:false },
        { id:'blueghost', name:'블루고스트 M1', lat:18.56, lng:61.81, year:2025, country:'USA', ok:true },
        { id:'chandrayaan2', name:'비크람', lat:-70.88, lng:22.78, year:2019, country:'IND', ok:false },
        { id:'chandrayaan3', name:'찬드라얀 3호', lat:-69.373, lng:32.319, year:2023, country:'IND', ok:true },
        { id:'change1', name:'창어 1호', lat:-1.5, lng:52.36, year:2009, country:'CHN', ok:true },
        { id:'change3', name:'창어 3호', lat:44.12, lng:-19.51, year:2013, country:'CHN', ok:true },
        { id:'change4', name:'창어 4호', lat:-45.457, lng:177.588, year:2019, country:'CHN', ok:true },
        { id:'change5', name:'창어 5호', lat:43.099, lng:-51.837, year:2020, country:'CHN', ok:true },
        { id:'change6', name:'창어 6호', lat:-41.638, lng:-153.986, year:2024, country:'CHN', ok:true },
        { id:'grail_ebb', name:'그레일(에브)', lat:75.61, lng:33.4, year:2012, country:'USA', ok:true },
        { id:'grail_flow', name:'그레일(플로우)', lat:75.61, lng:33.41, year:2012, country:'USA', ok:true },
        { id:'hakutor', name:'하쿠토-R', lat:47.58, lng:44.09, year:2023, country:'JPN', ok:false },
        { id:'hiten', name:'히텐', lat:-34.3, lng:55.6, year:1993, country:'JPN', ok:true },
        { id:'im2', name:'IM-2 아테나', lat:-85, lng:-31, year:2025, country:'USA', ok:false },
        { id:'kaguya', name:'카구야', lat:-65.5, lng:80.4, year:2009, country:'JPN', ok:true },
        { id:'ladee', name:'라디', lat:11.85, lng:-93.25, year:2014, country:'USA', ok:true },
        { id:'lcross', name:'엘크로스', lat:-84.67, lng:-48.72, year:2009, country:'USA', ok:true },
        { id:'luna13', name:'루나 13호', lat:18.87, lng:-62.05, year:1966, country:'URS', ok:true },
        { id:'luna15', name:'루나 15호', lat:17, lng:60, year:1969, country:'URS', ok:false },
        { id:'luna16', name:'루나 16호', lat:-0.51, lng:56.3, year:1970, country:'URS', ok:true },
        { id:'luna17', name:'루나 17호', lat:38.28, lng:-35, year:1970, country:'URS', ok:true },
        { id:'luna18', name:'루나 18호', lat:3.57, lng:56.3, year:1971, country:'URS', ok:false },
        { id:'luna2', name:'루나 2호', lat:29.1, lng:0, year:1959, country:'URS', ok:true },
        { id:'luna20', name:'루나 20호', lat:3.78, lng:56.55, year:1972, country:'URS', ok:true },
        { id:'luna21', name:'루나 21호', lat:25.85, lng:30.45, year:1973, country:'URS', ok:true },
        { id:'luna23', name:'루나 23호', lat:12.66, lng:62.15, year:1974, country:'URS', ok:false },
        { id:'luna24', name:'루나 24호', lat:12.71, lng:62.22, year:1976, country:'URS', ok:true },
        { id:'luna25', name:'루나 25호', lat:-57.865, lng:61.36, year:2023, country:'RUS', ok:false },
        { id:'luna7', name:'루나 7호', lat:9.8, lng:-47.8, year:1965, country:'URS', ok:false },
        { id:'luna8', name:'루나 8호', lat:9.1, lng:-63.3, year:1965, country:'URS', ok:false },
        { id:'luna9', name:'루나 9호', lat:7.03, lng:-64.33, year:1966, country:'URS', ok:true },
        { id:'lunarprospector', name:'루나 프로스펙터', lat:-87.7, lng:42.1, year:1999, country:'USA', ok:true },
        { id:'mip', name:'달 충돌 탐사선', lat:-89.76, lng:-39.4, year:2008, country:'IND', ok:true },
        { id:'odysseus', name:'오디세우스', lat:-80.13, lng:1.44, year:2024, country:'USA', ok:true },
        { id:'okina', name:'오키나', lat:28.2, lng:-159, year:2009, country:'JPN', ok:true },
        { id:'ranger4', name:'레인저 4호', lat:-15.5, lng:-130.7, year:1962, country:'USA', ok:false },
        { id:'ranger6', name:'레인저 6호', lat:9.358, lng:21.48, year:1964, country:'USA', ok:true },
        { id:'ranger7', name:'레인저 7호', lat:-10.63, lng:-20.6, year:1964, country:'USA', ok:true },
        { id:'ranger8', name:'레인저 8호', lat:2.67, lng:24.65, year:1965, country:'USA', ok:true },
        { id:'ranger9', name:'레인저 9호', lat:-12.83, lng:-2.37, year:1965, country:'USA', ok:true },
        { id:'slim', name:'슬림', lat:-13.316, lng:25.251, year:2024, country:'JPN', ok:true },
        { id:'smart1', name:'스마트 1호', lat:-34.24, lng:-46.2, year:2006, country:'EUR', ok:true },
        { id:'surveyor1', name:'서베이어 1호', lat:-2.474, lng:-43.339, year:1966, country:'USA', ok:true },
        { id:'surveyor2', name:'서베이어 2호', lat:4, lng:-11, year:1966, country:'USA', ok:false },
        { id:'surveyor3', name:'서베이어 3호', lat:-3.015, lng:-23.418, year:1967, country:'USA', ok:true },
        { id:'surveyor4', name:'서베이어 4호', lat:0.45, lng:-1.39, year:1967, country:'USA', ok:false },
        { id:'surveyor5', name:'서베이어 5호', lat:1.41, lng:23.18, year:1967, country:'USA', ok:true },
        { id:'surveyor6', name:'서베이어 6호', lat:0.49, lng:-1.4, year:1967, country:'USA', ok:true },
        { id:'surveyor7', name:'서베이어 7호', lat:-40.86, lng:-11.47, year:1968, country:'USA', ok:true },
      ];

      // ── 50개 대표 지형 데이터 (lunar_features_updated.csv) ──
      var LANDMARK_SITES = [
        { id:'FC-01', name:'티코', nameEn:'Tycho', type:'충돌구', lat:-43.3, lng:-11.2, diameter:85, area:5670 },
        { id:'FC-02', name:'코페르니쿠스', nameEn:'Copernicus', type:'충돌구', lat:9.6, lng:-20.1, diameter:93, area:6792 },
        { id:'FC-03', name:'플라톤', nameEn:'Plato', type:'충돌구', lat:51.6, lng:-9.4, diameter:101, area:8012 },
        { id:'FC-04', name:'아리스타르코스', nameEn:'Aristarchus', type:'충돌구', lat:23.7, lng:-47.4, diameter:40, area:1257 },
        { id:'FS-01', name:'무지개 만', nameEn:'Sinus Iridum', type:'만', lat:44.1, lng:-31.5, diameter:236, area:43736 },
        { id:'FM-01', name:'고요의 바다', nameEn:'Mare Tranquillitatis', type:'바다', lat:8.5, lng:31.4, diameter:873, area:598000 },
        { id:'FC-05', name:'클라비우스', nameEn:'Clavius', type:'충돌구', lat:-58.4, lng:-14.4, diameter:231, area:41900 },
        { id:'FM-02', name:'아펜닌 산맥', nameEn:'Montes Apenninus', type:'산맥', lat:18.9, lng:3.7, diameter:600, area:0 },
        { id:'FR-01', name:'직선의 벽', nameEn:'Rupes Recta', type:'단층', lat:-22.1, lng:-7.8, diameter:134, area:0 },
        { id:'FC-06', name:'가상디', nameEn:'Gassendi', type:'충돌구', lat:-17.5, lng:-39.9, diameter:110, area:9503 },
        { id:'FC-07', name:'메시에', nameEn:'Messier', type:'충돌구', lat:-1.9, lng:47.6, diameter:11, area:95 },
        { id:'FS-02', name:'라이너 감마', nameEn:'Reiner Gamma', type:'소용돌이', lat:7.5, lng:-59.0, diameter:70, area:3848 },
        { id:'FV-01', name:'알프스 계곡', nameEn:'Vallis Alpes', type:'계곡', lat:48.5, lng:3.2, diameter:166, area:0 },
        { id:'FC-08', name:'그리말디', nameEn:'Grimaldi', type:'충돌구', lat:-5.2, lng:-68.6, diameter:173, area:23500 },
        { id:'FC-09', name:'테오필루스', nameEn:'Theophilus', type:'충돌구', lat:-11.4, lng:26.4, diameter:100, area:7854 },
        { id:'FV-02', name:'슈뢰터 계곡', nameEn:'Vallis Schröteri', type:'계곡', lat:26.2, lng:-50.8, diameter:168, area:0 },
        { id:'FM-03', name:'위기의 바다', nameEn:'Mare Crisium', type:'바다', lat:17.0, lng:59.1, diameter:556, area:242744 },
        { id:'FC-10', name:'페타비우스', nameEn:'Petavius', type:'충돌구', lat:-25.3, lng:60.4, diameter:182, area:26012 },
        { id:'FC-11', name:'케플러', nameEn:'Kepler', type:'충돌구', lat:8.1, lng:-38.0, diameter:31, area:754 },
        { id:'FS-03', name:'중앙 만', nameEn:'Sinus Medii', type:'만', lat:2.4, lng:1.7, diameter:335, area:88125 },
        { id:'FR-02', name:'아리아데우스 열구', nameEn:'Rima Ariadaeus', type:'열구', lat:6.4, lng:17.3, diameter:250, area:0 },
        { id:'FC-12', name:'프톨레마이오스', nameEn:'Ptolemaeus', type:'충돌구', lat:-9.2, lng:-1.8, diameter:153, area:18380 },
        { id:'FC-13', name:'모레투스', nameEn:'Moretus', type:'충돌구', lat:-70.6, lng:-5.8, diameter:111, area:9676 },
        { id:'FM-04', name:'륌케르 산', nameEn:'Mons Rümker', type:'산', lat:40.8, lng:-58.1, diameter:70, area:3848 },
        { id:'FM-05', name:'추위의 바다', nameEn:'Mare Frigoris', type:'바다', lat:56.0, lng:0.0, diameter:1596, area:2000000 },
        { id:'BB-01', name:'남극-에이트킨 분지', nameEn:'South Pole-Aitken', type:'분지', lat:-53.0, lng:191.0, diameter:2500, area:4908738 },
        { id:'BC-01', name:'치올콥스키', nameEn:'Tsiolkovskiy', type:'충돌구', lat:-20.4, lng:129.1, diameter:185, area:26877 },
        { id:'BB-02', name:'동쪽의 바다', nameEn:'Orientale Basin', type:'분지', lat:-19.4, lng:267.2, diameter:930, area:679600 },
        { id:'BM-01', name:'모스크바의 바다', nameEn:'Mare Moscoviense', type:'바다', lat:27.3, lng:147.9, diameter:277, area:60237 },
        { id:'BC-02', name:'폰 카르만', nameEn:'Von Kármán', type:'충돌구', lat:-44.5, lng:175.9, diameter:186, area:27174 },
        { id:'BB-03', name:'아폴로', nameEn:'Apollo', type:'분지', lat:-35.7, lng:208.1, diameter:524, area:215573 },
        { id:'BC-03', name:'코롤료프', nameEn:'Korolev', type:'충돌구', lat:4.2, lng:202.6, diameter:417, area:136600 },
        { id:'BC-04', name:'가가린', nameEn:'Gagarin', type:'충돌구', lat:-19.7, lng:149.3, diameter:262, area:53900 },
        { id:'BB-04', name:'헤르츠스프룽', nameEn:'Hertzsprung', type:'분지', lat:1.4, lng:231.4, diameter:570, area:255000 },
        { id:'BC-05', name:'멘델레예프', nameEn:'Mendeleev', type:'충돌구', lat:5.7, lng:140.9, diameter:323, area:81900 },
        { id:'BB-05', name:'밀른', nameEn:'Milne', type:'분지', lat:-31.0, lng:112.8, diameter:262, area:53900 },
        { id:'BC-06', name:'버코프', nameEn:'Birkhoff', type:'충돌구', lat:58.7, lng:245.3, diameter:330, area:85500 },
        { id:'BB-06', name:'푸앵카레', nameEn:'Poincaré', type:'분지', lat:-56.7, lng:163.6, diameter:319, area:79900 },
        { id:'BB-07', name:'플랑크', nameEn:'Planck', type:'분지', lat:-57.9, lng:135.1, diameter:319, area:79900 },
        { id:'BC-07', name:'콤프턴', nameEn:'Compton', type:'충돌구', lat:55.3, lng:103.8, diameter:162, area:20600 },
        { id:'BB-08', name:'슈뢰딩거', nameEn:'Schrödinger', type:'분지', lat:-75.0, lng:132.4, diameter:316, area:78400 },
        { id:'BC-08', name:'안토니아디', nameEn:'Antoniadi', type:'충돌구', lat:-69.7, lng:188.0, diameter:138, area:14950 },
        { id:'BC-09', name:'에이트킨', nameEn:'Aitken', type:'충돌구', lat:-16.8, lng:173.0, diameter:135, area:14300 },
        { id:'BC-10', name:'데달루스', nameEn:'Daedalus', type:'충돌구', lat:-5.9, lng:179.4, diameter:93, area:6792 },
        { id:'BC-11', name:'반 데 그라프', nameEn:'Van de Graaff', type:'충돌구', lat:-27.4, lng:172.2, diameter:233, area:42600 },
        { id:'BC-12', name:'아문센', nameEn:'Amundsen', type:'충돌구', lat:-84.5, lng:82.8, diameter:101, area:8012 },
        { id:'BC-13', name:'버드', nameEn:'Byrd', type:'충돌구', lat:85.3, lng:9.8, diameter:93, area:6792 },
        { id:'BC-14', name:'피어리', nameEn:'Peary', type:'충돌구', lat:88.6, lng:33.0, diameter:73, area:4185 },
        { id:'BC-15', name:'쥘 베른', nameEn:'Jules Verne', type:'충돌구', lat:-2.1, lng:147.2, diameter:143, area:16060 },
        { id:'BC-16', name:'로모노소프', nameEn:'Lomonosov', type:'충돌구', lat:27.2, lng:98.3, diameter:92, area:6646 },
      ];

      // ── 지형 유형별 색상 ──
      function getTerrainTypeColor(type) {
          var colors = {
              '충돌구': '#60A5FA',
              '바다': '#818CF8',
              '분지': '#F472B6',
              '산맥': '#34D399',
              '산': '#34D399',
              '계곡': '#FBBF24',
              '단층': '#F97316',
              '열구': '#F97316',
              '만': '#A78BFA',
              '소용돌이': '#2DD4BF',
          };
          return colors[type] || '#9CA3AF';
      }

      // ── 원형 폴리곤 좌표 생성 (달 표면 위) ──
      function generateCirclePositions(latDeg, lngDeg, radiusKm, segments) {
          segments = segments || 64;
          var moonRadiusKm = 1737.4;
          var angularRadius = radiusKm / moonRadiusKm; // 라디안
          var latRad = Cesium.Math.toRadians(latDeg);
          var lngRad = Cesium.Math.toRadians(lngDeg);
          var positions = [];
          for (var i = 0; i <= segments; i++) {
              var bearing = (2 * Math.PI * i) / segments;
              var lat2 = Math.asin(Math.sin(latRad) * Math.cos(angularRadius) + Math.cos(latRad) * Math.sin(angularRadius) * Math.cos(bearing));
              var lng2 = lngRad + Math.atan2(Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latRad), Math.cos(angularRadius) - Math.sin(latRad) * Math.sin(lat2));
              positions.push(Cesium.Cartesian3.fromRadians(lng2, lat2, 0, Cesium.Ellipsoid.MOON));
          }
          return positions;
      }

      // ── 전체 리스트를 RN에 전달 ──
      function sendLandmarkList() {
          var allSites = LANDING_SITES.map(function(s) { return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, type: 'landing', year: s.year }; });
          var landmarkList = LANDMARK_SITES.map(function(s) { return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, type: 'landmark', diameter: s.diameter }; });
          window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LANDMARK_LIST',
              payload: { apollo: allSites, landmarks: landmarkList }
          }));
      }

      // ── 상태 ──
      var landingEntities = [];    // 착륙지 엔티티
      var terrainEntities = [];    // 지형 엔티티
      var landmarksLoaded = false;
      var landingSitesVisible = false;
      var terrainVisible = false;

      // ── 달 좌표 → Cartesian3 ──
      function moonPos(latDeg, lngDeg, heightM) {
          return Cesium.Cartesian3.fromRadians(
              Cesium.Math.toRadians(lngDeg),
              Cesium.Math.toRadians(latDeg),
              heightM || 0,
              Cesium.Ellipsoid.MOON
          );
      }

      // ── 국가별 색상 ──
      function getCountryColor(country) {
          var colors = {
              'USA': '#60A5FA',
              'URS': '#EF4444',
              'RUS': '#EF4444',
              'CHN': '#FBBF24',
              'IND': '#F97316',
              'JPN': '#A78BFA',
              'ISR': '#34D399',
              'EUR': '#06B6D4',
          };
          return colors[country] || '#9CA3AF';
      }

      // ── 랜드마크 로드 ──
      function loadLandmarkModels() {
          if (landmarksLoaded) return;
          landmarksLoaded = true;

          // 1. 대표 지형 50개: 라벨 + 중심점만 (오버레이는 선택 시에만)
          for (var i = 0; i < LANDMARK_SITES.length; i++) {
              var ls = LANDMARK_SITES[i];
              var typeColor = Cesium.Color.fromCssColorString(getTerrainTypeColor(ls.type));

              // 라벨 + 중심점
              var tEntity = viewer.entities.add({
                  position: moonPos(ls.lat, ls.lng, 0),
                  point: {
                      pixelSize: 7,
                      color: typeColor.withAlpha(0.9),
                      outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
                      outlineWidth: 1,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      disableDepthTestDistance: 1500000,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 1500000, 0.3),
                  },
                  label: {
                      text: ls.name,
                      font: '11px sans-serif',
                      fillColor: typeColor,
                      outlineColor: Cesium.Color.BLACK,
                      outlineWidth: 2,
                      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      pixelOffset: new Cesium.Cartesian2(10, -4),
                      disableDepthTestDistance: 1500000,
                      scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 1500000, 0.15),
                      showBackground: true,
                      backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                      backgroundPadding: new Cesium.Cartesian2(6, 4),
                  },
                  show: terrainVisible,
              });
              tEntity._lmId = ls.id;
              terrainEntities.push(tEntity);
          }

          // 2. 착륙지점 55개: 컬러 점 + 라벨
          for (var j = 0; j < LANDING_SITES.length; j++) {
              var site = LANDING_SITES[j];
              var dotColor = Cesium.Color.fromCssColorString(getCountryColor(site.country));
              var outlineCol = site.ok ? Cesium.Color.fromCssColorString('#34D399') : Cesium.Color.fromCssColorString('#EF4444');

              var sEntity = viewer.entities.add({
                  position: moonPos(site.lat, site.lng, 0),
                  point: {
                      pixelSize: 8,
                      color: dotColor,
                      outlineColor: outlineCol,
                      outlineWidth: 2,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      disableDepthTestDistance: 1500000,
                      scaleByDistance: new Cesium.NearFarScalar(500, 1.5, 800000, 0.3),
                  },
                  label: {
                      text: site.name,
                      font: '12px sans-serif',
                      fillColor: dotColor,
                      outlineColor: Cesium.Color.BLACK,
                      outlineWidth: 2,
                      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      verticalOrigin: Cesium.VerticalOrigin.CENTER,
                      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                      pixelOffset: new Cesium.Cartesian2(12, 0),
                      disableDepthTestDistance: 1500000,
                      scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 800000, 0.15),
                      showBackground: true,
                      backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
                      backgroundPadding: new Cesium.Cartesian2(6, 3),
                  },
                  show: landingSitesVisible,
              });
              sEntity._lmId = site.id;
              landingEntities.push(sEntity);
          }
      }

      // ── 전체 토글 (호환용) ──
      function toggleLandmarks(enabled) {
          landingSitesVisible = enabled;
          terrainVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var i = 0; i < landingEntities.length; i++) landingEntities[i].show = enabled;
          for (var j = 0; j < terrainEntities.length; j++) terrainEntities[j].show = enabled;
          if (enabled) sendLandmarkList();
      }

      // ── 착륙지만 토글 ──
      function toggleLandingSites(enabled) {
          landingSitesVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var i = 0; i < landingEntities.length; i++) landingEntities[i].show = enabled;
      }

      // ── 지형만 토글 ──
      function toggleTerrainFlags(enabled) {
          terrainVisible = enabled;
          if (!landmarksLoaded) { loadLandmarkModels(); sendLandmarkList(); }
          for (var j = 0; j < terrainEntities.length; j++) terrainEntities[j].show = enabled;
      }

      // ── 선택된 지형 면적 오버레이 (ClassificationPrimitive) ──
      var _featureAreaPrimitives = new Cesium.PrimitiveCollection();
      viewer.scene.primitives.add(_featureAreaPrimitives);

      function showFeatureArea(lat, lng, diameterKm, typeKr) {
          hideFeatureArea();
          var color = Cesium.Color.fromCssColorString(getTerrainTypeColor(typeKr));
          var radiusKm = diameterKm / 2;
          var circlePositions = generateCirclePositions(lat, lng, radiusKm, 64);
          _featureAreaPrimitives.add(new Cesium.ClassificationPrimitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(circlePositions),
                      ellipsoid: Cesium.Ellipsoid.MOON,
                      height: -20000,
                      extrudedHeight: 20000,
                  }),
                  attributes: {
                      color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(0.25))
                  }
              }),
              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
              classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
              asynchronous: false,
          }));
      }
      function hideFeatureArea() {
          _featureAreaPrimitives.removeAll();
      }
`;
