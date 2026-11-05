/** 대전광역시 중구 음식점 정보 (ODCLOUD 2025-11-27 자료)
 * GitHub Secret DATA_GO_KR_KEY = 공공데이터포털 Decoding 인증키
 * 정확한 데이터 컬럼은 API 응답에 따라 자동 인식하며, 모르는 필드는 원본 정보로 함께 보관.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const env = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* GitHub Actions uses Secrets */ }

const key = process.env.DATA_GO_KR_KEY?.trim();
if (!key || key.includes('여기에_')) throw new Error('DATA_GO_KR_KEY를 GitHub Actions Secrets에 등록하세요.');
const BASE = process.env.API_URL || 'https://api.odcloud.kr/api/3033892/v1/uddi:4c91d0b7-3e9a-4c3b-b61f-fde6f3bd97e7';
const PAGE_SIZE = Math.max(1, Math.min(1000, Number(process.env.PAGE_SIZE) || 1000));
const MAX_PAGES = Math.max(1, Number(process.env.MAX_PAGES) || 10000);
const DELAY = Math.max(0, Number(process.env.REQUEST_DELAY_MS) || 180);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => value === null || value === undefined ? '' : String(value).trim();
const get = (row, keys) => {
  for (const name of keys) {
    const exact = row[name];
    if (clean(exact)) return clean(exact);
  }
  const normalized = Object.entries(row).map(([k, v]) => [k.replace(/[\s_()·\-]/g, '').toLowerCase(), v]);
  for (const name of keys) {
    const match = normalized.find(([k]) => k === name.replace(/[\s_()·\-]/g, '').toLowerCase());
    if (match && clean(match[1])) return clean(match[1]);
  }
  return '';
};

function normalize(row, index) {
  const name = get(row, ['업소명','업체명','사업장명','음식점명','상호명','상호','가게명','업소 명','소재지명','bplcNm','name']);
  const address = get(row, ['도로명주소','도로명 주소','소재지도로명주소','소재지전체주소','주소','소재지','사업장소재지','지번주소','영업소주소','소재지주소','소재지(도로명)','rdnWhlAddr','siteWhlAddr','address']);
  const category = get(row, ['업태명','업종','업태','업종명','업태구분명','음식종류','음식점분류','분류','uptaeNm']) || '일반음식점';
  const phone = get(row, ['전화번호','연락처','전화','소재지전화','업소전화번호','siteTel']);
  const status = get(row, ['영업상태','영업상태명','상태','상세영업상태명','영업여부','trdStateNm']);
  const id = get(row, ['관리번호','인허가번호','번호','순번','연번','id']) || `${name}|${address}|${index}`;
  return {id,name,address,category,phone,status};
}
function isActive(r) {
  return !/폐업|말소|취소|종료|폐쇄|휴업|영업정지/.test(r.status);
}
async function requestPage(page) {
  const url = new URL(BASE);
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(PAGE_SIZE));
  url.searchParams.set('returnType', 'JSON');
  url.searchParams.set('serviceKey', key);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(45000), headers: {Accept:'application/json'}});
      const body = await response.text();
      if (!response.ok) {
        const err = new Error(`API HTTP ${response.status}: ${body.slice(0, 250)}`);
        if (response.status >= 400 && response.status < 500 && response.status !== 429) throw Object.assign(err,{nonRetryable:true});
        throw err;
      }
      let json;
      try { json = JSON.parse(body); } catch { throw Error(`JSON 응답이 아닙니다: ${body.slice(0,180)}`); }
      if (!Array.isArray(json.data)) throw Error(`ODCLOUD 응답에 data 배열이 없습니다. 필드: ${Object.keys(json).join(', ')}`);
      return {items:json.data, total:Number.isFinite(Number(json.totalCount)) ? Number(json.totalCount) : null};
    } catch (error) {
      if (error.nonRetryable || attempt === 4) throw error;
      console.log(`페이지 ${page} 재시도 ${attempt}/3: ${error.message}`);
      await sleep(attempt * 1500);
    }
  }
}

const rows = [];
let scanned = 0, pages = 0, total = null, complete = false;
console.log('대전광역시 중구 음식점 정보 ODCLOUD API 수집 시작 (2025-11-27 자료)');
for (let page = 1; page <= MAX_PAGES; page++) {
  const result = await requestPage(page);
  const {items} = result;
  pages = page;
  if (result.total !== null) total = result.total;
  if (page === 1) {
    console.log(`첫 페이지 ${items.length}건 / 전체 ${total ?? '미표시'}건`);
    if (items[0]) console.log('실제 응답 컬럼:', Object.keys(items[0]).join(', '));
  }
  rows.push(...items);
  scanned += items.length;
  if (page % 10 === 0) console.log(`${page}페이지, 누적 ${scanned}건`);
  if (items.length === 0 || (total !== null && scanned >= total) || items.length < PAGE_SIZE) { complete = true; break; }
  await sleep(DELAY);
}
if (!complete) throw Error('모든 페이지를 읽지 못했습니다. 기존 JSON 파일을 보존합니다.');
if (!rows.length) throw Error('API 결과가 0건입니다. 기존 JSON 파일을 보존합니다.');

const seen = new Map();
for (let i=0;i<rows.length;i++) {
  const raw = rows[i];
  const record = normalize(raw,i);
  if (!record.name || !isActive(record)) continue;
  // 이 API 자체가 중구 전용 자료이므로, 주소에 '대전 중구'가 생략되어도 제외하지 않습니다.
  seen.set(`${record.name}|${record.address}`, record);
}
const restaurants = [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko'));
if (!restaurants.length) throw Error('업소명 컬럼을 인식하지 못했습니다. Actions 로그의 실제 응답 컬럼을 확인하세요. 기존 데이터를 보존합니다.');
const result = {updatedAt:new Date().toISOString(),complete:true,total:restaurants.length,scannedPages:pages,scannedRecords:scanned,source:'대전광역시 중구 음식점 정보 (ODCLOUD 2025-11-27)',restaurants};
const target = path.join(ROOT,'public','restaurants.json');
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.writeFile(`${target}.tmp`,JSON.stringify(result,null,2),'utf8');
await fs.rename(`${target}.tmp`,target);
console.log(`수집 완료: ${restaurants.length}개 음식점 / public/restaurants.json`);
