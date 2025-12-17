# 모바일 설정 (iOS/Android 공통)

## 핵심 요약
- **모바일 브라우저에서 위치 권한(geolocation)은 HTTPS(보안 컨텍스트)에서만 정상 동작**합니다.
- 따라서 PC에서 프론트를 **HTTPS로 실행**하고, 휴대폰에서 **PC의 IP로 접속**해야 합니다.
- HTTPS 환경에서는 프론트가 백엔드(http)로 직접 호출하면 Mixed Content로 막힐 수 있으므로, 본 프로젝트는 기본적으로 **`/api` 프록시(Vite)** 를 사용하도록 구성되어 있습니다.

---

## 1. PC에서 서비스 실행(권장)
### A. 백엔드 실행(포트 8081)
- 프로젝트 루트에서:
  - `start-services.ps1` 또는 `start-services.bat` 실행
- 백엔드는 `http://localhost:8081`에서 실행됩니다.

### B. 프론트엔드 HTTPS 실행(포트 3000)
1) `pawvent-frontend`로 이동  
2) 인증서 생성 (mkcert 권장)  
3) HTTPS로 실행  

예시(Windows PowerShell):

```powershell
cd c:\pawvent_workspace\pawvent-frontend

# mkcert 설치 후(1회):
# choco install mkcert
# mkcert -install

# 아래 <PC_IP>를 본인 PC의 LAN IP로 바꿔주세요 (예: 192.168.0.10)
mkcert -key-file certs/dev.key -cert-file certs/dev.crt localhost 127.0.0.1 ::1 <PC_IP>

# HTTPS dev 서버 실행
.\scripts\dev-https.ps1
```

---

## 2. 휴대폰에서 접속/권한
1) 휴대폰이 **PC와 같은 Wi‑Fi**에 연결되어 있어야 합니다.  
2) 모바일 브라우저(사파리/크롬)에서 아래로 접속:
   - `https://<PC_IP>:3000/`
3) 위치 권한 팝업이 뜨면 **허용**을 선택합니다.

### iOS(사파리) 주의
- iOS는 **신뢰되지 않은 인증서**면 보안 컨텍스트로 인정되지 않아 **위치 권한이 동작하지 않을 수 있습니다**.
- 가능한 경우 mkcert 인증서를 iOS에 설치하고 “신뢰” 처리해 주세요(조직/기기 정책에 따라 다름).

### Android(Chrome) 주의
- 경고 화면에서 “고급 → 계속”으로 진입이 가능하지만, 보안 정책에 따라 위치 권한이 제한될 수 있습니다.

---

## 3. 로그인 관련(모바일)
- 로그인 토큰은 `localStorage`에 저장됩니다.
- iOS의 추적 방지/콘텐츠 차단 설정이 강하면 로그인 유지/리다이렉트에 영향이 있을 수 있습니다.
  - 문제가 있으면 해당 사이트에 대해 차단을 완화 후 재시도하세요.

---

## 4. 체크리스트
- [ ] 백엔드 8081 실행 중인가?
- [ ] 프론트가 **HTTPS**로 실행 중인가?
- [ ] 휴대폰이 PC와 같은 Wi‑Fi인가?
- [ ] 휴대폰에서 `https://<PC_IP>:3000`로 접속했는가?
- [ ] 위치 권한을 “허용”했는가?


