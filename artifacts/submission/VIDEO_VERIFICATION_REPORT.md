# LeaseFlow 해커톤 데모 영상 검증 보고서

- 최종 산출물: 로컬 제출 패키지에 의도적으로 포함한 `LeaseFlow_Hackathon_Demo_KO.mp4`
- 검증일: 2026-07-19 (Asia/Seoul)
- 데이터 경계: 합성 데모 데이터만 사용
- 외부 연동 경계: 실제 이메일·전화·로그인·회사 시스템 연동 없음

## 미디어 검증

- 재생 시간: 109.145초 (180초 제한 통과)
- 화면: 1920×1080
- 비디오: H.264
- 오디오: MPEG-4 AAC, 오디오 트랙 존재
- 파일 크기: 51,723,559 bytes
- SHA-256: `5b1f85b3c0a3339b388255f10c37ccddee14e3dc6a76085800d2186629e33bcc`

## 내용 검증

- 최신 Admin UI 기준으로 원자료 등록·분류, 데이터 담당자 확인, 선임 게시와 v2 현재본 전환을 재캡처했다.
- Mobile 화면에서 게시된 현재본만 사용하는 안내자료 초안, 사람 승인, 모의 발송 기록을 확인했다.
- 주간 보고서에서 출처 기반 변경안 반영, 최종 승인, 건물별 수신자·전달 전 상태를 확인했다.
- Vision OCR 자동 검사: 최종 7개 캡처 프레임에서 합성 데모 표식 확인.
- 일반 비밀정보 자동 검사: API 키, Bearer 토큰, 자격증명 할당, 개인 키 표식 패턴 0건.
- 로컬 민감 식별자 검사: 저장소 밖 금지어 파일 또는 환경변수 입력을 지원한다. 이 재현 가능한 검증에서는 로컬 목록이 설정되지 않았으므로 실제 식별자 검사를 실행했다고 주장하지 않는다.
- 육안 샘플 검사: 5초, 30초, 60초, 90초 프레임 모두 제목·본문·상태 표시가 정상이며 개발 오버레이가 없다.

## 재현 명령

```bash
zsh scripts/demo-video/capture.sh
zsh scripts/demo-video/render.sh
swift scripts/demo-video/probe.swift artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4
swift scripts/demo-video/verify-content.swift artifacts/submission/video-frames
swift scripts/demo-video/sample.swift artifacts/submission/LeaseFlow_Hackathon_Demo_KO.mp4 artifacts/submission/video-samples
```

영상은 로컬 제출 패키지에 포함했지만 공개 호스트로 push하거나 업로드하지 않았다.
