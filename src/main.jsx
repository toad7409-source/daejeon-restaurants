import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Search,MapPin,Utensils,ArrowUpRight,RefreshCw,ChevronDown,Store,Info,AlertCircle} from 'lucide-react';
import './style.css';
const PAGE=12;
function App(){
 const [items,setItems]=useState([]),[meta,setMeta]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[category,setCategory]=useState('전체'),[visible,setVisible]=useState(PAGE);
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch(`/restaurants.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`데이터 파일을 불러올 수 없습니다. (HTTP ${r.status})`);const json=await r.json();if(!json.complete)throw new Error(json.message||'데이터 수집 전입니다. README에 따라 npm run sync를 실행하세요.');if(!Array.isArray(json.restaurants))throw new Error('음식점 데이터 형식이 올바르지 않습니다.');setItems(json.restaurants);setMeta(json);setVisible(PAGE);}catch(e){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{load()},[]);
 const categories=useMemo(()=>['전체',...new Set(items.map(x=>x.category).filter(Boolean))].sort((a,b)=>a==='전체'?-1:b==='전체'?1:a.localeCompare(b,'ko')),[items]);
 const filtered=useMemo(()=>items.filter(x=>(category==='전체'||x.category===category)&&`${x.name} ${x.address}`.toLowerCase().includes(query.trim().toLowerCase())),[items,category,query]);
 useEffect(()=>setVisible(PAGE),[query,category]);
 const displayed=filtered.slice(0,visible);
 const updated=meta?.updatedAt?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(meta.updatedAt)):null;
 return <main className="page">
   <header className="masthead"><div className="brand"><span className="brand-symbol"><Utensils size={20}/></span><span>중구 한끼</span></div><div className="edition">DAEJEON JUNG-GU · FOOD DIRECTORY</div></header>
   <section className="hero"><div className="hero-eyebrow"><span className="dot"/> 대전광역시 중구 음식점 안내</div><h1>오늘은 어디서<br/><em>한 끼</em> 할까요?</h1><p>대전 중구의 일반음식점 정보를 한눈에 만나보세요.<br/>공공데이터를 바탕으로 동네의 다양한 식당을 찾아드립니다.</p><div className="hero-tags"><span>공공데이터 기반</span><span>영업 상태 기준 필터</span><span>주소로 지도 검색</span></div><div className="decor decor-one"/><div className="decor decor-two"/><div className="decor decor-three"/></section>
   <section className="content"><div className="sectiontop"><div><span className="section-kicker">EXPLORE THE NEIGHBORHOOD</span><h2>중구의 음식점 <span className="count">{items.length.toLocaleString('ko-KR')}</span></h2></div><button className="refresh" onClick={load} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/>{loading?'불러오는 중':'목록 다시 읽기'}</button></div>
   <div className="tools"><label className="search"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="식당 이름 또는 주소로 검색" aria-label="식당 검색"/></label><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="음식 종류 선택">{categories.map(v=><option key={v}>{v}</option>)}</select></div>
   <div className="meta"><span>{loading?'데이터를 불러오는 중입니다':`검색 결과 ${filtered.length.toLocaleString('ko-KR')}곳 · ${Math.min(visible,filtered.length).toLocaleString('ko-KR')}곳 표시`}</span>{updated&&<span>데이터 기준: {updated}</span>}</div>
   {loading?<div className="state"><div className="spinner"/><h3>음식점 목록을 준비하고 있어요</h3><p>저장된 전체 목록을 읽는 중입니다.</p></div>:error?<div className="state"><AlertCircle size={36}/><h3>음식점 정보를 가져오지 못했습니다</h3><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>:filtered.length===0?<div className="state"><Search size={36}/><h3>검색 결과가 없습니다</h3><p>다른 식당명이나 주소로 검색해 보세요.</p></div>:<><div className="cards">{displayed.map((r,i)=><article className="restaurant" key={r.id||`${r.name}-${i}`}><div className="card-top"><span className="type"><Store size={14}/>{r.category||'일반음식점'}</span><span className="card-number">{String(i+1).padStart(2,'0')}</span></div><h3>{r.name}</h3><div className="addr"><MapPin size={16}/><span>{r.address||'주소 정보 없음'}</span></div><div className="card-bottom"><span className="open-status"><span/>영업정보 등록</span><a href={`https://map.naver.com/p/search/${encodeURIComponent(`대전 중구 ${r.name} ${r.address}`)}`} target="_blank" rel="noopener noreferrer">지도에서 보기 <ArrowUpRight size={16}/></a></div></article>)}</div>{visible<filtered.length?<div className="more"><button onClick={()=>setVisible(v=>Math.min(v+PAGE,filtered.length))}>더보기 <ChevronDown size={19}/></button><p>현재 {Math.min(visible,filtered.length).toLocaleString('ko-KR')} / {filtered.length.toLocaleString('ko-KR')}개 음식점 표시 · 클릭할 때마다 12개 추가</p></div>:<p className="end">모든 검색 결과를 표시했습니다.</p>}</>}
   <div className="note"><Info size={17}/><span>본 서비스는 행정안전부 일반음식점 인허가 데이터를 활용합니다. 실제 운영시간·영업 여부·메뉴는 방문 전 확인하세요. 사진, 평점, 예약정보는 제공하지 않습니다.</span></div>
   </section><footer><strong>중구 한끼</strong><span>데이터 출처: 공공데이터포털 · 행정안전부 식품 일반음식점 조회서비스</span></footer>
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
