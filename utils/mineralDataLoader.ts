import { Asset } from 'expo-asset';

export interface MineralData {
    id: number;
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
    am: number;        // 원자 질량 (g/mol)
    neutron: number;   // 중성자 밀도 (g/cm³)
    mgo: number;       // 마그네슘 (wt%)
    al2o3: number;     // 알루미늄 (wt%)
    sio2: number;      // 규소 (wt%)
    cao: number;       // 칼슘 (wt%)
    tio2: number;      // 티타늄 (wt%)
    feo: number;       // 철 (wt%)
    k: number;         // 칼륨 (ppm)
    th: number;        // 토륨 (ppm)
    u: number;         // 우라늄 (ppm)
}

/**
 * lpgrs_high1_elem_abundance_2deg.tab 파일을 읽어서 광물 데이터를 파싱합니다.
 */
export async function loadMineralData(): Promise<MineralData[]> {
    try {
        console.log('Loading mineral data...');

        // Asset에서 파일 로드
        const asset = Asset.fromModule(require('../assets/lpgrs_high1_elem_abundance_2deg.tab'));
        await asset.downloadAsync();

        if (!asset.localUri) {
            throw new Error('Failed to load asset');
        }

        // 파일 읽기 - fetch를 사용하여 읽기
        const response = await fetch(asset.localUri);
        const fileContent = await response.text();

        // 라인별로 분리
        const lines = fileContent.split('\n');
        const mineralDataArray: MineralData[] = [];

        // 각 라인 파싱
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 빈 라인 스킵
            if (!line) continue;

            // 공백으로 분리
            const values = line.split(/\s+/);

            // 최소 16개 컬럼이 있어야 함
            if (values.length < 16) continue;

            try {
                const mineralData: MineralData = {
                    id: parseInt(values[0]),
                    latMin: parseFloat(values[1]),
                    latMax: parseFloat(values[2]),
                    lonMin: parseFloat(values[3]),
                    lonMax: parseFloat(values[4]),
                    am: parseFloat(values[5]),
                    neutron: parseFloat(values[6]),
                    mgo: parseFloat(values[7]),
                    al2o3: parseFloat(values[8]),
                    sio2: parseFloat(values[9]),
                    cao: parseFloat(values[10]),
                    tio2: parseFloat(values[11]),
                    feo: parseFloat(values[12]),
                    k: parseFloat(values[13]),
                    th: parseFloat(values[14]),
                    u: parseFloat(values[15]),
                };

                mineralDataArray.push(mineralData);
            } catch (error) {
                console.warn(`Failed to parse line ${i}:`, error);
            }
        }

        console.log(`Loaded ${mineralDataArray.length} mineral data entries`);
        return mineralDataArray;

    } catch (error) {
        console.error('Error loading mineral data:', error);
        throw error;
    }
}

/**
 * 위경도 범위로부터 셀 ID를 생성합니다.
 * 2도 그리드 기반으로 ID를 생성합니다.
 */
export function getCellIdFromLatLon(latMin: number, latMax: number, lonMin: number, lonMax: number): string {
    // 중심점 계산
    const lat = (latMin + latMax) / 2;
    const lon = (lonMin + lonMax) / 2;

    // 2도 그리드 기반 인덱스 계산
    const latIndex = Math.floor((lat + 90) / 2);
    const lonIndex = Math.floor((lon + 180) / 2);

    return `cell_${latIndex}_${lonIndex}`;
}

/**
 * 광물 데이터에서 특정 필터의 값을 가져옵니다.
 */
export function getMineralValue(data: MineralData, filter: string): number {
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

/**
 * 광물 필터별 값의 범위를 정의합니다.
 */
export const MINERAL_RANGES = {
    feo: { min: 0, max: 25, unit: 'wt%' },
    tio2: { min: 0, max: 15, unit: 'wt%' },
    mgo: { min: 0, max: 35, unit: 'wt%' },
    al2o3: { min: 0, max: 30, unit: 'wt%' },
    sio2: { min: 0, max: 50, unit: 'wt%' },
    cao: { min: 0, max: 20, unit: 'wt%' },
    k: { min: 0, max: 5000, unit: 'ppm' },
    th: { min: 0, max: 20, unit: 'ppm' },
    u: { min: 0, max: 10, unit: 'ppm' },
    am: { min: 20, max: 25, unit: 'g/mol' },
    neutron: { min: 0, max: 1, unit: 'g/cm³' },
} as const;
