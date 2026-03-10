// cesiumGridPL.js — Polyline 기반 그리드 렌더링 (점유모드2 전용)
// 기존 cesiumGrid.js와 독립적. gridMode === 'polyline' 일 때만 사용됨.

export const CESIUM_GRID_PL = `
      // ═══════════════════════════════════════════════════
      // Polyline Grid Renderer (cesiumGridPL.js)
      // ═══════════════════════════════════════════════════
      const PL_FIXED_HEIGHT = 10000;
      const plGridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());

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
          plGridPrimitives.removeAll();
          gridPrimitives.removeAll();
          parentPrimitives.removeAll();
          pillarPrimitives.removeAll();

          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          var lineInstances = [];
          var polyInstances = [];

          var gridColor = new Cesium.Color(0.4, 0.6, 1.0, 0.5);
          var thinColor = new Cesium.Color(0.5, 0.7, 1.0, 0.25);
          var thickColor = new Cesium.Color(0.9, 0.9, 0.9, 0.6);

          if (currentLevel >= 12) {
              // 3단계: selectLevel에 따른 굵은선/얇은선 분기
              var candidates16 = getDescendants(lastCellId, 16);

              if (selectLevel < 16) {
                  // 굵은선: selectLevel(14/15) 경계
                  var groupCells = getDescendants(lastCellId, selectLevel);
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
                      siblings = getDescendants(parentId, activeLevel);
                  } else {
                      for (var ff2 = 0; ff2 < 6; ff2++) {
                          siblings = siblings.concat(getDescendants(s2.cellid.fromFace(ff2), activeLevel));
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
                  for (var f = 0; f < 6; f++) candidates = candidates.concat(getDescendants(s2.cellid.fromFace(f), 4));
              } else {
                  candidates = getDescendants(lastCellId, targetLevel);
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
                          siblings = getDescendants(parentId, activeLevel);
                      } else {
                          // 최상위 — 6개 face 전체의 L4 셀
                          for (var ff = 0; ff < 6; ff++) {
                              siblings = siblings.concat(getDescendants(s2.cellid.fromFace(ff), activeLevel));
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
