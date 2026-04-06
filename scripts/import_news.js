const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://buglkkowaddezcxoprdm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Z2xra293YWRkZXpjeG9wcmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzYwMjksImV4cCI6MjA5MDYxMjAyOX0.X5J8AG4FSPBF3hol5OWLlDjIEKJrNu826-fRDKte-ek';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Simple CSV parser
function parseCSV(text) {
  const lines = [];
  let cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQ = !inQ;
    else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      if (cur.trim()) lines.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) lines.push(cur);

  function parseLine(line) {
    const r = []; let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i+1]==='"'){c+='"';i++;}else q=false; } else c+=ch; }
      else { if (ch==='"') q=true; else if (ch===','){r.push(c);c='';} else c+=ch; }
    }
    r.push(c);
    return r;
  }

  const headers = parseLine(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  });
}

async function main() {
  const text = fs.readFileSync(__dirname + '/../assets/news_rows.csv', 'utf-8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows`);

  let ok = 0, fail = 0;
  // Insert 5 at a time
  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5).map(r => {
      let bodyArr = [];
      try {
        if (r.body && r.body.trim()) bodyArr = JSON.parse(r.body);
      } catch(e) {
        console.warn(`  body parse fail row: ${r.title?.substring(0,20)}...`);
        bodyArr = [r.body || ''];
      }
      return {
        source_type: r.source_type,
        category: r.category,
        title: r.title,
        summary: r.summary,
        date: r.date,
        source: r.source,
        publish_date: r.publish_date,
        image_url: r.image_url || null,
        body: bodyArr,
        original_url: r.original_url || null,
        location_name: r.location_name || null,
        location_lat: r.location_lat ? parseFloat(r.location_lat) : null,
        location_lng: r.location_lng ? parseFloat(r.location_lng) : null,
      };
    });

    const { data, error } = await supabase.from('news').insert(batch).select('id');
    if (error) {
      console.error(`Batch ${i}: ${error.message}`);
      fail += batch.length;
    } else {
      ok += data.length;
      console.log(`Batch ${i}: OK (${data.length})`);
    }
  }
  console.log(`\nTotal: ${ok} success, ${fail} fail`);
}

main().catch(e => { console.error(e); process.exit(1); });
