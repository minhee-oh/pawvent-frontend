# 카카오 로그인 설정 가이드

## KOE004 오류 해결 방법

KOE004 오류는 카카오 개발자 콘솔의 설정 문제로 발생합니다. 다음 단계를 따라 설정을 완료해주세요.

## 1. 카카오 개발자 콘솔 접속

1. https://developers.kakao.com/ 접속
2. 카카오 계정으로 로그인
3. "내 애플리케이션" 클릭
4. 애플리케이션 선택 (없으면 생성)

## 2. 플랫폼 설정

1. 좌측 메뉴: **앱 설정 > 플랫폼**
2. **Web 플랫폼** 클릭
3. 사이트 도메인 등록 (여러 개 등록 가능):
   ```
   http://localhost:3000
   http://192.168.200.138:3000
   ```
   ⚠️ **모바일 접속 시**: 모바일에서 접속하는 IP 주소도 추가로 등록해야 합니다.
   - 현재 설정된 IP: `http://192.168.200.138:3000`
   - IP 주소가 변경되면 카카오 개발자 콘솔에 새 IP 주소를 추가로 등록해야 합니다.
   - PowerShell에서 `ipconfig` 명령어로 IP 주소 확인 가능
4. 저장

## 3. 카카오 로그인 설정

1. 좌측 메뉴: **제품 설정 > 카카오 로그인**
2. **카카오 로그인 활성화** 토글을 **ON**으로 설정

3. **Redirect URI** 등록 (여러 개 등록 가능):
   ```
   http://localhost:3000
   http://192.168.200.138:3000
   ```
   ⚠️ **모바일 접속 시**: 모바일에서 접속하는 IP 주소도 추가로 등록해야 합니다.
   - 현재 설정된 IP: `http://192.168.200.138:3000`
   - IP 주소가 변경되면 카카오 개발자 콘솔에 새 IP 주소를 추가로 등록해야 합니다.
   - PowerShell에서 `ipconfig` 명령어로 IP 주소 확인 가능
   (개발용이므로 localhost와 로컬 네트워크 IP 모두 등록, 배포 시 실제 도메인으로 변경)

## 4. 동의 항목 설정

1. **카카오 로그인 > 동의항목** 메뉴로 이동
2. 다음 항목들을 **필수 동의**로 설정:
   - **카카오계정(이메일)**: 필수
   - **닉네임**: 필수 (또는 선택)

## 5. 앱 키 확인

1. 좌측 메뉴: **앱 설정 > 앱 키**
2. 다음 키들을 확인:
   - **REST API 키**: 백엔드 `application.properties`에 설정
   - **JavaScript 키**: 프론트엔드 `Login.tsx`에 설정

## 6. 코드에 키 설정

### 백엔드 (`application.properties`)
```properties
spring.security.oauth2.client.registration.kakao.client-id=YOUR_REST_API_KEY
spring.security.oauth2.client.registration.kakao.client-secret=YOUR_CLIENT_SECRET
```

### 프론트엔드 (`src/pages/Login.tsx`)
```typescript
window.Kakao.init('YOUR_JAVASCRIPT_KEY')
```

## 7. 체크리스트

설정 완료 후 다음을 확인하세요:

- [ ] Web 플랫폼에 `http://localhost:3000` 등록됨
- [ ] Redirect URI에 `http://localhost:3000` 등록됨
- [ ] 카카오 로그인 활성화됨
- [ ] 동의 항목 (이메일, 닉네임) 필수로 설정됨
- [ ] JavaScript 키가 프론트엔드 코드에 올바르게 설정됨
- [ ] REST API 키와 Client Secret이 백엔드 설정에 올바르게 설정됨

## 주의사항

- **REST API 키**와 **JavaScript 키**는 서로 다릅니다!
- JavaScript SDK는 JavaScript 키를 사용합니다.
- 백엔드 OAuth2는 REST API 키와 Client Secret을 사용합니다.
- Redirect URI는 정확히 일치해야 합니다 (http/https, 포트 번호 등)

## 문제 해결

여전히 오류가 발생하면:
1. 브라우저 캐시 삭제
2. 카카오 개발자 콘솔에서 설정 다시 확인
3. JavaScript 키가 올바른지 확인
4. 카카오 로그아웃 후 다시 시도


