# 실행/배포 가이드 (백엔드/프론트 분리 레포 기준)

## 0) 추천 결론
- **로컬 개발(PC + 모바일 테스트)**: 한 폴더에 `pawvent/` + `pawvent-frontend/`를 같이 두고 실행 스크립트를 사용
- **배포(추천)**: **단일 도메인 + 리버스 프록시(Nginx)** 로 `https://domain` 하나에서
  - 프론트 정적 파일 서빙
  - `/api`를 백엔드로 프록시
  - (장점) CORS/Mixed Content 문제 최소화, 모바일 위치 권한도 안정적

---

## 1) 로컬에서 “한 번에” 실행하기
프로젝트 루트 구조가 아래처럼 되어 있으면 루트 스크립트로 한 번에 실행됩니다.

```
<workspace>/
  pawvent/            (Spring Boot, 8081)
  pawvent-frontend/   (Vite, 3000)
  start-services.ps1
  start-services.bat
```

### A. 일반 HTTP 실행
- PowerShell: `.\start-services.ps1`
- BAT: `start-services.bat`

### B. 모바일 위치 권한 테스트용 HTTPS 실행(권장)
- PowerShell:
  - `.\start-services.ps1 -Https`
- BAT:
  - `set PAWVENT_HTTPS=1`
  - `start-services.bat`

자세한 모바일 설정은 `docs/MOBILE_SETUP_GUIDE.md` 참고.

---

## 2) 레포가 2개일 때 운영/배포 전략

### 선택지 A) 프론트/백엔드 “각각” 배포(가장 흔함)
- 프론트: Vercel/Netlify/S3+CloudFront 등
- 백엔드: Render/Railway/Fly.io/EC2 등

필수 체크:
- 프론트 빌드 시 **API 주소를 환경변수로 주입**:
  - `VITE_API_BASE_URL=https://api.your-domain.com/api` (예시)
- 백엔드 CORS 설정: 프론트 도메인 허용
- 카카오 OAuth Redirect URI/도메인 등록: 실제 배포 도메인으로 등록

> 참고: 현재 프론트는 기본값이 `/api`라서, “서로 다른 도메인”으로 배포할 경우 위 `VITE_API_BASE_URL` 설정이 꼭 필요합니다.

### 선택지 B) 단일 도메인 + 리버스 프록시(추천)
- `https://your-domain.com`에서 프론트 제공
- Nginx가 `/api` 요청을 `http://backend:8081`로 프록시

장점:
- 프론트는 계속 `/api`로만 호출 → **CORS 문제 최소화**
- 모바일 위치 권한도 HTTPS에서 자연스럽게 동작

---

## 3) 운영을 더 편하게 만드는 방법(선택)
### “런처/배포” 전용 작은 레포 하나 추가(추천)
두 레포를 그대로 두고, 별도 `pawvent-stack`(가칭) 레포를 만들어:
- `docker-compose.yml`
- Nginx 설정
- 환경변수(.env)
- 배포 스크립트
만 관리하면 운영이 깔끔해집니다.


