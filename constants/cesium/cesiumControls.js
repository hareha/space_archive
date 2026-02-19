// cesiumControls.js — 클릭 핸들러 + 줌 + RN 메시지 라우팅 모듈
// handleRNMessage, 클릭 핸들러, changeZoomLevel

export const CESIUM_CONTROLS = `
      function handleRNMessage(data) {
         try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            if(message.type === 'GO_BACK') goBack();
            if(message.type === 'RESET') resetExplorer();
            if(message.type === 'TOGGLE_GRID') {
                showGrid = message.payload;
                if (gridPrimitives) gridPrimitives.show = showGrid;
            }
            if(message.type === 'UPDATE_GRID_VISIBILITY') {
                updateGridVisibility(message.visible);
            }
            if(message.type === 'CHANGE_GRID_COLOR') {
                render();
            }
            if(message.type === 'ZOOM_IN') {
                changeZoomLevel(1);
            }
            if(message.type === 'ZOOM_OUT') {
                changeZoomLevel(-1);
            }
            if(message.type === 'RESET_VIEW') {
                resetExplorer();
            }
            if(message.type === 'GO_TO_LOCATION') {
                const { lat, lng } = message.payload;
                const latRad = Cesium.Math.toRadians(lat);
                const lngRad = Cesium.Math.toRadians(lng);
                
                const altitude = 500000;
                const position = Cesium.Cartesian3.fromRadians(lngRad, latRad, altitude, Cesium.Ellipsoid.MOON);
                
                viewer.camera.flyTo({
                    destination: position,
                    orientation: {
                        heading: 0,
                        pitch: Cesium.Math.toRadians(-90),
                        roll: 0
                    },
                    duration: 2.0
                });
            }
            if(message.type === 'LOAD_MINERAL_DATA') {
                loadMineralData(message.data, message.isFirst, message.isLast);
            }
            if(message.type === 'UPDATE_MINERAL_FILTER') {
                updateMineralFilter(message.filter, message.enabled);
            }
            if(message.type === 'TOGGLE_TEMP_MAP') {
                toggleTempMap(message.enabled);
            }
            if(message.type === 'LOAD_TEMP_MAP_IMAGE') {
                loadTempMapImage(message.data);
            }
            if(message.type === 'TOGGLE_THERMAL_GRID') {
                toggleThermalGrid(message.enabled);
            }
            if(message.type === 'LOAD_THERMAL_GRID_DATA') {
                processThermalGridData(message.data);
            }
            if(message.type === 'UPDATE_THERMAL_MODE') {
                isDayTempMode = message.isDay;
                if (thermalGridCsvContent) {
                   renderThermalGridFromData();
                }
            }
            if(message.type === 'TOGGLE_GRAVITY_MAP') {
                toggleGravityMap(message.enabled);
            }
            if(message.type === 'LOAD_GRAVITY_DATA') {
                processGravityData(message.data);
            }
            if(message.type === 'TOGGLE_GRAVITY_GRID_MODE') {
                toggleGravityGridMode(message.enabled);
            }
            if(message.type === 'TOGGLE_NEUTRON_MAP') {
                toggleNeutronMap(message.enabled);
            }
            if(message.type === 'LOAD_NEUTRON_DATA') {
                processNeutronData(message.data);
            }
            if(message.type === 'TOGGLE_NEUTRON_GRID_MODE') {
                toggleNeutronGridMode(message.enabled);
            }

         } catch(e) { console.error("Msg Error", e); }
      }

      // === scene.pick 기반 클릭 핸들러 ===
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
          const picked = viewer.scene.pick(movement.position);
          if (!Cesium.defined(picked) || !picked.id) return;
          const cellId = picked.id;
          try {
              const lvl = s2.cellid.level(cellId);
              if (lvl <= 0) return;
          } catch(e) { return; }

          flashCell(cellId);
          selectionStack.push(cellId);
          render();
          flyToCell(cellId);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // --- 5단계 고정 줌 레벨 함수 ---
      function changeZoomLevel(direction) {
        const newLevel = currentZoomLevel + direction;
        
        if (newLevel < 0 || newLevel >= ZOOM_LEVELS.length) {
          updateUI();
          return;
        }
        
        currentZoomLevel = newLevel;
        const targetHeight = ZOOM_LEVELS[currentZoomLevel].height;
        
        const center = viewer.camera.pickEllipsoid(
          new Cesium.Cartesian2(viewer.canvas.width / 2, viewer.canvas.height / 2),
          moonEllipsoid
        );
        
        let targetPosition;
        
        if (center) {
          const normal = Cesium.Cartesian3.normalize(center, new Cesium.Cartesian3());
          targetPosition = Cesium.Cartesian3.add(
            center,
            Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
        } else {
          const camPos = viewer.camera.position;
          const normal = Cesium.Cartesian3.normalize(camPos, new Cesium.Cartesian3());
          const surfacePoint = Cesium.Cartesian3.multiplyByScalar(normal, moonRadius, new Cesium.Cartesian3());
          targetPosition = Cesium.Cartesian3.add(
            surfacePoint,
            Cesium.Cartesian3.multiplyByScalar(normal, targetHeight, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
        }
        
        const startPosition = Cesium.Cartesian3.clone(viewer.camera.position);
        const startHeading = viewer.camera.heading;
        const startPitch = viewer.camera.pitch;
        const targetPitch = Cesium.Math.toRadians(-90);
        const duration = 1000;
        let startTime = null;

        function animate(timestamp) {
          if (!startTime) startTime = timestamp;
          const progress = (timestamp - startTime) / duration;

          if (progress >= 1.0) {
            viewer.camera.setView({
              destination: targetPosition,
              orientation: {
                heading: startHeading,
                pitch: targetPitch,
                roll: 0.0
              }
            });
            return;
          }

          const t = 1 - Math.pow(1 - progress, 3);

          const currentPos = new Cesium.Cartesian3();
          Cesium.Cartesian3.lerp(startPosition, targetPosition, t, currentPos);

          const currentPitch = Cesium.Math.lerp(startPitch, targetPitch, t);

          viewer.camera.setView({
            destination: currentPos,
            orientation: {
              heading: startHeading,
              pitch: currentPitch,
              roll: 0.0
            }
          });

          requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
        updateUI();
      }

      // --- 초기 렌더링 ---
      render();
    } // end of initMoon

    // Start initialization
    initMoon().catch(err => {
        console.error("Top Level Init Error:", err);
        if(window.onerror) window.onerror(err.message, "initMoon", 0, 0, err);
    });
`;
