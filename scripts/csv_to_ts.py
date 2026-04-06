#!/usr/bin/env python3
"""
cosmos_times_moon_wiki.csv → TypeScript 데이터 파일 변환 스크립트
Usage: python3 scripts/csv_to_ts.py
"""
import csv
import os
import re
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'assets', 'documents', 'cosmos_times_moon_wiki.csv')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, '..', 'constants', 'CosmosNewsData.ts')

# 키워드 기반 카테고리 자동 분류
CATEGORY_RULES = [
    ('역사', ['아폴로', '닐 암스트롱', '역사', '경매', '유산', '기념', '최초의', '인류가 달에']),
    ('국제', ['협정', '아르테미스 협정', '서명', '국가', '노르웨이', '중국', '미국', '일본', '유럽', '인도', '조약', '협력']),
    ('기술', ['GPS', '위성', '모듈', '기술', '3D 프린팅', '로봇', '시스템', '통신', '발전', 'EDS', '먼지 제거', '핵추진', '원자로', '로켓']),
    ('탐사', ['착륙', '탐사', '로버', '발사', '미션', '아르테미스', '블루 고스트', '블루고스트', '다누리', '창어', '레질리언스', '스타십', 'SLS', '우주선', '달 착륙', '궤도']),
    ('자원', ['헬륨', '광물', '채굴', '얼음', '수빙', '물', '자원', '점유권']),
    ('과학', ['연구', '발견', '분석', '자기장', '샘플', '충돌', '분화구', '지질', '나이', '레골리스', '태양풍']),
]

def categorize(title: str, body: str) -> str:
    text = title + ' ' + body[:200]
    for cat, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in text:
                return cat
    return '과학'  # default

def clean_body(raw_body: str) -> list:
    """본문을 문단 단위로 분리하고 정리"""
    # 앞뒤 공백 제거, 이미지 캡션 등 제거
    lines = raw_body.split('\n')
    paragraphs = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 이미지 URL만 있는 줄 스킵
        if line.startswith('http://') or line.startswith('https://'):
            continue
        # 매우 짧은 줄(캡션 등) 스킵 (5자 미만)
        if len(line) < 5:
            continue
        # ▶ 링크 등 제거
        if line.startswith('▶') or line.startswith('http'):
            continue
        paragraphs.append(line)
    return paragraphs

def extract_first_image(raw_image: str) -> str:
    """이미지 필드에서 첫 번째 URL만 추출"""
    urls = [u.strip() for u in raw_image.split('\n') if u.strip().startswith('http')]
    return urls[0] if urls else ''

def extract_date_clean(raw_date: str) -> str:
    """작성일자에서 날짜만 추출 (시간 제거)"""
    # "2025.05.26 09:59" → "2025.05.26"
    parts = raw_date.strip().split(' ')
    return parts[0] if parts else raw_date.strip()

def format_publish_date(date_str: str) -> str:
    """'2025.05.26' → '2025. 05. 26'"""
    parts = date_str.split('.')
    if len(parts) == 3:
        return f'{parts[0]}. {parts[1].strip().zfill(2)}. {parts[2].strip().zfill(2)}'
    return date_str

def escape_ts_string(s: str) -> str:
    """TypeScript 문자열 이스케이프"""
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\r', '')

def main():
    articles = []
    
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)  # 헤더 스킵
        print(f"CSV 헤더: {header}")
        
        for i, row in enumerate(reader):
            if len(row) < 5:
                continue
            
            title = row[0].strip()
            if not title:
                continue
                
            image_url = extract_first_image(row[1])
            body_raw = row[2]
            date_raw = row[3]
            original_url = row[4].strip()
            
            body_paragraphs = clean_body(body_raw)
            if not body_paragraphs:
                continue
            
            date_clean = extract_date_clean(date_raw)
            category = categorize(title, body_raw)
            
            # summary: 첫 문단에서 100자 추출
            summary = body_paragraphs[0][:150]
            if len(body_paragraphs[0]) > 150:
                summary = summary[:summary.rfind(' ')] + '...' if ' ' in summary else summary + '...'
            
            articles.append({
                'id': f'C-{i + 1}',
                'sourceType': '코스모스',
                'category': category,
                'title': title,
                'summary': summary,
                'date': date_clean,
                'source': '코스모스 타임즈',
                'publishDate': format_publish_date(date_clean),
                'imageUrl': image_url,
                'originalUrl': original_url,
                'body': body_paragraphs,
            })
    
    print(f"\n총 {len(articles)}개 기사 파싱 완료")
    
    # 카테고리 통계
    cats = {}
    for a in articles:
        cats[a['category']] = cats.get(a['category'], 0) + 1
    print("카테고리 분포:")
    for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {cnt}개")
    
    # TypeScript 파일 생성
    ts_lines = []
    ts_lines.append("/**")
    ts_lines.append(" * 코스모스 타임즈 뉴스 데이터")
    ts_lines.append(f" * CSV에서 자동 생성됨 ({len(articles)}개 기사)")
    ts_lines.append(" * 생성 스크립트: scripts/csv_to_ts.py")
    ts_lines.append(" * ")
    ts_lines.append(" * TODO: 나중에 DB에서 가져올 때 이 파일 대신 DB 쿼리로 교체")
    ts_lines.append(" */")
    ts_lines.append("import { type NewsArticle } from '@/services/NewsService';")
    ts_lines.append("")
    ts_lines.append(f"export const COSMOS_ARTICLES: NewsArticle[] = [")
    
    for article in articles:
        ts_lines.append("    {")
        ts_lines.append(f"        id: '{escape_ts_string(article['id'])}',")
        ts_lines.append(f"        sourceType: '코스모스',")
        ts_lines.append(f"        category: '{escape_ts_string(article['category'])}',")
        ts_lines.append(f"        title: '{escape_ts_string(article['title'])}',")
        ts_lines.append(f"        summary: '{escape_ts_string(article['summary'])}',")
        ts_lines.append(f"        date: '{escape_ts_string(article['date'])}',")
        ts_lines.append(f"        source: '코스모스 타임즈',")
        ts_lines.append(f"        publishDate: '{escape_ts_string(article['publishDate'])}',")
        ts_lines.append(f"        imageUrl: '{escape_ts_string(article['imageUrl'])}',")
        ts_lines.append(f"        originalUrl: '{escape_ts_string(article['originalUrl'])}',")
        ts_lines.append(f"        body: [")
        for para in article['body']:
            ts_lines.append(f"            '{escape_ts_string(para)}',")
        ts_lines.append(f"        ],")
        ts_lines.append("    },")
    
    ts_lines.append("];")
    ts_lines.append("")
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(ts_lines))
    
    print(f"\n생성 완료: {OUTPUT_PATH}")
    print(f"파일 크기: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")

if __name__ == '__main__':
    main()
