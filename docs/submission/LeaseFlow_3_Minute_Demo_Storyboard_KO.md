# LeaseFlow 3분 미만 공개 데모 영상 콘티

목표 러닝타임: **2분 55초**  
구성: **25초 × 7장**  
언어: **영문 음성** 또는 영문 번역이 완전히 제공된 음성  
업로드: **YouTube 공개(Public)**

## 제출 규정에 맞춘 제작 원칙

- 3분을 채우지 않고 2분 55초에서 끝낸다.
- 실제로 작동하는 제품을 화면에서 시연한다.
- 음성으로 `무엇을 만들었는지`, `Codex를 어떻게 사용했는지`, `GPT-5.6을 어떻게 사용했는지`를 모두 설명한다.
- CBRE, KFT, Pacific Tower 등 실제 회사 자료·로고·개인정보는 촬영하지 않는다.
- 저장소의 합성 건물 `Cobalt Finance Center`와 합성 원자료만 사용한다.
- 배경음악은 생략하거나 사용 허가가 명확한 음원만 쓴다.
- GPT-5.6 라이브 호출을 하지 않는 데모 경로를 라이브 호출처럼 말하지 않는다. 서버 어댑터와 검증 계약, 자격증명 없는 합성 데모 경로의 차이를 정확히 설명한다.

## 전체 콘티

| 시간 | 장면 목적 | 화면과 조작 | 화면 자막 | 영문 내레이션 |
| --- | --- | --- | --- | --- |
| 0:00–0:25 | 남편의 업무 병목과 `Codex for Everyone`의 출발점 | 2초 타이틀 → 합성 PDF·XLSX·평면도 썸네일 → Admin Home의 진행 업무·최근 건물 변경·주간보고 요약 | `AI should adapt to the worker` | I built LeaseFlow to help my husband break through a serious bottleneck in his leasing work. I use AI every day, but he doesn't. Instead of asking him to become an AI power user, I used Codex to turn his real workflow, documents, and corrections into a tool that works the way he already works. |
| 0:25–0:50 | 원자료 등록과 분석 후보 생성 | **Building Data Intake** → 건물·자료 종류 선택 → 합성 샘플 첨부 → **Upload & Analyze** → 추출 후보값 표시 | `Source preserved · Changes proposed` | A designated user registers a landlord source by building and document type, then uploads the file. The server-side GPT-5.6 adapter is designed to propose structured changes. For this credential-free judge path, the same validated contract runs deterministically against the synthetic sample. The source is preserved, but the candidate is not yet official information. |
| 0:50–1:15 | 사람이 공식 정보로 확정하는 통제 증명 | Data Steward로 변경값 확인·확정 → Senior Reviewer 전환 → 게시 → 300→200평, 3→2개월, 3→2대, plan v1→v2를 짧게 확대 | `AI proposes · People confirm · Code enforces` | The Data Steward confirms source-backed changes. The Senior Reviewer decides what becomes current. Here, 5F changes from three hundred to two hundred py, rent-free from three to two months, parking from three to two spaces, and plan v2 replaces v1. The old plan remains in history but cannot enter a current package. |
| 1:15–1:40 | 웹과 모바일의 최신정보 동기화 증명 | Admin의 건물 상세 최신정보·원본 링크 → 모바일의 같은 건물 Current Leasing Information → 두 화면의 200평·2개월·2대·v2를 매치 컷 | `One published record · Web + Mobile` | Publication updates one shared record. The Admin Web and Mobile app now show the same latest information, including the original source link. Users do not need lifecycle codes or data-pipeline explanations. They need the correct building facts and the current file, wherever they are working. |
| 1:40–2:05 | 자연어 업무와 안전한 고객자료 준비 | 자연어 요청 입력 → 고객자료 패키지 준비 → 포함 정보와 v2 평면도 확인 → 사람 승인 게이트 → sandbox 전달 기록 | `Current facts only · Human approval required` | From the same current record, a team member can use natural language to prepare a customer package. Only active, authorized, externally shareable facts and files are selected. The package still requires a named human approval, and this demo records only a sandbox delivery. No real email is sent. |
| 2:05–2:30 | 임대인 기준 주간업무보고 자동화 | **Weekly Reports** 목록 → **Settings** → 임대인·담당 건물들·일정·필수 항목·수신자·승인자 → 건물별 생성 보고서 1건 | `One landlord meeting · Separate building reports` | Weekly reporting is organized by landlord meeting, because one owner may have several buildings. The user configures the buildings, schedule, required sections, recipients, and approver. LeaseFlow prepares a separate report for each building from that week's approved information and activity, ready for human review. |
| 2:30–2:55 | Codex/GPT-5.6 사용 증거와 확장성 | 사용자의 브라우저 주석 2–3개 → Codex 주 작업 화면 → 통과한 테스트 → `codex-for-everyone` 스킬 → 최종 타이틀·공개 데모 URL | `LeaseFlow is the product · Codex for Everyone is the method` | Codex did more than scaffold code. I used GPT-5.6 in Codex to reconstruct the workflow, translate annotated browser feedback into product rules, test document categories, and verify the full path. LeaseFlow is the first example of Codex for Everyone: AI adapts to the worker, instead of asking every worker to become an AI expert. |

## 컷별 촬영 메모

### 1장 — 0:00–0:25

- 로고 애니메이션은 2초를 넘기지 않는다.
- 남편 사진이나 개인정보를 쓰지 않고, `업무 병목이 있는 실제 임대 실무자`라는 관계와 동기만 음성으로 전달한다.
- 문제를 별도 슬라이드로 길게 설명하지 않는다. 합성 문서 → 실제 Admin Home으로 바로 진입한다.
- 홈에서는 진행 업무, 최근 변경 정보, 다음 주간보고가 한 화면에 보이게 한다.

### 2장 — 0:25–0:50

- 파일 선택창에서 실제 파일 경로나 개인 폴더명이 보이지 않도록 사전에 합성 샘플을 준비한다.
- 업로드·분석 대기 시간은 점프 컷으로 줄여도 되지만, 클릭 전후 상태는 보여준다.
- 후보값 옆의 근거 또는 원본 링크를 한 번 짚는다.

### 3장 — 0:50–1:15

- 역할 전환과 게시 버튼을 실제로 누른다.
- 네 가지 변경값은 커서 이동과 110–120% 화면 확대만으로 읽히게 한다.
- v1이 이력에는 남고 현재 패키지에서는 제외된다는 사실을 한 화면으로 증명한다.

### 4장 — 1:15–1:40

- 웹과 모바일은 같은 값이 보이는 지점에서 매치 컷한다.
- 모바일은 세로 화면 전체를 작게 띄우기보다 중요한 현재정보 영역을 크게 잡는다.
- 원본 파일 링크가 보이는 순간을 반드시 포함한다.

### 5장 — 1:40–2:05

- 자연어 요청은 짧고 읽기 쉽게 한다: `Prepare the latest 5F leasing package for Cobalt Finance Center.`
- 패키지 안에 plan v2가 있고 v1이 없는 것을 보여준다.
- `Sandbox delivery` 또는 동등한 표현을 화면에 남겨 실제 발송으로 오해되지 않게 한다.

### 6장 — 2:05–2:30

- 주간보고는 임대인이 상위 그룹이고 여러 건물이 그 아래 매칭되는 구조를 먼저 보여준다.
- 수신자·승인자는 설정값에서 나오며 모델이 임의 생성하지 않는다는 것을 화면 흐름으로 보여준다.
- 최종 보고서는 건물별로 분리되어 있다는 사실을 한 건 열어서 증명한다.

### 7장 — 2:30–2:55

- Codex 화면은 긴 대화가 아니라 `사용자 지적 → 구현 변화 → 검증`이 보이는 세 컷으로 구성한다.
- 테스트 숫자는 촬영 당일 다시 실행한 최신 결과만 사용한다.
- 마지막 4초는 제품명, 한 줄 가치, 공개 데모 URL만 남긴다.

## 촬영 직전 상태 준비

1. 합성 데모 데이터를 초기 상태로 재설정한다.
2. 공개 Admin URL과 공개 Mobile URL을 시크릿 창과 다른 네트워크에서 각각 연다.
3. Admin을 먼저 띄운 뒤 Mobile이 그 공개 Admin API를 사용하도록 배포된 버전인지 확인한다.
4. 합성 업로드 파일을 바탕화면의 별도 폴더에 둔다.
5. 브라우저 즐겨찾기, 계정 이름, 알림, 로컬 경로를 숨긴다.
6. 1920×1080, 30fps, 마우스 포인터 강조를 사용한다.
7. 전체 원테이크 대신 일곱 장을 따로 녹화하고 25초 단위로 편집한다.
8. 최종 파일은 2:55 이하인지 확인한 뒤 YouTube **공개**로 업로드한다.
9. 로그아웃 또는 시크릿 창에서 영상과 두 제품 URL이 모두 열리는지 확인한다.

## 영상 설명란 초안

**LeaseFlow: Codex for Everyone — OpenAI Build Week 2026**

LeaseFlow turns changing landlord source documents into reviewed, published leasing information shared across Admin Web and Mobile. It also prepares customer packages and building-specific weekly landlord reports under explicit human approval. Built through an iterative GPT-5.6 and Codex collaboration with a real domain user. All demo data is synthetic, and all deliveries are sandbox records.

Admin demo: `[ADD PUBLIC ADMIN URL]`  
Mobile demo: `[ADD PUBLIC MOBILE URL]`  
Repository: `https://github.com/heeyagun-max/leaseflow`
