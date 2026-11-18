# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

확장은 모든 사이트(`<all_urls>`)에서 콘텐츠 스크립트를 실행합니다. 확장 권한은 `storage` 하나이고, 캡처한 응답 데이터는 메모리에만 두며 네트워크로 보내지 않습니다. 연습용 목 서버는 127.0.0.1 에서만 접속되도록 묶여 있습니다. / The extension runs content scripts on all sites (`<all_urls>`). Its only permission is `storage`; captured response data stays in memory and is never sent over the network. The practice mock server binds to 127.0.0.1 only.
