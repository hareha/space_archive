// cesiumGridLine.js — S2 그리드 렌더링 (선 버전) + 네비게이션 모듈
// 면(polygon) 대신 선(polyline)으로 그리드를 표현
// getRenderConfig, getExactCellPositions, flashCell, getDescendants, render, flyToCell

export const CESIUM_GRID = `
      // --- 프로토타입 기반 그리드 렌더링 함수들 ---

      const getRenderConfig = (level) => ({
          segments: level <= 4 ? 8 : (level <= 8 ? 4 : 1)
      });

      function getExactCellPositions(cellId, height, segments) {
          const cell = s2.Cell.fromCellID(cellId);
          const positions = [];
          for (let i = 0; i < 4; i++) {
              const p1 = cell.vertex(i); const p2 = cell.vertex((i + 1) % 4);
              for (let j = 0; j < segments; j++) {
                  const t = j / segments;
                  const dx = p1.x * (1 - t) + p2.x * t, dy = p1.y * (1 - t) + p2.y * t, dz = p1.z * (1 - t) + p2.z * t;
                  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  positions.push(Cesium.Cartesian3.fromRadians(Math.atan2(dy / mag, dx / mag), Math.asin(dz / mag), height, Cesium.Ellipsoid.MOON));
              }
          }
          return positions;
      }

      function flashCell(cellId) {
          flashPrimitives.removeAll();
          const cell = s2.Cell.fromCellID(cellId);
          const cc = cell.center();
          const ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
          const centerCart = Cesium.Cartesian3.fromRadians(
              Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
          );
          const FLASH_INSET = 0.92;
          const insetPositions = [];
          for (let i = 0; i < 4; i++) {
              const v = cell.vertex(i); const r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
              const vertCart = Cesium.Cartesian3.fromRadians(Math.atan2(v.y, v.x), Math.asin(v.z / r), 0, Cesium.Ellipsoid.MOON);
              insetPositions.push(new Cesium.Cartesian3(
                  centerCart.x + (vertCart.x - centerCart.x) * FLASH_INSET,
                  centerCart.y + (vertCart.y - centerCart.y) * FLASH_INSET,
                  centerCart.z + (vertCart.z - centerCart.z) * FLASH_INSET
              ));
          }
          // 플래시는 면으로 유지 (선택 피드백)
          flashPrimitives.add(new Cesium.ClassificationPrimitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(insetPositions),
                      ellipsoid: Cesium.Ellipsoid.MOON,
                      height: -15000, extrudedHeight: 15000,
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.5)) }
              }),
              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
              classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
              asynchronous: false
          }));
          setTimeout(() => { flashPrimitives.removeAll(); }, 600);
      }

      function getDescendants(cellId, targetLevel) {
          let results = [cellId];
          let currentLevel = s2.cellid.level(cellId);
          while (currentLevel < targetLevel) {
              let nextResults = [];
              for (let id of results) { nextResults.push(...s2.cellid.children(id)); }
              results = nextResults;
              currentLevel++;
          }
          return results;
      }

      function render() {
          gridPrimitives.removeAll();
          pillarPrimitives.removeAll(); // 활성 레벨만 갱신

          const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          var displayedCellCount = 0;
          var gridTargetLevel = currentLevel;

          // ─── 1. parentPrimitives에 누적 (lv4 초기 + 드릴다운 시 형제 셀) ───
          const parentColors = [
              Cesium.Color.LAWNGREEN.withAlpha(0.7),     // lv4 초기 그리드
              Cesium.Color.LAWNGREEN.withAlpha(0.3),     // lv8 형제
              Cesium.Color.CYAN.withAlpha(0.4),           // lv12 형제
              Cesium.Color.DODGERBLUE.withAlpha(0.5),     // lv15 형제
          ];
          const parentWidths = [2.0, 1.5, 1.5, 1.0]; // 레벨별 선 두께

          // --- helper: S2 셀의 4개 꼭짓점 → 닫힌 polyline 좌표 ---
          function getCellOutlinePositions(cellId) {
              const cell = s2.Cell.fromCellID(cellId);
              const positions = [];
              for (let vi = 0; vi < 4; vi++) {
                  const v = cell.vertex(vi);
                  const vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                  positions.push(Cesium.Cartesian3.fromRadians(
                      Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                  ));
              }
              // 닫기: 첫 번째 점 다시 추가
              positions.push(positions[0].clone());
              return positions;
          }

          // --- helper: 셀 배열을 선으로 컬렉션에 그리는 함수 ---
          function renderCellLines(cellIds, color, collection, width, async) {
              cellIds.forEach(id => {
                  const positions = getCellOutlinePositions(id);
                  collection.add(new Cesium.GroundPolylinePrimitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.GroundPolylineGeometry({
                              positions: positions,
                              width: width || 2.0,
                          }),
                          attributes: {
                              color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
                          }
                      }),
                      appearance: new Cesium.PolylineColorAppearance(),
                      asynchronous: !!async
                  }));
              });
          }

          // lv4 기본 레이어
          if (lastRenderedDepth === 0) {
              let lv4Cells = [];
              for (let f = 0; f < 6; f++) lv4Cells.push(...getDescendants(s2.cellid.fromFace(f), 4));
              renderCellLines(lv4Cells, parentColors[0], parentPrimitives, parentWidths[0], false);
              lastRenderedDepth = 1;
          }

          // 드릴다운 형제 셀
          for (let si = lastRenderedDepth - 1; si < selectionStack.length; si++) {
              if (si < 1) continue;
              if (si >= parentColors.length) break;
              const siblings = getDescendants(selectionStack[si - 1], s2.cellid.level(selectionStack[si]));
              renderCellLines(siblings, parentColors[si], parentPrimitives, parentWidths[si], false);
          }
          lastRenderedDepth = selectionStack.length + 1;

          // ─── 2. 현재 활성 레벨 (pillarPrimitives, 매번 갱신) ───
          const activeColor = Cesium.Color.LAWNGREEN.withAlpha(0.7);
          const activeWidth = 2.0;

          if (currentLevel >= 15) {
              // ─── 15레벨: 블록 → 4개 Mag 셀 ───
              var children16 = s2.cellid.children(lastCellId);
              var magColor = Cesium.Color.YELLOW.withAlpha(0.9);
              renderCellLines(children16, magColor, pillarPrimitives, 3.0, true);
              displayedCellCount = 4;
              gridTargetLevel = 16;

              // 블록(15레벨) 중심 좌표 + 샘플 데이터
              var blockCell = s2.Cell.fromCellID(lastCellId);
              var center15 = blockCell.center();
              var cr = Math.sqrt(center15.x ** 2 + center15.y ** 2 + center15.z ** 2);
              var cLon = Math.atan2(center15.y, center15.x);
              var cLat = Math.asin(center15.z / cr);
              var cLonDeg = Cesium.Math.toDegrees(cLon).toFixed(4);
              var cLatDeg = Cesium.Math.toDegrees(cLat).toFixed(4);
              var token = s2.cellid.toToken(lastCellId);

              var seed = parseInt(token.substring(0, 6), 16) || 0;
              var feo = (((seed * 7 + 13) % 100) / 10).toFixed(1);
              var tio2 = (((seed * 3 + 7) % 50) / 10).toFixed(1);
              var waterIce = (((seed * 11 + 3) % 30) / 10).toFixed(1);
              var tempK = 40 + ((seed * 17) % 260);
              var price = (0.5 + ((seed * 13) % 100) / 20).toFixed(2);
              var magTokens = children16.map(function(cid) { return s2.cellid.toToken(cid); });

              sendToRN('CELL_SELECTED', {
                  cellId: token, token: token,
                  lat: parseFloat(cLatDeg), lng: parseFloat(cLonDeg),
                  level: 15,
                  childLevel: 16,
                  unit: '1 Block = 4 Mag',
                  magCount: 4,
                  magTokens: magTokens,
                  minerals: {
                      feo: feo + '%',
                      tio2: tio2 + '%',
                      waterIce: waterIce + '%',
                      surfaceTemp: tempK + 'K'
                  },
                  price: '$' + price,
                  area: '~3.2 km²'
              });
          } else if (currentLevel > 0) {
              // ─── lv4~12: 선택 셀의 하위 그리드 ───
              var targetLevel;
              if (currentLevel === 12) {
                  targetLevel = 15;
              } else {
                  targetLevel = currentLevel + 4;
              }
              gridTargetLevel = targetLevel;
              let candidates = getDescendants(lastCellId, targetLevel);
              displayedCellCount = candidates.length;
              renderCellLines(candidates, activeColor, pillarPrimitives, activeWidth, true);
          }

          // 디버그 패널 업데이트
          var debugEl = document.getElementById('debugPanel');
          if (debugEl) {
              var pathStr = '0';
              var pathLevels = [0, 4, 8, 12, 15];
              for (var pi = 0; pi < selectionStack.length && pi < pathLevels.length; pi++) {
                  pathStr += ' → ' + s2.cellid.level(selectionStack[pi]);
              }
              debugEl.innerHTML =
                  '<b>Grid Debug (LINE)</b><br>' +
                  'Selection Level: ' + currentLevel + '<br>' +
                  'Showing Level: ' + gridTargetLevel + ' cells<br>' +
                  'Cell Count: ' + displayedCellCount + '<br>' +
                  'Stack Depth: ' + selectionStack.length + '<br>' +
                  'Path: ' + pathStr + '<br>' +
                  'Hierarchy: 0→4→8→12→15(Block)';
          }

          updateUI();
      }

      function flyToCell(targetCellId) {
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          const cell = s2.Cell.fromCellID(targetCellId);
          const center = cell.center();
          const r = Math.sqrt(center.x ** 2 + center.y ** 2 + center.z ** 2);
          const lon = Math.atan2(center.y, center.x), lat = Math.asin(center.z / r);
          const level = s2.cellid.level(targetCellId);

          let targetHeight;
          if (level === 0) targetHeight = 3500000;
          else if (level === 4) targetHeight = 600000;
          else if (level === 8) targetHeight = 40000;
          else if (level === 12) targetHeight = 12000;
          else if (level >= 15) {
            var cartographic = new Cesium.Cartographic(lon, lat);
            var surfaceHeight = viewer.scene.sampleHeight(cartographic);
            if (surfaceHeight !== undefined && surfaceHeight !== null) {
              targetHeight = surfaceHeight + 2000;
            } else {
              targetHeight = 4000;
            }
          }
          else targetHeight = 600000;

          const targetPosition = Cesium.Cartesian3.fromRadians(lon, lat, targetHeight, Cesium.Ellipsoid.MOON);
          const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
          const startHeading = viewer.camera.heading, startPitch = viewer.camera.pitch;
          const targetPitch = Cesium.Math.toRadians(-90);
          const duration = 1200;
          let startTime = null;

          function animate(timestamp) {
              if (!startTime) startTime = timestamp;
              const progress = (timestamp - startTime) / duration;
              if (progress >= 1.0) {
                  viewer.camera.setView({ destination: targetPosition, orientation: { heading: startHeading, pitch: targetPitch, roll: 0 } });
                  currentAnimFrame = null; return;
              }
              const t = 1 - Math.pow(1 - progress, 3);
              const currentPos = new Cesium.Cartesian3();
              Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);
              const currentPitch = Cesium.Math.lerp(startPitch, targetPitch, t);
              viewer.camera.setView({ destination: currentPos, orientation: { heading: startHeading, pitch: currentPitch, roll: 0 } });
              currentAnimFrame = requestAnimationFrame(animate);
          }
          currentAnimFrame = requestAnimationFrame(animate);
      }
`;
