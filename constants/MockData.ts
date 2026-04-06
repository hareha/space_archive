/**
 * MockData.ts
 * 
 * 뉴스 데이터는 Supabase news 테이블로 이관 완료.
 * 이 파일은 더 이상 사용되지 않습니다.
 * 
 * @deprecated Supabase 연동 완료 후 삭제 예정
 */

// 하위 호환성을 위해 빈 export 유지
export const NEWS_DATA: any[] = [];
export const MY_LANDS: any[] = [];
export const SCRAPPED_NEWS: any[] = [];

export interface NewsItem {
    id: string;
    category: string;
    sourceType: '코스모스' | '생성형';
    title: string;
    summary: string;
    date: string;
    source: string;
    publishDate: string;
    imageUrl: string;
    body: string[];
    originalUrl?: string;
    location?: {
        name: string;
        lat: number;
        lng: number;
    };
}
