// CesiumARSurfaceHtml.js — 달 표면 1인칭 자이로 뷰 전용 Cesium HTML
// 카메라를 셀 중심 지표면 위에 배치, 디바이스 자이로로 시점 조작
// 풀스크린 Cesium (카메라 배경 없음)

export function createCesiumARSurfaceHtml(lat, lng) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Moon Surface View</title>
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"><\/script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <style>
    html, body, #cesiumContainer {
      width: 100%; height: 100%;
      margin: 0; padding: 0;
      overflow: hidden;
      background: #000 !important;
      -webkit-user-select: none;
      user-select: none;
    }
    .cesium-viewer-toolbar,
    .cesium-viewer-bottom,
    .cesium-credit-logoContainer,
    .cesium-credit-textContainer,
    .cesium-viewer-cesiumWidgetContainer .cesium-widget-credits {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="cesiumContainer"></div>
  <script>
    function sendToRN(type, payload) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(
            Object.assign({ type: type }, payload || {})
          ));
        }
      } catch(e) {}
    }

    (function initSurfaceView() {
      try {
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MjNhYjIzZi0wMWU5LTQzOTEtODY3Ni1kY2JkNTEyMmE2NTgiLCJpZCI6Mzc2MDQ4LCJpYXQiOjE3Njc4MzYyNTR9.K6HpEEiCNNlC8AzsTe3zuuGtcg9AJKEAnt8mA2MIoMg';

        var moonEllipsoid = Cesium.Ellipsoid.MOON;
        var targetLat = ${lat};
        var targetLng = ${lng};
        var latRad = Cesium.Math.toRadians(targetLat);
        var lngRad = Cesium.Math.toRadians(targetLng);

        var viewer = new Cesium.Viewer('cesiumContainer', {
          globe: new Cesium.Globe(moonEllipsoid),
          baseLayer: false,
          skyBox: false,
          skyAtmosphere: false,
          geocoder: false,
          timeline: false,
          animation: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          homeButton: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
          creditContainer: document.createElement('div'),
          scene3DOnly: true
        });

        // 어두운 우주 배경
        viewer.scene.backgroundColor = new Cesium.Color(0.02, 0.02, 0.05, 1.0);
        viewer.scene.globe.show = false;
        viewer.scene.highDynamicRange = false;
        try { viewer.scene.sun.show = false; } catch(e) {}
        try { viewer.scene.moon.show = false; } catch(e) {}
        viewer.scene.skyBox = undefined;
        viewer.scene.fog.enabled = false;

        // 사용자 터치 입력 비활성 (자이로로만 제어)
        var controller = viewer.scene.screenSpaceCameraController;
        controller.enableRotate = false;
        controller.enableZoom = false;
        controller.enableTranslate = false;
        controller.enableTilt = false;
        controller.enableLook = false;
        controller.zoomEventTypes = [];

        try { viewer.resolutionScale = window.devicePixelRatio || 1; } catch(e) {}

        // 조명 — 밝은 조명으로 지형 선명하게
        viewer.shadows = false;
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(0.5, 0.5, -0.7),
          intensity: 2.5
        });

        // 3D Tileset 로드
        Cesium.IonResource.fromAssetId(2684829).then(function(resource) {
          return Cesium.Cesium3DTileset.fromUrl(resource);
        }).then(function(moonTileset) {
          viewer.scene.primitives.add(moonTileset);

          // 타일셋 로드 후 카메라 배치
          setTimeout(function() {
            var surfaceH = 0;
            try {
              var carto = new Cesium.Cartographic(lngRad, latRad);
              var sh = viewer.scene.sampleHeight(carto);
              if (sh !== undefined && !isNaN(sh)) {
                surfaceH = sh;
              }
            } catch(e) {}

            // 지표면 위 1.7m (사람 눈높이)
            var eyeHeight = surfaceH + 1.7;
            var eyePos = Cesium.Cartesian3.fromRadians(lngRad, latRad, eyeHeight, moonEllipsoid);

            // 초기 시야: 약간 아래를 내려다보기
            viewer.camera.setView({
              destination: eyePos,
              orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-15),
                roll: 0
              }
            });

            window._viewer = viewer;
            window._eyePos = eyePos;
            window._surfaceH = surfaceH;
            window._moonEllipsoid = moonEllipsoid;
            window._lngRad = lngRad;
            window._latRad = latRad;

            sendToRN('AR_SURFACE_READY', { success: true, surfaceH: surfaceH });
          }, 500);

        }).catch(function(err) {
          sendToRN('AR_SURFACE_ERROR', { error: 'Tileset: ' + String(err) });
        });

        // ── 디바이스 방향 업데이트 ──
        function handleMessage(event) {
          try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'UPDATE_ORIENTATION') {
              if (!window._viewer || !window._eyePos) return;
              var heading = Cesium.Math.toRadians(data.heading || 0);
              var pitch = Cesium.Math.toRadians(data.pitch || 0);

              window._viewer.camera.setView({
                destination: window._eyePos,
                orientation: {
                  heading: heading,
                  pitch: pitch,
                  roll: 0
                }
              });
            }
          } catch(e) {}
        }
        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage);

      } catch(err) {
        sendToRN('AR_SURFACE_ERROR', { error: 'Init: ' + String(err) });
      }
    })();
  <\/script>
</body>
</html>`;
}
