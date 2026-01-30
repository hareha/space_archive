export const CESIUM_HTML = \`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>3D Moon</title>
    <script src="https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Cesium.js"></script>
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.104/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
    <style>
        body, html { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background-color: #000; }
        #cesiumContainer { width: 100%; height: 100%; }
        .cesium-viewer-bottom { display: none !important; }
    </style>
</head>
<body>
    <div id="cesiumContainer"></div>
    <script>
      // Cesium Token (Use a default or one provided by user if any. For now, empty or standard public token if needed, but often works for basic ellipse without terrain if no token/ionic)
      // Cesium.Ion.defaultAccessToken = 'YOUR_TOKEN'; 

      const viewer = new Cesium.Viewer('cesiumContainer', {
          imageryProvider: new Cesium.TileMapServiceImageryProvider({
              url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          animation: false,
          fullscreenButton: false,
          creditsDisplay: false // Hide credits for clean UI
      });

      // Moon Ellipsoid
      const moonEllipsoid = new Cesium.Ellipsoid(1737400, 1737400, 1737400);
      viewer.scene.globe.ellipsoid = moonEllipsoid;

      // Removes default Earth atmosphere
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.globe.enableLighting = true; 

      // Set initial view
      viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 5000000)
      });

      // --- State ---
      const state = {
        level: 4,               
        showGrid: true,
        color: '#00FF00',
        selectedCellId: null,   
        focusedCellId: null,    
        history: [],            
        
        // Mineral Resource State
        showResources: false,
        resourceType: 'CORE', // 'CORE' | 'RARE' | 'PHYSICS'
        activeElement: 12,    // Default: FeO (12)
      };

      let gridPrimitives = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
      let selectedCellPrimitive = null; 

      // Mineral Visualization Variables
      let geologicPrimitive = null;
      let rawData = [];
      let stats = { min: 0, max: 1 };
      const shaderParams = { colIndex: 12, gain: 1.0, alpha: 0.6, offset: 0.5 };

      // --- Mineral Data Logic ---

      window.receiveMineralData = (dataString) => {
        try {
           rawData = dataString.trim().split('\\n').map(line => line.trim().split(/\\s+/));
           console.log("Mineral Data Received. Rows:", rawData.length);
           
           if (rawData.length > 0) {
             createDataSphere();
             calculateStats(shaderParams.colIndex);
             updateMineralTexture();
           }
        } catch (e) {
           console.error("Failed to parse mineral data:", e);
        }
      };

      function calculateStats(index) {
          if (!rawData || rawData.length === 0) return;
          let values = [];
          for(let i=0; i<rawData.length; i++) {
            const p = rawData[i];
            if(p.length > index) {
               const v = parseFloat(p[index]);
               if(!isNaN(v)) values.push(v);
            }
          }
          if(values.length > 0) {
             stats.min = Math.min(...values);
             stats.max = Math.max(...values);
          }
      }

      function updateMineralTexture() {
          if (!rawData || rawData.length === 0) return;

          const canvas = document.createElement('canvas');
          canvas.width = 1024;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          
          ctx.clearRect(0,0, canvas.width, canvas.height);

          const range = stats.max - stats.min;
          
          rawData.forEach(p => {
              if (p.length > shaderParams.colIndex) {
                  const val = parseFloat(p[shaderParams.colIndex]);
                  const latMax = parseFloat(p[2]), latMin = parseFloat(p[1]);
                  const lonMin = parseFloat(p[3]), lonMax = parseFloat(p[4]);

                  let normalized = (val - stats.min) / (range || 1);
                  normalized = Math.pow(normalized, 1 / shaderParams.gain);

                  const x = (lonMin + 180) * (canvas.width / 360);
                  const y = (90 - latMax) * (canvas.height / 180);
                  const w = (lonMax - lonMin) * (canvas.width / 360);
                  const h = (latMax - latMin) * (canvas.height / 180);

                  const hue = 240 - (Math.min(normalized, 1.0) * 240);
                  ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
                  ctx.fillRect(x, y, w + 0.6, h + 0.6);
              }
          });

          if (geologicPrimitive) {
              geologicPrimitive.appearance.material.uniforms.image = canvas;
          }
      }

      function createDataSphere() {
          if (geologicPrimitive) {
             viewer.scene.primitives.remove(geologicPrimitive);
          }

          const geometry = new Cesium.EllipsoidGeometry({
            radii: new Cesium.Cartesian3(moonEllipsoid.maximumRadius + 2000, moonEllipsoid.maximumRadius + 2000, moonEllipsoid.maximumRadius + 2000)
          });

          geologicPrimitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({ geometry: geometry }),
            appearance: new Cesium.MaterialAppearance({
              material: new Cesium.Material({
                fabric: {
                  type: 'LunarMasterMaterial',
                  uniforms: { image: document.createElement('canvas'), u_offset: 0.5, u_alpha: 0.0 }, 
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
            show: state.showResources
          });
          viewer.scene.primitives.add(geologicPrimitive);
      }

      // --- Message Listener for RN ---
      document.addEventListener('message', (event) => {
         try {
           const message = JSON.parse(event.data);
           handleMessage(message);
         } catch(e) {
           console.log("Msg Error", e);
         }
      });
      window.addEventListener('message', (event) => {
         try {
           const message = JSON.parse(event.data);
           handleMessage(message);
         } catch(e) {
         }
      });

      function handleMessage(msg) {
         if (!msg) return;
         switch(msg.type) {
           case 'INJECT_DATA':
             window.receiveMineralData(msg.payload);
             break;
           case 'TOGGLE_RESOURCE': 
             state.showResources = msg.payload.show;
             if (geologicPrimitive) {
                geologicPrimitive.show = msg.payload.show;
                geologicPrimitive.appearance.material.uniforms.u_alpha = msg.payload.show ? 0.6 : 0.0;
             }
             if (msg.payload.type) {
                let newIndex = 12;
                if (msg.payload.type === 'RARE') newIndex = 14; 
                if (msg.payload.type === 'PHYSICS') newIndex = 5; 
                
                if (newIndex !== shaderParams.colIndex) {
                   shaderParams.colIndex = newIndex;
                   calculateStats(newIndex);
                   updateMineralTexture();
                }
             }
             break;
            case 'TOGGLE_LABELS':
             break;
            case 'FLY_TO':
             const { lat, lng } = msg.payload;
             viewer.camera.flyTo({
                 destination: Cesium.Cartesian3.fromDegrees(lng, lat, 2000000)
             });
             break;
            case 'ZOOM_IN':
             viewer.camera.zoomIn(500000);
             break;
            case 'ZOOM_OUT':
             viewer.camera.zoomOut(500000);
             break;
         }
      }
    </script>
</body>
</html>
\`;
