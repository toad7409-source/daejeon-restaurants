/**
 * 공공데이터포털 행정안전부 일반음식점 API -> 대전 중구 영업 업소 snapshot
 * API 스키마/페이지 매개변수는 제공기관 변경에 따라 조정 필요.
 * 불완전 수집 시 기존 snapshot 절대 덮어쓰지 않음.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const envFile=path.join(ROOT,'.env');
try { const s=await fs.readFile(envFile,'utf8'); for(const line of s.split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);if(m && !process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');} } catch {}
const key=process.env.DATA_GO_KR_KEY;
if(!key || key.includes('여기에_')){console.error('DATA_GO_KR_KEY가 없습니다. .env 파일을 설정하세요.');process.exit(1);}
const BASE=process.env.API_URL||'https://apis.data.go.kr/1741000/general_restaurants/info';
const PAGE_SIZE=Math.max(1,Number(process.env.PAGE_SIZE)||1000);
const MAX_PAGES=Math.max(1,Number(process.env.MAX_PAGES)||10000);
const DELAY=Math.max(0,Number(process.env.REQUEST_DELAY_MS)||180);
const pause=t=>new Promise(r=>setTimeout(r,t));
const val=(o,...keys)=>{for(const k of keys){if(o?.[k]!=null && String(o[k]).trim()) return String(o[k]).trim();}return ''};
const firstArray=obj=>{
  if(Array.isArray(obj))return obj;
  if(!obj||typeof obj!=='object')return null;
  for(const key of ['data','items','item','row','rows','list','result','body','response','results']){const a=firstArray(obj[key]);if(a)return a;}
  for(const v of Object.values(obj)){if(v&&typeof v==='object'){const a=firstArray(v);if(a)return a;}}
  return null;
};
const deepCount=(obj,depth=0)=>{
 if(!obj||typeof obj!=='object'||depth>6)return null;
 for(const k of ['totalCount','total_count','totalCnt','total','totalRecords'])if(obj[k]!==undefined && Number.isFinite(Number(obj[k])))return Number(obj[k]);
 for(const k of ['response','body','result','data','header']){const n=deepCount(obj[k],depth+1);if(n!=null)return n;} return null;
};
function normalize(r){
 const name=val(r,'bplcNm','BPLCNM','siteWhlNm','SITEWHLNM','업소명','사업장명','사업장명칭','name','shopName');
 const address=val(r,'rdnWhlAddr','RDNWHLADDR','rdnwhladdr','siteWhlAddr','SITEWHLADDR','sitewhladdr','도로명전체주소','소재지전체주소','소재지도로명주소','소재지주소','address');
 const status=val(r,'dtlstatenm','DTLSTATENM','dtlStateNm','trdStateNm','TRDSTATENM','영업상태명','영업상태','status');
 const category=val(r,'uptaeNm','UPTAENM','uptaenm','업태구분명','업태명','category')||'일반음식점';
 const number=val(r,'mgtNo','MGTNO','관리번호','id');
 const phone=val(r,'siteTel','SITETEL','전화번호','phone');
 return {id:number||`${name}|${address}`,name,address,category,status,phone};
}
function belongs(x){return /대전(광역시)?\s*(중구)/.test(x.address) || /대전광역시 중구/.test(x.address);}
function isOpen(x){if(!x.status)return true; if(/폐업|취소|말소|정지|휴업|종료|폐쇄/.test(x.status))return false;return true;}
async function requestPage(page){
 const url=new URL(BASE);
 // 행안부 API의 Swagger /info 요청 규격; provider-specific parameters can be set above.
 url.searchParams.set('serviceKey',key);
 url.searchParams.set('pageNo',String(page));
 url.searchParams.set('numOfRows',String(PAGE_SIZE));
 url.searchParams.set('type','json');
 const regionField=process.env.API_REGION_FIELD;
 if(regionField && process.env.API_REGION_VALUE)url.searchParams.set(regionField,process.env.API_REGION_VALUE);
 for(let tries=0;tries<3;tries++){
  const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),35000);
  try{
   const resp=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});
   const text=await resp.text();
   if(!resp.ok)throw Error(`API HTTP ${resp.status}: ${text.slice(0,180)}`);
   let json;try{json=JSON.parse(text)}catch{throw Error(`JSON 응답이 아닙니다. API 응답형식/키 확인: ${text.slice(0,180)}`)}
   if(json?.response?.header?.resultCode && !['00','0','NORMAL_SERVICE'].includes(String(json.response.header.resultCode)))throw Error(`API 오류: ${json.response.header.resultMsg||json.response.header.resultCode}`);
   const arr=firstArray(json);
   if(!arr)throw Error(`응답에서 목록 배열을 찾지 못했습니다. 응답 필드: ${Object.keys(json).join(', ')}`);
   return {items:arr,total:deepCount(json)};
  }catch(e){if(tries===2)throw e;console.log(`  재시도 ${tries+1}: ${e.message}`);await pause(1200*(tries+1));}
  finally{clearTimeout(timeout);}
 }
}
const seen=new Map();let total=null;let count=0;let pages=0;let completed=false;
console.log('행안부 공공데이터 일반음식점 API 수집 시작 (대전 중구 필터)');
for(let page=1;page<=MAX_PAGES;page++){
 const {items,total:t}=await requestPage(page); pages=page;count+=items.length;
 if(t!=null)total=t;
 for(const raw of items){const r=normalize(raw);if(!r.name||!belongs(r)||!isOpen(r))continue;seen.set(r.id,r);}
 if(page===1) console.log(`  첫 페이지 ${items.length}건, 전체 건수 ${total??'미제공'}`);
 if(page%10===0)console.log(`  ${page}페이지 / ${count}건 검사 / 중구 ${seen.size}건`);
 if(items.length===0 || (total!=null&&count>=total) || items.length<PAGE_SIZE){completed=true;break;}
 await pause(DELAY);
}
if(!completed)throw Error(`MAX_PAGES=${MAX_PAGES} 도달. 완전한 목록이 아니므로 기존 데이터를 유지합니다.`);
const restaurants=[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko'));
if(!restaurants.length)throw Error('대전 중구 음식점이 0건입니다. API 응답 필드와 주소 필터를 확인하세요. 기존 데이터를 보존합니다.');
const result={updatedAt:new Date().toISOString(),complete:true,total:restaurants.length,scannedPages:pages,scannedRecords:count,source:'행정안전부_식품_일반음식점 조회서비스 (공공데이터포털)',restaurants};
const out=path.join(ROOT,'public','restaurants.json');
await fs.writeFile(out+'.tmp',JSON.stringify(result,null,2),'utf8');
await fs.rename(out+'.tmp',out);
console.log(`완료! 대전 중구 음식점 ${restaurants.length}개 저장: public/restaurants.json`);
