/**
 * 뉴스 CSV → Supabase 마이그레이션 스크립트
 * node --experimental-modules scripts/import_news.mjs
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://buglkkowaddezcxoprdm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY 환경변수 필요');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CSV 파싱 (RFC 4180 호환)
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const lines = [];
  let currentLine = '';
  let inQuotes = false;

  for (let c = 0; c < text.length; c++) {
    const ch = text[c];
    if (ch === '"') {
      inQuotes = !inQuotes;
      currentLine += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[c + 1] === '\n') c++;
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += ch;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  const headers = parseCSVLine(lines[0]);
  for (let l = 1; l < lines.length; l++) {
    const values = parseCSVLine(lines[l]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || null;
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const csvPath = new URL('../assets/news_rows.csv', import.meta.url).pathname;
  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows`);

  let success = 0;
  let fail = 0;

  // 배치로 50개씩
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50).map(r => ({
      source_type: r.source_type,
      category: r.category,
      title: r.title,
      summary: r.summary,
      date: r.date,
      source: r.source,
      publish_date: r.publish_date,
      image_url: r.image_url || null,
      body: r.body ? JSON.parse(r.body) : [],
      original_url: r.original_url || null,
      location_name: r.location_name || null,
      location_lat: r.location_lat ? parseFloat(r.location_lat) : null,
      location_lng: r.location_lng ? parseFloat(r.location_lng) : null,
    }));

    const { data, error } = await supabase.from('news').insert(batch).select('id');
    if (error) {
      console.error(`Batch ${i} error:`, error.message);
      fail += batch.length;
    } else {
      success += data.length;
      console.log(`Batch ${i}: inserted ${data.length}`);
    }
  }

  console.log(`\nDone: ${success} success, ${fail} fail out of ${rows.length}`);
}

main().catch(console.error);
