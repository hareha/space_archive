// cesiumMaps.js — 광물/온도/열그리드/중력/중성자 맵 모듈
// 모든 과학 데이터 시각화 레이어를 관리합니다.

export const CESIUM_MAPS = `
      // --- Mineral Data Functions ---
      
      function loadMineralData(dataArray, isFirst, isLast) {
        if (isFirst) {
          mineralDataArray = [];
        }
        mineralDataArray.push(...dataArray);
        
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
        showGrid = visible; // cesiumInit.js의 전역 플래그 업데이트
        if (typeof gridPrimitives !== 'undefined' && gridPrimitives) gridPrimitives.show = visible;
        if (typeof parentPrimitives !== 'undefined' && parentPrimitives) parentPrimitives.show = visible;
        if (typeof pillarPrimitives !== 'undefined' && pillarPrimitives) pillarPrimitives.show = visible;
        if (typeof flashPrimitives !== 'undefined' && flashPrimitives) flashPrimitives.show = visible;
      }

      function calculateMineralStats(filter) {
        const values = mineralDataArray
          .map(item => getMineralValue(item, filter))
          .filter(v => !isNaN(v) && v !== null && v !== undefined);
        
        if (values.length > 0) {
          mineralStats.min = Math.min(...values);
          mineralStats.max = Math.max(...values);
        }
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

      function updateMineralTexture() {
        if (!activeMineralFilter || mineralDataArray.length === 0) {
          return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        const range = mineralStats.max - mineralStats.min;
        if (range === 0) {
          return;
        }

        mineralDataArray.forEach(item => {
          const val = getMineralValue(item, activeMineralFilter);
          if (isNaN(val) || val === null || val === undefined) return;

          const latMax = item.latMax;
          const latMin = item.latMin;
          const lonMin = item.lonMin;
          const lonMax = item.lonMax;

          let normalized = (val - mineralStats.min) / range;
          normalized = Math.max(0, Math.min(1, normalized));

          const x = (lonMin + 180) * (canvas.width / 360);
          const y = (90 - latMax) * (canvas.height / 180);
          const w = (lonMax - lonMin) * (canvas.width / 360);
          const h = (latMax - latMin) * (canvas.height / 180);

          const hue = 240 - (normalized * 240);
          ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
          ctx.fillRect(x, y, w + 0.5, h + 0.5);
        });

        if (geologicPrimitive && geologicPrimitive.appearance && geologicPrimitive.appearance.material) {
          geologicPrimitive.appearance.material.uniforms.image = canvas;
        }
      }

      function createMineralSphere() {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(
            moonEllipsoid.maximumRadius + 18500,
            moonEllipsoid.maximumRadius + 18500,
            moonEllipsoid.maximumRadius + 18500
          )
        });

        geologicPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarMineralMaterial',
                uniforms: {
                  image: document.createElement('canvas'),
                  u_offset: 0.5,
                  u_alpha: mineralOpacity
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    st.x = fract(st.x + u_offset);
                    vec4 color = texture(image, st);
                    material.diffuse = color.rgb;
                    material.alpha = u_alpha;
                    return material;
                  }
                \`
              }
            })
          }),
          show: false
        });
        
        viewer.scene.primitives.add(geologicPrimitive);
      }

      // --- Temperature Map Functions ---

      function loadTempMapImage(base64Data) {
        tempMapImageData = base64Data;
        if (!tempMapPrimitive) {
          createTempMapSphere();
        }
        const img = new Image();
        img.onload = function() {
          if (tempMapPrimitive && tempMapPrimitive.appearance && tempMapPrimitive.appearance.material) {
            tempMapPrimitive.appearance.material.uniforms.image = img;
          }
        };
        img.src = base64Data;
      }

      function createTempMapSphere() {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(
            moonEllipsoid.maximumRadius,
            moonEllipsoid.maximumRadius,
            moonEllipsoid.maximumRadius
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
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    st.x = fract(st.x + u_offset);
                    vec4 color = texture(image, st);
                    material.diffuse = color.rgb;
                    material.alpha = u_alpha;
                    return material;
                  }
                \`
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

      // --- Thermal Grid Functions ---
      
      function processThermalGridData(csvContent) {
        thermalGridCsvContent = csvContent;
        renderThermalGridFromData();
        thermalGridDataLoaded = true;
      }

      function renderThermalGridFromData() {
        if (!thermalGridCsvContent) return;

        if (thermalGridPrimitive) {
          viewer.scene.primitives.remove(thermalGridPrimitive);
          thermalGridPrimitive = null;
        }

        console.log('Rendering thermal grid data... Day Mode:', isDayTempMode);
        const lines = thermalGridCsvContent.split('\\n');
        
        const width = 360;
        const height = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, width, height);

        const minTemp = isDayTempMode ? 200 : 40;
        const maxTemp = isDayTempMode ? 390 : 100;
        const tempRange = maxTemp - minTemp;
        
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length < 4) continue;
          
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          const dayMax = parseFloat(parts[2]);
          const nightMin = parseFloat(parts[3]);
          
          if (isNaN(lat) || isNaN(lon)) continue;

          const temp = isDayTempMode ? dayMax : nightMin;
          if (isNaN(temp)) continue;

          let y = Math.floor(90 - lat);
          let x = Math.floor(lon + 180);
          
          if (y >= height) y = height - 1;
          if (x >= width) x = width - 1;
          
          const index = (y * width + x) * 4;
          
          let t = (temp - minTemp) / tempRange;
          t = Math.max(0, Math.min(1, t));
          
          const hue = 240 * (1 - t);
          
          const [r, g, b] = hslToRgb(hue / 360, 1.0, 0.5);
          
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 160;
        }
        
        ctx.putImageData(imgData, 0, 0);
        createThermalGridSphere(canvas);
      }

      function hslToRgb(h, s, l) {
          let r, g, b;
          if (s === 0) {
              r = g = b = l;
          } else {
              const hue2rgb = (p, q, t) => {
                  if (t < 0) t += 1;
                  if (t > 1) t -= 1;
                  if (t < 1 / 6) return p + (q - p) * 6 * t;
                  if (t < 1 / 2) return q;
                  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                  return p;
              };
              const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
              const p = 2 * l - q;
              r = hue2rgb(p, q, h + 1 / 3);
              g = hue2rgb(p, q, h);
              b = hue2rgb(p, q, h - 1 / 3);
          }
          return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      function createThermalGridSphere(canvas) {
        const moonEllipsoid = Cesium.Ellipsoid.MOON;
        const radius = moonEllipsoid.maximumRadius + 20000;
        
        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(radius, radius, radius)
        });

        thermalGridPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarThermalGridMaterial',
                uniforms: {
                  image: canvas
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;

                    float width = 360.0;
                    float height = 180.0;

                    float dx = 1.0 / width;
                    float dy = 1.0 / height;
                    vec2 st_nearest = vec2(
                      (floor(st.x * width) + 0.5) * dx,
                      (floor(st.y * height) + 0.5) * dy
                    );
                    
                    vec4 color = texture(image, st_nearest);

                    float cellX = fract(st.x * width);
                    float cellY = fract(st.y * height);

                    float border = 0.05;

                    if (cellX < border || cellX > 1.0 - border || cellY < border || cellY > 1.0 - border) {
                      material.diffuse = color.rgb * 0.7;
                      material.alpha = min(1.0, color.a + 0.2);
                    } else {
                      material.diffuse = color.rgb;
                      material.alpha = color.a;
                    }

                    return material;
                  }
                \`
              }
            }),
            translucent: true,
            renderState: {
                depthTest: { enabled: true },
                cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showThermalGrid
        });
        
        viewer.scene.primitives.add(thermalGridPrimitive);
      }

      function toggleThermalGrid(enabled) {
        showThermalGrid = enabled;
        if (thermalGridPrimitive) {
          thermalGridPrimitive.show = enabled;
        }
      }

      // --- Gravity Anomaly Map Functions ---

      function processGravityData(csvContent) {
        gravityCsvContent = csvContent;
        renderGravityMap();
        gravityDataLoaded = true;
      }

      function renderGravityMap() {
        if (!gravityCsvContent) return;

        if (gravityPrimitive) {
          viewer.scene.primitives.remove(gravityPrimitive);
          gravityPrimitive = null;
        }

        console.log('Rendering gravity anomaly map...');
        const lines = gravityCsvContent.split('\\n');

        let minGrav = Infinity, maxGrav = -Infinity;
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length < 3) continue;
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          const grav = parseFloat(parts[2]);
          if (isNaN(lat) || isNaN(lon) || isNaN(grav)) continue;
          parsed.push({ lat, lon, grav });
          if (grav < minGrav) minGrav = grav;
          if (grav > maxGrav) maxGrav = grav;
        }

        console.log('Gravity range:', minGrav, 'to', maxGrav, 'mGal,', parsed.length, 'points');

        const width = 360;
        const height = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (const { lat, lon, grav } of parsed) {
          let y = Math.floor(90 - lat);
          let x = Math.floor(lon + 180);
          if (y >= height) y = height - 1;
          if (x >= width) x = width - 1;
          if (y < 0) y = 0;
          if (x < 0) x = 0;

          const index = (y * width + x) * 4;
          let r, g, b;

          if (grav < 0) {
            const t = Math.min(1, Math.abs(grav) / Math.abs(minGrav));
            r = Math.round(255 * (1 - t));
            g = Math.round(255 * (1 - t));
            b = 255;
          } else {
            const t = Math.min(1, grav / maxGrav);
            r = 255;
            g = Math.round(255 * (1 - t));
            b = Math.round(255 * (1 - t));
          }

          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 180;
        }

        ctx.putImageData(imgData, 0, 0);
        createGravitySphere(canvas);

        sendToRN('GRAVITY_RANGE', { min: Math.round(minGrav), max: Math.round(maxGrav) });
      }

      function createGravitySphere(canvas) {
        const radius = moonEllipsoid.maximumRadius + 15000;

        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(radius, radius, radius)
        });

        gravityPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarGravityMaterial_' + Date.now(),
                uniforms: {
                  image: canvas,
                  u_showGrid: gravityGridMode ? 1.0 : 0.0
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    float width = 360.0;
                    float height = 180.0;

                    if (u_showGrid > 0.5) {
                      float dx = 1.0 / width;
                      float dy = 1.0 / height;
                      vec2 st_nearest = vec2(
                        (floor(st.x * width) + 0.5) * dx,
                        (floor(st.y * height) + 0.5) * dy
                      );
                      vec4 color = texture(image, st_nearest);
                      material.diffuse = color.rgb;
                      material.alpha = color.a;
                    } else {
                      vec4 color = texture(image, st);
                      material.diffuse = color.rgb;
                      material.alpha = color.a;
                    }
                    return material;
                  }
                \`
              }
            }),
            translucent: true,
            renderState: {
              depthTest: { enabled: true },
              cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showGravityMap
        });

        viewer.scene.primitives.add(gravityPrimitive);
      }

      function toggleGravityMap(enabled) {
        showGravityMap = enabled;
        if (gravityPrimitive) {
          gravityPrimitive.show = enabled;
        }
      }

      function toggleGravityGridMode(enabled) {
        gravityGridMode = enabled;
        if (gravityPrimitive && gravityPrimitive.appearance && gravityPrimitive.appearance.material) {
          gravityPrimitive.appearance.material.uniforms.u_showGrid = enabled ? 1.0 : 0.0;
        }
      }

      // --- Neutron (Hydrogen) Map Functions ---

      function processNeutronData(csvContent) {
        neutronCsvContent = csvContent;
        renderNeutronMap();
        neutronDataLoaded = true;
      }

      function renderNeutronMap() {
        if (!neutronCsvContent) return;

        if (neutronPrimitive) {
          viewer.scene.primitives.remove(neutronPrimitive);
          neutronPrimitive = null;
        }

        let minVal = Infinity, maxVal = -Infinity;
        const parsed = [];
        const lines = neutronCsvContent.split(String.fromCharCode(10));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length < 3) continue;
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          const val = parseFloat(parts[2]);
          
          if (isNaN(lat) || isNaN(lon) || isNaN(val)) continue;
          
          parsed.push({ lat, lon, val });
          
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }

        console.log('Neutron range:', minVal, 'to', maxVal, ', Total points:', parsed.length);

        const width = 360;
        const height = 180;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;
        const range = maxVal - minVal;

        for (const { lat, lon, val } of parsed) {
          let y = Math.floor(90 - lat);
          let x = Math.floor(lon + 180);
          if (y >= height) y = height - 1;
          if (x >= width) x = width - 1;
          if (y < 0) y = 0;
          if (x < 0) x = 0;

          const t = range > 0 ? (val - minVal) / range : 0.5;

          const r = Math.round(30 + (180 - 30) * t);
          const g = Math.round(100 + (180 - 100) * t);
          const b = Math.round(255 + (180 - 255) * t);

          const index = (y * width + x) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 180;
        }

        ctx.putImageData(imgData, 0, 0);
        createNeutronSphere(canvas);

        sendToRN('NEUTRON_RANGE', { min: Math.round(minVal), max: Math.round(maxVal) });
      }

      function createNeutronSphere(canvas) {
        const radius = moonEllipsoid.maximumRadius + 16000;

        const geometry = new Cesium.EllipsoidGeometry({
          radii: new Cesium.Cartesian3(radius, radius, radius)
        });

        neutronPrimitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
          appearance: new Cesium.MaterialAppearance({
            material: new Cesium.Material({
              fabric: {
                type: 'LunarNeutronMaterial_' + Date.now(),
                uniforms: {
                  image: canvas,
                  u_showGrid: neutronGridMode ? 1.0 : 0.0
                },
                source: \`
                  czm_material czm_getMaterial(czm_materialInput materialInput) {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    float width = 360.0;
                    float height = 180.0;

                    if (u_showGrid > 0.5) {
                      float dx = 1.0 / width;
                      float dy = 1.0 / height;
                      vec2 st_nearest = vec2(
                        (floor(st.x * width) + 0.5) * dx,
                        (floor(st.y * height) + 0.5) * dy
                      );
                      vec4 color = texture(image, st_nearest);
                      material.diffuse = color.rgb;
                      material.alpha = color.a;
                    } else {
                      vec4 color = texture(image, st);
                      material.diffuse = color.rgb;
                      material.alpha = color.a;
                    }
                    return material;
                  }
                \`
              }
            }),
            translucent: true,
            renderState: {
              depthTest: { enabled: true },
              cull: { enabled: true, face: Cesium.CullFace.BACK }
            }
          }),
          show: showNeutronMap
        });

        viewer.scene.primitives.add(neutronPrimitive);
      }

      function toggleNeutronMap(enabled) {
        showNeutronMap = enabled;
        if (neutronPrimitive) {
          neutronPrimitive.show = enabled;
        }
      }

      function toggleNeutronGridMode(enabled) {
        neutronGridMode = enabled;
        if (neutronPrimitive && neutronPrimitive.appearance && neutronPrimitive.appearance.material) {
          neutronPrimitive.appearance.material.uniforms.u_showGrid = enabled ? 1.0 : 0.0;
        }
      }
`;
