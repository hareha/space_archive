// cesiumGrid.js — S2 그리드 렌더링 + 네비게이션 모듈
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
          const polyPositions = [];
          for (let i = 0; i < 4; i++) {
              const v = cell.vertex(i); const r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
              polyPositions.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y, v.x), Math.asin(v.z / r), 0, Cesium.Ellipsoid.MOON));
          }
          const instanceId = "flash-" + s2.cellid.toToken(cellId);
          const primitive = flashPrimitives.add(new Cesium.Primitive({
              geometryInstances: new Cesium.GeometryInstance({
                  geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(polyPositions),
                      ellipsoid: Cesium.Ellipsoid.MOON, height: FIXED_HEIGHT + 20,
                      granularity: Cesium.Math.toRadians(1.0)
                  }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.6)) },
                  id: instanceId
              }),
              appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }), asynchronous: false
          }));
          let alpha = 0.6;
          const fade = () => {
              if (flashPrimitives.length === 0) return;
              alpha -= 0.05;
              if (alpha <= 0) { flashPrimitives.removeAll(); return; }
              const attr = primitive.getGeometryInstanceAttributes(instanceId);
              if (attr) attr.color = Cesium.ColorGeometryInstanceAttribute.toValue(Cesium.Color.WHITE.withAlpha(alpha));
              requestAnimationFrame(fade);
          };
          fade();
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
          pillarPrimitives.removeAll();
          const lineInstances = [];
          const polyInstances = [];
          const surfaceClassInstances = [];
          const color = Cesium.Color.LAWNGREEN.withAlpha(0.6);

          const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          // 15레벨에 도달했으면 4개의 16레벨 자식 셀로 달 표면 하이라이팅
          // 1 Block (15레벨 셀) = 4 Mag (16레벨 셀 4개)
          var displayedCellCount = 0;
          var gridTargetLevel = currentLevel;

          if (currentLevel >= 15) {
              // ─── 15레벨: 블록 → 4개 Mag 셀 inset 표시 (최종 선택) ───
              var children16 = s2.cellid.children(lastCellId);
              var magColor = Cesium.Color.YELLOW.withAlpha(0.45);
              var INSET = 0.95;

              for (var ci = 0; ci < children16.length; ci++) {
                  var child16 = s2.Cell.fromCellID(children16[ci]);
                  var cc = child16.center();
                  var ccr = Math.sqrt(cc.x ** 2 + cc.y ** 2 + cc.z ** 2);
                  var centerCart = Cesium.Cartesian3.fromRadians(
                      Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
                  );

                  var surfPos16 = [];
                  for (var vi = 0; vi < 4; vi++) {
                      var v = child16.vertex(vi);
                      var vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      var vertCart = Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                      );
                      surfPos16.push(new Cesium.Cartesian3(
                          centerCart.x + (vertCart.x - centerCart.x) * INSET,
                          centerCart.y + (vertCart.y - centerCart.y) * INSET,
                          centerCart.z + (vertCart.z - centerCart.z) * INSET
                      ));
                  }
                  pillarPrimitives.add(new Cesium.ClassificationPrimitive({
                      geometryInstances: new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(surfPos16),
                              ellipsoid: Cesium.Ellipsoid.MOON,
                              height: -15000, extrudedHeight: 15000,
                          }),
                          attributes: {
                              color: Cesium.ColorGeometryInstanceAttribute.fromColor(magColor)
                          }
                      }),
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                      asynchronous: true
                  }));
              }
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
          } else {
              // 아직 15레벨 미만이면 하위 그리드 렌더링
              var targetLevel;
              if (currentLevel === 12) {
                  targetLevel = 15; // 12→15 (3단계, 64셀)
              } else {
                  targetLevel = currentLevel + 4;
              }
              gridTargetLevel = targetLevel;
              let candidates = [];
              if (currentLevel === 0) {
                  for (let f = 0; f < 6; f++) candidates.push(...getDescendants(s2.cellid.fromFace(f), 4));
              } else {
                  candidates = getDescendants(lastCellId, targetLevel);
              }
              displayedCellCount = candidates.length;

              const config = getRenderConfig(targetLevel);
              candidates.forEach(id => {
                  const linePos = getExactCellPositions(id, FIXED_HEIGHT, config.segments);
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({
                          positions: [...linePos, linePos[0]],
                          width: 1.0, arcType: Cesium.ArcType.NONE
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) }
                  }));

                  const cell = s2.Cell.fromCellID(id);
                  const polyPositions = [];
                  for (let i = 0; i < 4; i++) {
                      const v = cell.vertex(i); const r = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      polyPositions.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y, v.x), Math.asin(v.z / r), 0, Cesium.Ellipsoid.MOON));
                  }
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                          polygonHierarchy: new Cesium.PolygonHierarchy(polyPositions),
                          ellipsoid: Cesium.Ellipsoid.MOON, height: FIXED_HEIGHT,
                          granularity: Cesium.Math.toRadians(5.0)
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                      id: id
                  }));
              });
          }

          if (lineInstances.length > 0) {
              gridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({ flat: true }),
                  asynchronous: true
              }));
          }

          if (polyInstances.length > 0) {
              gridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  asynchronous: true
              }));
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
                  '<b>Grid Debug</b><br>' +
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
