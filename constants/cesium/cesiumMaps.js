// cesiumMaps.js — 광물/온도/열그리드/중력/중성자 맵 모듈
// 모든 과학 데이터 시각화 레이어를 관리합니다.
// ★ 스타일 통일: 모든 히트맵은 thermalGrid 방식 (nearest 샘플링 + 셀 경계선 + HSL 무지개 색상)

export const CESIUM_MAPS = `
      // 환경 자원별 마지막 범위 캐시 (toggle 시 MINERAL_STATS 재전송용)
      var lastThermalRange = null;
      var lastGravityRange = null;
      var lastNeutronRange = null;

      // ==================================================
      // 공통 셰이더 소스 (thermalGrid 스타일 통일)
      // nearest 샘플링 + 셀 경계선(border darkening) + translucent
      // ==================================================
      var UNIFIED_HEATMAP_SHADER = [
        'czm_material czm_getMaterial(czm_materialInput materialInput) {',
        '  czm_material material = czm_getDefaultMaterial(materialInput);',
        '  vec2 st = materialInput.st;',
        '  float gw = u_gridW;',
        '  float gh = u_gridH;',
        '  float dx = 1.0 / gw;',
        '  float dy = 1.0 / gh;',
        '  vec2 st_nearest = vec2(',
        '    (floor(st.x * gw) + 0.5) * dx,',
        '    (floor(st.y * gh) + 0.5) * dy',
        '  );',
        '  vec4 color = texture(image, st_nearest);',
        '  float cellX = fract(st.x * gw);',
        '  float cellY = fract(st.y * gh);',
        '  float border = 0.015;',
        '  if (cellX < border || cellX > 1.0 - border || cellY < border || cellY > 1.0 - border) {',
        '    material.diffuse = color.rgb * 0.7;',
        '    material.alpha = min(1.0, color.a + 0.2);',
        '  } else {',
        '    material.diffuse = color.rgb;',
        '    material.alpha = color.a;',
        '  }',
        '  return material;',
        '}'
      ].join('\\n');

      var TEMP_MAP_SHADER = [
        'czm_material czm_getMaterial(czm_materialInput materialInput) {',
        '  czm_material material = czm_getDefaultMaterial(materialInput);',
        '  vec2 st = materialInput.st;',
        '  st.x = fract(st.x + u_offset);',
        '  vec4 color = texture(image, st);',
        '  material.diffuse = color.rgb;',
        '  material.alpha = u_alpha;',
        '  return material;',
        '}'
      ].join('\\n');

      // 공통 HSL → RGB 변환 함수
      function hslToRgb(h, s, l) {
          var r, g, b;
          if (s === 0) {
              r = g = b = l;
          } else {
              var hue2rgb = function(p, q, t) {
                  if (t < 0) t += 1;
                  if (t > 1) t -= 1;
                  if (t < 1 / 6) return p + (q - p) * 6 * t;
                  if (t < 1 / 2) return q;
                  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                  return p;
              };
              var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
              var p = 2 * l - q;
              r = hue2rgb(p, q, h + 1 / 3);
              g = hue2rgb(p, q, h);
              b = hue2rgb(p, q, h - 1 / 3);
          }
          return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      // 공통: 데이터 → 캔버스 픽셀 변환 (HSL 무지개 색상, 0.0~1.0 정규화)
      function paintHeatmapPixels(imgData, width, height, parsed, minVal, maxVal) {
        var data = imgData.data;
        var range = maxVal - minVal;
        var scaleX = width / 360;
        var scaleY = height / 180;

        for (var i = 0; i < parsed.length; i++) {
          var item = parsed[i];
          var lat = item.lat, lon = item.lon, val = item.val;
          var y = Math.floor((90 - lat) * scaleY);
          var x = Math.floor((lon + 180) * scaleX);
          if (y >= height) y = height - 1;
          if (x >= width) x = width - 1;
          if (y < 0) y = 0;
          if (x < 0) x = 0;

          var t = range > 0 ? (val - minVal) / range : 0.5;
          t = Math.max(0, Math.min(1, t));

          // HSL 무지개: 파랑(240) → 빨강(0)
          var hue = 240 * (1 - t);
          var rgb = hslToRgb(hue / 360, 1.0, 0.5);

          // 1° 데이터를 scaleX × scaleY 픽셀로 채움 (x축 wraparound 처리)
          for (var dy = 0; dy < scaleY && (y + dy) < height; dy++) {
            for (var dx = 0; dx < scaleX; dx++) {
              var px = (x + dx) % width;  // x축 경계 넘으면 wrap
              var idx = ((y + dy) * width + px) * 4;
              data[idx] = rgb[0];
              data[idx + 1] = rgb[1];
              data[idx + 2] = rgb[2];
              data[idx + 3] = 160;
            }
          }
        }
      }

      // 공통: 통일 스타일 구체 생성 (gridW, gridH = 데이터 해상도에 맞는 격자 수)
      function createUnifiedHeatmapSphere(canvas, offsetRadius, showFlag, gridW, gridH) {
        var radius = moonEllipsoid.maximumRadius + offsetRadius;
        
        var geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(radius, radius, radius)
        });

        return new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'UnifiedHeatmap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                uniforms: {
                  image: canvas,
                  u_gridW: gridW || 360.0,
                  u_gridH: gridH || 180.0
                },
                source: UNIFIED_HEATMAP_SHADER
              }
            }),
            translucent: true,
            renderState: {
                depthTest: { enabled: true },
                cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showFlag
        });
      }

      // ==================================================
      // 1. 광물 (Mineral) 히트맵
      // ==================================================
      
      function loadMineralData(dataArray, isFirst, isLast) {
        if (isFirst) {
          mineralDataArray = [];
        }
        mineralDataArray.push.apply(mineralDataArray, dataArray);
        
        if (isLast) {
          console.log('All mineral data loaded:', mineralDataArray.length, 'total entries');
          if (!geologicPrimitive) {
            createMineralSphere();
          }
        }
      }

      function updateMineralFilter(filter, enabled) {
        if (enabled) {
          activeMineralFilter = filter;
          calculateMineralStats(filter);
          updateMineralTexture();
          if (geologicPrimitive) {
            geologicPrimitive.show = true;
          }
        } else {
          activeMineralFilter = null;
          if (geologicPrimitive) {
            geologicPrimitive.show = false;
          }
        }
      }

      function updateGridVisibility(visible) {
        showGrid = visible;
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = visible;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = visible;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = visible;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = visible;
      }

      function calculateMineralStats(filter) {
        var values = [];
        for (var i = 0; i < mineralDataArray.length; i++) {
          var v = getMineralValue(mineralDataArray[i], filter);
          if (!isNaN(v) && v !== null && v !== undefined) {
            values.push(v);
          }
        }
        
        if (values.length > 0) {
          mineralStats.min = Math.min.apply(null, values);
          mineralStats.max = Math.max.apply(null, values);
        }

        // 단위 매핑
        var unitMap = {
          feo: 'wt%', tio2: 'wt%', mgo: 'wt%', al2o3: 'wt%',
          sio2: 'wt%', cao: 'wt%', k: 'ppm', th: 'ppm', u: 'ppm',
          am: 'g/mol', neutron: 'count/s'
        };
        var unit = unitMap[filter] || '';

        // RN에 통계 전송
        sendToRN('MINERAL_STATS', {
          filter: filter,
          min: mineralStats.min,
          max: mineralStats.max,
          unit: unit
        });
      }

      function getMineralValue(data, filter) {
        switch (filter) {
          case 'feo': return data.feo;
          case 'tio2': return data.tio2;
          case 'mgo': return data.mgo;
          case 'al2o3': return data.al2o3;
          case 'sio2': return data.sio2;
          case 'cao': return data.cao;
          case 'k': return data.k;
          case 'th': return data.th;
          case 'u': return data.u;
          case 'am': return data.am;
          case 'neutron': return data.neutron;
          default: return 0;
        }
      }

      // 자원별 고유 색상 계열 (normalized: 0=최솟값, 1=최댓값)
      // 각 자원마다 구분이 명확한 HSL 범위를 사용
      function getMineralColor(filter, normalized) {
        var t = Math.max(0, Math.min(1, normalized));
        switch (filter) {
          // ── 일반 자원 ──
          case 'feo':   // 철: 초록(120) → 빨강(0)
            return hslToRgb((120 * (1 - t)) / 360, 1.0, 0.45);
          case 'tio2':  // 티타늄: 파랑(240) → 주황(30)
            return hslToRgb((240 - 210 * t) / 360, 0.9, 0.5);
          case 'mgo':   // 마그네슘: 청록(180) → 노랑(60)
            return hslToRgb((180 - 120 * t) / 360, 0.85, 0.45);
          case 'al2o3': // 알루미늄: 파랑(220) → 빨강(0)
            return hslToRgb((220 * (1 - t)) / 360, 0.9, 0.5);
          case 'sio2':  // 규소: 남색(250) → 초록(90)
            return hslToRgb((250 - 160 * t) / 360, 0.8, 0.48);
          case 'cao':   // 칼슘: 자주(300) → 노랑(50)
            return hslToRgb((300 - 250 * t) / 360, 0.85, 0.5);
          // ── 특수 자원 (토륨/우라늄은 완전 다른 색 계열) ──
          case 'k':     // 칼륨: 연두(90) → 빨강(0)
            return hslToRgb((90 * (1 - t)) / 360, 1.0, 0.42);
          case 'th':    // 토륨: 보라(270) → 노랑(50) — 보라→핑크→주황→노랑
            return hslToRgb((270 - 220 * t) / 360, 0.9, 0.5);
          case 'u':     // 우라늄: 청록(180) → 분홍(330) — 청록→파랑→보라→분홍
            return hslToRgb(((180 + 150 * t) % 360) / 360, 0.85, 0.5);
          // ── 기타 ──
          case 'am':    // 원자질량: 파랑(240) → 빨강(0)
            return hslToRgb((240 * (1 - t)) / 360, 1.0, 0.5);
          case 'neutron': // 중성자: 파랑(240) → 빨강(0)
            return hslToRgb((240 * (1 - t)) / 360, 1.0, 0.5);
          default:
            return hslToRgb((240 * (1 - t)) / 360, 1.0, 0.5);
        }
      }

      // 현재 하이라이트된 셀 (위경도 범위)
      var highlightedMineralCell = null;

      function updateMineralTexture() {
        if (!activeMineralFilter || mineralDataArray.length === 0) {
          return;
        }

        var range = mineralStats.max - mineralStats.min;
        if (range === 0) {
          return;
        }

        // 720x360 캔버스 (고해상도 하이라이트를 위해 2배)
        var width = 720;
        var height = 360;
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        // 광물 데이터는 셀 범위(latMin~latMax, lonMin~lonMax)이므로 fillRect 사용
        // LP-GRS 데이터 경도 0° = Cesium 달 경도 180° → 캔버스에 +180° 시프트(+width/2) 적용
        var halfW = width / 2;
        for (var i = 0; i < mineralDataArray.length; i++) {
          var item = mineralDataArray[i];
          var val = getMineralValue(item, activeMineralFilter);
          if (isNaN(val) || val === null || val === undefined) continue;

          var normalized = (val - mineralStats.min) / range;
          normalized = Math.max(0, Math.min(1, normalized));

          var rgb = getMineralColor(activeMineralFilter, normalized);

          var baseX = (item.lonMin + 180) * (width / 360);
          var y = (90 - item.latMax) * (height / 180);
          var w = (item.lonMax - item.lonMin) * (width / 360);
          var h = (item.latMax - item.latMin) * (height / 180);
          var x = (baseX + halfW) % width;

          ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.63)';
          if (x + w > width) {
            // 캔버스 오른쪽 경계를 넘는 셀 → 두 부분으로 나눠서 그림
            ctx.fillRect(x, y, width - x, Math.max(h, 1));
            ctx.fillRect(0, y, w - (width - x), Math.max(h, 1));
          } else {
            ctx.fillRect(x, y, Math.max(w, 1), Math.max(h, 1));
          }
        }

        // ── 선택된 셀 하이라이트 (셰이더 그리드 셀 1개에 맞춤) ──
        if (highlightedMineralCell) {
          var hc = highlightedMineralCell;
          // 클릭 위치를 캔버스 좌표로 변환 (+180° 시프트 포함)
          var clickCanvasX = ((hc.clickLon + 180) * (width / 360) + halfW) % width;
          var clickCanvasY = (90 - hc.clickLat) * (height / 180);
          // 셰이더 그리드 셀 크기 (gridW=180, gridH=90)
          var gridCellW = width / 180;   // 720/180 = 4px
          var gridCellH = height / 90;   // 360/90  = 4px
          // 클릭 위치가 속한 그리드 셀의 좌상단 좌표
          var hx = Math.floor(clickCanvasX / gridCellW) * gridCellW;
          var hy = Math.floor(clickCanvasY / gridCellH) * gridCellH;

          // 밝은 흰색 채움으로 셀을 확 밝게
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.fillRect(hx, hy, gridCellW, gridCellH);
          // 얇은 시안 테두리 (어떤 히트맵 색 위에서도 구분됨)
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
          ctx.lineWidth = 1;
          ctx.strokeRect(hx, hy, gridCellW, gridCellH);
        }

        if (geologicPrimitive && geologicPrimitive.appearance && geologicPrimitive.appearance.material) {
          // canvas 직접 전달 시 Cesium 캐싱 문제 → dataURL로 변환하여 항상 새 텍스처로 인식
          var dataUrl = canvas.toDataURL('image/png');
          geologicPrimitive.appearance.material.uniforms.image = dataUrl;
          console.log('[MineralTexture] texture updated, highlight:', !!highlightedMineralCell);
        } else {
          console.log('[MineralTexture] geologicPrimitive not ready:', !!geologicPrimitive);
        }
      }

      function highlightMineralCell(clickLat, clickLon) {
        highlightedMineralCell = { clickLat: clickLat, clickLon: clickLon };
        updateMineralTexture();
      }

      function clearMineralHighlight() {
        highlightedMineralCell = null;
        updateMineralTexture();
      }

      function createMineralSphere() {
        geologicPrimitive = createUnifiedHeatmapSphere(
          document.createElement('canvas'),
          20000,
          false,
          180.0,
          90.0
        );
        
        viewer.scene.primitives.add(geologicPrimitive);
      }

      // ==================================================
      // 2. 온도 맵 (이미지 오버레이 — 기존 유지, 자원 스캐너에서는 미사용)
      // ==================================================

      function loadTempMapImage(base64Data) {
        tempMapImageData = base64Data;
        if (!tempMapPrimitive) {
          createTempMapSphere();
        }
        var img = new Image();
        img.onload = function() {
          if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material) {
            tempMapPrimitive.appearance.material.uniforms.image = img;
          }
        };
        img.src = base64Data;
      }

      function createTempMapSphere() {
        var moonEll = Cesium.Ellipsoid.MOON;
        var geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(
            moonEll.maximumRadius,
            moonEll.maximumRadius,
            moonEll.maximumRadius
          )
        });

        tempMapPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarTempMapMaterial',
                uniforms: {
                  image: document.createElement('canvas'),
                  u_offset: 0.0,
                  u_alpha: 1.0
                },
                source: TEMP_MAP_SHADER
              }
            }),
            renderState: {
              depthTest: { enabled: true },
              cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showTempMap
        });

        viewer.scene.primitives.add(tempMapPrimitive);
      }

      function toggleTempMap(enabled) {
        showTempMap = enabled;
        if (moonTileset) {
          moonTileset.show = !enabled;
        }
        if (tempMapPrimitive) {
          tempMapPrimitive.show = enabled;
        }
        try {
          if (enabled) {
            if (!window._tempGui && typeof dat !== 'undefined') {
              var p = { opacity: 1.0, offset: 0.0 };
              window._tempGui = new dat.GUI({ width: 180 });
              window._tempGui.add(p, 'opacity', 0.05, 1.0, 0.01).name('투명도').onChange(function(v) {
                if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material)
                  tempMapPrimitive.appearance.material.uniforms.u_alpha = v;
              });
              window._tempGui.add(p, 'offset', -0.5, 0.5, 0.01).name('경도 오프셋').onChange(function(v) {
                if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material)
                  tempMapPrimitive.appearance.material.uniforms.u_offset = v;
              });
            }
          } else {
            if (window._tempGui) {
              window._tempGui.destroy();
              window._tempGui = null;
            }
          }
        } catch(e) { console.warn('dat.gui error:', e); }
      }

      // ==================================================
      // 3. 열 그리드 (Thermal Grid) — ★ 기준 스타일
      // ==================================================
      
      function processThermalGridData(csvContent) {
        thermalGridCsvContent = csvContent;
        renderThermalGridFromData();
        thermalGridDataLoaded = true;
      }

      function renderThermalGridFromData() {
        if (!thermalGridCsvContent) return;

        console.log('Rendering thermal grid data... Day Mode:', isDayTempMode);
        var lines = thermalGridCsvContent.split('\\n');
        
        var width = 1440;
        var height = 720;
        var halfW = Math.floor(width / 2);
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        var minTemp = isDayTempMode ? 200 : 40;
        var maxTemp = isDayTempMode ? 390 : 100;
        
        var parsed = [];
        for (var i = 1; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          var parts = line.split(',');
          if (parts.length < 4) continue;
          var lat = parseFloat(parts[0]);
          var lon = parseFloat(parts[1]);
          var dayMax = parseFloat(parts[2]);
          var nightMin = parseFloat(parts[3]);
          if (isNaN(lat) || isNaN(lon)) continue;
          var temp = isDayTempMode ? dayMax : nightMin;
          if (isNaN(temp)) continue;
          parsed.push({ lat: lat, lon: lon, val: temp });
        }

        var imgData = ctx.createImageData(width, height);
        paintHeatmapPixels(imgData, width, height, parsed, minTemp, maxTemp);
        ctx.putImageData(imgData, 0, 0);

        if (highlightedEnvCell && highlightedEnvCell.filter === 'thermalGrid') {
          drawEnvHighlightOnCanvas(ctx, width, height, halfW, highlightedEnvCell);
        }
        thermalGridParsed = parsed;
        lastThermalRange = { min: Math.round(minTemp), max: Math.round(maxTemp) };

        if (!thermalGridPrimitive) {
          thermalGridPrimitive = createUnifiedHeatmapSphere(canvas, 20000, showThermalGrid);
          viewer.scene.primitives.add(thermalGridPrimitive);
        } else {
          var dataUrl = canvas.toDataURL('image/png');
          thermalGridPrimitive.appearance.material.uniforms.image = dataUrl;
        }

        sendToRN('MINERAL_STATS', {
          filter: 'thermalGrid',
          min: Math.round(minTemp),
          max: Math.round(maxTemp),
          unit: 'K'
        });
      }

      function toggleThermalGrid(enabled) {
        showThermalGrid = enabled;
        if (thermalGridPrimitive) {
          thermalGridPrimitive.show = enabled;
        }
        if (enabled && lastThermalRange) {
          sendToRN('MINERAL_STATS', { filter: 'thermalGrid', min: lastThermalRange.min, max: lastThermalRange.max, unit: 'K' });
        }
      }

      // ==================================================
      // 4. 중력 이상 (Gravity Anomaly) — 통일 스타일 적용
      // ==================================================

      function processGravityData(csvContent) {
        gravityCsvContent = csvContent;
        renderGravityMap();
        gravityDataLoaded = true;
      }

      function renderGravityMap() {
        if (!gravityCsvContent) return;

        console.log('Rendering gravity anomaly map...');
        var lines = gravityCsvContent.split('\\n');

        var minGrav = Infinity, maxGrav = -Infinity;
        var parsed = [];
        for (var i = 1; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          var parts = line.split(',');
          if (parts.length < 3) continue;
          var lat = parseFloat(parts[0]);
          var lon = parseFloat(parts[1]);
          var grav = parseFloat(parts[2]);
          if (isNaN(lat) || isNaN(lon) || isNaN(grav)) continue;
          parsed.push({ lat: lat, lon: lon, val: grav });
          if (grav < minGrav) minGrav = grav;
          if (grav > maxGrav) maxGrav = grav;
        }

        console.log('Gravity range:', minGrav, 'to', maxGrav, 'mGal,', parsed.length, 'points');

        var width = 1440;
        var height = 720;
        var halfW = Math.floor(width / 2);
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        var imgData = ctx.createImageData(width, height);
        paintHeatmapPixels(imgData, width, height, parsed, minGrav, maxGrav);
        ctx.putImageData(imgData, 0, 0);

        if (highlightedEnvCell && highlightedEnvCell.filter === 'gravity') {
          drawEnvHighlightOnCanvas(ctx, width, height, halfW, highlightedEnvCell);
        }

        gravityParsed = parsed;
        lastGravityRange = { min: Math.round(minGrav), max: Math.round(maxGrav) };

        if (!gravityPrimitive) {
          gravityPrimitive = createUnifiedHeatmapSphere(canvas, 20000, showGravityMap);
          viewer.scene.primitives.add(gravityPrimitive);
        } else {
          var dataUrl = canvas.toDataURL('image/png');
          gravityPrimitive.appearance.material.uniforms.image = dataUrl;
        }

        sendToRN('MINERAL_STATS', {
          filter: 'gravity',
          min: Math.round(minGrav),
          max: Math.round(maxGrav),
          unit: 'mGal'
        });
      }

      function toggleGravityMap(enabled) {
        showGravityMap = enabled;
        if (gravityPrimitive) {
          gravityPrimitive.show = enabled;
        }
        if (enabled && lastGravityRange) {
          sendToRN('MINERAL_STATS', { filter: 'gravity', min: lastGravityRange.min, max: lastGravityRange.max, unit: 'mGal' });
        }
      }

      function toggleGravityGridMode(enabled) {
        gravityGridMode = enabled;
        // 통일 스타일에서는 항상 그리드가 켜져있으므로 이 함수는 호환성 유지용
      }

      // ==================================================
      // 5. 중성자/수소 (Neutron) — 통일 스타일 적용
      // ==================================================

      function processNeutronData(csvContent) {
        neutronCsvContent = csvContent;
        renderNeutronMap();
        neutronDataLoaded = true;
      }

      function renderNeutronMap() {
        if (!neutronCsvContent) return;

        var minVal = Infinity, maxVal = -Infinity;
        var parsed = [];
        var lines = neutronCsvContent.split(String.fromCharCode(10));

        for (var i = 1; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          var parts = line.split(',');
          if (parts.length < 3) continue;
          var lat = parseFloat(parts[0]);
          var lon = parseFloat(parts[1]);
          var val = parseFloat(parts[2]);
          
          if (isNaN(lat) || isNaN(lon) || isNaN(val)) continue;
          
          parsed.push({ lat: lat, lon: lon, val: val });
          
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }

        console.log('Neutron range:', minVal, 'to', maxVal, ', Total points:', parsed.length);

        var width = 1440;
        var height = 720;
        var halfW = Math.floor(width / 2);
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        var imgData = ctx.createImageData(width, height);
        paintHeatmapPixels(imgData, width, height, parsed, minVal, maxVal);
        ctx.putImageData(imgData, 0, 0);

        if (highlightedEnvCell && highlightedEnvCell.filter === 'neutron') {
          drawEnvHighlightOnCanvas(ctx, width, height, halfW, highlightedEnvCell);
        }

        neutronParsed = parsed;
        lastNeutronRange = { min: Math.round(minVal), max: Math.round(maxVal) };

        if (!neutronPrimitive) {
          neutronPrimitive = createUnifiedHeatmapSphere(canvas, 20000, showNeutronMap);
          viewer.scene.primitives.add(neutronPrimitive);
        } else {
          var dataUrl = canvas.toDataURL('image/png');
          neutronPrimitive.appearance.material.uniforms.image = dataUrl;
        }

        sendToRN('MINERAL_STATS', {
          filter: 'neutron',
          min: Math.round(minVal),
          max: Math.round(maxVal),
          unit: 'count/s'
        });
      }

      function toggleNeutronMap(enabled) {
        showNeutronMap = enabled;
        if (neutronPrimitive) {
          neutronPrimitive.show = enabled;
        }
        if (enabled && lastNeutronRange) {
          sendToRN('MINERAL_STATS', { filter: 'neutron', min: lastNeutronRange.min, max: lastNeutronRange.max, unit: 'count/s' });
        }
      }

      function toggleNeutronGridMode(enabled) {
        neutronGridMode = enabled;
        // 통일 스타일에서는 항상 그리드가 켜져있으므로 이 함수는 호환성 유지용
      }

      // ==================================================
      // 환경 셀 하이라이트 (캔버스 기반 — 광물과 동일 방식)
      // ==================================================

      function drawEnvHighlightOnCanvas(ctx, width, height, halfW, hc) {
        var clickCanvasX = (hc.clickLon + 180) * (width / 360);
        var clickCanvasY = (90 - hc.clickLat) * (height / 180);
        var gridCellW = width / 360;   // 1440/360 = 4px
        var gridCellH = height / 180;  // 720/180 = 4px
        var hx = Math.floor(clickCanvasX / gridCellW) * gridCellW;
        var hy = Math.floor(clickCanvasY / gridCellH) * gridCellH;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(hx, hy, gridCellW, gridCellH);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx + 0.5, hy + 0.5, gridCellW - 1, gridCellH - 1);
      }

      function highlightEnvCell(filter, clickLat, clickLon) {
        highlightedEnvCell = { filter: filter, clickLat: clickLat, clickLon: clickLon };
        if (envHighlightEntity) {
          viewer.entities.remove(envHighlightEntity);
          envHighlightEntity = null;
        }
        if (filter === 'thermalGrid') renderThermalGridFromData();
        else if (filter === 'gravity') renderGravityMap();
        else if (filter === 'neutron') renderNeutronMap();
      }

      function clearEnvHighlight() {
        var prevFilter = highlightedEnvCell ? highlightedEnvCell.filter : null;
        highlightedEnvCell = null;
        if (envHighlightEntity) {
          viewer.entities.remove(envHighlightEntity);
          envHighlightEntity = null;
        }
        if (prevFilter === 'thermalGrid') renderThermalGridFromData();
        else if (prevFilter === 'gravity') renderGravityMap();
        else if (prevFilter === 'neutron') renderNeutronMap();
      }


      // ==================================================
      // 6. 지질 선형 피처 (USGS Unified Geologic Map)
      // ==================================================

      var geologyLinearData = null;
      var geologyLinearPrimitive = null;
      var showGeologyLinear = false;

      // 지질 유닛 래스터
      var geologyUnitPrimitive = null;
      var showGeologyUnit = false;

      var GEOLOGY_LINE_SHADER = [
        'czm_material czm_getMaterial(czm_materialInput materialInput) {',
        '  czm_material material = czm_getDefaultMaterial(materialInput);',
        '  vec2 st = materialInput.st;',
        '  vec4 color = texture(image, st);',
        '  material.diffuse = color.rgb;',
        '  material.alpha = color.a;',
        '  return material;',
        '}'
      ].join('\\\\n');

      function loadGeologyLinearData(geojsonFeatures) {
        if (!geologyLinearData) geologyLinearData = [];
        geologyLinearData = geologyLinearData.concat(geojsonFeatures);
        console.log('[Geology] Linear features chunk loaded, total:', geologyLinearData.length);
        // 매 청크마다 렌더링 (마지막 청크 시 최종 결과)
        renderGeologyLinear();
      }

      function renderGeologyLinear() {
        if (!geologyLinearData || geologyLinearData.length === 0) return;

        var width = 4096;
        var height = 2048;
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        // 타입별 색상 + 선 굵기
        var typeStyles = {
          'crest of crater rim':         { color: 'rgba(255,107,107,0.85)', width: 1.5 },
          'crest of buried crater':      { color: 'rgba(255,159,67,0.7)',  width: 1.0 },
          'ridge crest (type 1), certain': { color: 'rgba(78,205,196,0.85)', width: 1.5 },
          'ridge crest (type 1), approx.': { color: 'rgba(78,205,196,0.5)',  width: 1.0 },
          'graben trace, certain':       { color: 'rgba(162,155,254,0.85)', width: 1.5 },
          'graben trace, approx.':       { color: 'rgba(162,155,254,0.5)',  width: 1.0 },
          'lineament':                   { color: 'rgba(255,234,167,0.8)', width: 1.0 },
          'channel (volcanic)':          { color: 'rgba(225,112,85,0.85)', width: 2.0 },
          'basin ring':                  { color: 'rgba(116,185,255,0.85)', width: 2.5 },
        };
        var defaultStyle = { color: 'rgba(223,230,233,0.6)', width: 1.0 };

        for (var i = 0; i < geologyLinearData.length; i++) {
          var feat = geologyLinearData[i];
          var coords = feat.geometry.coordinates;
          if (!coords || coords.length < 2) continue;

          var ftype = feat.properties.type || '';
          var style = typeStyles[ftype] || defaultStyle;

          ctx.beginPath();
          ctx.strokeStyle = style.color;
          ctx.lineWidth = style.width;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';

          for (var j = 0; j < coords.length; j++) {
            var lon = coords[j][0];
            var lat = coords[j][1];
            var x = (lon + 180) / 360 * width;
            var y = (90 - lat) / 180 * height;

            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // 구체에 매핑
        var radius = moonEllipsoid.maximumRadius + 15000;
        if (!geologyLinearPrimitive) {
          var geometry = new Cesium.EllipsoidGeometry({
            radii: new Cesium.Cartesian3(radius, radius, radius)
          });
          geologyLinearPrimitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
            appearance: new Cesium.MaterialAppearance({
              material: new Cesium.Material({
                fabric: {
                  type: 'GeologyLinear_' + Date.now(),
                  uniforms: { image: canvas },
                  source: GEOLOGY_LINE_SHADER
                }
              }),
              translucent: true,
              renderState: {
                depthTest: { enabled: true },
                cull: { enabled: true, face: Cesium.CullFace.BACK }
              }
            }),
            show: showGeologyLinear
          });
          viewer.scene.primitives.add(geologyLinearPrimitive);
          console.log('[Geology] Linear primitive created');
        } else {
          var dataUrl = canvas.toDataURL('image/png');
          geologyLinearPrimitive.appearance.material.uniforms.image = dataUrl;
        }
      }

      function toggleGeologyLinear(enabled) {
        showGeologyLinear = enabled;
        if (geologyLinearPrimitive) {
          geologyLinearPrimitive.show = enabled;
        }
      }

      // ==================================================
      // 7. 지질 유닛 래스터 오버레이 (PNG 이미지)
      // ==================================================

      function loadGeologyUnitImage(dataUri) {
        var radius = moonEllipsoid.maximumRadius + 10000;
        var img = new Image();
        img.onload = function() {
          if (!geologyUnitPrimitive) {
            var geometry = new Cesium.EllipsoidGeometry({
              radii: new Cesium.Cartesian3(radius, radius, radius)
            });
            geologyUnitPrimitive = new Cesium.Primitive({
              geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
              appearance: new Cesium.MaterialAppearance({
                material: new Cesium.Material({
                  fabric: {
                    type: 'GeologyUnit_' + Date.now(),
                    uniforms: { image: img, u_alpha: 0.6 },
                    source: [
                      'czm_material czm_getMaterial(czm_materialInput materialInput) {',
                      '  czm_material material = czm_getDefaultMaterial(materialInput);',
                      '  vec4 color = texture(image, materialInput.st);',
                      '  material.diffuse = color.rgb;',
                      '  material.alpha = color.a * u_alpha;',
                      '  return material;',
                      '}'
                    ].join('\\\\n')
                  }
                }),
                translucent: true,
                renderState: {
                  depthTest: { enabled: true },
                  cull: { enabled: true, face: Cesium.CullFace.BACK }
                }
              }),
              show: showGeologyUnit
            });
            viewer.scene.primitives.add(geologyUnitPrimitive);
            console.log('[Geology] Unit raster primitive created');
          } else {
            geologyUnitPrimitive.appearance.material.uniforms.image = img;
          }
        };
        img.src = dataUri;
      }

      function toggleGeologyUnit(enabled) {
        showGeologyUnit = enabled;
        if (geologyUnitPrimitive) {
          geologyUnitPrimitive.show = enabled;
        }
      }

`;
