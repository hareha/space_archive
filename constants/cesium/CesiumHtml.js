// CesiumHtml.js — 메인 조합 파일
// 각 모듈의 코드 문자열을 조합하여 최종 HTML 문자열을 생성합니다.

import { CESIUM_STYLES } from './cesiumStyles.js';
import { CESIUM_INIT } from './cesiumInit.js';
import { CESIUM_GRID } from './cesiumGrid.js';
import { CESIUM_MAPS } from './cesiumMaps.js';
import { CESIUM_LANDMARKS } from './cesiumLandmarks.js';
import { CESIUM_CONTROLS } from './cesiumControls.js';

/**
 * Apollo LM GLB 로컬 URI를 주입하여 HTML 생성
 * @param {string} apolloModelUri - Asset.localUri (e.g. 'file:///...') 또는 빈 문자열 시 CDN fallback
 */
export function createCesiumHtml(apolloModelUri) {
  const uriJson = JSON.stringify(apolloModelUri || '');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
  <title>Moon 3D</title>
  
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"></script>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.min.js"></script>
  
  <style>
${CESIUM_STYLES}
  </style>

  <script>
    window.onerror = function(msg, url, line, col, error) {
        var el = document.getElementById('errorDisplay');
        if(el) {
            el.innerText = "JS Error: " + msg + "\\nLocation: " + url + ":" + line + ":" + col + "\\n" + (error ? error.stack : 'No stack');
            el.style.display = 'block';
        }
        var loadText = document.getElementById('loadingText');
        if(loadText) loadText.style.display = 'none';
        var overlay = document.getElementById('loadingOverlay');
        if(overlay) overlay.style.display = 'flex';
    };
    // Apollo LM GLB URI (로컬 파일 또는 CDN fallback)
    window.APOLLO_LM_URI = ${uriJson};
  </script>
</head>

<body>
  <div id="cesiumContainer"></div>
  <div id="debugPanel" style="display:none;">Grid Debug: Loading...</div>

  <div id="loadingOverlay">
      <div id="loadingText">INITIALIZING MOON...</div>
      <div id="errorDisplay"></div>
  </div>

  <script type="module">
${CESIUM_INIT}
${CESIUM_GRID}
${CESIUM_MAPS}
${CESIUM_LANDMARKS}
${CESIUM_CONTROLS}
  </script>
</body>
</html>`;
}

// 하위 호환 (기존 코드에서 CESIUM_HTML을 직접 사용하는 경우)
export const CESIUM_HTML = createCesiumHtml('');
