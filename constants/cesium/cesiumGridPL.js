// cesiumGridPL.js — Polyline 기반 그리드 렌더링 (점유모드2 전용)
// 점유모드1과 완전 독립. mainMode === 'occupation2' 일 때만 사용됨.

export const CESIUM_GRID_PL = `
      // ═══════════════════════════════════════════════════
      // Polyline Grid Renderer (cesiumGridPL.js)
      // 점유모드2 전용 — 점유모드1과 완전 독립
      // ═══════════════════════════════════════════════════
      const PL_FIXED_HEIGHT = 10000;
      const plGridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());

      // ═══ PL 전용 유틸리티 함수 (독립 정의) ═══

      function getDescendantsPL(cellId, targetLevel) {
          var results = [cellId];
          var currentLevel = s2.cellid.level(cellId);
          while (currentLevel < targetLevel) {
              var nextResults = [];
              for (var i = 0; i < results.length; i++) {
                  var children = s2.cellid.children(results[i]);
                  for (var j = 0; j < children.length; j++) nextResults.push(children[j]);
              }
              results = nextResults;
              currentLevel++;
          }
          return results;
      }

      function sendBlockDataPL(lastCellId) {
          var blockCell = s2.Cell.fromCellID(lastCellId);
          var center16 = blockCell.center();
          var cr = Math.sqrt(center16.x ** 2 + center16.y ** 2 + center16.z ** 2);
          var cLon = Math.atan2(center16.y, center16.x);
          var cLat = Math.asin(center16.z / cr);
          var cLonDeg = Cesium.Math.toDegrees(cLon).toFixed(4);
          var cLatDeg = Cesium.Math.toDegrees(cLat).toFixed(4);
          var token = s2.cellid.toToken(lastCellId);
          var seed = parseInt(token.substring(0, 6), 16) || 0;
          var feo = (((seed * 7 + 13) % 100) / 10).toFixed(1);
          var tio2 = (((seed * 3 + 7) % 50) / 10).toFixed(1);
          var waterIce = (((seed * 11 + 3) % 30) / 10).toFixed(1);
          var tempK = 40 + ((seed * 17) % 260);
          var price = (0.5 + ((seed * 13) % 100) / 20).toFixed(2);
          sendToRN('CELL_SELECTED', {
              cellId: token, token: token,
              lat: parseFloat(cLatDeg), lng: parseFloat(cLonDeg),
              level: 16, childLevel: 16,
              unit: '1 Block = 1 Mag', magCount: 1, magTokens: [token],
              minerals: { feo: feo + '%', tio2: tio2 + '%', waterIce: waterIce + '%', surfaceTemp: tempK + 'K' },
              price: '\\$' + price, area: '~0.8 km\\u00B2'
          });
      }

      function getPLCellPositions(cellId, height, segments) {
          var cell = s2.Cell.fromCellID(cellId);
          var positions = [];
          for (var i = 0; i < 4; i++) {
              var p1 = cell.vertex(i);
              var p2 = cell.vertex((i + 1) % 4);
              for (var j = 0; j < segments; j++) {
                  var t = j / segments;
                  var dx = p1.x * (1 - t) + p2.x * t;
                  var dy = p1.y * (1 - t) + p2.y * t;
                  var dz = p1.z * (1 - t) + p2.z * t;
                  var mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  positions.push(Cesium.Cartesian3.fromRadians(
                      Math.atan2(dy / mag, dx / mag),
                      Math.asin(dz / mag),
                      height, Cesium.Ellipsoid.MOON
                  ));
              }
          }
          return positions;
      }

      function getPLRenderConfig(level) {
          return { segments: level <= 4 ? 8 : (level <= 8 ? 4 : 1) };
      }

      function renderPolyline() {
          // PL 전용 primitives만 클리어 (모드1 primitives 건드리지 않음)
          plGridPrimitives.removeAll();

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          var lineInstances = [];
          var polyInstances = [];

          var gridColor = new Cesium.Color(0.4, 0.6, 1.0, 0.5);
          var thinColor = new Cesium.Color(0.5, 0.7, 1.0, 0.25);
          var thickColor = new Cesium.Color(0.9, 0.9, 0.9, 0.6);

          if (currentLevel >= 12) {
              // 3단계: selectLevel에 따른 굵은선/얇은선 분기
              var candidates16 = getDescendantsPL(lastCellId, 16);

              if (selectLevel < 16) {
                  // 굵은선: selectLevel(14/15) 경계
                  var groupCells = getDescendantsPL(lastCellId, selectLevel);
                  groupCells.forEach(function(gid) {
                      var gPos = getPLCellPositions(gid, PL_FIXED_HEIGHT, 1);
                      lineInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({
                              positions: gPos.concat([gPos[0]]),
                              width: 3.0, arcType: Cesium.ArcType.NONE
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(thickColor) }
                      }));
                  });

                  // 얇은선: 16레벨 셀
                  candidates16.forEach(function(cid) {
                      var cPos = getPLCellPositions(cid, PL_FIXED_HEIGHT, 1);
                      lineInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({
                              positions: cPos.concat([cPos[0]]),
                              width: 1.0, arcType: Cesium.ArcType.NONE
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(thinColor) }
                      }));
                  });
              } else {
                  // 1칸 모드: 일반 그리드
                  candidates16.forEach(function(cid) {
                      var cPos = getPLCellPositions(cid, PL_FIXED_HEIGHT, 1);
                      lineInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({
                              positions: cPos.concat([cPos[0]]),
                              width: 1.5, arcType: Cesium.ArcType.NONE
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(gridColor) }
                      }));
                  });
              }

              // 히트테스트용 투명 Polygon (클릭 영역)
              candidates16.forEach(function(cid) {
                  var cell = s2.Cell.fromCellID(cid);
                  var polyPos = [];
                  for (var i = 0; i < 4; i++) {
                      var v = cell.vertex(i);
                      var vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      polyPos.push(Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr),
                          PL_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
                      ));
                  }
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                          polygonHierarchy: new Cesium.PolygonHierarchy(polyPos),
                          ellipsoid: Cesium.Ellipsoid.MOON,
                          height: PL_FIXED_HEIGHT,
                          granularity: Cesium.Math.toRadians(5.0)
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                      id: cid
                  }));
              });

              // 점유 셀 하이라이팅 (공중 폴리곤)
              if (typeof occupiedTokens !== 'undefined' && occupiedTokens.length > 0) {
                  candidates16.forEach(function(cid) {
                      if (occupiedTokens.indexOf(s2.cellid.toToken(cid)) !== -1) {
                          var oCell = s2.Cell.fromCellID(cid);
                          var oPos = [];
                          for (var oi = 0; oi < 4; oi++) {
                              var ov = oCell.vertex(oi);
                              var ovr = Math.sqrt(ov.x ** 2 + ov.y ** 2 + ov.z ** 2);
                              oPos.push(Cesium.Cartesian3.fromRadians(
                                  Math.atan2(ov.y, ov.x), Math.asin(ov.z / ovr),
                                  PL_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
                              ));
                          }
                          polyInstances.push(new Cesium.GeometryInstance({
                              geometry: new Cesium.PolygonGeometry({
                                  polygonHierarchy: new Cesium.PolygonHierarchy(oPos),
                                  ellipsoid: Cesium.Ellipsoid.MOON,
                                  height: PL_FIXED_HEIGHT,
                              }),
                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                  new Cesium.Color(0.9, 0.2, 0.15, 0.55)
                              )}
                          }));
                      }
                  });
              }

              // 3단계에서도 부모 레이어 그리드 (활성 셀 제외한 형제들)
              for (var si = selectionStack.length - 1; si >= 0; si--) {
                  var activeId = selectionStack[si];
                  var activeLevel = s2.cellid.level(activeId);
                  var activeToken = s2.cellid.toToken(activeId);
                  var parentId = (si > 0) ? selectionStack[si - 1] : null;
                  var siblings = [];
                  if (parentId) {
                      siblings = getDescendantsPL(parentId, activeLevel);
                  } else {
                      for (var ff2 = 0; ff2 < 6; ff2++) {
                          siblings = siblings.concat(getDescendantsPL(s2.cellid.fromFace(ff2), activeLevel));
                      }
                  }
                  var parentAlpha = 0.12 - (selectionStack.length - 1 - si) * 0.03;
                  if (parentAlpha < 0.03) parentAlpha = 0.03;
                  var parentColor = Cesium.Color.WHITE.withAlpha(parentAlpha);
                  var sConf = getPLRenderConfig(activeLevel);
                  siblings.forEach(function(sib) {
                      if (s2.cellid.toToken(sib) === activeToken) return;
                      var sPos = getPLCellPositions(sib, PL_FIXED_HEIGHT, sConf.segments);
                      lineInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolylineGeometry({
                              positions: sPos.concat([sPos[0]]),
                              width: 1.0, arcType: Cesium.ArcType.NONE
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(parentColor) }
                      }));
                  });
              }
          } else {
              // 0~2단계: 하위 그리드 렌더링
              var targetLevel = currentLevel + 4;
              var candidates = [];
              if (currentLevel === 0) {
                  for (var f = 0; f < 6; f++) candidates = candidates.concat(getDescendantsPL(s2.cellid.fromFace(f), 4));
              } else {
                  candidates = getDescendantsPL(lastCellId, targetLevel);
              }

              var config = getPLRenderConfig(targetLevel);
              var lineColor = (currentLevel === 0) ? Cesium.Color.WHITE.withAlpha(0.35) : gridColor;
              candidates.forEach(function(id) {
                  var linePos = getPLCellPositions(id, PL_FIXED_HEIGHT, config.segments);
                  lineInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({
                          positions: linePos.concat([linePos[0]]),
                          width: 1.0, arcType: Cesium.ArcType.NONE
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(lineColor) }
                  }));

                  // 히트테스트용 투명 Polygon
                  var cell = s2.Cell.fromCellID(id);
                  var polyPos = [];
                  for (var i = 0; i < 4; i++) {
                      var v = cell.vertex(i);
                      var vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      polyPos.push(Cesium.Cartesian3.fromRadians(
                          Math.atan2(v.y, v.x), Math.asin(v.z / vr),
                          PL_FIXED_HEIGHT, Cesium.Ellipsoid.MOON
                      ));
                  }
                  polyInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                          polygonHierarchy: new Cesium.PolygonHierarchy(polyPos),
                          ellipsoid: Cesium.Ellipsoid.MOON,
                          height: PL_FIXED_HEIGHT,
                          granularity: Cesium.Math.toRadians(5.0)
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                      id: id
                  }));
              });

              // 부모 레이어 그리드 (활성 셀 제외한 형제 셀들)
              if (currentLevel > 0) {
                  for (var si = selectionStack.length - 1; si >= 0; si--) {
                      var activeId = selectionStack[si];
                      var activeLevel = s2.cellid.level(activeId);
                      var activeToken = s2.cellid.toToken(activeId);
                      // 이 셀의 부모에서 형제들 구하기
                      var parentId = (si > 0) ? selectionStack[si - 1] : null;
                      var siblings = [];
                      if (parentId) {
                          siblings = getDescendantsPL(parentId, activeLevel);
                      } else {
                          // 최상위 — 6개 face 전체의 L4 셀
                          for (var ff = 0; ff < 6; ff++) {
                              siblings = siblings.concat(getDescendantsPL(s2.cellid.fromFace(ff), activeLevel));
                          }
                      }
                      var parentAlpha = 0.15 - (selectionStack.length - 1 - si) * 0.04;
                      if (parentAlpha < 0.04) parentAlpha = 0.04;
                      var parentColor = Cesium.Color.WHITE.withAlpha(parentAlpha);
                      var sConf = getPLRenderConfig(activeLevel);
                      siblings.forEach(function(sib) {
                          // 활성 셀은 건너뜀 (겹침 방지)
                          if (s2.cellid.toToken(sib) === activeToken) return;
                          var sPos = getPLCellPositions(sib, PL_FIXED_HEIGHT, sConf.segments);
                          lineInstances.push(new Cesium.GeometryInstance({
                              geometry: new Cesium.PolylineGeometry({
                                  positions: sPos.concat([sPos[0]]),
                                  width: 1.0, arcType: Cesium.ArcType.NONE
                              }),
                              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(parentColor) }
                          }));
                      });
                  }
              }
          }

          // 렌더
          if (lineInstances.length > 0) {
              plGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: lineInstances,
                  appearance: new Cesium.PolylineColorAppearance({ flat: true }),
                  asynchronous: true
              }));
          }
          if (polyInstances.length > 0) {
              plGridPrimitives.add(new Cesium.Primitive({
                  geometryInstances: polyInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  asynchronous: true
              }));
          }

          updateUI();
      }
`;
