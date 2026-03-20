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
            exploreZoom(1);
        }
        if (message.type === 'EXPLORE_ZOOM_OUT') {
            exploreZoom(-1);
        }
        if (message.type === 'SELECT_CENTER_CELL') {
            // 점유모드 전용: 화면 중앙의 셀을 선택하여 뎁스를 깊이 들어감
            var canvas = viewer.scene.canvas;
            var centerX = Math.floor(canvas.clientWidth / 2);
            var centerY = Math.floor(canvas.clientHeight / 2);
            var ray = viewer.camera.getPickRay(new Cesium.Cartesian2(centerX, centerY));
            if (!ray) return;
            var intersection = Cesium.IntersectionTests.rayEllipsoid(ray, Cesium.Ellipsoid.MOON);
            if (!intersection) return;
            var point = Cesium.Ray.getPoint(ray, intersection.start);
            var carto = Cesium.Cartographic.fromCartesian(point, Cesium.Ellipsoid.MOON);
            var latRad = carto.latitude;
            var lngRad = carto.longitude;

            // S2 포인트 계산
            var s2Pt = new s2.Point(
                Math.cos(latRad) * Math.cos(lngRad),
                Math.cos(latRad) * Math.sin(lngRad),
                Math.sin(latRad)
            );
            var leafId = s2.cellid.fromPoint(s2Pt);

            // 현재 스택 뎁스에 따라 다음 레벨 결정
            var depth = selectionStack.length;
            var targetLevel;
            if (depth === 0) targetLevel = 4;
            else if (depth === 1) targetLevel = 8;
            else if (depth === 2) targetLevel = 12;
            else return; // 이미 3단계 이상이면 무시

            var cellId = s2.cellid.parent(leafId, targetLevel);

            flashCell(cellId);
            selectionStack.push(cellId);
            if (mainMode === 'occupation3') {
                renderTerrain();
            } else if (mainMode === 'occupation2') {
                renderPolyline();
            } else {
                render();
            }
            if (mainMode === 'occupation3') {
                flyToCellTR(cellId, targetLevel >= 8);
            } else if (mainMode === 'occupation2') {
                flyToCellPL(cellId);
            } else {
                flyToCell(cellId);
            }
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
                _focusSatName = null;
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
            // 탐사모드로 복귀: 빌트인 컨트롤러 기본값 복원
            viewer.scene.screenSpaceCameraController.enableRotate = true;
            viewer.scene.screenSpaceCameraController.enableTranslate = false;
            viewer.scene.screenSpaceCameraController.enableZoom = true;
            viewer.scene.screenSpaceCameraController.enableTilt = false;
            viewer.scene.screenSpaceCameraController.enableLook = false;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
            viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;

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

            // 위성 현재 위치 (애니메이션된 위치 우선)
            var satPos = null;
            if (window._satCurrentPositions && window._satCurrentPositions[satName]) {
                satPos = window._satCurrentPositions[satName];
            } else if (lastSatellitesData) {
                for (var fi = 0; fi < lastSatellitesData.length; fi++) {
                    if (lastSatellitesData[fi].name === satName && lastSatellitesData[fi].position) {
                        var sp = lastSatellitesData[fi].position;
                        satPos = new Cesium.Cartesian3(sp.x * 1000, sp.y * 1000, sp.z * 1000);
                        break;
                    }
                }
            }

            if (satPos) {
                _focusSatName = satName;
                _focusSatPos = satPos;
                _focusSatRange = 1200;

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
                var danuriFound = false;
                viewer.entities.values.forEach(function(entity) {
                    if (entity.model && entity._isDanuriModel) {
                        entity.model.uri = new Cesium.ConstantProperty(message.uri);
                        danuriFound = true;
                    }
                });
                // 다누리 엔티티가 아직 없으면 위성 데이터 재렌더링
                if (!danuriFound && lastSatellitesData) {
                    drawSatelliteData(lastSatellitesData);
                }
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
            showFeatureArea(p.lat, p.lng, p.diameterKm, p.widthKm, p.angle, p.typeKr);
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
        if (message.type === 'FLY_TO_LOCATION') {
            const { lat, lng } = message.payload;
            const dest = Cesium.Cartesian3.fromRadians(
                Cesium.Math.toRadians(lng),
                Cesium.Math.toRadians(lat),
                MOON_RADIUS + 50000
            );
            viewer.camera.flyTo({
                destination: dest,
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-60),
                    roll: 0
                },
                duration: 2.0
            });
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
var _focusSatPos = null;
var _focusSatLookTarget = null;
var _focusSatRange = 1200;
var _focusSatName = null;

// --- 줌 증감 함수 (누적 목표 + lookAtTransform 애니메이션) ---
// 연타 시 목표가 누적되어 최종 위치까지 하나의 부드러운 애니메이션으로 이동
var _zoomAnimFrame = null;
var _zoomTargetRange = null;   // 누적 목표 range (일반/위성 공용)

// --- 탐사모드 전용 줌 (카메라 방향 100% 보존, 거리만 변경) ---
var _exploreZoomAnim = null;
var _exploreZoomTarget = null;

function exploreZoom(direction) {
    var cam = viewer.camera;
    var pos = cam.positionWC;
    var currentRange = Cesium.Cartesian3.magnitude(pos);
    
    var scale = direction > 0 ? 0.6 : 1.667;
    // 누적 목표 계산 (빠르게 연타해도 부드럽게)
    var base = (_exploreZoomTarget !== null) ? _exploreZoomTarget : currentRange;
    _exploreZoomTarget = Math.max(1800000, Math.min(20000000, base * scale));

    if (_exploreZoomAnim) { cancelAnimationFrame(_exploreZoomAnim); _exploreZoomAnim = null; }

    var startRange = currentRange;
    var targetRange = _exploreZoomTarget;
    // 현재 카메라 방향 단위벡터 (원점→카메라)
    var dir = Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());
    var duration = 400;
    var startTime = null;
    var finalTarget = _exploreZoomTarget;

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1.0);
        var t = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        var curRange = startRange + (targetRange - startRange) * t;

        // 방향 벡터 * 새 거리 = 새 위치 (방향 완벽 보존)
        var newPos = Cesium.Cartesian3.multiplyByScalar(dir, curRange, new Cesium.Cartesian3());
        cam.position = newPos;

        if (progress >= 1.0) {
            _exploreZoomAnim = null;
            if (_exploreZoomTarget === finalTarget) {
                _exploreZoomTarget = null;
            }
            return;
        }
        _exploreZoomAnim = requestAnimationFrame(animate);
    }
    _exploreZoomAnim = requestAnimationFrame(animate);
}

function changeZoomLevel(direction) {

    // 위성 포커스 활성 시: range 누적 스케일링
    if (_focusSatPos) {
        var scale = direction > 0 ? 0.6 : 1.667;
        // 이전 애니메이션 진행 중이면 누적 목표에서 계속 줌
        var baseRange = (_zoomTargetRange !== null) ? _zoomTargetRange : _focusSatRange;
        _zoomTargetRange = Math.max(50, Math.min(100000, baseRange * scale));

        var dirToCenter = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.negate(_focusSatPos, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );
        var shiftAmount = _zoomTargetRange * 0.4;
        var newLookTarget = Cesium.Cartesian3.add(
            _focusSatPos,
            Cesium.Cartesian3.multiplyByScalar(dirToCenter, shiftAmount, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        );

        // 진행 중이던 애니메이션 취소
        if (_zoomAnimFrame) { cancelAnimationFrame(_zoomAnimFrame); _zoomAnimFrame = null; }

        // 현재 카메라 상태에서 새 목표로 애니메이션 시작
        var startRange = _focusSatRange;
        var targetRange = _zoomTargetRange;
        var startHeadingSat = viewer.camera.heading;
        var startPitchSat = viewer.camera.pitch;
        var duration = 500;
        var startTime = null;

        function animateSat(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1.0);
            var t = 1 - Math.pow(1 - progress, 3);
            var currentRange = startRange + (targetRange - startRange) * t;
            var hpr = new Cesium.HeadingPitchRange(startHeadingSat, startPitchSat, currentRange);
            viewer.camera.lookAt(newLookTarget, hpr);

            if (progress >= 1.0) {
                _focusSatRange = targetRange;
                _focusSatLookTarget = newLookTarget;
                _zoomAnimFrame = null;
                _zoomTargetRange = null;
                return;
            }
            _zoomAnimFrame = requestAnimationFrame(animateSat);
        }
        _zoomAnimFrame = requestAnimationFrame(animateSat);
        return;
    }
    // 일반 줌: lookAtTransform(IDENTITY) range 보간
    var hpr = window._getCamHPR();
    var currentRange = hpr.range;

    // 누적 목표 range 계산
    var baseRange = (_zoomTargetRange !== null) ? _zoomTargetRange : currentRange;
    var scale = direction > 0 ? 0.6 : 1.667;
    _zoomTargetRange = Math.max(1800000, Math.min(20000000, baseRange * scale));

    // 진행 중이던 애니메이션 취소
    if (_zoomAnimFrame) { cancelAnimationFrame(_zoomAnimFrame); _zoomAnimFrame = null; }

    var startRange = currentRange;
    var targetRange = _zoomTargetRange;
    var fixedHeading = hpr.heading;
    var fixedPitch = hpr.pitch;
    var duration = 500;
    var startTime = null;
    var finalTarget = _zoomTargetRange;

    function animateZoom(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1.0);
        var t = 1 - Math.pow(1 - progress, 3);
        var curRange = startRange + (targetRange - startRange) * t;
        viewer.camera.lookAtTransform(
            Cesium.Matrix4.IDENTITY,
            new Cesium.HeadingPitchRange(fixedHeading, fixedPitch, curRange)
        );

        if (progress >= 1.0) {
            _zoomAnimFrame = null;
            if (_zoomTargetRange === finalTarget) {
                _zoomTargetRange = null;
            }
            return;
        }
        _zoomAnimFrame = requestAnimationFrame(animateZoom);
    }
    _zoomAnimFrame = requestAnimationFrame(animateZoom);
}

// ==== 모드 전환 헬퍼 함수 ====
function updateAppMode(payload) {
    // 위성 포커스 해제
    if (_focusSatPos) {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        _focusSatPos = null;
        _focusSatLookTarget = null;
        _focusSatName = null;
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

        // lookAtTransform(IDENTITY)로 초기 위치 복귀
        viewer.camera.lookAtTransform(
            Cesium.Matrix4.IDENTITY,
            new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 8000000)
        );

    }

    // 탐사모드로 복귀: 빌트인 컨트롤러 최소 설정
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;


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
        // 점유모드에서는 내장 rotation 활성화 (셀 선택/드래그 필요)
        viewer.scene.screenSpaceCameraController.enableRotate = true;
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
        // 점유 모드(모드2): 내장 rotation 활성화
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        // 점유 모드(모드2): 모드1/TR 그리드 숨기기, PL은 cesiumControlsPL.js가 독립 관리
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = false;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = false;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = false;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = false;
        if (typeof plGridPrimitives !== 'undefined' && plGridPrimitives) plGridPrimitives.show = true;
        if (typeof trGridPrimitives !== 'undefined' && trGridPrimitives) trGridPrimitives.show = false;
    } else if (mainMode === 'occupation3') {
        // 점유 모드(모드3): 내장 rotation 활성화
        viewer.scene.screenSpaceCameraController.enableRotate = true;
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
            // 위성 뷰: 내장 rotation 활성화 + 틸팅 허용
            viewer.scene.screenSpaceCameraController.enableRotate = true;
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
            // 1인칭 뷰: 내장 rotation 활성화
            viewer.scene.screenSpaceCameraController.enableRotate = true;
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
            // 기본 뷰 (우주 뷰 = 기본): 줌/회전 가능
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

// Centripetal Catmull-Rom 스플라인 (오버슈팅 방지)
function catmullRomSmooth(points, subdivisions) {
    if (points.length < 3) return points.slice();
    var result = [];

    function dist(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    for (var i = 0; i < points.length - 1; i++) {
        var p0 = points[Math.max(0, i - 1)];
        var p1 = points[i];
        var p2 = points[Math.min(points.length - 1, i + 1)];
        var p3 = points[Math.min(points.length - 1, i + 2)];
        result.push(p1);

        // centripetal 파라미터 (alpha=0.5)
        var d01 = Math.pow(dist(p0, p1), 0.5) || 1;
        var d12 = Math.pow(dist(p1, p2), 0.5) || 1;
        var d23 = Math.pow(dist(p2, p3), 0.5) || 1;

        for (var s = 1; s < subdivisions; s++) {
            var t = s / subdivisions;

            // Barry-Goldman 알고리즘
            var t0 = 0, t1 = d01, t2 = t1 + d12, t3 = t2 + d23;
            var tt = t1 + t * (t2 - t1);

            var a1x = (t1 - tt) / (t1 - t0) * p0.x + (tt - t0) / (t1 - t0) * p1.x;
            var a1y = (t1 - tt) / (t1 - t0) * p0.y + (tt - t0) / (t1 - t0) * p1.y;
            var a1z = (t1 - tt) / (t1 - t0) * p0.z + (tt - t0) / (t1 - t0) * p1.z;

            var a2x = (t2 - tt) / (t2 - t1) * p1.x + (tt - t1) / (t2 - t1) * p2.x;
            var a2y = (t2 - tt) / (t2 - t1) * p1.y + (tt - t1) / (t2 - t1) * p2.y;
            var a2z = (t2 - tt) / (t2 - t1) * p1.z + (tt - t1) / (t2 - t1) * p2.z;

            var a3x = (t3 - tt) / (t3 - t2) * p2.x + (tt - t2) / (t3 - t2) * p3.x;
            var a3y = (t3 - tt) / (t3 - t2) * p2.y + (tt - t2) / (t3 - t2) * p3.y;
            var a3z = (t3 - tt) / (t3 - t2) * p2.z + (tt - t2) / (t3 - t2) * p3.z;

            var b1x = (t2 - tt) / (t2 - t0) * a1x + (tt - t0) / (t2 - t0) * a2x;
            var b1y = (t2 - tt) / (t2 - t0) * a1y + (tt - t0) / (t2 - t0) * a2y;
            var b1z = (t2 - tt) / (t2 - t0) * a1z + (tt - t0) / (t2 - t0) * a2z;

            var b2x = (t3 - tt) / (t3 - t1) * a2x + (tt - t1) / (t3 - t1) * a3x;
            var b2y = (t3 - tt) / (t3 - t1) * a2y + (tt - t1) / (t3 - t1) * a3y;
            var b2z = (t3 - tt) / (t3 - t1) * a2z + (tt - t1) / (t3 - t1) * a3z;

            var cx = (t2 - tt) / (t2 - t1) * b1x + (tt - t1) / (t2 - t1) * b2x;
            var cy = (t2 - tt) / (t2 - t1) * b1y + (tt - t1) / (t2 - t1) * b2y;
            var cz = (t2 - tt) / (t2 - t1) * b1z + (tt - t1) / (t2 - t1) * b2z;

            result.push(new Cesium.Cartesian3(cx, cy, cz));
        }
    }
    result.push(points[points.length - 1]);
    return result;
}

// ==== 위성 데이터 렌더링 ====
var _danuriEntities = [];
window._satCurrentPositions = {}; // 위성 이름 → 현재 Cartesian3 (FOCUS_SATELLITE용)

function drawSatelliteData(satellites) {
    if (typeof satellitePrimitives === 'undefined') return;
    lastSatellitesData = satellites;
    satellitePrimitives.removeAll();
    _danuriEntities.forEach(function(e) { viewer.entities.remove(e); });
    _danuriEntities = [];
    if (window._satAnimFrameId) { cancelAnimationFrame(window._satAnimFrameId); window._satAnimFrameId = null; }
    window._satCurrentPositions = {};

    var labels = satellitePrimitives.add(new Cesium.LabelCollection());
    var billboards = satellitePrimitives.add(new Cesium.BillboardCollection());
    var animatedStates = [];
    var nowMs = Date.now();

    satellites.forEach(function(sat) {
        var isHighlighted = highlightedSatelliteName === sat.name;
        var hasHighlight = highlightedSatelliteName !== null;
        var baseAlpha = hasHighlight ? (isHighlighted ? 0.8 : 0.08) : 0.5;
        var markerAlpha = hasHighlight ? (isHighlighted ? 1.0 : 0.15) : 0.9;
        if (!sat.position) return;

        // ─── 1. 궤적 전체 정렬 (과거+미래 모두) ───
        var sorted = [];
        if (sat.trajectory && sat.trajectory.length > 1) {
            sorted = sat.trajectory.slice()
                .filter(function(p) { return p.epochMs && !isNaN(p.epochMs); })
                .sort(function(a, b) { return a.epochMs - b.epochMs; });
        }

        if (sorted.length < 2) {
            // 궤적 없으면 정적 마커만
            var staticPos = new Cesium.Cartesian3(sat.position.x * 1000, sat.position.y * 1000, sat.position.z * 1000);
            window._satCurrentPositions[sat.name] = staticPos;
            billboards.add({ position: staticPos, image: _hexDataUrl, width: 28, height: 28, color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha), sizeInMeters: false, disableDepthTestDistance: Number.POSITIVE_INFINITY });
            labels.add({ position: staticPos, text: sat.name.toUpperCase(), font: '14px sans-serif', fillColor: new Cesium.Color(0.8, 0.8, 0.8, 0.8), outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(22, 0), horizontalOrigin: Cesium.HorizontalOrigin.LEFT, verticalOrigin: Cesium.VerticalOrigin.CENTER, disableDepthTestDistance: Number.POSITIVE_INFINITY });
            return;
        }

        // ─── 2. 전체 궤적을 Catmull-Rom으로 한 번에 스무딩 ───
        var rawPts = [];
        var rawTimes = [];
        for (var i = 0; i < sorted.length; i++) {
            rawPts.push(new Cesium.Cartesian3(sorted[i].x * 1000, sorted[i].y * 1000, sorted[i].z * 1000));
            rawTimes.push(sorted[i].epochMs);
        }
        var smoothPts = catmullRomSmooth(rawPts, 8);

        // ─── 3. 스무스 포인트마다 시간 매핑 ───
        var smoothTimes = [];
        var subsPerSeg = 8; // catmullRomSmooth의 subdivisions
        var origCount = rawPts.length;
        // 각 원본 세그먼트(i→i+1) 사이에 subsPerSeg개 보간점
        // smoothPts 구조: [p0, sub1..sub8, p1, sub1..sub8, p2, ...]
        // 총 포인트 = (origCount - 1) * subsPerSeg + origCount  ... 아님
        // catmullRomSmooth 결과: 각 세그먼트에 subdivisions개 + 마지막 원본 = (n-1)*subs + 1 + (n-1) 대략
        // 정확히는: smoothPts 개수를 기반으로 선형 매핑
        var totalSmooth = smoothPts.length;
        for (var si = 0; si < totalSmooth; si++) {
            // 전체 스무스 범위를 원본 시간 범위에 선형 매핑
            var frac = si / (totalSmooth - 1);
            var t = rawTimes[0] + frac * (rawTimes[rawTimes.length - 1] - rawTimes[0]);
            smoothTimes.push(t);
        }

        // ─── 4. 현재 위치 = 스무스 경로 위 시간 보간 ───
        var pos = interpSmooth(smoothPts, smoothTimes, nowMs);
        window._satCurrentPositions[sat.name] = pos;

        // ─── 5. 과거 트레일 (현재까지 지나간 부분만) ───
        var pastIdx = findSplitIndex(smoothTimes, nowMs);
        var pastSlice = smoothPts.slice(0, pastIdx + 1);
        pastSlice.push(pos); // 현재 보간 위치까지

        // 10단계 그라데이션 트레일
        var lineW = isHighlighted ? 2.5 : 1.5;
        var trailPolylines = []; // 나중에 업데이트용
        var trailCollections = [];
        if (pastSlice.length >= 2) {
            var numSeg = 10;
            var segSz = Math.max(2, Math.floor(pastSlice.length / numSeg));
            for (var gi = 0; gi < numSeg; gi++) {
                var s = gi * segSz;
                var e = (gi === numSeg - 1) ? pastSlice.length : Math.min((gi + 1) * segSz + 1, pastSlice.length);
                if (s >= pastSlice.length) break;
                var sp = pastSlice.slice(s, e);
                if (sp.length < 2) continue;
                var tr = (gi + 1) / numSeg;
                var al = 0.05 + (baseAlpha - 0.05) * tr * tr;
                var pc = satellitePrimitives.add(new Cesium.PolylineCollection());
                var pl = pc.add({ positions: sp, width: lineW, material: Cesium.Material.fromType('Color', { color: new Cesium.Color(0.75, 0.75, 0.75, al) }) });
                pl.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
                trailPolylines.push(pl);
                trailCollections.push(pc);
            }
        }

        // ─── 라이브 팁 (그라데이션 끝 → 현재 위치, 매 프레임 연장) ───
        var tipColl = satellitePrimitives.add(new Cesium.PolylineCollection());
        var tipPoly = tipColl.add({
            positions: [pos.clone(), pos.clone()],
            width: lineW,
            material: Cesium.Material.fromType('Color', { color: new Cesium.Color(0.75, 0.75, 0.75, baseAlpha) })
        });
        tipPoly.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };

        // ─── 6. 마커 + 라벨 ───
        var bb = billboards.add({
            position: pos, image: _hexDataUrl,
            width: isHighlighted ? 36 : 28, height: isHighlighted ? 36 : 28,
            color: new Cesium.Color(0.85, 0.85, 0.85, markerAlpha),
            sizeInMeters: false, disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
        bb.id = { name: sat.name, isSatellite: true, nocsId: sat.nocsId };
        var lbl = labels.add({
            position: pos, text: sat.name.toUpperCase(),
            font: isHighlighted ? '500 16px sans-serif' : '14px sans-serif',
            fillColor: new Cesium.Color(0.8, 0.8, 0.8, hasHighlight ? (isHighlighted ? 1.0 : 0.2) : 0.8),
            outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(22, 0),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT, verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        });

        // ─── 7. 다누리 3D 모델 ───
        var snu = sat.name.toUpperCase();
        var isDanuri = snu.indexOf('DANURI') !== -1 || snu.indexOf('KPLO') !== -1 || (sat.id && sat.id === '-155');
        var danuriEntity = null;
        if (isDanuri && window.DANURI_GLB_URI) {
            try {
                danuriEntity = viewer.entities.add({
                    position: pos, model: { uri: window.DANURI_GLB_URI, scale: 500, minimumPixelSize: 32, maximumScale: 50000, silhouetteColor: Cesium.Color.fromCssColorString('#60A5FA'), silhouetteSize: 1.5 }
                });
                danuriEntity._isDanuriModel = true; _danuriEntities.push(danuriEntity);
            } catch(e) {}
        }

        animatedStates.push({
            name: sat.name, billboard: bb, label: lbl, danuriEntity: danuriEntity,
            smoothPts: smoothPts, smoothTimes: smoothTimes,
            tipPoly: tipPoly, lastTipAnchor: pos.clone(),
            baseAlpha: baseAlpha, lineW: lineW, nocsId: sat.nocsId,
            lastEpochMs: sorted[sorted.length - 1].epochMs
        });
    });

    // ─── 스무스 경로 위 시간 보간 ───
    function interpSmooth(pts, times, t) {
        if (t <= times[0]) return pts[0].clone();
        if (t >= times[times.length - 1]) return pts[pts.length - 1].clone();
        // 이진탐색
        var lo = 0, hi = times.length - 1;
        while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        var frac = (t - times[lo]) / (times[hi] - times[lo]);
        return new Cesium.Cartesian3(
            pts[lo].x + (pts[hi].x - pts[lo].x) * frac,
            pts[lo].y + (pts[hi].y - pts[lo].y) * frac,
            pts[lo].z + (pts[hi].z - pts[lo].z) * frac
        );
    }

    function findSplitIndex(times, t) {
        // t 이하인 마지막 인덱스
        var lo = 0, hi = times.length - 1;
        if (t >= times[hi]) return hi;
        if (t <= times[lo]) return 0;
        while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        return lo;
    }

    // ─── 실시간 애니메이션 루프 ───
    if (animatedStates.length > 0) {
        function animLoop() {
            try {
                var now = Date.now();
                for (var i = 0; i < animatedStates.length; i++) {
                    var st = animatedStates[i];

                    // 위성 위치 = 스무스 경로 위 보간
                    var np = interpSmooth(st.smoothPts, st.smoothTimes, now);
                    st.billboard.position = np;
                    st.label.position = np;
                    if (st.danuriEntity) st.danuriEntity.position = np;
                    window._satCurrentPositions[st.name] = np;

                    // 카메라 포커스 추적
                    if (_focusSatName === st.name && _focusSatPos) {
                        _focusSatPos = np;
                        var d2c = Cesium.Cartesian3.normalize(Cesium.Cartesian3.negate(np, new Cesium.Cartesian3()), new Cesium.Cartesian3());
                        _focusSatLookTarget = Cesium.Cartesian3.add(np, Cesium.Cartesian3.multiplyByScalar(d2c, _focusSatRange * 0.4, new Cesium.Cartesian3()), new Cesium.Cartesian3());
                        try { viewer.camera.lookAt(_focusSatLookTarget, new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, _focusSatRange)); } catch(e) {}
                    }

                    // 매 프레임: 팁 폴리라인을 현재 위치까지 연장 (부드러운 그리기)
                    st.tipPoly.positions = [st.lastTipAnchor, np];

                    // 미래 데이터 끝 근처(5분 전)이면 재갱신 트리거
                    if (now > st.lastEpochMs - 5 * 60 * 1000 && !st._refreshTriggered) {
                        st._refreshTriggered = true;
                        try {
                            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SATELLITE_DATA_REFRESH_NEEDED' }));
                        } catch(e) {}
                    }
                }
            } catch(e) { console.error('[Sat] Anim error:', e); }
            window._satAnimFrameId = requestAnimationFrame(animLoop);
        }
        window._satAnimFrameId = requestAnimationFrame(animLoop);
    }
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
