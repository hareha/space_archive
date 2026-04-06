/**
 * 뉴스 서비스 (Supabase 연동)
 * 
 * Supabase news 테이블에서 실시간 데이터를 조회합니다.
 * 캐시를 유지하여 불필요한 네트워크 요청을 줄입니다.
 */
import { supabase } from './supabase';

// ── 타입 (DB 스키마 기반) ──
export interface NewsArticle {
  id: number;
  sourceType: '코스모스' | '생성형';
  category: string;
  title: string;
  summary: string;
  publishDate: string; // ISO string from DB
  source: string;
  imageUrl: string;
  body: string[];
  originalUrl?: string;
  location?: {
    name: string;
    lat: number;
    lng: number;
  };
  viewCount: number;
}

export type SourceType = '전체' | '코스모스' | '생성형';

// ── DB row → NewsArticle 변환 ──
function mapRow(row: any): NewsArticle {
  return {
    id: row.id,
    sourceType: row.source_type,
    category: row.category,
    title: row.title,
    summary: row.summary,
    publishDate: row.published_at,
    source: row.source,
    imageUrl: row.image_url || '',
    body: row.body || [],
    originalUrl: row.original_url || undefined,
    location: row.location_name
      ? { name: row.location_name, lat: row.location_lat, lng: row.location_lng }
      : undefined,
    viewCount: row.view_count || 0,
  };
}

// ── 내부 캐시 ──
let _cache: NewsArticle[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

async function fetchAll(): Promise<NewsArticle[]> {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('[NewsService] fetchAll error:', error.message);
    return _cache || [];
  }

  _cache = (data || []).map(mapRow);
  _cacheTime = now;
  return _cache;
}

// ── Public API ──
const NewsService = {
  /** 코스모스 타임즈 기사 전체 조회 */
  async getCosmosNews(): Promise<NewsArticle[]> {
    const all = await fetchAll();
    return all.filter(a => a.sourceType === '코스모스');
  },

  /** 생성형 기사 전체 조회 */
  async getGeneratedNews(): Promise<NewsArticle[]> {
    const all = await fetchAll();
    return all.filter(a => a.sourceType === '생성형');
  },

  /** 전체 기사 조회 */
  async getAllNews(): Promise<NewsArticle[]> {
    return fetchAll();
  },

  /** ID로 기사 조회 */
  async getById(id: string | number): Promise<NewsArticle | null> {
    // 캐시에서 먼저 찾기
    const all = await fetchAll();
    const found = all.find(item => item.id.toString() === id.toString());
    if (found) return found;

    // 캐시에 없으면 DB직접 조회
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', typeof id === 'string' ? parseInt(id) : id)
      .single();

    if (error || !data) return null;
    return mapRow(data);
  },

  /** 소스 타입별 필터 조회 */
  async getBySourceType(sourceType: SourceType): Promise<NewsArticle[]> {
    if (sourceType === '전체') return fetchAll();
    const all = await fetchAll();
    return all.filter(item => item.sourceType === sourceType);
  },

  /** 카테고리별 필터 조회 */
  async getByCategory(category: string, sourceType?: SourceType): Promise<NewsArticle[]> {
    let pool = await fetchAll();
    if (sourceType && sourceType !== '전체') {
      pool = pool.filter(item => item.sourceType === sourceType);
    }
    if (category === '전체') return pool;
    return pool.filter(item => item.category === category);
  },

  /** 검색 */
  async search(query: string, sourceType?: SourceType): Promise<NewsArticle[]> {
    if (!query.trim()) return this.getBySourceType(sourceType || '전체');
    const q = query.toLowerCase();
    let pool = await fetchAll();
    if (sourceType && sourceType !== '전체') {
      pool = pool.filter(item => item.sourceType === sourceType);
    }
    return pool.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q)
    );
  },

  /** Breaking 뉴스 (최신 코스모스 기사 N건) */
  async getBreakingNews(count: number = 3): Promise<NewsArticle[]> {
    const cosmos = await this.getCosmosNews();
    return cosmos.slice(0, count);
  },

  /** 카테고리 목록 조회 (동적) */
  async getCategories(sourceType?: SourceType): Promise<string[]> {
    let pool = await fetchAll();
    if (sourceType && sourceType !== '전체') {
      pool = pool.filter(item => item.sourceType === sourceType);
    }
    const cats = Array.from(new Set(pool.map(item => item.category)));
    return ['전체', ...cats];
  },

  /** 전체 기사 수 */
  async getCount(sourceType?: SourceType): Promise<number> {
    if (sourceType && sourceType !== '전체') {
      const filtered = await this.getBySourceType(sourceType);
      return filtered.length;
    }
    const all = await fetchAll();
    return all.length;
  },

  /** 조회수 증가 */
  async incrementViewCount(id: string | number): Promise<void> {
    const { error } = await supabase.rpc('increment_news_view', { news_id: typeof id === 'string' ? parseInt(id) : id });
    if (error) {
      console.error('[NewsService] incrementViewCount error:', error.message);
    }
  },

  /** 캐시 강제 초기화 */
  invalidateCache() {
    _cache = null;
    _cacheTime = 0;
  },
};

export default NewsService;
