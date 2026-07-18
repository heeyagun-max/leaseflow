import type { Metadata } from "next";
import {
  ActionButton,
  ArrowUpRightIcon,
  DataFact,
  FeedbackPanel,
  GovernanceSurface,
  SectionHeading,
  ShieldIcon,
  StatusBadge,
  WorkflowStep,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "LeaseFlow 디자인 시스템",
  description: "LeaseFlow 관리자 화면의 디자인 요소와 상태입니다.",
};

export default function DesignShowcasePage() {
  return (
    <>
      <a className="lf-skip-link" href="#showcase-content">디자인 요소로 바로가기</a>
      <main className="lf-showcase" id="showcase-content">
        <header className="lf-showcase__masthead">
          <div className="lf-showcase__intro">
            <p className="lf-eyebrow">LeaseFlow 디자인 시스템</p>
            <h1 className="lf-showcase__title">복잡한 자산 업무를 <span>차분하고 명확하게.</span></h1>
            <p className="lf-showcase__lead">
              관리자 화면에 쓰이는 색상, 글자, 작업면, 상태와 반응형 동작을 한곳에서 확인합니다.
            </p>
          </div>
          <div className="lf-showcase__signal">
            <ShieldIcon />
            <span>
              <strong>색보다 문장으로 상태를 설명합니다</strong>
              <span>업무 결과와 다음 행동은 짧고 분명한 말로 안내합니다.</span>
            </span>
          </div>
        </header>

        <section className="lf-showcase__section" aria-labelledby="surface-heading">
          <SectionHeading
            eyebrow="작업면"
            headingId="surface-heading"
            level={2}
            title="하나의 차분한 작업면"
            description="얇은 경계와 자연스러운 그림자로 내용의 위계만 드러냅니다."
          />
          <div className="lf-showcase__grid lf-showcase__grid--wide">
            <GovernanceSurface interactive>
              <div className="lf-showcase__sample">
                <div className="lf-cluster">
                  <StatusBadge>확인 전</StatusBadge>
                  <StatusBadge tone="info">검토 중</StatusBadge>
                </div>
                <SectionHeading
                  level={3}
                  variant="compact"
                  title="기본 작업면"
                  description="일상적인 검토와 입력 업무에 사용하는 기본 표면입니다."
                />
              </div>
            </GovernanceSurface>
            <GovernanceSurface variant="accent">
              <div className="lf-showcase__sample">
                <div className="lf-cluster">
                  <StatusBadge tone="success">게시 완료</StatusBadge>
                  <StatusBadge tone="warning">확인 필요</StatusBadge>
                  <StatusBadge tone="error">진행 불가</StatusBadge>
                </div>
                <SectionHeading
                  level={3}
                  variant="compact"
                  title="중요 작업면"
                  description="승인 완료처럼 중요한 결과에만 절제된 강조를 사용합니다."
                />
              </div>
            </GovernanceSurface>
          </div>
        </section>

        <section className="lf-showcase__section" aria-labelledby="action-heading">
          <SectionHeading
            eyebrow="버튼"
            headingId="action-heading"
            level={2}
            title="행동의 우선순위와 상태"
            description="모든 버튼은 키보드로 접근할 수 있고, 진행 중이거나 사용할 수 없는 상태를 분명히 보여줍니다."
          />
          <GovernanceSurface variant="subtle">
            <div className="lf-showcase__sample">
              <h3>버튼 유형</h3>
              <div className="lf-cluster">
                <ActionButton trailingIcon={<ArrowUpRightIcon />}>승인하고 게시하기</ActionButton>
                <ActionButton variant="secondary">근거 확인</ActionButton>
                <ActionButton variant="ghost">취소</ActionButton>
                <ActionButton variant="danger">변경안 제외</ActionButton>
                <ActionButton disabled variant="secondary">담당자 확인 필요</ActionButton>
                <ActionButton loading variant="secondary">게시 중</ActionButton>
              </div>
              <p className="lf-section-heading__description">
                Tab 키로 모든 버튼을 이동할 수 있으며, 현재 위치가 명확하게 표시됩니다.
              </p>
            </div>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="workflow-heading">
          <SectionHeading
            eyebrow="진행 상황"
            headingId="workflow-heading"
            level={2}
            title="기억에 의존하지 않는 단계 안내"
            description="현재 단계와 담당자, 다음 행동을 같은 위치에서 확인합니다."
          />
          <GovernanceSurface>
            <ol className="lf-workflow">
              <WorkflowStep index={1} state="complete" title="변경안 찾기">자료에서 4건 확인</WorkflowStep>
              <WorkflowStep index={2} state="current" title="1차 확인">현재 단계 · 데이터 담당자</WorkflowStep>
              <WorkflowStep index={3} state="pending" title="최종 승인">대기 · 선임 담당자</WorkflowStep>
              <WorkflowStep index={4} state="blocked" title="게시">승인 후 진행</WorkflowStep>
            </ol>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="data-heading">
          <SectionHeading
            eyebrow="정보 표시"
            headingId="data-heading"
            level={2}
            title="필요한 정보만 가까이"
            description="주요 값은 바로 읽고, 상세 식별 정보는 필요할 때만 확인합니다."
          />
          <GovernanceSurface>
            <dl className="lf-data-grid">
              <DataFact label="임대 면적" value="200평" detail="현재 사용" state="verified" />
              <DataFact label="평면도" value="Cobalt_5F_v2.pdf" detail="최신 파일" state="verified" />
              <DataFact label="렌트프리 제안" value="2개월" detail="담당자 확인 필요" state="candidate" />
              <DataFact label="긴 건물명" value="Cobalt International Finance Center South Tower" detail="긴 이름도 화면 밖으로 넘치지 않습니다" />
            </dl>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="feedback-heading">
          <SectionHeading
            eyebrow="상태 안내"
            headingId="feedback-heading"
            level={2}
            title="불러오기, 빈 화면, 완료와 오류"
            description="각 상태는 지금 무슨 일이 일어났고 무엇을 하면 되는지 안내합니다."
          />
          <div className="lf-showcase__grid">
            <FeedbackPanel tone="loading" title="자산 정보를 불러오는 중">잠시만 기다려 주세요.</FeedbackPanel>
            <FeedbackPanel tone="empty" title="아직 변경안이 없습니다" action={<ActionButton variant="secondary">변경안 찾기</ActionButton>}>새 자료에서 달라진 내용을 먼저 찾아보세요.</FeedbackPanel>
            <FeedbackPanel tone="success" title="게시를 마쳤습니다">현장 팀에서 최신 자산 정보를 확인할 수 있습니다.</FeedbackPanel>
            <FeedbackPanel tone="error" title="최신 정보가 있습니다" action={<ActionButton variant="danger">다시 불러오기</ActionButton>}>다른 담당자가 먼저 변경했습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.</FeedbackPanel>
          </div>
        </section>
      </main>
    </>
  );
}
