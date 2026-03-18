/**
 * S2 Cell 유틸리티 - 달 지형 범위 내 S2 셀 계산
 * Level 16 기준 실제 면적 계산
 */

const MOON_RADIUS_KM = 1737.4;

/**
 * S2 Level 16 기준 달 표면 셀 하나의 면적 (km²)
 * 달 표면적 = 4π × 1737.4² ≈ 37,932,330 km²
 * Level 16 총 셀 수 = 6 × 4^16 = 25,769,803,776
 * ≈ 0.001472 km² (약 1,472 m²)
 */
const MOON_S2_LEVEL16_CELL_AREA_KM2 =
  (4 * Math.PI * MOON_RADIUS_KM * MOON_RADIUS_KM) / (6 * Math.pow(4, 16));

/**
 * 두 좌표 사이의 거리 계산 (km, Haversine)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * 점이 타원 내부에 있는지 판별
 */
function isPointInEllipse(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  semiMajorKm: number,
  semiMinorKm: number,
  angleDeg: number
): boolean {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dNorth = (pointLat - centerLat) * (Math.PI / 180) * MOON_RADIUS_KM;
  const dEast =
    (pointLng - centerLng) *
    (Math.PI / 180) *
    MOON_RADIUS_KM *
    Math.cos(toRad(centerLat));

  const rotRad = toRad(angleDeg);
  const rx = dEast * Math.cos(rotRad) + dNorth * Math.sin(rotRad);
  const ry = -dEast * Math.sin(rotRad) + dNorth * Math.cos(rotRad);

  return (rx / semiMajorKm) ** 2 + (ry / semiMinorKm) ** 2 <= 1;
}

export interface S2CellInfo {
  lat: number;
  lng: number;
  cellId: string;
  isOccupied: boolean;
  owner?: string;
}

/**
 * 원형 범위의 실제 면적 계산 (km²) — S2 Level 16 기준
 */
export function getCircleAreaKm2(radiusKm: number): number {
  // 구면 위 원의 면적 = 2πR²(1 - cos(θ)), θ = r/R
  const theta = radiusKm / MOON_RADIUS_KM;
  return 2 * Math.PI * MOON_RADIUS_KM * MOON_RADIUS_KM * (1 - Math.cos(theta));
}

/**
 * 타원형 범위의 실제 면적 계산 (km²) — 근사값
 */
export function getEllipseAreaKm2(lengthKm: number, widthKm: number): number {
  // π × a × b (평면 근사, 작은 영역에서 유효)
  return Math.PI * (lengthKm / 2) * (widthKm / 2);
}

/**
 * 면적에서 S2 Level 16 셀 수 계산
 */
export function getCellCountFromArea(areaKm2: number): number {
  return Math.round(areaKm2 / MOON_S2_LEVEL16_CELL_AREA_KM2);
}

/**
 * 원형 범위 내 셀 목록 생성 (시각화용, 최대 500)
 */
export function getCellsInCircle(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  level: number = 16
): S2CellInfo[] {
  const MAX_STEPS = 15;
  const MAX_CELLS = 500;
  const idealStep = radiusKm / MAX_STEPS;
  const cellSizeKm = Math.max(0.89, idealStep);
  const cells: S2CellInfo[] = [];

  const latStep = (cellSizeKm / MOON_RADIUS_KM) * (180 / Math.PI);
  const lngStep = latStep / Math.cos((centerLat * Math.PI) / 180);
  const stepsNeeded = Math.min(Math.ceil(radiusKm / cellSizeKm) + 1, MAX_STEPS);

  for (let i = -stepsNeeded; i <= stepsNeeded; i++) {
    for (let j = -stepsNeeded; j <= stepsNeeded; j++) {
      const cLat = centerLat + i * latStep;
      const cLng = centerLng + j * lngStep;
      const dist = haversineDistance(centerLat, centerLng, cLat, cLng);

      if (dist <= radiusKm) {
        cells.push({
          lat: cLat,
          lng: cLng,
          cellId: `L${level}_${cLat.toFixed(4)}_${cLng.toFixed(4)}`,
          isOccupied: false,
        });
      }
      if (cells.length >= MAX_CELLS) return cells;
    }
  }

  return cells;
}

/**
 * 타원형 범위 내 셀 목록 생성 (시각화용, 최대 500)
 */
export function getCellsInEllipse(
  centerLat: number,
  centerLng: number,
  lengthKm: number,
  widthKm: number,
  angleDeg: number,
  level: number = 16
): S2CellInfo[] {
  const MAX_STEPS = 15;
  const MAX_CELLS = 500;
  const semiMajor = lengthKm / 2;
  const semiMinor = widthKm / 2;
  const maxRadius = Math.max(semiMajor, semiMinor);
  const idealStep = maxRadius / MAX_STEPS;
  const cellSizeKm = Math.max(0.89, idealStep);
  const cells: S2CellInfo[] = [];

  const latStep = (cellSizeKm / MOON_RADIUS_KM) * (180 / Math.PI);
  const lngStep = latStep / Math.cos((centerLat * Math.PI) / 180);
  const stepsNeeded = Math.min(Math.ceil(maxRadius / cellSizeKm) + 1, MAX_STEPS);

  for (let i = -stepsNeeded; i <= stepsNeeded; i++) {
    for (let j = -stepsNeeded; j <= stepsNeeded; j++) {
      const cLat = centerLat + i * latStep;
      const cLng = centerLng + j * lngStep;

      if (isPointInEllipse(cLat, cLng, centerLat, centerLng, semiMajor, semiMinor, angleDeg)) {
        cells.push({
          lat: cLat,
          lng: cLng,
          cellId: `L${level}_${cLat.toFixed(4)}_${cLng.toFixed(4)}`,
          isOccupied: false,
        });
      }
      if (cells.length >= MAX_CELLS) return cells;
    }
  }

  return cells;
}

/**
 * 점유 통계 — 실제 S2 Level 16 면적 기반
 */
export function getOccupationStats(
  target: { radiusKm?: number; diameterKm?: number; widthKm?: number }
) {
  let areaKm2: number;

  if (target.radiusKm) {
    areaKm2 = getCircleAreaKm2(target.radiusKm);
  } else if (target.diameterKm) {
    const w = target.widthKm || target.diameterKm;
    areaKm2 = getEllipseAreaKm2(target.diameterKm, w);
  } else {
    areaKm2 = getCircleAreaKm2(5); // 기본값 5km
  }

  const totalCells = getCellCountFromArea(areaKm2);

  return {
    totalCells,
    areaKm2,
    cellAreaKm2: MOON_S2_LEVEL16_CELL_AREA_KM2,
  };
}
