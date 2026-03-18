/**
 * scrapStore.ts
 * 관심 영역(착륙지 & 지형) + 콘텐츠 보관함(기사) 스크랩 관리
 * AsyncStorage 기반 영속화
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── 타입 ───
export interface ScrapArea {
  id: string;
  type: 'landing' | 'feature';
  name: string;
  lat: number;
  lng: number;
  extra?: string;     // 착륙지: country/date, 지형: type_kr
  savedAt: number;    // timestamp
}

export interface ScrapContent {
  newsId: string;
  title: string;
  summary: string;
  savedAt: number;
}

const AREA_KEY = 'scrap_areas';
const CONTENT_KEY = 'scrap_contents';

// ─── 관심 영역 ───
export async function getScrapAreas(): Promise<ScrapArea[]> {
  const raw = await AsyncStorage.getItem(AREA_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addScrapArea(item: ScrapArea): Promise<void> {
  const list = await getScrapAreas();
  if (list.find(a => a.id === item.id)) return; // 중복 방지
  list.unshift(item);
  await AsyncStorage.setItem(AREA_KEY, JSON.stringify(list));
}

export async function removeScrapArea(id: string): Promise<void> {
  const list = await getScrapAreas();
  await AsyncStorage.setItem(AREA_KEY, JSON.stringify(list.filter(a => a.id !== id)));
}

export async function isAreaScrapped(id: string): Promise<boolean> {
  const list = await getScrapAreas();
  return !!list.find(a => a.id === id);
}

// ─── 콘텐츠 보관함 ───
export async function getScrapContents(): Promise<ScrapContent[]> {
  const raw = await AsyncStorage.getItem(CONTENT_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addScrapContent(item: ScrapContent): Promise<void> {
  const list = await getScrapContents();
  if (list.find(c => c.newsId === item.newsId)) return;
  list.unshift(item);
  await AsyncStorage.setItem(CONTENT_KEY, JSON.stringify(list));
}

export async function removeScrapContent(newsId: string): Promise<void> {
  const list = await getScrapContents();
  await AsyncStorage.setItem(CONTENT_KEY, JSON.stringify(list.filter(c => c.newsId !== newsId)));
}

export async function isContentScrapped(newsId: string): Promise<boolean> {
  const list = await getScrapContents();
  return !!list.find(c => c.newsId === newsId);
}
