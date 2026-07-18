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
  title: "Design System Showcase",
  description: "LeaseFlow governed operations design primitives and interaction states.",
};

export default function DesignShowcasePage() {
  return (
    <>
      <a className="lf-skip-link" href="#showcase-content">Skip to primitive showcase</a>
      <main className="lf-showcase" id="showcase-content">
        <header className="lf-showcase__masthead">
          <div className="lf-showcase__intro">
            <p className="lf-eyebrow">LeaseFlow / Design system 0.1</p>
            <h1 className="lf-showcase__title">A calm command center for <span>governed work.</span></h1>
            <p className="lf-showcase__lead">
              This isolated route proves tokens, states, material depth, long-content resilience, and responsive behavior before any product screen is composed.
            </p>
          </div>
          <div className="lf-showcase__signal">
            <ShieldIcon />
            <span>
              <strong>Green means governed</strong>
              <span>Candidate AI output remains neutral until a human-controlled transition verifies it.</span>
            </span>
          </div>
        </header>

        <section className="lf-showcase__section" aria-labelledby="surface-heading">
          <SectionHeading
            eyebrow="01 / Material"
            headingId="surface-heading"
            level={2}
            title="Governance surfaces"
            description="The double bezel separates the operational work surface from the ambient canvas without generic card shadows or scrolling blur."
          />
          <div className="lf-showcase__grid lf-showcase__grid--wide">
            <GovernanceSurface interactive>
              <div className="lf-showcase__sample">
                <div className="lf-cluster">
                  <StatusBadge>Unreviewed</StatusBadge>
                  <StatusBadge tone="info">Candidate</StatusBadge>
                </div>
                <SectionHeading
                  level={3}
                  variant="compact"
                  title="Default work surface"
                  description="Hover this surface to verify the rim response. The content remains fully readable without motion."
                />
              </div>
            </GovernanceSurface>
            <GovernanceSurface variant="accent">
              <div className="lf-showcase__sample">
                <div className="lf-cluster">
                  <StatusBadge tone="success">Published</StatusBadge>
                  <StatusBadge tone="warning">Review due</StatusBadge>
                  <StatusBadge tone="error">Blocked</StatusBadge>
                </div>
                <SectionHeading
                  level={3}
                  variant="compact"
                  title="Governed work surface"
                  description="Accent material appears only after verification. Status text and marks preserve meaning without color."
                />
              </div>
            </GovernanceSurface>
          </div>
        </section>

        <section className="lf-showcase__section" aria-labelledby="action-heading">
          <SectionHeading
            eyebrow="02 / Interaction"
            headingId="action-heading"
            level={2}
            title="Action hierarchy and states"
            description="All controls are native, keyboard reachable, at least 44px tall, and explicit about disabled or in-progress state."
          />
          <GovernanceSurface variant="subtle">
            <div className="lf-showcase__sample">
              <h3>Button variants</h3>
              <div className="lf-cluster">
                <ActionButton trailingIcon={<ArrowUpRightIcon />}>Approve publication</ActionButton>
                <ActionButton variant="secondary">Review evidence</ActionButton>
                <ActionButton variant="ghost">Cancel</ActionButton>
                <ActionButton variant="danger">Reject candidate</ActionButton>
                <ActionButton disabled variant="secondary">Permission required</ActionButton>
                <ActionButton loading variant="secondary">Publishing</ActionButton>
              </div>
              <p className="lf-section-heading__description">
                Keyboard sample: Tab through each control to inspect the focus ring. Press states scale the control without moving adjacent content.
              </p>
            </div>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="workflow-heading">
          <SectionHeading
            eyebrow="03 / Workflow"
            headingId="workflow-heading"
            level={2}
            title="Progress without memory burden"
            description="Stage, ownership, and outcome remain visible together. The rail becomes one column when its content floor is reached."
          />
          <GovernanceSurface>
            <ol className="lf-workflow">
              <WorkflowStep index={1} state="complete" title="Extracted">Four source-backed candidates</WorkflowStep>
              <WorkflowStep index={2} state="current" title="Junior confirmation">Current · Data Steward</WorkflowStep>
              <WorkflowStep index={3} state="pending" title="Senior approval">Pending · Senior Reviewer</WorkflowStep>
              <WorkflowStep index={4} state="blocked" title="Publication">Blocked until approval</WorkflowStep>
            </ol>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="data-heading">
          <SectionHeading
            eyebrow="04 / Data density"
            headingId="data-heading"
            level={2}
            title="Facts stay close to provenance"
            description="Definition-list semantics and overflow-safe tracks support dense records, Korean labels, and unbroken identifiers."
          />
          <GovernanceSurface>
            <dl className="lf-data-grid">
              <DataFact label="Marketed area" value="200 py" detail="rec-cobalt-area-v2 · published" state="verified" />
              <DataFact label="Floor plan" value="Cobalt_5F_v2.pdf" detail="file-cobalt-plan-v2 · current" state="verified" />
              <DataFact label="Rent-free candidate" value="2 months" detail="candidate_requires_junior_confirmation" state="candidate" />
              <DataFact label="긴 출처 식별자 / Long source ID" value="src-synthetic-cobalt-weekly-update-2026-07-18" detail="synthetic://operations/cobalt/weekly/2026-07-18/revision/000000000000000042" />
            </dl>
          </GovernanceSurface>
        </section>

        <section className="lf-showcase__section" aria-labelledby="feedback-heading">
          <SectionHeading
            eyebrow="05 / Recovery"
            headingId="feedback-heading"
            level={2}
            title="Loading, empty, success, and error"
            description="Every state explains what happened and, when necessary, how to recover. No blank frames, color-only status, or placeholder copy."
          />
          <div className="lf-showcase__grid">
            <FeedbackPanel tone="loading" title="Loading persistent demo state">Revision and audit history are being reconciled.</FeedbackPanel>
            <FeedbackPanel tone="empty" title="No candidates yet" action={<ActionButton variant="secondary">Extract synthetic source</ActionButton>}>Run extraction to create reviewable candidates. Official property data will not be changed.</FeedbackPanel>
            <FeedbackPanel tone="success" title="Publication verified">Mobile adapters can now read the current authorized record and floor plan.</FeedbackPanel>
            <FeedbackPanel tone="error" title="Revision conflict" action={<ActionButton variant="danger">Reload latest revision</ActionButton>}>Another actor changed this demo. Reload revision 42 before retrying approval.</FeedbackPanel>
          </div>
        </section>
      </main>
    </>
  );
}
