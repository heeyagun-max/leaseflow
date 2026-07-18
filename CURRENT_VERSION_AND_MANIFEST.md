# LeaseFlow Current Version and Manifest

## 유일한 제품 기준본

LeaseFlow의 공식 기준선은 **v3.0.0**이다.

| 구분 | 정확한 이름 |
|---|---|
| 최종 배포 ZIP | `LeaseFlow_Final_Master_Package_v3.0.0.zip` |
| 압축 해제 후 최상위 폴더 | `LeaseFlow_Final_Master_Package_v3.0.0` |
| Codex에서 열 작업 저장소 | `LeaseFlow_Codex_Repository_v3.0.0` |
| 제품 풀스펙 DOCX | `LeaseFlow_Full_Product_Specification_v3.0.0_KO.docx` |
| 제품 풀스펙 Markdown | `LeaseFlow_Full_Product_Specification_v3.0.0_KO.md` |

링크에 표시하는 이름, 실제 다운로드 파일명, ZIP을 풀었을 때의 최상위 폴더명은 서로 정확히 일치해야 한다. “최신본”, “v2 저장소” 같은 별칭만으로 파일을 안내하지 않는다.

이전 LeaseFlow ZIP과 기획 문서는 참고·보관 자료일 뿐 기준본으로 사용하지 않는다. 교체본을 만들 때는 대체 대상과 폐기·보관 상태를 반드시 명시한다.

## 기준 패키지 구조

```text
LeaseFlow_Final_Master_Package_v3.0.0
├── 00_START_HERE.md
├── 01_CURRENT_VERSION_AND_MANIFEST.md
├── 01_PRODUCT_SPEC
│   ├── LeaseFlow_Full_Product_Specification_v3.0.0_KO.docx
│   ├── LeaseFlow_Full_Product_Specification_v3.0.0_KO.md
│   └── 문서 도식 이미지
├── 02_SCREEN_PLANNING
│   ├── MVP 고정 범위
│   ├── 모바일 앱 최종 화면기획
│   ├── 폐쇄형 웹 최종 화면기획
│   ├── UX 완료 기준
│   └── Codex 프런트엔드 작업 지시
├── 03_IA_UX_REFERENCE
│   ├── 전체 운영 구조
│   ├── 폐쇄형 웹 IA
│   ├── 모바일 IA
│   └── 요청·회신·보완·주간보고 사이클
├── 04_DATA_MODEL
│   ├── 최종 데이터 사전
│   └── 원자료 보관·분류 정책
├── 05_WORKFLOW_TO_AUTOMATION_SKILL
│   └── 최종 Workflow-to-Automation Skill
├── 06_CODEX_REPOSITORY
│   └── LeaseFlow_Codex_Repository_v3.0.0
│       ├── 최종 기획문서
│       ├── 앱·웹 초기 코드
│       ├── 합성 데이터
│       ├── 테스트
│       └── Codex 작업 프롬프트
└── 08_ARCHIVE_GUIDE
    └── 이전 파일 중 보관·삭제할 목록
```

Codex에서는 다음 폴더 하나를 작업 저장소로 연다.

```text
LeaseFlow_Final_Master_Package_v3.0.0/
└── 06_CODEX_REPOSITORY/
    └── LeaseFlow_Codex_Repository_v3.0.0/
```

## 제품 풀스펙의 필수 범위

- 실제 업무 환경과 이동·운전·현장·사무실 사용 맥락
- 건물별 원데이터 누적과 월별·도면별 버전 관리
- 주니어 확인 → 시니어 승인 → 최신 운영정보 게시
- 폐쇄형 Admin Web의 전체 구조와 화면
- 모바일 앱의 전체 IA, UX, 사용자 카피
- 자연어·음성 요청 → 자료·메일 준비 → 승인·발송
- 회신·누락·보완·재발송을 잇는 업무 스레드
- 건물·수신자·기간·상태 복합 검색과 뒤로 가기 상태 복원
- 임대인 보고그룹, 회사 대표 보고, 보고 체크포인트
- Outlook, Microsoft Entra, 권한, 저장소, 감사, 보존·복구의 운영 확장
- GPT 결과를 후보·작업·초안·패치로 제한하는 결정론적 통제
- 사용자 화면에서 프로그램 언어와 내부 상태를 숨기는 카피 규칙
- 해커톤 MVP부터 제한 파일럿·팀 파일럿·운영 배포까지의 로드맵
- 골든 테스트, UX 완료 기준, 보안 리스크와 미결정 사항

이 풀스펙이 제품의 상위 기준이다. 해커톤 MVP 문서와 Codex 구현 프롬프트는 여기서 필요한 범위만 잘라 사용하며, 상위 원칙과 충돌하는 축약본을 새 기준으로 만들지 않는다.

## 버전 규칙

- 오탈자·작은 수정: `v3.0.1`
- 화면이나 기능 추가: `v3.1.0`
- 서비스 구조 변경: `v4.0.0`

버전이 올라가면 기존 파일을 애매하게 덮어쓰지 않는다. 새 버전명으로 생성하고, 현재 사용 파일과 보관·폐기 파일을 구분한 목록을 유지한다.

## 현재 물리적 상태

2026-07-19 확인 시점에 `LeaseFlow_Final_Master_Package_v3.0.0.zip`과 위 이름의 v3.0.0 풀스펙 파일은 현재 작업 폴더 및 다운로드 폴더에서 발견되지 않았다. 따라서 이 문서는 **확정된 기준과 조립 목표**를 기록하며, 실물 패키지가 존재하거나 검증됐다고 주장하지 않는다.

현재 저장소 `LeaseFlow_Team_Pilot_Hackathon_MVP`는 구현 작업본이다. 최종 제출 전에 위 구조로 패키지를 조립하고, 파일명·최상위 폴더명·내부 저장소명·매니페스트·해시를 검증해야 한다.
