/**
 * 달 착륙선 3D 모델 배치 데이터
 * 탐사 모드(index.tsx)와 구역 상세(territory-detail.tsx) 양쪽에서 공유.
 * 새 착륙선 추가 시 이 파일만 수정하면 됩니다.
 */

export interface LandingModel {
    /** 고유 ID (cesiumLandmarks의 id와 동일) */
    id: string;
    /** 표시 이름 */
    name: string;
    /** 위도 (도) */
    lat: number;
    /** 경도 (도) */
    lng: number;
    /** 모델 파일명 (assets/3d/ 안) */
    glbFile: string;
    /** require() 경로 — 빌드 시점에 해석됨 */
    glbRequire: any;
    /** 배치 고도 (m) */
    height: number;
    /** 모델 스케일 */
    scale: number;
}

export const LANDING_MODELS: LandingModel[] = [
    {
        id: 'apollo11',
        name: '아폴로 11호',
        lat: 0.674,
        lng: 23.473,
        glbFile: 'apollo',
        glbRequire: require('../assets/3d/apollo_11_lunar_module.glb'),
        height: 950,
        scale: 6,
    },
    {
        id: 'luna2',
        name: '루나 2호',
        lat: 29.1,
        lng: 0.0,
        glbFile: 'apollo', // 같은 모델 재활용 (별도 모델 추가 시 변경)
        glbRequire: require('../assets/3d/apollo_11_lunar_module.glb'),
        height: 950,
        scale: 6,
    },
];

/**
 * JS 문자열로 직렬화 (WebView injectJavaScript에서 사용)
 * cesiumControls.js의 SET_MODEL_URI 핸들러에서 사용할 수 있는 사이트 목록
 */
export const LANDING_SITES_JS = LANDING_MODELS.map(m => ({
    id: m.id,
    lat: m.lat,
    lng: m.lng,
    height: m.height,
    scale: m.scale,
    glbFile: m.glbFile,
}));
