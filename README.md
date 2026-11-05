# 대전 중구 음식점 검색 — React / Vite / 공공데이터포털

## 기능
- 대전광역시 중구의 **일반음식점** (등록된 영업 상태 기준) 전체 목록을 JSON 파일에 먼저 수집
- 초기 12개 (데스크톱 3열 × 4행), '더보기' 클릭 때마다 12개 추가
- 이름/주소 검색, 업태 필터, 네이버 지도 검색 링크
- API 키가 브라우저와 GitHub 소스에 나타나지 않도록 Node.js 수집 스크립트에서만 사용
- GitHub Actions 주간 수집 + Vercel 자동 배포

## 데이터 출처
[행정안전부_식품_일반음식점 조회서비스](https://www.data.go.kr/data/15154916/openapi.do)
REST `https://apis.data.go.kr/1741000/general_restaurants/info`.
이 API는 **전국 단위**로 제공되며 식당 사진/메뉴 가격/별점은 없습니다.

**주의: API별 응답 필드와 페이지 매개변수는 변경될 수 있습니다.**
제공기관 API 명세에 맞춰 `server/sync.mjs`의 `requestPage()` 및 `normalize()`를 조정할 수 있습니다.
직접 키를 사용한 API 호출 검증은 수행하지 못했습니다. 전국 인허가 목록을 모두 가져오는 데 시간이 오래 걸리고 호출량 한도에 도달할 수도 있습니다. 실패하면 과거 JSON을 유지합니다. 페이지네이션이 성공했는지 확인한 후 운영하세요.

## 1. API 키 신청
1. 공공데이터포털 로그인
2. 위 서비스 페이지에서 활용신청 (자동승인 여부 확인)
3. 마이페이지에서 **디코딩 인증키** 복사

## 2. Windows 로컬 설치
1. Node.js 20+ 설치
2. 이 프로젝트 폴더에서 CMD 또는 VS Code 터미널 열기
3. `npm install`
4. `.env.example`을 복사해 `.env`로 이름 변경
5. `DATA_GO_KR_KEY=` 뒤에 디코딩 인증키 입력 (절대 GitHub에 업로드 금지)
6. `npm run sync` 실행 → 성공하면 `public/restaurants.json` 생성
7. `npm run dev` 실행 → http://localhost:5173 접속

**참고:** 초기 수집은 전국 전체 페이지를 읽어야 하므로 상당한 시간이 걸릴 수 있습니다. 완료 전에는 음식점이 표시되지 않습니다. `PAGE_SIZE`, `MAX_PAGES`로 API 호출 수를 조절할 수 있지만 `MAX_PAGES`에 닿으면 불완전 목록이므로 저장되지 않습니다. 실제 API에 지역 조건 파라미터가 있으면 `.env`에 `API_REGION_FIELD`, `API_REGION_VALUE`를 설정하면 조회량을 줄일 수 있습니다. 단, 지원 여부와 정확한 이름을 API 명세에서 확인해야 합니다.

## 3. GitHub 업로드
1. GitHub 새 저장소 생성
2. 프로젝트 파일 전체 업로드 (`.github/workflows/sync.yml` 포함, `.env` 제외)
3. `Settings > Secrets and variables > Actions > New repository secret`
4. 이름 `DATA_GO_KR_KEY`, 값은 **디코딩 인증키**
5. `Settings > Actions > General > Workflow permissions`에서 Read and write permissions 허용 (정책상 가능할 때)
6. `Actions > Sync Daejeon Jung-gu restaurants > Run workflow` 클릭
7. 실행 성공 후 `public/restaurants.json`의 `complete: true`, `restaurants` 배열을 확인
8. 실패하면 실행 로그를 열어 API 오류 내용을 확인 (인증키는 로그에 출력하지 않음)

예약 실행은 한국시간 월요일 오전 03:20에 해당합니다. GitHub Actions의 예약 시간은 지연될 수 있습니다.

## 4. Vercel 배포
1. https://vercel.com/new 접속
2. Import Git Repository 선택
3. Framework Preset: `Vite`
4. Build Command: `npm run build`, Output Directory: `dist`
5. Deploy
6. GitHub Actions가 새 JSON을 커밋하면 Vercel 자동배포가 활성화된 프로젝트는 재배포

**중요:** Vercel에서 DATA_GO_KR_KEY를 넣을 필요가 없습니다. GitHub Actions가 수집하며 Vercel은 정적 React 사이트만 배포합니다. 데이터 변경 직후 사이트에 반영되지 않으면 Vercel > Deployments에서 최신 배포를 확인하세요.

## 보안/정확도
- API 인증키를 `src` 안에 넣거나 `VITE_` 접두어의 변수로 저장하지 마세요.
- 인허가 영업 상태는 실시간 실제 영업 여부가 아닙니다. 폐업/휴업 상태가 기록된 업소는 제외하지만 API 값이 비어 있으면 포함됩니다.
- 전국 API의 응답 스키마/지역 필터 방식이 달라질 경우 일부 업소 누락 또는 수집 실패할 수 있습니다.
- 개발키 일일 10,000회 요청 정책에 유의하세요. 전체 수집이 비현실적이면 별도의 지역 전용 API나 지역 데이터 파일을 데이터 원천으로 교체하는 것이 적합합니다.
