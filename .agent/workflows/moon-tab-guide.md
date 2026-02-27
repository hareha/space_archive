---
description: 달 탭 (Moon 3D Viewer) 프로젝트 컨텍스트 가이드
---

# Moon Tab 프로젝트 가이드

## 프로젝트 개요
달 표면을 CesiumJS로 3D 렌더링하고, S2 geometry로 토지를 분할하여 구매할 수 있는 React Native (Expo) 앱.

## 기술 스택
- **프레임워크**: React Native + Expo (expo-router)
- **3D 렌더링**: CesiumJS (WebView 내부에서 실행)
- **그리드 시스템**: S2 Geometry (s2-geometry 라이브러리)
- **통신**: WebView ↔ React Native postMessage

## 핵심 파일 구조

### React Native 측
- `app/(tabs)/moon.tsx` — 달 탭 메인 화면. WebView 호스팅, 셀 선택 상태 관리, 정보 카드 UI

### Cesium 모듈 (constants/cesium/)
코드가 문자열로 조합되어 WebView HTML에 주입됨:
- `CesiumHtml.js` — 최종 HTML 문자열 조합 (각 모듈 import & 합침)
- `cesiumStyles.js` — CSS 스타일 (디버그 패널 포함)
- `cesiumInit.js` — Cesium viewer 초기화, 달 3D 타일 로드, 클릭/호버 핸들러, goBack(), resetView()
- `cesiumGrid.js` — S2 그리드 렌더링, render() 함수, flyToCell()
- `cesiumControls.js` — 줌 인/아웃, 옵션 메뉴, 히트맵/착륙지점 토글
- `cesiumMaps.js` — 중성자 히트맵 데이터, 착륙지점 데이터

### CesiumHtml.ts (constants/)
- `CesiumHtml.js`에서 조합된 HTML을 TypeScript 모듈로 export

## S2 그리드 레벨 체계

### 탐색 경로
```
레벨 0 (전체 달) → 레벨 4 → 레벨 8 → 레벨 12 → 레벨 15 (블록, 최종 선택)
```

### 구매 단위
- **1 Block = 4 Mag** (1개의 15레벨 셀 = 4개의 16레벨 자식 셀)
- 15레벨 셀 선택 시 4개 16레벨 Mag 셀이 표면에 inset(95%) 하이라이팅

### 렌더링 방식
- **그리드 라인**: `Primitive` + `PolylineGeometry` (FIXED_HEIGHT=5000에 떠있음)
- **클릭 타겟**: `Primitive` + `PolygonGeometry` (투명, FIXED_HEIGHT에 배치)
- **표면 하이라이팅**: `ClassificationPrimitive` (3D 타일 표면에 투영)
- **Mag 경계**: 4셀을 95% inset하여 틈새로 경계 표현

### CELL_SELECTED 페이로드 (15레벨)
```json
{
  "cellId": "토큰", "token": "토큰",
  "lat": 위도, "lng": 경도,
  "level": 15,
  "childLevel": 16,
  "unit": "1 Block = 4 Mag",
  "magCount": 4,
  "magTokens": ["토큰1", "토큰2", "토큰3", "토큰4"],
  "minerals": { "feo": "X%", "tio2": "X%", "waterIce": "X%", "surfaceTemp": "XK" },
  "price": "$X.XX",
  "area": "~3.2 km²"
}
```

## 주요 설계 결정

1. **그리드가 FIXED_HEIGHT(5000m)에 떠있는 이유**: 달 표면 3D 타일과 겹치면 z-fighting 발생. 떠있는 그리드로 클릭 타겟 역할.
2. **표면 하이라이팅은 ClassificationPrimitive**: 3D 타일에 직접 투영되어 바닥에 정확히 표시.
3. **16레벨 개별 선택 기능 미구현**: 그리드(공중)↔표면투영 위치 차이로 클릭 정확도 문제. 15레벨 블록이 최종 선택.
4. **Cesium 코드 모듈 분리**: 하나의 거대한 HTML 문자열 대신 기능별로 분리하여 유지보수성 확보.

## S2 토큰 참고
- S2 토큰은 64비트 셀 ID의 hex 표현 (trailing zero 제거)
- 부모(15레벨)와 자식(16레벨)의 토큰 자릿수가 같을 수 있음 (정상 동작)
- 예: 부모 `479b5a6e4` → 자식 `479b5a6e1`, `479b5a6e3`, `479b5a6e5`, `479b5a6e7`

## 현재 상태 (2025-02-19 기준)
- ✅ S2 15레벨 블록 선택 시스템 구현
- ✅ 4개 Mag 셀 inset 하이라이팅 (표면 투영)
- ✅ 셀 정보 카드 (단위/Mag 토큰 목록 표시)
- ✅ 디버그 패널 (그리드 상태 실시간 표시)
- ⬜ 구매 플로우 연동 (현재 console.log placeholder)
- ⬜ 성능 최적화 (대규모 그리드 렌더링)

## 자주 쓰는 명령어
```bash
# 개발 서버
npx expo start

# EAS 업데이트
npx eas-cli update --branch preview --message "메시지"

# Git
git add -A && git commit -m "메시지" && git push
```
