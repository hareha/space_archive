// cesiumControls.js — 클릭 핸들러 + 줌 + RN 메시지 라우팅 모듈
// handleRNMessage, 클릭 핸들러, changeZoomLevel

export const CESIUM_CONTROLS = `
var selectLevel = 16; // 14, 15, 16 중 선택 레벨
var occupiedTokens = []; // 점유된 셀 토큰 목록 (휘발성)

function handleRNMessage(data) {
    try {
        let message = data;
        if (typeof data === 'string') {
            try {
                message = JSON.parse(data);
            } catch(e) {
                console.error("Failed to parse RN message:", data);
                return;
            }
        }
        if (!message || !message.type) return;
        if (message.type === 'GO_BACK') goBack();
        if (message.type === 'RESET') resetExplorer();
        if (message.type === 'TOGGLE_GRID') {
            showGrid = message.payload;
            if (gridPrimitives) gridPrimitives.show = showGrid;
        }
        if (message.type === 'UPDATE_GRID_VISIBILITY') {
            updateGridVisibility(message.visible);
        }
        if (message.type === 'FIRST_PERSON_MOVE') {
            const { direction, isPressed } = message.payload;
            firstPersonData[direction] = isPressed;
        }
        if (message.type === 'LOAD_SATELLITE_DATA') {
            drawSatelliteData(message.data);
        }
        if (message.type === 'UPDATE_MODE') {
            updateAppMode(message.payload);
        }
        if (message.type === 'CHANGE_GRID_COLOR') {
            if (mainMode !== 'occupation2' && mainMode !== 'occupation3') render();
        }
        if (message.type === 'ZOOM_IN') {
            // 점유모드 전용: 레벨 기반 단계 줌
            changeZoomLevel(1);
        }
        if (message.type === 'ZOOM_OUT') {
            // 점유모드 전용: 레벨 기반 단계 줌
            changeZoomLevel(-1);
        }
        if (message.type === 'EXPLORE_ZOOM_IN') {
            // 탐사모드 전용: 절대값 줌인 (레벨 무관)
            changeZoomLevel(1);
        }
        if (message.type === 'EXPLORE_ZOOM_OUT') {
            // 탐사모드 전용: 절대값 줌아웃 (레벨 무관)
            changeZoomLevel(-1);
        }
        if (message.type === 'SET_SELECT_LEVEL') {
            selectLevel = message.payload.level || 16;
            // 이미 3단계(16레벨 표시)면 re-render
            var _lastId = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : null;
            if (_lastId && s2.cellid.level(_lastId) >= 12) {
                if (mainMode === 'occupation3') {
                    renderTerrain();
                } else if (mainMode === 'occupation2') {
                    renderPolyline();
                } else {
                    render();
                }
            }
        }
        if (message.type === 'DESELECT_CELL') {
            // 셀 선택만 해제, selectionStack 유지 → 격자 재렌더 + 카메라 복귀
            if (mainMode === 'occupation3') {
                renderTerrain();
                if (selectionStack.length > 0) {
                    flyToCellTR(selectionStack[selectionStack.length - 1]);
                }
            } else if (mainMode === 'occupation2') {
                renderPolyline();
                if (selectionStack.length > 0) {
                    flyToCellPL(selectionStack[selectionStack.length - 1]);
                }
            } else {
                render();
                if (selectionStack.length > 0) {
                    flyToCell(selectionStack[selectionStack.length - 1]);
                }
            }
        }
        if (message.type === 'OCCUPY_CELLS') {
            // 점유 확정: 토큰을 L16으로 전개하여 저장
            var tokens = message.payload.tokens || [];
            var lvl = message.payload.level || 16;
            tokens.forEach(function(t) {
                var cid = s2.cellid.fromToken(t);
                if (lvl < 16) {
                    var desc;
                    if (mainMode === 'occupation3') desc = getDescendantsTR(cid, 16);
                    else if (mainMode === 'occupation2') desc = getDescendantsPL(cid, 16);
                    else desc = getDescendants(cid, 16);
                    desc.forEach(function(d) {
                        var dt = s2.cellid.toToken(d);
                        if (occupiedTokens.indexOf(dt) === -1) occupiedTokens.push(dt);
                    });
                } else {
                    if (occupiedTokens.indexOf(t) === -1) occupiedTokens.push(t);
                }
            });
            window.multiSelectedL16 = [];
            if (mainMode === 'occupation3') {
                renderTerrain();
            } else if (mainMode === 'occupation2') {
                renderPolyline();
            } else {
                render();
            }
        }
        if (message.type === 'UPDATE_MAG_BALANCE') {
            window.magBalance = message.payload.balance || 0;
        }
        if (message.type === 'RESET_VIEW') {
            // 위성/착륙지 포커스 해제
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            if (_focusSatPos) {
                _focusSatPos = null;
                _focusSatLookTarget = null;
            }
            // pitch clamp 리스너 해제
            if (window._fpPitchClamp) { window._fpPitchClamp(); window._fpPitchClamp = null; }
            window._fpLookTarget = null;
            window._fpAboveAlt = null;
            // 3D 깃발 제거
            if (window._fpFlagEntities) {
                window._fpFlagEntities.forEach(function(e) { viewer.entities.remove(e); });
                window._fpFlagEntities = null;
            }
            // 컨트롤러 기본값 복원
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            viewer.scene.screenSpaceCameraController.enableTranslate = true;
            viewer.scene.screenSpaceCameraController.enableZoom = true;
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.scene.screenSpaceCameraController.enableLook = true;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1;
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = Infinity;
            resetExplorer();
        }
        if (message.type === 'GO_TO_LOCATION') {
            const { lat, lng } = message.payload;
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);

            // 패널이 하단 50%를 차지 → 지점이 상단 50% 중앙에 오도록
            const altitude = 150000;
            var latOffset = Cesium.Math.toRadians(7.0); // 7도 남쪽 offset
            var camLatRad = latRad - latOffset;
            var pitchDeg = -55; // 비스듬하게 (지점이 화면 상단에 보이도록)

            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(lngRad, camLatRad, altitude, Cesium.Ellipsoid.MOON),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(pitchDeg),
                    roll: 0
                },
                duration: 2.0
            });
        }
        // 특정 좌표에서 공중뷰 (lerp 기반 매끄러운 전환, 바운스 없음)
        if (message.type === 'FIRST_PERSON_AT') {
            const { lat, lng } = message.payload;
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);

            const aboveAlt = 20000;

            var terrainProvider = viewer.terrainProvider;
            var carto = new Cesium.Cartographic(lngRad, latRad, 0);

            function doFlyToSurface(terrainHeight) {
                var safeHeight = (terrainHeight && !isNaN(terrainHeight)) ? Math.max(0, terrainHeight) : 0;
                var lookTarget = Cesium.Cartesian3.fromRadians(lngRad, latRad, safeHeight, Cesium.Ellipsoid.MOON);
                var viewPitch = -60;
                var viewPitchRad = Cesium.Math.toRadians(viewPitch);

                // 기존 깃발 제거
                if (window._fpFlagEntities) {
                    window._fpFlagEntities.forEach(function(e) { viewer.entities.remove(e); });
                }
                window._fpFlagEntities = [];

                // lookAt이 카메라를 배치할 위치 계산
                var horizDist = aboveAlt * Math.cos(Math.abs(viewPitchRad));
                var vertDist = aboveAlt * Math.sin(Math.abs(viewPitchRad));
                var latOffsetRad = horizDist / 1737400;
                var camLat = latRad - latOffsetRad;
                var camAlt = safeHeight + vertDist;

                // 카메라 현재 위치를 달 타원체 기준 Cartographic으로 변환
                // (positionCartographic는 scene 기본 타원체(WGS84)를 쓸 수 있어 오류 발생)
                var startCarto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC, Cesium.Ellipsoid.MOON);
                if (!startCarto) {
                    // fallback
                    startCarto = new Cesium.Cartographic(lngRad, latRad, 150000);
                }
                var targetLon = lngRad;
                var targetLat = camLat;
                var targetAlt = camAlt;
                var startHeading = viewer.camera.heading;
                var startPitch = viewer.camera.pitch;
                var targetPitchVal = viewPitchRad;
                var duration = 1500;
                var startTime = null;

                if (window._fpAnimFrame) { cancelAnimationFrame(window._fpAnimFrame); window._fpAnimFrame = null; }

                function onArrival() {
                    viewer.camera.lookAt(
                        lookTarget,
                        new Cesium.HeadingPitchRange(0, viewPitchRad, aboveAlt)
                    );

                    // ── 위치 마커 생성 ──
                    var pinCanvas = document.createElement('canvas');
                    pinCanvas.width = 48;
                    pinCanvas.height = 120;
                    var ctx = pinCanvas.getContext('2d');
                    var cx = 24;

                    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cx, 30);
                    ctx.lineTo(cx, 110);
                    ctx.stroke();

                    var glow = ctx.createRadialGradient(cx, 112, 0, cx, 112, 8);
                    glow.addColorStop(0, 'rgba(96, 165, 250, 0.8)');
                    glow.addColorStop(1, 'rgba(96, 165, 250, 0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(cx, 112, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#60A5FA';
                    ctx.beginPath();
                    ctx.arc(cx, 112, 3, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.save();
                    ctx.translate(cx, 16);
                    ctx.rotate(Math.PI / 4);
                    ctx.shadowColor = '#60A5FA';
                    ctx.shadowBlur = 8;
                    ctx.fillStyle = '#1E3A5F';
                    ctx.fillRect(-9, -9, 18, 18);
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#60A5FA';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(-9, -9, 18, 18);
                    ctx.fillStyle = '#60A5FA';
                    ctx.fillRect(-4, -4, 8, 8);
                    ctx.restore();

                    var pinImg = pinCanvas.toDataURL();
                    var pinBillboard = viewer.entities.add({
                        position: Cesium.Cartesian3.fromRadians(lngRad, latRad, 0, Cesium.Ellipsoid.MOON),
                        billboard: {
                            image: pinImg,
                            scale: 0.7,
                            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                            disableDepthTestDistance: 1500000,
                            scaleByDistance: new Cesium.NearFarScalar(1000, 1.2, 30000, 0.6),
                        },
                        show: true,
                    });
                    window._fpFlagEntities.push(pinBillboard);

                    viewer.scene.screenSpaceCameraController.enableRotate = true;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = true;
                    viewer.scene.screenSpaceCameraController.enableTilt = true;
                    viewer.scene.screenSpaceCameraController.enableLook = false;
                    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;
                    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 100000;

                    if (window._fpPitchClamp) { window._fpPitchClamp(); window._fpPitchClamp = null; }
                    window._fpLookTarget = lookTarget;
                    window._fpAboveAlt = aboveAlt;
                    window._fpPitchClamp = viewer.scene.preUpdate.addEventListener(function() {
                        var targetPos = window._fpLookTarget;
                        if (!targetPos) return;
                        var targetCarto = Cesium.Cartographic.fromCartesian(targetPos, Cesium.Ellipsoid.MOON);
                        var camCarto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC, Cesium.Ellipsoid.MOON);
                        if (camCarto && targetCarto && camCarto.height < targetCarto.height + 200) {
                            viewer.camera.lookAt(
                                targetPos,
                                new Cesium.HeadingPitchRange(
                                    viewer.camera.heading,
                                    Cesium.Math.toRadians(-5),
                                    window._fpAboveAlt
                                )
                            );
                        }
                    });

                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FIRST_PERSON_READY' }));
                }

                // Cartographic 보간 (달 표면을 따라 이동)
                var dLon = targetLon - startCarto.longitude;
                if (dLon > Math.PI) dLon -= 2 * Math.PI;
                if (dLon < -Math.PI) dLon += 2 * Math.PI;
                var dLat = targetLat - startCarto.latitude;
                var dAlt = targetAlt - startCarto.height;
                var minAlt = safeHeight + 500; // 지형 위 최소 500m (관통 방지)

                // heading 최단 경로 보정 (2π 전체 회전 방지)
                var dHeading = 0 - startHeading; // target heading = 0
                if (dHeading > Math.PI) dHeading -= 2 * Math.PI;
                if (dHeading < -Math.PI) dHeading += 2 * Math.PI;

                function animate(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = (timestamp - startTime) / duration;
                    if (progress >= 1.0) {
                        var finalPos = Cesium.Cartesian3.fromRadians(targetLon, targetLat, targetAlt, Cesium.Ellipsoid.MOON);
                        viewer.camera.setView({
                            destination: finalPos,
                            orientation: { heading: 0, pitch: targetPitchVal, roll: 0 }
                        });
                        window._fpAnimFrame = null;
                        onArrival();
                        return;
                    }
                    // easeOutCubic
                    var t = 1 - Math.pow(1 - progress, 3);
                    var curLon = startCarto.longitude + dLon * t;
                    var curLat = startCarto.latitude + dLat * t;
                    var curAlt = Math.max(minAlt, startCarto.height + dAlt * t);
                    var currentPos = Cesium.Cartesian3.fromRadians(curLon, curLat, curAlt, Cesium.Ellipsoid.MOON);
                    var currentPitch = startPitch + (targetPitchVal - startPitch) * t;
                    var currentHeading = startHeading + dHeading * t;
                    viewer.camera.setView({
                        destination: currentPos,
                        orientation: { heading: currentHeading, pitch: currentPitch, roll: 0 }
                    });
                    window._fpAnimFrame = requestAnimationFrame(animate);
                }
                window._fpAnimFrame = requestAnimationFrame(animate);
            }

            // 지형 높이 측정 시도
            if (terrainProvider && typeof Cesium.sampleTerrainMostDetailed === 'function') {
                Cesium.sampleTerrainMostDetailed(terrainProvider, [carto]).then(function(updatedPositions) {
                    doFlyToSurface(updatedPositions[0].height);
                }).catch(function() {
                    var h = viewer.scene.globe.getHeight(carto);
                    doFlyToSurface(h);
                });
            } else {
                var h = viewer.scene.globe.getHeight(carto);
                doFlyToSurface(h);
            }
        }
        if (message.type === 'FOCUS_SATELLITE') {
            // 위성 전용: lookAt으로 위성 중심 카메라 고정 (줌 자유롭게 가능)
            var satName = message.payload.name;
            highlightSatellite(satName);

            // 기존 lookAt 잠금 해제
            if (_focusSatPos) {
                viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            }

            // 기존 trackedEntity 정리
            if (viewer.trackedEntity) {
                var wasTemp = viewer.trackedEntity._isTempTrack;
                var tempEnt = viewer.trackedEntity;
                viewer.trackedEntity = undefined;
                if (wasTemp) viewer.entities.remove(tempEnt);
            }

            // 위성 위치 찾기
            var satPos = null;
            if (lastSatellitesData) {
                for (var fi = 0; fi < lastSatellitesData.length; fi++) {
                    if (lastSatellitesData[fi].name === satName && lastSatellitesData[fi].position) {
                        var sp = lastSatellitesData[fi].position;
                        satPos = new Cesium.Cartesian3(sp.x * 1000, sp.y * 1000, sp.z * 1000);
                        break;
                    }
                }
            }

            if (satPos) {
                // 위성 위치 저장 + 초기 거리
                _focusSatPos = satPos;
                _focusSatRange = 1200;

                // lookAt 타겟을 위성에서 달 중심 방향으로 오프셋 (위성이 화면 상단에 보이도록)
                var dirToCenter = Cesium.Cartesian3.normalize(
                    Cesium.Cartesian3.negate(satPos, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                var shiftAmount = _focusSatRange * 0.4;
                _focusSatLookTarget = Cesium.Cartesian3.add(
                    satPos,
                    Cesium.Cartesian3.multiplyByScalar(dirToCenter, shiftAmount, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );

                // flyToBoundingSphere로 매끄럽게 날아감
                var hpr = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), _focusSatRange);
                viewer.camera.flyToBoundingSphere(
                    new Cesium.BoundingSphere(_focusSatLookTarget, 0),
                    {
                        offset: hpr,
                        duration: 2.0,
                        complete: function() {
                            viewer.camera.lookAt(_focusSatLookTarget, hpr);
                        }
                    }
                );
            } else {
                console.warn('[Controls] Satellite position not found for:', satName);
            }
        }
        if (message.type === 'SET_MODEL_URI') {
            // GLB 모델 URI 동적 주입 (달 로드 후 나중에 도착)
            if (message.model === 'apollo') {
                window.APOLLO_LM_URI = message.uri;
                APOLLO_LM_GLB = message.uri;
                // 이미 렌더링된 Apollo 엔티티 모델 URI 업데이트
                viewer.entities.values.forEach(function(entity) {
                    if (entity.model && entity._isApolloModel) {
                        entity.model.uri = new Cesium.ConstantProperty(message.uri);
                    }
                });
                console.log('[Controls] Apollo GLB URI injected');
            } else if (message.model === 'danuri') {
                window.DANURI_GLB_URI = message.uri;
                // 이미 렌더링된 Danuri 엔티티 모델 URI 업데이트
                viewer.entities.values.forEach(function(entity) {
                    if (entity.model && entity._isDanuriModel) {
                        entity.model.uri = new Cesium.ConstantProperty(message.uri);
                    }
                });
                console.log('[Controls] Danuri GLB URI injected');
            }
        }
        if (message.type === 'LOAD_MINERAL_DATA') {
            loadMineralData(message.data, message.isFirst, message.isLast);
        }
        if (message.type === 'UPDATE_MINERAL_FILTER') {
            updateMineralFilter(message.filter, message.enabled);
        }
        if (message.type === 'TOGGLE_TEMP_MAP') {
            toggleTempMap(message.enabled);
        }
        if (message.type === 'LOAD_TEMP_MAP_IMAGE') {
            loadTempMapImage(message.data);
        }
        if (message.type === 'TOGGLE_THERMAL_GRID') {
            toggleThermalGrid(message.enabled);
        }
        if (message.type === 'LOAD_THERMAL_GRID_DATA') {
            processThermalGridData(message.data);
        }
        if (message.type === 'UPDATE_THERMAL_MODE') {
            isDayTempMode = message.isDay;
            if (thermalGridCsvContent) {
                renderThermalGridFromData();
            }
        }
        if (message.type === 'TOGGLE_GRAVITY_MAP') {
            toggleGravityMap(message.enabled);
        }
        if (message.type === 'LOAD_GRAVITY_DATA') {
            processGravityData(message.data);
        }
        if (message.type === 'TOGGLE_GRAVITY_GRID_MODE') {
            toggleGravityGridMode(message.enabled);
        }
        if (message.type === 'TOGGLE_NEUTRON_MAP') {
            toggleNeutronMap(message.enabled);
        }
        if (message.type === 'LOAD_NEUTRON_DATA') {
            processNeutronData(message.data);
        }
        if (message.type === 'TOGGLE_NEUTRON_GRID_MODE') {
            toggleNeutronGridMode(message.enabled);
        }
        if (message.type === 'TOGGLE_LANDMARKS') {
            toggleLandmarks(message.enabled);
        }
        if (message.type === 'TOGGLE_LANDING_SITES') {
            toggleLandingSites(message.enabled);
        }
        if (message.type === 'TOGGLE_TERRAIN') {
            toggleTerrainFlags(message.enabled);
        }
        if (message.type === 'SHOW_FEATURE_AREA') {
            var p = message.payload;
            showFeatureArea(p.lat, p.lng, p.diameterKm, p.typeKr);
        }
        if (message.type === 'HIDE_FEATURE_AREA') {
            hideFeatureArea();
        }
        if (message.type === 'RECOMMEND_LAND') {
            const { lat, lng } = message.payload;

            // 위경도를 통해 S2Point 획득
            const latRad = Cesium.Math.toRadians(lat);
            const lngRad = Cesium.Math.toRadians(lng);
            const point = new s2.Point(
                Math.cos(latRad) * Math.cos(lngRad),
                Math.cos(latRad) * Math.sin(lngRad),
                Math.sin(latRad)
            );

            // 최종 목표: Level 16 셀
            const leafId = s2.cellid.fromPoint(point);
            const finalTargetId = s2.cellid.parent(leafId, 16);

            // selectionStack 한번에 세팅 (기존 클릭 로직과 동일한 계층구조)
            selectionStack = [
                s2.cellid.parent(finalTargetId, 4),
                s2.cellid.parent(finalTargetId, 8),
                s2.cellid.parent(finalTargetId, 12),
                finalTargetId // Level 16
            ];
            lastRenderedDepth = 0;
            parentPrimitives.removeAll();

            // 그리드 렌더링 (render 내부에서 CELL_SELECTED도 자동 전송)
            render();
            flashCell(finalTargetId);

            // 기존 flyToCell 그대로 사용 (레벨별 적절한 높이 자동 계산)
            flyToCell(finalTargetId);

            // 줌 레벨도 최대(4)로 동기화
            currentZoomLevel = ZOOM_LEVELS.length - 1;
            updateUI();
        }
    } catch (e) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEBUG_LOG', payload: 'Cesium JS Error: ' + e.message }));
        }
        console.error("Cesium Message Error:", e);
    }
}

// === 클릭 핸들러 (드래그/줌과 탭 구분) ===
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

// 터치 시작 위치 저장 (드래그 vs 탭 구분용)
var _touchStartPos = null;
handler.setInputAction(function(movement) {
    _touchStartPos = Cesium.Cartesian2.clone(movement.position);
}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

handler.setInputAction((movement) => {
    // 드래그 vs 탭 구분: 시작점과 끝점 거리가 10px 이상이면 드래그로 간주
    if (_touchStartPos) {
        var dx = movement.position.x - _touchStartPos.x;
        var dy = movement.position.y - _touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            _touchStartPos = null;
            return; // 드래그 → 무시
        }
    }
    _touchStartPos = null;

    // ─── 위성 모드 전용 ───
    if (mainMode === 'exploration' && subMode === 'satellite') {
        // 위성 찾기: scene.pick 으로 단순화
        var picked = viewer.scene.pick(movement.position);
        var satInfo = null;

        if (Cesium.defined(picked)) {
            // Billboard/Polyline/Label의 id에 isSatellite 플래그
            if (picked.id && picked.id.isSatellite) {
                satInfo = picked.id;
            }
            // 다누리 3D Entity 직접 클릭
            if (!satInfo && picked.id && picked.id._isDanuriModel) {
                // 다누리 Entity → KPLO로 매핑
                satInfo = { name: 'KPLO', isSatellite: true };
            }
        }

        // drillPick fallback (pick이 라벨을 못 잡을 수 있음)
        if (!satInfo) {
            var drilled = viewer.scene.drillPick(movement.position, 5);
            for (var di = 0; di < drilled.length; di++) {
                if (drilled[di].id && drilled[di].id.isSatellite) {
                    satInfo = drilled[di].id;
                    break;
                }
            }
        }

        if (satInfo) {
            // 위성 선택!
            highlightSatellite(satInfo.name);
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SATELLITE_SELECTED',
                payload: {
                    name: satInfo.name,
                    speed: satInfo.speed || '',
                    description: satInfo.description || ''
                }
            }));

            // trackedEntity로 카메라 고정
            var trackTarget = null;
            var satUpper = satInfo.name.toUpperCase();
            if (_danuriEntities.length > 0 && (satUpper.indexOf('DANURI') !== -1 || satUpper.indexOf('KPLO') !== -1)) {
                trackTarget = _danuriEntities[0];
            }
            if (!trackTarget && lastSatellitesData) {
                for (var si = 0; si < lastSatellitesData.length; si++) {
                    if (lastSatellitesData[si].name === satInfo.name && lastSatellitesData[si].position) {
                        var sp = lastSatellitesData[si].position;
                        trackTarget = viewer.entities.add({
                            position: new Cesium.Cartesian3(sp.x * 1000, sp.y * 1000, sp.z * 1000),
                            point: { pixelSize: 1, color: Cesium.Color.TRANSPARENT },
                        });
                        trackTarget._isTempTrack = true;
                        break;
                    }
                }
            }
            if (trackTarget) {
                trackTarget.viewFrom = new Cesium.Cartesian3(800, 800, 400);
                viewer.trackedEntity = trackTarget;
            }
            return;
        }

        // 빈 공간 탭 → 위성 해제
        if (viewer.trackedEntity) {
            var wasTemp = viewer.trackedEntity._isTempTrack;
            var tempEnt = viewer.trackedEntity;
            viewer.trackedEntity = undefined;
            if (wasTemp) viewer.entities.remove(tempEnt);
        }
        highlightSatellite(null);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DESELECTED' }));
        return;
    }

    // 2. 히트박스 기반 셀 선택 (scene.pick)
    if (mainMode !== 'occupation') return;

    var picked = viewer.scene.pick(movement.position);
    if (!Cesium.defined(picked) || !picked.id) return;
    var pickedCellId = picked.id;

    const lastCellId = selectionStack.length === 0 ? null : selectionStack[selectionStack.length - 1];
    const currentLevel = lastCellId ? s2.cellid.level(lastCellId) : 0;


    if (currentLevel >= 12) {
        // 3단계: 4셀 단위 다중선택 (L15 그룹 고정)
        var clickedL16 = pickedCellId;
        var parentL15 = s2.cellid.parent(clickedL16, 15);
        var selectedCells = getDescendants(parentL15, 16);

        if (selectedCells.length === 0) return;
        
        var hasOccupied = selectedCells.some(function(cid) {
            return occupiedTokens.indexOf(s2.cellid.toToken(cid)) !== -1;
        });
        if (hasOccupied) return;

        if (!window.multiSelectedL16) window.multiSelectedL16 = [];
        var groupTokens = selectedCells.map(function(c) { return s2.cellid.toToken(c); });
        // 이 그룹이 이미 선택되어 있는지 확인
        var isAlreadySelected = groupTokens.every(function(t) {
            return window.multiSelectedL16.indexOf(t) !== -1;
        });
        if (isAlreadySelected) {
            // 토글 제거
            groupTokens.forEach(function(t) {
                var i = window.multiSelectedL16.indexOf(t);
                if (i !== -1) window.multiSelectedL16.splice(i, 1);
            });
        } else {
            // mag 초과 체크
            var newTotal = window.multiSelectedL16.length + groupTokens.length;
            var balance = (typeof window.magBalance !== 'undefined') ? window.magBalance : 40;
            if (newTotal > balance) {
                sendToRN('MAG_EXCEEDED', { needed: newTotal, balance: balance });
                return;
            }
            // 중복 방지하면서 추가
            groupTokens.forEach(function(t) {
                if (window.multiSelectedL16.indexOf(t) === -1) {
                    window.multiSelectedL16.push(t);
                }
            });
        }
        if (window.multiSelectedL16.length === 0) {
            sendToRN('CELL_DESELECTED', {});
            render();
            return;
        }
        // 다중선택 정보 전송
        var firstToken = window.multiSelectedL16[0];
        var cc2 = s2.Cell.fromCellID(clickedL16).center();
        var ccr2 = Math.sqrt(cc2.x**2+cc2.y**2+cc2.z**2);
        sendToRN('CELL_SELECTED', {
            cellId: firstToken, token: firstToken,
            lat: parseFloat((Math.asin(cc2.z / ccr2) * 180 / Math.PI).toFixed(2)),
            lng: parseFloat((Math.atan2(cc2.y, cc2.x) * 180 / Math.PI).toFixed(2)),
            level: 15, childLevel: 16,
            cellCount: window.multiSelectedL16.length,
            unit: window.multiSelectedL16.length + ' Block = ' + window.multiSelectedL16.length + ' Mag',
            magCount: window.multiSelectedL16.length,
            price: '$' + window.multiSelectedL16.length,
            area: '~' + (0.8 * window.multiSelectedL16.length).toFixed(1) + ' km²',
            multiTokens: window.multiSelectedL16.slice(),
            isMultiSelect: window.multiSelectedL16.length > 1
        });
        if (!window.selectionPrimMap) window.selectionPrimMap = {};

        if (isAlreadySelected) {
            // 제거된 그룹만 primitive 삭제
            groupTokens.forEach(function(tk) {
                if (window.selectionPrimMap[tk]) {
                    selectionPrimitives.remove(window.selectionPrimMap[tk]);
                    delete window.selectionPrimMap[tk];
                }
            });
        } else {
            // 새 그룹만 primitive 추가
            groupTokens.forEach(function(tk) {
                if (window.selectionPrimMap[tk]) return; // 이미 있으면 스킵
                var cid = s2.cellid.fromToken(tk);
                var cell = s2.Cell.fromCellID(cid);
                var positions = [];
                for (var vi = 0; vi < 4; vi++) {
                    var v = cell.vertex(vi);
                    var vr = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
                    positions.push(Cesium.Cartesian3.fromRadians(
                        Math.atan2(v.y, v.x), Math.asin(v.z / vr), 0, Cesium.Ellipsoid.MOON
                    ));
                }
                var prim = selectionPrimitives.add(new Cesium.ClassificationPrimitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolygonGeometry({
                            polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                            ellipsoid: Cesium.Ellipsoid.MOON,
                            height: -15000, extrudedHeight: 15000,
                        }),
                        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                            new Cesium.Color(0.15, 0.45, 0.95, 0.45)
                        )}
                    }),
                    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                    classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
                    asynchronous: true,
                }));
                window.selectionPrimMap[tk] = prim;
            });
        }
        return;
    }

    // 0~2단계: 히트박스에서 직접 감지된 셀 사용
    var cellId = pickedCellId;
    var lvl = s2.cellid.level(cellId);
    if (lvl <= 0) return;

    // 프러스텀 컬링: 모든 보이는 셀 클릭 가능 (부모 범위 제한 제거)

    flashCell(cellId);
    selectionStack.push(cellId);
    render();
    flyToCell(cellId);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
// --- 위성 포커스 상태 ---
var _focusSatPos = null;           // 포커스된 위성의 Cartesian3 위치
var _focusSatLookTarget = null;    // lookAt용 오프셋 타겟 (위성보다 약간 달 방향)
var _focusSatRange = 1200;         // 카메라~위성 거리 (m)

// --- 단순 줌 증감 함수 ---
function changeZoomLevel(direction) {
    // 위성 포커스 활성 시: range 스케일링 후 lookAt 재호출
    if (_focusSatPos) {
        var scale = direction > 0 ? 0.6 : 1.667;
        _focusSatRange = Math.max(50, Math.min(100000, _focusSatRange * scale));

        // 오프셋 타겟 재계산 (range에 맞게)
        var dirToCenter = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.negate(_focusSatPos, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        var shiftAmount = _focusSatRange * 0.4;
        _focusSatLookTarget = Cesium.Cartesian3.add(
            _focusSatPos,
            Cesium.Cartesian3.multiplyByScalar(dirToCenter, shiftAmount, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );

        viewer.camera.lookAt(
            _focusSatLookTarget,
            new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, _focusSatRange)
        );
        return;
    }

    var carto = Cesium.Cartographic.fromCartesian(viewer.camera.position, Cesium.Ellipsoid.MOON);
    if (!carto) return;
    var currentHeight = carto.height;
    var moveAmount = currentHeight * 0.4;
    if (direction > 0) {
        viewer.camera.moveForward(moveAmount);
    } else {
        viewer.camera.moveBackward(moveAmount);
    }
}

// ==== 모드 전환 헬퍼 함수 ====
function updateAppMode(payload) {
    // 위성 포커스 해제
    if (_focusSatPos) {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        _focusSatPos = null;
        _focusSatLookTarget = null;
    }
    const oldMainMode = mainMode;
    mainMode = payload.mainMode;
    subMode = payload.subMode;

    // 탐사 <-> 점유 모드 상호 전환 시 카메라 뷰 완전 초기화
    if (oldMainMode && oldMainMode !== mainMode) {
        viewer.camera.cancelFlight();

        // 모드 전환 시 이전 모드의 잔여물(예: 위성 궤적) 완벽히 초기화
        if (typeof satellitePrimitives !== 'undefined') {
            satellitePrimitives.removeAll();
        }
        if (typeof _danuriEntities !== 'undefined') {
            _danuriEntities.forEach(function(e) { viewer.entities.remove(e); });
            _danuriEntities = [];
        }
        if (typeof highlightSatellite === 'function') {
            highlightSatellite(null);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DESELECTED' }));
        }

        const defaultPos = Cesium.Cartesian3.fromRadians(0, 0, 6105648, Cesium.Ellipsoid.MOON);
        viewer.camera.flyTo({
            destination: defaultPos,
            orientation: {
                heading: 0.0,
                pitch: Cesium.Math.toRadians(-90),
                roll: 0.0
            },
            duration: 1.5
        });
    }

    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true; // 틸트 잠금 해제
    viewer.scene.screenSpaceCameraController.enableLook = true;

    // 일인칭 컨트롤러 이벤트 제거
    if (firstPersonData.handler) {
        firstPersonData.handler.destroy();
        firstPersonData.handler = null;
    }

    // 그리드/아이템 표시 여부 초기화 (occupation2/3이면 모드1 그리드 건드리지 않음)
    if (mainMode === 'occupation') {
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = true;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = true;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = true;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = true;
    }

    // 위성 레이어 플러시 로직 (점유 모드로 가거나 탐사 모드 중 위성이 아닐 때 모두 초기화)
    if (typeof satellitePrimitives !== 'undefined') {
        if (mainMode === 'occupation' || subMode !== 'satellite') {
            satellitePrimitives.removeAll();
        }
    }

    if (mainMode === 'occupation') {
        // 점유 모드(모드1): 오리지널 그리드 활성화, PL/TR 그리드 숨김
        showGrid = true;
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = true;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = true;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = true;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = true;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
        sendToRN('GRID_VISIBILITY_CHANGED', { visible: true });
        render();
    } else if (mainMode === 'occupation2') {
        // 점유 모드(모드2): 모드1/TR 그리드 숨기기, PL은 cesiumControlsPL.js가 독립 관리
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = true;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
    } else if (mainMode === 'occupation3') {
        // 점유 모드(모드3): 모드1/2 그리드 숨기기, TR은 cesiumControlsTR.js가 독립 관리
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = true;
    } else {
        // 탐사 모드: 모든 그리드 숨기기
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = false;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;

        if (subMode === 'satellite') {
            // 위성 뷰: 틸팅 비활성화, 화면에 달이 절반만 찰 정도로 아주 멀리 줌 아웃 (2만 km 고도)
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.scene.screenSpaceCameraController.enableLook = false;
            let carto = viewer.camera.positionCartographic;
            const newPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 20000000, Cesium.Ellipsoid.MOON);
            viewer.camera.flyTo({ destination: newPos, duration: 1.5 });

            // 위성 데이터 다시 렌더링
            if (typeof drawSatelliteData === 'function' && typeof lastSatellitesData !== 'undefined' && lastSatellitesData) {
                drawSatelliteData(lastSatellitesData);
            }
        } else if (subMode === 'firstPerson') {
            // 1인칭 뷰 로직 (재사용 가능: 지형 줌인, 땅보기, 탐사지점 1인칭 전환 등)
            const carto = viewer.camera.positionCartographic;
            let terrainHeight = 0;
            let fallbackHeight = viewer.scene.globe.getHeight(carto);
            if (fallbackHeight !== undefined && !isNaN(fallbackHeight)) {
                terrainHeight = Math.max(0, fallbackHeight);
            }

            const targetHeight = terrainHeight + 2000.0; // 2km 고도

            const surfacePos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, targetHeight, Cesium.Ellipsoid.MOON);

            viewer.camera.flyTo({
                destination: surfacePos,
                orientation: {
                    heading: viewer.camera.heading,
                    pitch: 0,
                    roll: 0
                },
                duration: 1.5,
                complete: function () {
                    // 제어 제한: 회전, 이동 방지. Look만 허용 (드래그로 시야 변경)
                    viewer.scene.screenSpaceCameraController.enableRotate = false;
                    viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    viewer.scene.screenSpaceCameraController.enableZoom = false;
                    viewer.scene.screenSpaceCameraController.enableTilt = true;
                    viewer.scene.screenSpaceCameraController.enableLook = true;

                    // 터치 드래그로 Camera Look 방향 변경 핸들러 추가
                    firstPersonData.handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
                    firstPersonData.handler.setInputAction(function (movement) {
                        const dx = movement.endPosition.x - movement.startPosition.x;
                        const dy = movement.endPosition.y - movement.startPosition.y;
                        const lookFactor = 0.005;

                        let newHeading = viewer.camera.heading + (dx * lookFactor);
                        let newPitch = viewer.camera.pitch - (dy * lookFactor);

                        // Pitch 제한 (서서 걷는 느낌을 위해 누운 시점 방지, 상하 80도 제한)
                        const maxPitch = Cesium.Math.toRadians(80);
                        const minPitch = Cesium.Math.toRadians(-80);
                        if (newPitch > maxPitch) newPitch = maxPitch;
                        if (newPitch < minPitch) newPitch = minPitch;

                        viewer.camera.setView({
                            orientation: {
                                heading: newHeading,
                                pitch: newPitch,
                                roll: 0.0 // Roll 완전 고정
                            }
                        });
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE); // 드래그 시야 변경
                }
            });
        } else {
            // 기본 뷰 (우주 뷰 = 기본): 틸팅 비활성화, 줌/회전만 가능
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            viewer.scene.screenSpaceCameraController.enableLook = false;
        }
    }
}

// === 텔레메트리 변수 ===
let lastTelemetryTime = 0;

// === 1인칭 및 텔레메트리 루프 ===
viewer.scene.preUpdate.addEventListener(function (scene, time) {
    if (mainMode === 'exploration') {
        // 1. 텔레메트리 데이터 전송 (1초마다 4번, 즉 250ms 마다)
        const now = Date.now();
        if (now - lastTelemetryTime > 250) {
            lastTelemetryTime = now;
            // positionCartographic는 Cesium 내부적으로 WGS84 기준일 수 있으므로
            // 반드시 MOON ellipsoid로 직접 변환해야 올바른 표면 기준 고도가 나옴
            const camCartesian = viewer.camera.position;
            const camPos = Cesium.Cartographic.fromCartesian(camCartesian, Cesium.Ellipsoid.MOON);
            const lat = Cesium.Math.toDegrees(camPos.latitude).toFixed(4);
            const lon = Cesium.Math.toDegrees(camPos.longitude).toFixed(4);
            const alt = camPos.height.toFixed(0); // 달 표면 기준 미터(m)
            const heading = Cesium.Math.toDegrees(viewer.camera.heading).toFixed(1);
            const pitch = Cesium.Math.toDegrees(viewer.camera.pitch).toFixed(1);

            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TELEMETRY_UPDATE',
                payload: { lat, lon, alt, heading, pitch }
            }));
        }

        // 2. 1인칭 이동 로직
        if (subMode === 'firstPerson') {
            const moveAmount = 50.0; // 한번에 이동하는 거리(속도)
            if (firstPersonData.forward) viewer.camera.moveForward(moveAmount);
            if (firstPersonData.backward) viewer.camera.moveBackward(moveAmount);
            if (firstPersonData.left) viewer.camera.moveLeft(moveAmount);
            if (firstPersonData.right) viewer.camera.moveRight(moveAmount);

            if (firstPersonData.forward || firstPersonData.backward || firstPersonData.left || firstPersonData.right) {
                const currentPos = viewer.camera.position;
                const carto = Cesium.Cartographic.fromCartesian(currentPos, Cesium.Ellipsoid.MOON);

                let terrainHeight = 0;
                let fallbackHeight = viewer.scene.globe.getHeight(carto); // Use globe.getHeight
                if (fallbackHeight !== undefined && !isNaN(fallbackHeight)) {
                    terrainHeight = Math.max(0, fallbackHeight);
                }

                const targetHeight = terrainHeight + 2000.0; // 사용자가 띄우라고 요청함

                // 보간 추적 로직 (부드러운 카메라 이동 제한)
                carto.height += (targetHeight - carto.height) * 0.1;

                const finalPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height, Cesium.Ellipsoid.MOON);
                viewer.camera.position = finalPos;
            }
        }
    }
});

let lastSatellitesData = null;
let highlightedSatelliteName = null;

function highlightSatellite(name) {
    highlightedSatelliteName = name;
    if (lastSatellitesData) {
        drawSatelliteData(lastSatellitesData);
    }
}

// ==== 육각형 마커 이미지 생성 (2x 해상도) ====
var _hexCanvas = document.createElement('canvas');
_hexCanvas.width = 64; _hexCanvas.height = 64;
var _hctx = _hexCanvas.getContext('2d');
_hctx.strokeStyle = 'rgba(210,210,210,1)';
_hctx.lineWidth = 2.5;
_hctx.beginPath();
for (var hi = 0; hi < 6; hi++) {
    var hAngle = Math.PI / 3 * hi - Math.PI / 6;
    var hx = 32 + 22 * Math.cos(hAngle);
    var hy = 32 + 22 * Math.sin(hAngle);
    if (hi === 0) _hctx.moveTo(hx, hy);
    else _hctx.lineTo(hx, hy);
}
_hctx.closePath();
_hctx.stroke();
var _hexDataUrl = _hexCanvas.toDataURL();

// ==== 위성 데이터 렌더링 ====
var _danuriEntities = [];
function drawSatelliteData(satellites) {
    if (typeof satellitePrimitives === 'undefined') return;
    lastSatellitesData = satellites;
    satellitePrimitives.removeAll();

    // 이전 다누리 3D 모델 정리
    _danuriEntities.forEach(function(e) { viewer.entities.remove(e); });
    _danuriEntities = [];

    var labels = satellitePrimitives.add(new Cesium.LabelCollection());
    var billboards = satellitePrimitives.add(new Cesium.BillboardCollection());

    satellites.forEach(function(sat) {
        var isHighlighted = highlightedSatelliteName === sat.name;
        var hasHighlight = highlightedSatelliteName !== null;
        var baseAlpha = hasHighlight ? (isHighlighted ? 0.8 : 0.08) : 0.5;

        // ─── 궤적 (그라데이션 페이드) ───
        if (sat.trajectory && sat.trajectory.length > 1) {
            // 현재 위치를 궤적 끝에 추가하여 마커까지 연결
            var traj = sat.trajectory.slice();
            if (sat.position) {
                traj.push({ x: sat.position.x, y: sat.position.y, z: sat.position.z });
            }

            var totalPts = traj.length;
            // 궤적을 여러 세그먼트로 나눠 각각 다른 투명도
            var segCount = Math.min(totalPts - 1, 40);
            var step = Math.max(1, Math.floor(totalPts / segCount));

            for (var si = 0; si < totalPts - step; si += step) {
                var ei = Math.min(si + step + 1, totalPts);
                var segPositions = [];
                for (var pi = si; pi < ei; pi++) {
                    var pt = traj[pi];
                    segPositions.push(new Cesium.Cartesian3(pt.x * 1000, pt.y * 1000, pt.z * 1000));
                }
                // 현재위치(끝)에 가까울수록 밝고, 과거(시작)일수록 흐림
                var progress = si / (totalPts - 1); // 0=과거, 1=현재
                var segAlpha = baseAlpha * (0.05 + 0.95 * progress);
                var lineWidth = isHighlighted ? 2.5 : 1.5;

                var polylines = satellitePrimitives.add(new Cesium.PolylineCollection());
                var polyline = polylines.add({
                    positions: segPositions,
                    width: lineWidth,
                    material: Cesium.Material.fromType('Color', {
                        color: new Cesium.Color(0.75, 0.75, 0.75, segAlpha)
                    })
                });
                polyline.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
            }
        }

        // ─── 현재 위치 마커 (육각형) ───
        if (sat.position) {
            var pos = new Cesium.Cartesian3(
                sat.position.x * 1000,
                sat.position.y * 1000,
                sat.position.z * 1000
            );

            var markerAlpha = hasHighlight ? (isHighlighted ? 1.0 : 0.15) : 0.9;
            var bb = billboards.add({
                position: pos,
                image: _hexDataUrl,
                width: isHighlighted ? 36 : 28,
                height: isHighlighted ? 36 : 28,
                color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha),
                sizeInMeters: false,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            });
            bb.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };

            // ─── 라벨 (심플 무채색) ───
            labels.add({
                position: pos,
                text: sat.name.toUpperCase(),
                font: isHighlighted ? '500 16px sans-serif' : '14px sans-serif',
                fillColor: new Cesium.Color(0.8, 0.8, 0.8, hasHighlight ? (isHighlighted ? 1.0 : 0.2) : 0.8),
                outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(22, 0),
                horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            });

            // 다누리호 3D 모델
            var satNameUpper = sat.name.toUpperCase();
            if ((satNameUpper.indexOf('DANURI') !== -1 || satNameUpper.indexOf('KPLO') !== -1) && window.DANURI_GLB_URI) {
                var danuriEntity = viewer.entities.add({
                    position: pos,
                    model: {
                        uri: window.DANURI_GLB_URI,
                        scale: 500,
                        minimumPixelSize: 32,
                        maximumScale: 50000,
                        silhouetteColor: Cesium.Color.fromCssColorString('#60A5FA'),
                        silhouetteSize: 1.5,
                    },
                });
                danuriEntity._isDanuriModel = true;
                _danuriEntities.push(danuriEntity);
            }
        }
    });
}

// --- 초기 렌더링 (occupation3이면 renderTerrain) ---
if (mainMode === 'occupation3') {
    renderTerrain();
} else if (mainMode === 'occupation2') {
    renderPolyline();
} else {
    render();
}

// --- 초기화 완료: 메시지 큐 리플레이 ---
window._initComplete = true;
document.removeEventListener('message', _earlyMessageHandler);
window.removeEventListener('message', _earlyMessageHandler);
if (window._messageQueue.length > 0) {
    console.log('[Queue] Replaying', window._messageQueue.length, 'buffered messages');
    window._messageQueue.forEach(function(msgData) {
        var evt = new MessageEvent('message', { data: msgData });
        document.dispatchEvent(evt);
    });
    window._messageQueue = [];
}
console.log('[Init] initMoon() fully complete');

    } // end of initMoon

// Start initialization
initMoon().catch(err => {
    console.error("Top Level Init Error:", err);
    if (window.onerror) window.onerror(err.message, "initMoon", 0, 0, err);
});
`;
