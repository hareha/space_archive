// cesiumGrid.js — S2 그리드 렌더링 + 네비게이션 모듈
// 면(fill) / 선(line) 모드 완전 독립 분리
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

      // ═══ 프러스텀 + 백페이스 컬링 헬퍼 ═══

      // ═══ 디버그 수치 저장용 ═══
      var _perfStats = {
          filterCalls: 0, filterCandidates: 0, filterResults: 0, filterTimeMs: 0,
          getVisibleTimeMs: 0, getVisibleRecursions: 0,
          renderOneParentCalls: 0, renderOneParentTimeMs: 0,
          updateGridTimeMs: 0, geoInstanceCount: 0
      };
      function resetPerfStats() {
          _perfStats.filterCalls = 0; _perfStats.filterCandidates = 0;
          _perfStats.filterResults = 0; _perfStats.filterTimeMs = 0;
          _perfStats.getVisibleTimeMs = 0; _perfStats.getVisibleRecursions = 0;
          _perfStats.renderOneParentCalls = 0; _perfStats.renderOneParentTimeMs = 0;
          _perfStats.updateGridTimeMs = 0; _perfStats.geoInstanceCount = 0;
      }

      // 셀 ID 배열 → 화면에 보이는 셀만 필터
      function filterVisible(cellIds) {
          var t0 = performance.now();
          _perfStats.filterCalls++;
          _perfStats.filterCandidates += cellIds.length;

          var camPos = viewer.camera.positionWC;
          var camLen = Cesium.Cartesian3.magnitude(camPos);
          var camNorm = { x: camPos.x / camLen, y: camPos.y / camLen, z: camPos.z / camLen };
          var moonR = 1737400;
          var cosHorizon = moonR / camLen;

          var cullingVolume = viewer.camera.frustum.computeCullingVolume(
              camPos, viewer.camera.directionWC, viewer.camera.upWC
          );

          var result = cellIds.filter(function(id) {
              var cc = s2.Cell.fromCellID(id).center();
              var dot = cc.x * camNorm.x + cc.y * camNorm.y + cc.z * camNorm.z;
              // 카메라가 표면에 가까울수록 백페이스 컬링을 관대하게
              var altRatio = camLen / moonR; // 1.0 = 표면, 2.0 = 반지름 높이
              var backfaceFactor = (altRatio < 1.05) ? 0.3 : (altRatio < 1.5) ? 0.5 : 0.7;
              if (dot < cosHorizon * backfaceFactor) return false;
              var ccr = Math.sqrt(cc.x * cc.x + cc.y * cc.y + cc.z * cc.z);
              var cart = Cesium.Cartesian3.fromRadians(
                  Math.atan2(cc.y, cc.x), Math.asin(cc.z / ccr), 0, Cesium.Ellipsoid.MOON
              );
              var level = s2.cellid.level(id);
              var cellRadius = moonR * Math.sqrt(Math.PI / (6 * Math.pow(4, level)));
              var bs = new Cesium.BoundingSphere(cart, cellRadius * 2);
              return cullingVolume.computeVisibility(bs) !== Cesium.Intersect.OUTSIDE;
          });

          _perfStats.filterResults += result.length;
          _perfStats.filterTimeMs += performance.now() - t0;
          return result;
      }

      // 화면에 보이는 셀만 반환 (프러스텀+백페이스, MAX 안전장치)
      var MAX_VISIBLE = 9;


      function getVisibleCellsAtLevel(level) {
          _perfStats.getVisibleRecursions++;
          var t0 = performance.now();
          var result;
          if (level <= 4) {
              var all = [];
              for (var f = 0; f < 6; f++) all = all.concat(getDescendants(s2.cellid.fromFace(f), level));
              result = sortByCameraCenter(filterVisible(all)).slice(0, MAX_VISIBLE);
          } else {
              var parentVisible = getVisibleCellsAtLevel(level - 4);
              var children = [];
              parentVisible.forEach(function(pid) {
                  children = children.concat(getDescendants(pid, level));
              });
              result = sortByCameraCenter(filterVisible(children)).slice(0, MAX_VISIBLE);
          }
          _perfStats.getVisibleTimeMs += performance.now() - t0;
          return result;
      }

      // 화면 중앙(카메라 위치)에 가까운 셀 우선 정렬
      function sortByCameraCenter(cellIds) {
          var camPos = viewer.camera.positionWC;
          return cellIds.sort(function(a, b) {
              var ca = s2.Cell.fromCellID(a).center();
              var cb = s2.Cell.fromCellID(b).center();
              var dotA = ca.x * camPos.x + ca.y * camPos.y + ca.z * camPos.z;
              var dotB = cb.x * camPos.x + cb.y * camPos.y + cb.z * camPos.z;
              return dotB - dotA; // 높은 dot product = 카메라 위치에 가까운 셀 우선
          });
      }

      // ═══ 증분 업데이트 트래킹 ═══
      var _renderedCells = {}; // token → { parentPrims:[], childPrims:[], hitPrims:[] }

      function clearRenderedCells() {
          _renderedCells = {};
      }

      // 부모 셀 1개에 대한 프리미티브 생성 (parent outline + child grid + hitbox)
      function renderOneParent(pid, currentLevel, targetLevel, lineWidth, lastCellId) {
          var _ropT0 = performance.now();
          _perfStats.renderOneParentCalls++;
          var token = s2.cellid.toToken(pid);
          var entry = { parentPrims: [], childPrims: [], hitPrims: [] };
          var PARENT_COLOR = Cesium.Color.WHITE.withAlpha(0.25);
          var ACTIVE_COLOR = new Cesium.Color(0.15, 0.45, 0.95, 0.35);

          // 부모 아웃라인
          var pInst = buildOutlineInstances([pid], PARENT_COLOR, lastCellId, lineWidth);
          if (pInst.length > 0) {
              var pp = new Cesium.ClassificationPrimitive({
                  geometryInstances: pInst,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true
              });
              parentPrimitives.add(pp); entry.parentPrims.push(pp);
          }

          // 자식 그리드
          var children = getDescendants(pid, targetLevel);
          if (currentLevel === 12) {
              var THICK_COLOR = new Cesium.Color(0.15, 0.45, 0.95, 0.5);
              var THIN_COLOR = new Cesium.Color(0.15, 0.45, 0.95, 0.2);
              var l15 = getDescendants(pid, 15);
              var thickI = buildThickOutline(l15, lineWidth);
              if (thickI.length > 0) {
                  var tp = new Cesium.ClassificationPrimitive({
                      geometryInstances: thickI,
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true
                  });
                  pillarPrimitives.add(tp); entry.childPrims.push(tp);
              }
              var thinI = buildOutlineInstances(children, THIN_COLOR, null, lineWidth);
              // [최적화] 3레벨(12->16) 얇은 자식선 생략으로 버벅임 완충
              // 256개 ClassificationPrimitive 연산을 없앰
              if (false && thinI.length > 0) {
                  var tnp = new Cesium.ClassificationPrimitive({
                      geometryInstances: thinI,
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true
                  });
                  pillarPrimitives.add(tnp); entry.childPrims.push(tnp);
              }
          } else {
              var cI = buildOutlineInstances(children, ACTIVE_COLOR, null, lineWidth);
              if (cI.length > 0) {
                  var cp = new Cesium.ClassificationPrimitive({
                      geometryInstances: cI,
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true
                  });
                  pillarPrimitives.add(cp); entry.childPrims.push(cp);
              }
          }

          // 점유 셀
          if (typeof occupiedTokens !== 'undefined' && occupiedTokens.length > 0) {
              var OCC_COLOR = new Cesium.Color(0.9, 0.25, 0.15, 0.45);
              var occI = [];
              children.forEach(function(cid) {
                  if (occupiedTokens.indexOf(s2.cellid.toToken(cid)) === -1) return;
                  var oC = s2.Cell.fromCellID(cid), oP = [];
                  for (var i = 0; i < 4; i++) { var v = oC.vertex(i), vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                      oP.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x),Math.asin(v.z/vr),0,Cesium.Ellipsoid.MOON)); }
                  occI.push(new Cesium.GeometryInstance({ geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(oP), ellipsoid: Cesium.Ellipsoid.MOON,
                      height: -15000, extrudedHeight: 15000, granularity: Cesium.Math.toRadians(10) }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(OCC_COLOR) } }));
              });
              if (occI.length > 0) {
                  var op = new Cesium.ClassificationPrimitive({ geometryInstances: occI,
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true });
                  pillarPrimitives.add(op); entry.childPrims.push(op);
              }
          }

          // 히트박스
          var hitI = [];
          children.forEach(function(cid) {
              var hC = s2.Cell.fromCellID(cid), hP = [];
              for (var i = 0; i < 4; i++) { var v = hC.vertex(i), vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                  hP.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x),Math.asin(v.z/vr),0,Cesium.Ellipsoid.MOON)); }
              hitI.push(new Cesium.GeometryInstance({ geometry: new Cesium.PolygonGeometry({
                  polygonHierarchy: new Cesium.PolygonHierarchy(hP), ellipsoid: Cesium.Ellipsoid.MOON,
                  height: -15000, extrudedHeight: 15000, granularity: Cesium.Math.toRadians(10) }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                  id: cid }));
          });
          if (hitI.length > 0) {
              var hp = new Cesium.ClassificationPrimitive({ geometryInstances: hitI,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true });
              gridPrimitives.add(hp); entry.hitPrims.push(hp);
          }

          _renderedCells[token] = entry;
          _perfStats.renderOneParentTimeMs += performance.now() - _ropT0;
      }

      // occupiedTokens → 특정 레벨 부모별 점유 수 카운트 (모드1용)
      function buildOccupationMapM1(displayLevel) {
          var map = {};
          for (var oi = 0; oi < occupiedTokens.length; oi++) {
              try {
                  var ocId = s2.cellid.fromToken(occupiedTokens[oi]);
                  var parentId = s2.cellid.parent(ocId, displayLevel);
                  var parentToken = s2.cellid.toToken(parentId);
                  map[parentToken] = (map[parentToken] || 0) + 1;
              } catch(e) {}
          }
          return map;
      }
      // 부모 토큰별 점유 라벨/색상 추적 (증분 업데이트)
      var _occRendered = {}; // token → { entities:[], colorPrim:null }

      function clearOccForToken(token) {
          var entry = _occRendered[token];
          if (!entry) return;
          for (var i = 0; i < entry.entities.length; i++) {
              try { viewer.entities.remove(entry.entities[i]); } catch(e) {}
          }
          if (entry.colorPrim) {
              try { pillarPrimitives.remove(entry.colorPrim); } catch(e) {}
          }
          delete _occRendered[token];
      }

      function clearAllOccRendered() {
          Object.keys(_occRendered).forEach(function(t) { clearOccForToken(t); });
      }

      function renderOccForParent(parentCellId, targetLevel) {
          var token = s2.cellid.toToken(parentCellId);
          if (_occRendered[token]) return; // 이미 있으면 스킵
          var entry = { entities: [], colorPrim: null };
          var children = getDescendants(parentCellId, targetLevel);

          if (targetLevel < 16) {
              var occMap = buildOccupationMapM1(targetLevel);
              var levelDiff = 16 - targetLevel;
              var maxSubCells = Math.pow(4, levelDiff);
              var colorInstances = [];
              children.forEach(function(cid) {
                  var cnt = occMap[s2.cellid.toToken(cid)] || 0;
                  if (cnt > 0) {
                      var hc = s2.Cell.fromCellID(cid);
                      var center = hc.center();
                      var cr = Math.sqrt(center.x*center.x+center.y*center.y+center.z*center.z);
                      var labelPos = Cesium.Cartesian3.fromRadians(
                          Math.atan2(center.y, center.x), Math.asin(center.z / cr), 0, Cesium.Ellipsoid.MOON
                      );
                      entry.entities.push(viewer.entities.add({
                          position: labelPos,
                          label: {
                              text: cnt.toString(), font: 'bold 12px sans-serif',
                              fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
                              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                              horizontalOrigin: Cesium.HorizontalOrigin.CENTER, verticalOrigin: Cesium.VerticalOrigin.CENTER,
                              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                              disableDepthTestDistance: Number.POSITIVE_INFINITY,
                              scaleByDistance: new Cesium.NearFarScalar(5000, 1.0, 500000, 0.3),
                          }
                      }));
                      var ratio = Math.min(cnt / maxSubCells, 1.0);
                      var fillR = ratio < 0.5 ? ratio * 2 : 1.0;
                      var fillG = ratio < 0.5 ? 1.0 : 1.0 - (ratio - 0.5) * 2;
                      var fillColor = new Cesium.Color(fillR, fillG, 0.1, 0.15 + ratio * 0.15);
                      var cellObj = s2.Cell.fromCellID(cid); var cPos = [];
                      for (var vi = 0; vi < 4; vi++) {
                          var v = cellObj.vertex(vi); var vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                          cPos.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x), Math.asin(v.z/vr), 0, Cesium.Ellipsoid.MOON));
                      }
                      colorInstances.push(new Cesium.GeometryInstance({
                          geometry: new Cesium.PolygonGeometry({
                              polygonHierarchy: new Cesium.PolygonHierarchy(cPos), ellipsoid: Cesium.Ellipsoid.MOON,
                              height: -15000, extrudedHeight: 15000, granularity: Math.PI
                          }),
                          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor) }
                      }));
                  }
              });
              if (colorInstances.length > 0) {
                  entry.colorPrim = new Cesium.ClassificationPrimitive({
                      geometryInstances: colorInstances,
                      appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                      classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: true
                  });
                  pillarPrimitives.add(entry.colorPrim);
              }
          } else {
              children.forEach(function(cid) {
                  if (occupiedTokens.indexOf(s2.cellid.toToken(cid)) !== -1) {
                      var hc = s2.Cell.fromCellID(cid); var center = hc.center();
                      var cr = Math.sqrt(center.x*center.x+center.y*center.y+center.z*center.z);
                      var labelPos = Cesium.Cartesian3.fromRadians(
                          Math.atan2(center.y, center.x), Math.asin(center.z / cr), 0, Cesium.Ellipsoid.MOON
                      );
                      entry.entities.push(viewer.entities.add({
                          position: labelPos,
                          label: {
                              text: '✓', font: 'bold 10px sans-serif',
                              fillColor: new Cesium.Color(1, 0.3, 0.2, 0.9), outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
                              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                              horizontalOrigin: Cesium.HorizontalOrigin.CENTER, verticalOrigin: Cesium.VerticalOrigin.CENTER,
                              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                              disableDepthTestDistance: Number.POSITIVE_INFINITY,
                              scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.3),
                          }
                      }));
                  }
              });
          }
          _occRendered[token] = entry;
      }

      // 증분 업데이트: 기존 셀 유지 + 새 셀 추가 + 안 보이는 셀 제거
      function updateDynamicGrid() {
          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          if (!lastCellId) return;
          var currentLevel = s2.cellid.level(lastCellId);
          if (currentLevel === 0 || currentLevel >= 16) return;

          var parentLevel = currentLevel;
          var targetLevel = currentLevel + 4;
          var BASE_INSET = 0.90, MOON_R = 1737400;
          var activeLevel = targetLevel;
          var refEdge = MOON_R * Math.sqrt(Math.PI / (6 * Math.pow(4, activeLevel)));
          var lineWidth = (1 - BASE_INSET) * refEdge;

          var visibleParents = getVisibleCellsAtLevel(parentLevel);
          var newTokens = {};
          visibleParents.forEach(function(id) { newTokens[s2.cellid.toToken(id)] = id; });

          // 안 보이는 셀 제거
          var toRemove = [];
          Object.keys(_renderedCells).forEach(function(token) {
              if (!newTokens[token]) {
                  var e = _renderedCells[token];
                  e.parentPrims.forEach(function(p) { parentPrimitives.remove(p); });
                  e.childPrims.forEach(function(p) { pillarPrimitives.remove(p); });
                  e.hitPrims.forEach(function(p) { gridPrimitives.remove(p); });
                  toRemove.push(token);
              }
          });
          toRemove.forEach(function(t) { delete _renderedCells[t]; });

          // 새로 보이는 셀만 추가
          Object.keys(newTokens).forEach(function(token) {
              if (_renderedCells[token]) return;
              renderOneParent(newTokens[token], currentLevel, targetLevel, lineWidth, lastCellId);
          });

          // ═══ 점유 라벨/색상 증분 업데이트 ═══
          // 안 보이는 토큰의 라벨/색상 제거
          Object.keys(_occRendered).forEach(function(token) {
              if (!newTokens[token]) clearOccForToken(token);
          });
          // 새로 보이는 토큰만 라벨/색상 추가
          if (occupiedTokens.length > 0) {
              Object.keys(newTokens).forEach(function(token) {
                  if (!_occRendered[token]) renderOccForParent(newTokens[token], targetLevel);
              });
          }

          updateUI();
      }

      // ═══════════════════════════════════════════════════
      // render() — 그리드 렌더링 진입점 (클릭/줌 완료 시)
      // ═══════════════════════════════════════════════════
      function render(syncMode) {
          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          // 항상 parent outlines + hitboxes 클리어 (lv0 polyline 즉시 제거)
          parentPrimitives.removeAll();
          if (typeof gridPrimitives !== 'undefined') gridPrimitives.removeAll();
          // _renderedCells의 parent/hit 참조 무효화
          Object.keys(_renderedCells).forEach(function(token) {
              _renderedCells[token].parentPrims = [];
              _renderedCells[token].hitPrims = [];
          });

          if (typeof mainMode !== 'undefined' && mainMode === 'exploration') {
              if (typeof pillarPrimitives !== 'undefined') pillarPrimitives.removeAll();
              clearRenderedCells();
              clearAllOccRendered();
              return;
          }

          if (currentLevel === 0 || currentLevel >= 16) {
              if (typeof pillarPrimitives !== 'undefined') pillarPrimitives.removeAll();
              clearRenderedCells();
              renderLine(syncMode);
              return;
          }
          // 1~3단계: pillarPrimitives 유지 (자식 그리드 보이는 상태)
          // flyToCell 완료 후 onFlightDone이 증분 업데이트
          updateUI();
      }

      // ═══════════════════════════════════════════════════
      function renderLine(syncMode) {
          var useAsync = !syncMode;

          const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;

          // 0단계/16단계만 parentPrimitives 클리어 (1~3단계는 증분 업데이트가 관리)
          if (currentLevel === 0 || currentLevel >= 16) {
              parentPrimitives.removeAll();
          }
          var displayedCellCount = 0;
          var gridTargetLevel = currentLevel;

          // ═══ 0단계: Polyline으로 lv4 그리드 ═══
          if (currentLevel === 0) {
              let lv4Cells = [];
              for (let f = 0; f < 6; f++) lv4Cells.push(...getDescendants(s2.cellid.fromFace(f), 4));

              const ALT = 25000;
              const instances = [];
              const hitInstances = [];
              lv4Cells.forEach(id => {
                  const positions = getExactCellPositions(id, ALT, 8);
                  positions.push(positions[0]);

                  instances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolylineGeometry({ positions: positions, width: 0.3 }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.3)) }
                  }));

                  const cell = s2.Cell.fromCellID(id);
                  const hitPos = [];
                  for (let vi = 0; vi < 4; vi++) {
                      const v = cell.vertex(vi);
                      const vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                      hitPos.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON));
                  }
                  hitInstances.push(new Cesium.GeometryInstance({
                      geometry: new Cesium.PolygonGeometry({
                          polygonHierarchy: new Cesium.PolygonHierarchy(hitPos),
                          ellipsoid: Cesium.Ellipsoid.MOON, height: -15000, extrudedHeight: 15000,
                          granularity: Cesium.Math.toRadians(10)
                      }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE.withAlpha(0.01)) },
                      id: id
                  }));
              });

              parentPrimitives.add(new Cesium.Primitive({
                  geometryInstances: instances,
                  appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
                  asynchronous: false
              }));
              gridPrimitives.add(new Cesium.ClassificationPrimitive({
                  geometryInstances: hitInstances,
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                  asynchronous: false,
              }));

              displayedCellCount = lv4Cells.length;
              gridTargetLevel = 4;
              updateUI();
              return;
          }

          // ═══ 16단계: 단일 셀 면 채우기 ═══
          if (currentLevel >= 16) {
              var cell16 = s2.Cell.fromCellID(lastCellId);
              var pos16 = [];
              for (var vi = 0; vi < 4; vi++) { var v = cell16.vertex(vi), vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                  pos16.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x),Math.asin(v.z/vr),0,Cesium.Ellipsoid.MOON)); }
              pillarPrimitives.add(new Cesium.ClassificationPrimitive({
                  geometryInstances: new Cesium.GeometryInstance({ geometry: new Cesium.PolygonGeometry({
                      polygonHierarchy: new Cesium.PolygonHierarchy(pos16),
                      ellipsoid: Cesium.Ellipsoid.MOON, height: -15000, extrudedHeight: 15000,
                      granularity: Math.PI }),
                      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(0.15,0.45,0.95,0.45)) } }),
                  appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                  classificationType: Cesium.ClassificationType.CESIUM_3D_TILE, asynchronous: false }));
              displayedCellCount = 1;
              gridTargetLevel = 16;
              sendBlockData(lastCellId);
              updateUI();
              return;
          }

          // ═══ 1~3단계: 증분 업데이트 ═══
          updateDynamicGrid();
      }

      // 셀 아웃라인(ring) 인스턴스 배열 생성 (독립 함수)
      function buildOutlineInstances(cellIds, color, excludeId, lineWidth) {
          var instances = [];
          var exTk = excludeId ? s2.cellid.toToken(excludeId) : null;
          cellIds.forEach(function(id) {
              if (exTk && s2.cellid.toToken(id) === exTk) return;
              var cell = s2.Cell.fromCellID(id), cc = cell.center();
              var ccr = Math.sqrt(cc.x**2+cc.y**2+cc.z**2);
              var cCart = Cesium.Cartesian3.fromRadians(Math.atan2(cc.y,cc.x),Math.asin(cc.z/ccr),0,Cesium.Ellipsoid.MOON);
              var outer = [];
              for (var vi = 0; vi < 4; vi++) { var v = cell.vertex(vi), vr = Math.sqrt(v.x**2+v.y**2+v.z**2);
                  outer.push(Cesium.Cartesian3.fromRadians(Math.atan2(v.y,v.x),Math.asin(v.z/vr),0,Cesium.Ellipsoid.MOON)); }
              var edge = Cesium.Cartesian3.distance(outer[0], outer[1]);
              var inset = Math.max(0.5, 1 - lineWidth / edge);
              var inner = outer.map(function(vc) { return new Cesium.Cartesian3(
                  cCart.x+(vc.x-cCart.x)*inset, cCart.y+(vc.y-cCart.y)*inset, cCart.z+(vc.z-cCart.z)*inset); });
              instances.push(new Cesium.GeometryInstance({ geometry: new Cesium.PolygonGeometry({
                  polygonHierarchy: new Cesium.PolygonHierarchy(outer,[new Cesium.PolygonHierarchy(inner)]),
                  ellipsoid: Cesium.Ellipsoid.MOON, height: -15000, extrudedHeight: 15000,
                  granularity: Math.PI }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) } }));
          });
          return instances;
      }

      // L15 그룹 굵은 아웃라인 인스턴스 배열
      function buildThickOutline(groupCells, lineWidth) {
          var THICK_COLOR = new Cesium.Color(0.15, 0.45, 0.95, 0.5);
          var instances = [];
          groupCells.forEach(function(gid) {
              var gCell = s2.Cell.fromCellID(gid), gcc = gCell.center();
              var gccr = Math.sqrt(gcc.x**2+gcc.y**2+gcc.z**2);
              var gCenter = Cesium.Cartesian3.fromRadians(Math.atan2(gcc.y,gcc.x),Math.asin(gcc.z/gccr),0,Cesium.Ellipsoid.MOON);
              var gO = [];
              for (var vi = 0; vi < 4; vi++) { var vv = gCell.vertex(vi), vvr = Math.sqrt(vv.x**2+vv.y**2+vv.z**2);
                  gO.push(Cesium.Cartesian3.fromRadians(Math.atan2(vv.y,vv.x),Math.asin(vv.z/vvr),0,Cesium.Ellipsoid.MOON)); }
              var gEdge = Cesium.Cartesian3.distance(gO[0], gO[1]);
              var thickInset = Math.max(0.5, 1 - (lineWidth * 2) / gEdge);
              var gI = gO.map(function(vc) { return new Cesium.Cartesian3(
                  gCenter.x+(vc.x-gCenter.x)*thickInset, gCenter.y+(vc.y-gCenter.y)*thickInset, gCenter.z+(vc.z-gCenter.z)*thickInset); });
              instances.push(new Cesium.GeometryInstance({ geometry: new Cesium.PolygonGeometry({
                  polygonHierarchy: new Cesium.PolygonHierarchy(gO,[new Cesium.PolygonHierarchy(gI)]),
                  ellipsoid: Cesium.Ellipsoid.MOON, height: -15000, extrudedHeight: 15000,
                  granularity: Math.PI }),
                  attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(THICK_COLOR) } }));
          });
          return instances;
      }

      // ═══════════════════════════════════════════════════
      // 공통 헬퍼
      // ═══════════════════════════════════════════════════
      function sendBlockData(lastCellId) {
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
              price: '$' + price, area: '~0.8 km\u00B2'
          });
      }

      var _isFlying = false;
      var _isTransitioning = false;

      function flyToCell(targetCellId, onMidFlight) {
          if (currentAnimFrame) { cancelAnimationFrame(currentAnimFrame); currentAnimFrame = null; }
          _isFlying = true;
          // 부모 굵은선 즉시 제거 (줌인 시 자연스러운 전환)
          parentPrimitives.removeAll();
          Object.keys(_renderedCells).forEach(function(token) {
              _renderedCells[token].parentPrims = [];
          });
          const cell = s2.Cell.fromCellID(targetCellId);
          const center = cell.center();
          const r = Math.sqrt(center.x ** 2 + center.y ** 2 + center.z ** 2);
          const lon = Math.atan2(center.y, center.x), lat = Math.asin(center.z / r);
          const level = s2.cellid.level(targetCellId);

          var cartographic = new Cesium.Cartographic(lon, lat);
          var surfaceHeight = viewer.scene.sampleHeight(cartographic);
          if (surfaceHeight === undefined || surfaceHeight === null) surfaceHeight = 0;

          let baseHeight;
          if (level === 0) baseHeight = 3500000;
          else if (level <= 4) baseHeight = 250000;
          else if (level <= 8) baseHeight = 15000;
          else if (level <= 12) baseHeight = 1000;
          else if (level >= 16) baseHeight = 100;
          else baseHeight = 1500;

          const targetHeight = Math.max(baseHeight, surfaceHeight + baseHeight);
          var latOffset = (level >= 16) ? Cesium.Math.toRadians(0.00116) : 0;
          const targetPosition = Cesium.Cartesian3.fromRadians(lon, lat - latOffset, targetHeight, Cesium.Ellipsoid.MOON);
          const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
          const startHeading = viewer.camera.heading, startPitch = viewer.camera.pitch;
          const targetPitch = Cesium.Math.toRadians(-90);
          const duration = 1200;
          let startTime = null;
          let midFired = false;

          function onFlightDone() {
              _isFlying = false;
              _isTransitioning = true; // 전환 기간: 카메라 리스너 차단
              setTimeout(function() {
                  var oldCells = _renderedCells;
                  _renderedCells = {};
                  updateDynamicGrid(); // 새 그리드 추가 (async)
                  // 구 그리드 지연 제거 (새 그리드 GPU 컴파일 대기)
                  setTimeout(function() {
                      Object.keys(oldCells).forEach(function(token) {
                          if (_renderedCells[token]) return;
                          var e = oldCells[token];
                          e.parentPrims.forEach(function(p) { parentPrimitives.remove(p); });
                          e.childPrims.forEach(function(p) { pillarPrimitives.remove(p); });
                          e.hitPrims.forEach(function(p) { gridPrimitives.remove(p); });
                      });
                      _isTransitioning = false; // 전환 완료 → 카메라 리스너 허용
                  }, 800);
              }, 400);
          }

          function animate(timestamp) {
              if (!startTime) startTime = timestamp;
              const progress = (timestamp - startTime) / duration;
              if (!midFired && progress >= 0.3 && onMidFlight) { midFired = true; onMidFlight(); }
              if (progress >= 1.0) {
                  viewer.camera.setView({ destination: targetPosition, orientation: { heading: startHeading, pitch: targetPitch, roll: 0 } });
                  currentAnimFrame = null;
                  if (!midFired && onMidFlight) onMidFlight();
                  onFlightDone();
                  return;
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

      // ═══ 카메라 이동 시 배치 업데이트 (디바운스) ═══
      var _camDebounceTimer = null;
      // percentageChanged를 현재 줌 레벨에 맞게 동적 조정
      function updateCameraSensitivity(parentLevel) {
          var MOON_R = 1737400;
          var cellSize = MOON_R * Math.sqrt(Math.PI / (6 * Math.pow(4, parentLevel)));
          var camDist = Cesium.Cartesian3.magnitude(viewer.camera.positionWC);
          // 셀 크기의 10% 이동 시 발동 (민감하게)
          viewer.camera.percentageChanged = Math.max(0.0001, (cellSize / camDist) * 0.1);
      }
      viewer.camera.percentageChanged = 0.01; // 초기값
      viewer.camera.changed.addEventListener(function() {
          if (_isFlying || _isTransitioning) return;
          var lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
          var currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;
          if (currentLevel === 0 || currentLevel >= 16) return;
          if (_camDebounceTimer) clearTimeout(_camDebounceTimer);
          _camDebounceTimer = setTimeout(function() {
              _camDebounceTimer = null;
              updateCameraSensitivity(currentLevel);
              updateDynamicGrid();
          }, 80);
      });
`;
