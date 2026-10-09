# 소셜 로그인 브랜드 자산

공식 자료 확인·다운로드: 2026-10-09. 외부 리소스 로드 없이 서비스와 함께 제공한다.

- Google: https://developers.google.com/identity/branding-guidelines
  - 다운로드: https://developers.google.com/static/identity/images/signin-assets.zip
  - `Android + Web/PNG @4x/Light/Theme=Light, Show text=No, Shape=Square, Platform=Android+Web@4x.png`를 `google-official-icon-button.png`로 이름만 바꾸어 보관. 공식 최신 그라데이션 G를 그대로 사용한다.
  - CSS에서 40px 표시 자산의 중앙 20px G 영역을 보여준다. 로고 색·형태·비율은 변경하지 않는다. 흰 버튼의 테두리 #747775, 글자 #1F1F1F, 14/20px, 로고 뒤 간격10px, 최소 좌우12px.
  - Google Sans Medium: 공식 Google Fonts CSS API `https://fonts.googleapis.com/css2?family=Google+Sans:wght@500&text=Google&display=swap`가 반환한 TrueType 부분집합. 영문 Google 글자에 사용하고 한글은 기존 Noto Sans KR로 표시한다. 로컬 `google-sans-login.ttf`에 보관.
- 카카오: https://developers.kakao.com/docs/ko/kakaologin/design-guide
  - 원본: https://developers.kakao.com/tool/images/resource/preview/login-complete-ko.svg
  - 공식 심볼 path를 그대로 분리하고 viewBox만 심볼 영역으로 지정한 `kakao-symbol.svg`. 심볼 색은 현행 가이드의 #000000. 컨테이너 #FEE500, 글자 검정85%, radius12px.
  - 레이블은 사용자 명시 요청의 ‘카카오로 로그인’. 공식 가이드의 기본 레이블 ‘카카오 로그인’을 서비스 문구에 맞춰 변경했으며 브랜드의 공식 심사·승인을 받았다는 뜻은 아니다.

두 버튼은 같은 전체 폭·48px 높이·12px 세로 간격으로 배치한다. Google 로고를 임의 재작성하거나 카카오 CI·다른 아이콘으로 대체하지 않는다. 신규 동의·가입 확정과 기존 OAuth code 교환은 Server 계약을 그대로 사용한다.
