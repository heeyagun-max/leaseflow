import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { assistantHome, demoRequest, type MobilePublishedSnapshot } from "@leaseflow/demo-data";
import {
  ActionButton,
  DataRow,
  Divider,
  FeedbackPanel,
  GovernanceSurface,
  MetricCard,
  MonoText,
  SectionHeading,
  StatusBadge,
  WorkflowRail,
  type StatusTone,
} from "../src/components/operations-ui";
import { fetchPublishedData } from "../src/data/published-data";
import {
  ReportWorkflowHttpError,
  REPORT_INVESTIGATION_COMMANDS,
  fetchMobileReports,
  mutateMobileReports,
  reportWorkflowRefreshRevision,
  requiresReportWorkflowRefresh,
  type MobileReportView,
  type MobileReportWorkflowView,
  type ReportWorkflowAction,
} from "../src/data/reports";
import {
  fetchMobileWorkflow,
  mutateMobileWorkflow,
  type MobileWorkflowView,
} from "../src/data/workflow";
import {
  colors,
  control,
  fonts,
  icon,
  layout,
  lineHeight,
  radius,
  space,
  tabularNumbers,
  tracking,
  type,
} from "../src/styles/theme";

type WorkflowAction = Parameters<typeof mutateMobileWorkflow>[1];
type BusyKey = string | null;

interface SurfaceError {
  title: string;
  description: string;
}

interface SurfaceErrors {
  published: SurfaceError | null;
  package: SurfaceError | null;
  report: SurfaceError | null;
}

const EMPTY_ERRORS: SurfaceErrors = {
  published: null,
  package: null,
  report: null,
};

export default function Home() {
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  const isTablet = width >= layout.tabletBreakpoint;
  const [published, setPublished] = useState<MobilePublishedSnapshot | null>(null);
  const [workflow, setWorkflow] = useState<MobileWorkflowView | null>(null);
  const [reportWorkflow, setReportWorkflow] = useState<MobileReportWorkflowView | null>(null);
  const [errors, setErrors] = useState<SurfaceErrors>(EMPTY_ERRORS);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<BusyKey>("initial-load");

  const updateError = useCallback((surface: keyof SurfaceErrors, next: SurfaceError | null) => {
    setErrors((current) => ({ ...current, [surface]: next }));
  }, []);

  const refreshPublished = useCallback(async () => {
    try {
      setPublished(await fetchPublishedData());
      updateError("published", null);
    } catch (error) {
      updateError("published", surfaceError("게시된 데이터에 연결할 수 없습니다", error));
    }
  }, [updateError]);

  const refreshPackageWorkflow = useCallback(async () => {
    try {
      setWorkflow(await fetchMobileWorkflow());
      updateError("package", null);
    } catch (error) {
      updateError("package", surfaceError("요청 워크플로를 불러오지 못했습니다", error));
    }
  }, [updateError]);

  const refreshReportWorkflow = useCallback(async () => {
    try {
      setReportWorkflow(await fetchMobileReports());
      updateError("report", null);
    } catch (error) {
      updateError("report", surfaceError("주간 보고서를 불러오지 못했습니다", error));
    }
  }, [updateError]);

  const refreshAll = useCallback(async (showBusy = true) => {
    if (showBusy) setBusyKey("refresh-all");
    setNotice(null);
    await Promise.all([refreshPublished(), refreshPackageWorkflow(), refreshReportWorkflow()]);
    if (showBusy) setBusyKey(null);
  }, [refreshPackageWorkflow, refreshPublished, refreshReportWorkflow]);

  useEffect(() => {
    void refreshAll().finally(() => setBusyKey(null));
  }, [refreshAll]);

  const runPackageAction = useCallback(async (action: WorkflowAction, key: string) => {
    if (!workflow || busyKey) return;
    setBusyKey(key);
    setNotice(null);
    try {
      const next = await mutateMobileWorkflow(workflow.revision, action);
      setWorkflow(next);
      updateError("package", null);
      await refreshReportWorkflow();
    } catch (error) {
      updateError("package", surfaceError("요청 작업을 완료하지 못했습니다", error));
      if (isRevisionConflict(error)) {
        await Promise.all([refreshPackageWorkflow(), refreshReportWorkflow()]);
        setNotice("다른 작업에서 상태가 변경되어 최신 리비전을 다시 불러왔습니다.");
      }
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refreshPackageWorkflow, refreshReportWorkflow, updateError, workflow]);

  const runReportAction = useCallback(async (action: ReportWorkflowAction, key: string) => {
    if (!reportWorkflow || busyKey) return;
    setBusyKey(key);
    setNotice(null);
    try {
      const next = await mutateMobileReports(reportWorkflow.revision, action);
      setReportWorkflow(next);
      updateError("report", null);
      await refreshPackageWorkflow();
    } catch (error) {
      updateError("report", surfaceError("보고서 작업을 완료하지 못했습니다", error));
      if (requiresReportWorkflowRefresh(error)) {
        await Promise.all([refreshPackageWorkflow(), refreshReportWorkflow()]);
        const currentRevision = reportWorkflowRefreshRevision(error);
        const reason = error.code === "WORKFLOW_STALE"
          ? "소스 또는 게시 상태가 변경되어 보고서가 stale 처리되었습니다."
          : "다른 작업에서 상태가 변경되었습니다.";
        setNotice(currentRevision
          ? `${reason} 서버 리비전 ${currentRevision}으로 동기화했습니다.`
          : `${reason} 최신 상태를 다시 불러왔습니다.`);
      }
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refreshPackageWorkflow, refreshReportWorkflow, reportWorkflow, updateError]);

  const request = workflow?.requests.at(-1);
  const packageDraft = workflow?.packages.at(-1);
  const report = reportWorkflow?.reports.at(-1);
  const packagePending = packageDraft
    ? packageDraft.status === "sent" ? 0 : 1
    : assistantHome.pendingPackages;
  const reportDue = report?.status === "sent" ? 0 : assistantHome.weeklyReportsDue;
  const publicationReady = published && workflow?.publication_stage === "published";

  const globalRevision = Math.max(workflow?.revision ?? 0, reportWorkflow?.revision ?? 0);
  const auditCount = (workflow?.audit.length ?? 0) + (reportWorkflow?.audit.length ?? 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, isTablet && styles.contentTablet, isWide && styles.contentWide]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="LeaseFlow 모바일 운영 콕핏"
    >
      <StatusBar style="light" />

      <View style={styles.topbar}>
        <View style={styles.brandCluster}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <View style={styles.brandMarkInner} />
          </View>
          <View>
            <Text style={styles.brand}>LeaseFlow</Text>
            <Text style={styles.brandSubline}>MOBILE OPERATIONS</Text>
          </View>
        </View>
        <View style={[styles.topbarMeta, isTablet && styles.topbarMetaTablet]}>
          <StatusBadge label="DEMO" tone="info" />
          <StatusBadge label="LM Manager" tone="neutral" />
          <StatusBadge label="SANDBOX ONLY" tone="warning" />
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>GOVERNED FIELD DESK</Text>
          <Text accessibilityRole="header" aria-level={1} style={[styles.heroTitle, isTablet && styles.heroTitleTablet]}>
            오늘의 외부 작업을{`\n`}증거와 승인으로 닫습니다.
          </Text>
          <Text style={styles.heroDescription}>
            현재 게시된 자산만 조회하고, 후보 변경은 사람이 확정하며, 모든 외부 발송은 샌드박스 승인 뒤 기록됩니다.
          </Text>
        </View>
        <GovernanceSurface
          accent={Boolean(publicationReady)}
          subtle={!publicationReady}
          style={[styles.heroStatus, isTablet && styles.heroStatusTablet]}
          accessibilityLabel="운영 상태 요약"
        >
          <View style={styles.heroStatusHeader}>
            <Text style={styles.heroStatusLabel}>CONTROL PLANE</Text>
            <StatusBadge label={publicationReady ? "게시 상태 정상" : "연결 확인 필요"} tone={publicationReady ? "success" : "warning"} live />
          </View>
          <View style={styles.heroStatusLine}>
            <View style={[styles.heroStatusSignal, publicationReady && styles.heroStatusSignalReady]} />
            <View style={styles.heroStatusCopy}>
              <Text style={styles.heroStatusTitle}>Cobalt Finance Center · 5F</Text>
              <MonoText>revision {globalRevision || "—"} · {auditCount} audit events</MonoText>
            </View>
          </View>
          <ActionButton
            label="모든 상태 새로고침"
            variant="ghost"
            compact
            loading={busyKey === "refresh-all" || busyKey === "initial-load"}
            disabled={Boolean(busyKey) && busyKey !== "refresh-all" && busyKey !== "initial-load"}
            onPress={() => void refreshAll()}
            hint="게시 데이터, 요청 패키지, 주간 보고서를 모두 다시 불러옵니다"
          />
        </GovernanceSurface>
      </View>

      {notice ? (
        <FeedbackPanel tone="info" title="최신 상태로 동기화했습니다" description={notice} />
      ) : null}

      <View style={[styles.metricGrid, isTablet && styles.metricGridTablet]}>
        <MetricCard value={packagePending} label="검토할 외부 패키지" tone={packagePending ? "warning" : "success"} />
        <MetricCard value={reportDue} label="마감할 주간 보고서" tone={reportDue ? "warning" : "success"} />
        <MetricCard value={published?.marketed_area_py ?? "—"} label="현재 게시 면적 · py" tone={published ? "success" : "neutral"} />
        <MetricCard value={globalRevision || "—"} label="공유 상태 리비전" />
      </View>

      <PublishedSnapshot
        published={published}
        error={errors.published}
        busy={busyKey === "published-refresh"}
        onRefresh={async () => {
          setBusyKey("published-refresh");
          await refreshPublished();
          setBusyKey(null);
        }}
      />

      <View style={[styles.workspaceGrid, isWide && styles.workspaceGridWide]}>
        <RequestWorkspace
          workflow={workflow}
          request={request}
          packageDraft={packageDraft}
          error={errors.package}
          busyKey={busyKey}
          onAction={runPackageAction}
          onRefresh={refreshPackageWorkflow}
          isWide={isWide}
        />
        <ReportWorkspace
          workflow={reportWorkflow}
          report={report}
          error={errors.report}
          busyKey={busyKey}
          onAction={runReportAction}
          onRefresh={refreshReportWorkflow}
          isTablet={isTablet}
          isWide={isWide}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>DEMO BOUNDARY</Text>
        <Text style={styles.footerCopy}>
          합성 데이터와 mock Outlook 요약만 사용합니다. 실제 Outlook, SSO, 통신사 발신 또는 프로덕션 이메일 전송과 연결되지 않습니다.
        </Text>
      </View>
    </ScrollView>
  );
}

function PublishedSnapshot({ published, error, busy, onRefresh }: {
  published: MobilePublishedSnapshot | null;
  error: SurfaceError | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <GovernanceSurface style={styles.sectionSurface} accessibilityLabel="게시 데이터 스냅샷">
      <SectionHeading
        eyebrow="PUBLISHED RECORD"
        title="외부 작업이 참조하는 단 하나의 현재 버전"
        description="모바일은 Admin Web에서 게시·활성·외부공유 가능 상태로 확정된 자산만 받습니다. 이전 평면도는 새 패키지에서 차단됩니다."
        action={<ActionButton label="게시 데이터 갱신" variant="ghost" compact onPress={onRefresh} loading={busy} />}
      />
      <Divider />
      {error ? (
        <FeedbackPanel tone="error" title={error.title} description={`${error.description} Admin Web을 실행하거나 EXPO_PUBLIC_LEASEFLOW_API_URL을 확인하세요.`} />
      ) : published ? (
        <View style={styles.dataGrid}>
          <DataRow label="MARKETED AREA" value={`${published.marketed_area_py} py`} detail="현재 외부 마케팅 면적" tone="verified" />
          <DataRow label="RENT FREE" value={`${published.rent_free_months} months`} detail="현재 게시 조건" tone="verified" />
          <DataRow label="SUPPORTED PARKING" value={`${published.supported_parking_spaces} spaces`} detail="현재 게시 조건" tone="verified" />
          <DataRow label="CURRENT PLAN" value={published.floor_plan.filename} detail={published.floor_plan.version_id} tone="verified" />
          <DataRow
            label="BLOCKED PLAN"
            value={published.blocked_floor_plans.join(", ") || "차단 버전 없음"}
            detail="새 외부 패키지 선택 불가"
            tone="candidate"
          />
        </View>
      ) : (
        <FeedbackPanel tone="info" title="게시 데이터를 확인하는 중입니다" description="현재 버전과 차단 버전을 안전하게 불러오고 있습니다." />
      )}
    </GovernanceSurface>
  );
}

function RequestWorkspace({ workflow, request, packageDraft, error, busyKey, onAction, onRefresh, isWide }: {
  workflow: MobileWorkflowView | null;
  request: MobileWorkflowView["requests"][number] | undefined;
  packageDraft: MobileWorkflowView["packages"][number] | undefined;
  error: SurfaceError | null;
  busyKey: BusyKey;
  onAction: (action: WorkflowAction, key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isWide: boolean;
}) {
  const steps = requestWorkflowSteps(request, packageDraft);
  const status = packageStatus(packageDraft, request);

  return (
    <GovernanceSurface style={[styles.workspaceSurface, isWide && styles.workspaceSurfaceWide]} accessibilityLabel="요청에서 샌드박스 패키지까지 워크플로">
      <SectionHeading
        eyebrow="REQUEST → PACKAGE"
        title="요청을 현재 게시 자료로 패키징"
        description="합성 통화·이메일을 후보 요청으로 가져온 뒤 사람이 확인하고, 게시 버전으로 외부 패키지를 만듭니다."
        action={<StatusBadge label={status.label} tone={status.tone} live />}
      />
      <View style={styles.railWrap}><WorkflowRail steps={steps} /></View>
      <Divider />

      {error ? (
        <FeedbackPanel
          tone="error"
          title={error.title}
          description={error.description}
          action={<ActionButton label="요청 상태 다시 불러오기" variant="ghost" compact onPress={() => void onRefresh()} />}
        />
      ) : null}

      {!workflow ? (
        <FeedbackPanel tone="info" title="요청 워크플로를 확인하는 중입니다" description="서버의 현재 리비전과 감사 기록을 불러오고 있습니다." />
      ) : null}

      {workflow && !request ? (
        <View style={styles.taskStack}>
          <TaskIntro
            label="SYNTHETIC INBOX"
            title="새 요청을 안전한 후보로 가져오기"
            description={demoRequest.text}
          />
          <FeedbackPanel tone="warning" title="후보는 공식 데이터가 아닙니다" description="가져온 요청은 확인 전까지 후보이며 게시 자산을 수정하지 않습니다." />
          <View style={styles.actionCluster}>
            <ActionButton
              label="합성 통화 가져오기"
              variant="primary"
              loading={busyKey === "import-call"}
              disabled={Boolean(busyKey) && busyKey !== "import-call"}
              onPress={() => void onAction({ action: "import", source: "call" }, "import-call")}
            />
            <ActionButton
              label="합성 이메일 가져오기"
              loading={busyKey === "import-email"}
              disabled={Boolean(busyKey) && busyKey !== "import-email"}
              onPress={() => void onAction({ action: "import", source: "email" }, "import-email")}
            />
          </View>
        </View>
      ) : null}

      {request?.status === "candidate" ? (
        <View style={styles.taskStack}>
          <TaskIntro label="EXTRACTED CANDIDATE" title="추출 결과를 확인하세요" description="건물·층·요청 자료·수신자를 사람이 확인해야 다음 단계로 이동합니다." />
          <RequestSummary request={request} />
          <ActionButton
            label="추출 요청 확인"
            variant="primary"
            loading={busyKey === "confirm-request"}
            disabled={Boolean(busyKey) && busyKey !== "confirm-request"}
            onPress={() => void onAction({ action: "confirm", request_id: request.id }, "confirm-request")}
          />
        </View>
      ) : null}

      {request?.status === "confirmed" && !packageDraft ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="요청이 확인되었습니다" description="현재 게시된 200 py와 plan v2만 사용해 외부 패키지를 만들 수 있습니다." />
          <ActionButton
            label="게시 v2로 패키지 작성"
            variant="primary"
            loading={busyKey === "draft-package"}
            disabled={Boolean(busyKey) && busyKey !== "draft-package"}
            onPress={() => void onAction({ action: "draft", request_id: request.id }, "draft-package")}
          />
        </View>
      ) : null}

      {packageDraft ? (
        <PackageStage pkg={packageDraft} busyKey={busyKey} onAction={onAction} />
      ) : null}

      <Divider />
      <MonoText>package revision {workflow?.revision ?? "—"} · {workflow?.audit.length ?? 0} audit events</MonoText>
    </GovernanceSurface>
  );
}

function PackageStage({ pkg, busyKey, onAction }: {
  pkg: MobileWorkflowView["packages"][number];
  busyKey: BusyKey;
  onAction: (action: WorkflowAction, key: string) => Promise<void>;
}) {
  if (pkg.status === "stale") {
    return (
      <FeedbackPanel
        tone="error"
        title="패키지가 최신 게시 상태와 다릅니다"
        description="이 패키지는 발송할 수 없습니다. 게시 상태를 갱신한 뒤 새 패키지를 작성하세요."
      />
    );
  }

  if (pkg.status === "sent") {
    return (
      <View style={styles.taskStack}>
        <FeedbackPanel tone="success" title="샌드박스 발송이 기록되었습니다" description="SANDBOX ONLY 전달과 building activity가 감사 기록에 남았습니다." />
        <PackageReview pkg={pkg} />
      </View>
    );
  }

  if (pkg.status === "edit_pending") {
    return (
      <View style={styles.taskStack}>
        <TaskIntro label="SCOPED EDIT CANDIDATE" title="문구 변경 전후를 비교하세요" description="후보 문구만 바뀌며 게시 자산과 수신자 규칙은 변경되지 않습니다." />
        <PackageReview pkg={pkg} />
        <BeforeAfter before={`${pkg.subject}\n${pkg.body}`} after={`${pkg.edit_candidate?.subject ?? ""}\n${pkg.edit_candidate?.body ?? ""}`} />
        <View style={styles.actionCluster}>
          <ActionButton
            label="문구 변경 수락"
            variant="primary"
            loading={busyKey === "accept-package-edit"}
            disabled={Boolean(busyKey) && busyKey !== "accept-package-edit"}
            onPress={() => void onAction({ action: "decide", package_id: pkg.id, decision: "accept" }, "accept-package-edit")}
          />
          <ActionButton
            label="문구 변경 거절"
            variant="ghost"
            loading={busyKey === "reject-package-edit"}
            disabled={Boolean(busyKey) && busyKey !== "reject-package-edit"}
            onPress={() => void onAction({ action: "decide", package_id: pkg.id, decision: "reject" }, "reject-package-edit")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.taskStack}>
      <TaskIntro
        label={pkg.status === "approved" ? "APPROVED PACKAGE" : "PACKAGE DRAFT"}
        title={pkg.subject}
        description={pkg.body}
      />
      <PackageReview pkg={pkg} />
      {pkg.status === "draft" ? (
        <View style={styles.actionStack}>
          <ActionButton
            label="간결한 문구 변경 제안"
            loading={busyKey === "edit-package"}
            disabled={Boolean(busyKey) && busyKey !== "edit-package"}
            onPress={() => void onAction({ action: "edit", package_id: pkg.id, instruction: "Make the message concise and courteous" }, "edit-package")}
          />
          <ActionButton
            label="LM Manager로 패키지 승인"
            variant="primary"
            loading={busyKey === "approve-package"}
            disabled={Boolean(busyKey) && busyKey !== "approve-package"}
            onPress={() => void onAction({ action: "approve", package_id: pkg.id }, "approve-package")}
          />
        </View>
      ) : null}
      {pkg.status === "approved" ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="warning" title="승인 완료 · 아직 발송 전" description="다음 동작은 실제 이메일이 아닌 SANDBOX ONLY 기록입니다." />
          <ActionButton
            label="SANDBOX ONLY 발송"
            variant="primary"
            loading={busyKey === "send-package"}
            disabled={Boolean(busyKey) && busyKey !== "send-package"}
            onPress={() => void onAction({ action: "send", package_id: pkg.id, idempotency_key: `mobile-demo-${pkg.id}` }, "send-package")}
          />
        </View>
      ) : null}
    </View>
  );
}

function ReportWorkspace({ workflow, report, error, busyKey, onAction, onRefresh, isTablet, isWide }: {
  workflow: MobileReportWorkflowView | null;
  report: MobileReportView | undefined;
  error: SurfaceError | null;
  busyKey: BusyKey;
  onAction: (action: ReportWorkflowAction, key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isTablet: boolean;
  isWide: boolean;
}) {
  const status = reportStatus(report);
  return (
    <GovernanceSurface style={[styles.workspaceSurface, isWide && styles.workspaceSurfaceWide]} accessibilityLabel="주간 보고서 워크플로">
      <SectionHeading
        eyebrow="WEEKLY LANDLORD REPORT"
        title="활동과 mock Outlook을 건물별 보고서로"
        description="정확히 정의된 한국어 조사 명령만 후보 패치를 만들며, 구성된 수신자와 사람 승인이 외부 전달을 통제합니다."
        action={<StatusBadge label={status.label} tone={status.tone} live />}
      />
      <View style={styles.railWrap}><WorkflowRail steps={reportWorkflowSteps(report)} /></View>
      <Divider />

      {error ? (
        <FeedbackPanel
          tone="error"
          title={error.title}
          description={error.description}
          action={<ActionButton label="보고서 상태 다시 불러오기" variant="ghost" compact onPress={() => void onRefresh()} />}
        />
      ) : null}

      {!workflow ? (
        <FeedbackPanel tone="info" title="보고서 상태를 확인하는 중입니다" description="건물별 보고서와 최신 리비전을 불러오고 있습니다." />
      ) : null}

      {workflow && !report ? (
        <View style={styles.taskStack}>
          <TaskIntro label="BUILDING-SCOPED DRAFT" title="Cobalt Finance Center 주간 보고서 작성" description="LeaseFlow activity와 허용된 mock Outlook 요약으로 2026-07-13–2026-07-18 보고서를 만듭니다." />
          <FeedbackPanel tone="info" title="내부 전용 메시지는 제외됩니다" description="client_confidential 소스는 보고서, 후보 근거, 모바일 응답에 들어오지 않습니다." />
          <ActionButton
            label="건물별 보고서 초안 만들기"
            variant="primary"
            loading={busyKey === "draft-report"}
            disabled={Boolean(busyKey) && busyKey !== "draft-report"}
            onPress={() => void onAction({ action: "draft" }, "draft-report")}
          />
        </View>
      ) : null}

      {report ? (
        <View style={styles.taskStack}>
          <ReportSummary report={report} />

          {report.status === "stale" ? (
            <FeedbackPanel
              tone="error"
              title="보고서가 최신 소스와 다릅니다"
              description="소스·수신자·게시 자료 변동이 감지되었습니다. 이 보고서는 승인 또는 발송할 수 없습니다."
            />
          ) : null}

          {report.status === "draft" ? (
            <CommandPicker
              busyKey={busyKey}
              reportId={report.id}
              onAction={onAction}
              columns={isTablet ? 2 : 1}
            />
          ) : null}

          {report.status === "patch_pending" && report.pending_candidate ? (
            <PatchCandidatePanel candidate={report.pending_candidate} />
          ) : null}

          {report.status === "patch_pending" ? (
            <View style={styles.taskStack}>
              {report.pending_candidate?.unresolved.length ? (
                <FeedbackPanel
                  tone="warning"
                  title="미해결 항목 때문에 패치를 수락할 수 없습니다"
                  description="근거 질문을 해소하거나 후보를 거절한 뒤 새 조사를 실행하세요. 미해결 후보는 공식 보고서에 반영되지 않습니다."
                />
              ) : null}
              <View style={styles.actionCluster}>
                <ActionButton
                  label="근거 기반 패치 수락"
                  variant="primary"
                  loading={busyKey === "accept-report-patch"}
                  disabled={Boolean(report.pending_candidate?.unresolved.length) || (Boolean(busyKey) && busyKey !== "accept-report-patch")}
                  onPress={() => void onAction({ action: "decide_patch", report_id: report.id, decision: "accept" }, "accept-report-patch")}
                  hint={report.pending_candidate?.unresolved.length ? "미해결 질문이 있어 수락할 수 없습니다" : "근거가 표시된 후보 변경을 보고서에 반영합니다"}
                />
                <ActionButton
                  label="패치 거절"
                  variant="ghost"
                  loading={busyKey === "reject-report-patch"}
                  disabled={Boolean(busyKey) && busyKey !== "reject-report-patch"}
                  onPress={() => void onAction({ action: "decide_patch", report_id: report.id, decision: "reject" }, "reject-report-patch")}
                />
              </View>
            </View>
          ) : null}

          <RecipientPanel report={report} />

          {report.status === "draft" ? (
            <View style={styles.taskStack}>
              {report.accepted_patch_count === 0 ? (
                <FeedbackPanel tone="warning" title="조사 패치를 먼저 검토하세요" description="다섯 명령 중 하나로 소스를 조사하고 후보 diff를 수락한 뒤 승인할 수 있습니다." />
              ) : (
                <FeedbackPanel tone="success" title={`${report.accepted_patch_count}개 패치가 반영되었습니다`} description="수신자와 외부 커버를 확인한 뒤 LM Manager 승인을 진행하세요." />
              )}
              <ActionButton
                label="LM Manager로 외부 보고서 승인"
                variant="primary"
                loading={busyKey === "approve-report"}
                disabled={report.accepted_patch_count === 0 || (Boolean(busyKey) && busyKey !== "approve-report")}
                onPress={() => void onAction({ action: "approve", report_id: report.id }, "approve-report")}
              />
            </View>
          ) : null}

          {report.status === "approved" ? (
            <View style={styles.taskStack}>
              <FeedbackPanel tone="warning" title="승인 완료 · 샌드박스 전달 대기" description="구성된 To/Cc는 고정되어 있으며 다음 동작은 프로덕션 이메일 발송이 아닙니다." />
              <ActionButton
                label="SANDBOX ONLY 보고서 발송"
                variant="primary"
                loading={busyKey === "send-report"}
                disabled={Boolean(busyKey) && busyKey !== "send-report"}
                onPress={() => void onAction({ action: "send", report_id: report.id, idempotency_key: `mobile-report-demo-${report.id}` }, "send-report")}
              />
            </View>
          ) : null}

          {report.status === "sent" ? (
            <FeedbackPanel tone="success" title="주간 보고서 샌드박스 전달 완료" description="보고서 활동과 감사 이벤트가 건물 기록에 저장되었습니다." />
          ) : null}
        </View>
      ) : null}

      <Divider />
      <MonoText>report revision {workflow?.revision ?? "—"} · {workflow?.audit.length ?? 0} audit events</MonoText>
    </GovernanceSurface>
  );
}

function CommandPicker({ reportId, busyKey, onAction, columns }: {
  reportId: string;
  busyKey: BusyKey;
  onAction: (action: ReportWorkflowAction, key: string) => Promise<void>;
  columns: 1 | 2;
}) {
  return (
    <View style={styles.taskStack}>
      <TaskIntro label="CONTROLLED INVESTIGATION" title="허용된 한국어 조사 명령" description="자유 입력 대신 검증된 다섯 문장만 소스 기반 후보 패치를 요청합니다." />
      <View style={[styles.commandGrid, columns === 2 && styles.commandGridTwo]}>
        {REPORT_INVESTIGATION_COMMANDS.map((command, index) => {
          const key = `report-command-${index}`;
          return (
            <View key={command} style={columns === 2 ? styles.commandCell : undefined}>
              <ActionButton
                label={command}
                variant={index === 2 ? "primary" : "secondary"}
                loading={busyKey === key}
                disabled={Boolean(busyKey) && busyKey !== key}
                onPress={() => void onAction({ action: "investigate", report_id: reportId, command }, key)}
                hint="허용된 합성 activity와 mock Outlook 소스만 조사합니다"
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PatchCandidatePanel({ candidate }: {
  candidate: NonNullable<MobileReportView["pending_candidate"]>;
}) {
  return (
    <View style={styles.taskStack}>
      <TaskIntro label="SOURCE-BACKED CANDIDATE" title="패치 후보와 근거를 함께 검토하세요" description={candidate.command} />
      <View accessibilityRole="list" style={styles.findingList}>
        {candidate.findings.map((finding, index) => (
          <View key={`${finding.finding}-${index}`} style={styles.findingCard}>
            <View style={styles.findingHeader}>
              <StatusBadge label={`신뢰도 ${Math.round(finding.confidence * 100)}%`} tone="info" />
              <MonoText>finding {index + 1}</MonoText>
            </View>
            <Text style={styles.findingText}>{finding.finding}</Text>
            <SourceChips sourceIds={finding.source_reference_ids} />
          </View>
        ))}
      </View>
      {candidate.operations.map((operation, index) => (
        <View key={`${operation.section}-${index}`} style={styles.operationCard}>
          <View style={styles.operationHeader}>
            <StatusBadge label="AI 후보 · 미승인" tone="info" />
            <MonoText>{operation.section} · {operation.operation}</MonoText>
          </View>
          <BeforeAfter before={formatPatchValue(operation.before)} after={formatPatchValue(operation.after)} />
          <SourceChips sourceIds={operation.source_reference_ids} />
        </View>
      ))}
      {candidate.unresolved.length ? (
        <FeedbackPanel
          tone="warning"
          title="확인이 필요한 항목이 남았습니다"
          description={candidate.unresolved.map((item) => `${item.field}: ${item.question}`).join(" · ")}
        />
      ) : null}
    </View>
  );
}

function ReportSummary({ report }: { report: MobileReportView }) {
  const sectionItems = [
    ...report.sections.changes_since_last_report,
    ...report.sections.activity_summary,
    ...report.sections.negotiated_area_floor_changes,
    ...report.sections.competitor_buildings,
    ...report.sections.blocker_and_pending_approval,
  ];
  return (
    <View style={styles.taskStack}>
      <View style={styles.reportIdentity}>
        <View style={styles.reportIdentityCopy}>
          <Text style={styles.reportTitle}>Cobalt Finance Center</Text>
          <Text style={styles.reportPeriod}>{report.reporting_period.from} — {report.reporting_period.to}</Text>
        </View>
        <MonoText>{report.id}</MonoText>
      </View>
      <DataRow label="KEY ISSUE" value={report.sections.key_issue} detail={`${sectionItems.length} report lines · ${report.sources.length} permitted sources`} tone={report.status === "approved" || report.status === "sent" ? "verified" : "neutral"} />
      <View style={styles.reportLineList}>
        {sectionItems.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.reportLine}>
            <View style={styles.reportLineMark} />
            <Text style={styles.reportLineText}>{item}</Text>
          </View>
        ))}
        {report.sections.next_actions.map((item) => (
          <View key={`${item.action}-${item.due_date}`} style={styles.reportLine}>
            <View style={[styles.reportLineMark, styles.reportLineMarkAction]} />
            <Text style={styles.reportLineText}>{item.action} · {item.owner} · {item.due_date}</Text>
          </View>
        ))}
      </View>
      <View style={styles.sourceSummary}>
        <Text style={styles.sourceSummaryTitle}>허용된 근거</Text>
        {report.sources.map((source) => (
          <View key={source.id} style={styles.sourceRow}>
            <MonoText>{source.id}</MonoText>
            <Text style={styles.sourceText}>{source.summary}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecipientPanel({ report }: { report: MobileReportView }) {
  return (
    <View style={styles.recipientPanel} accessibilityLabel="구성된 보고서 수신자">
      <View style={styles.recipientHeader}>
        <View>
          <Text style={styles.recipientLabel}>CONFIGURED RECIPIENTS</Text>
          <Text style={styles.recipientTitle}>모델이 아닌 수신자 그룹 규칙</Text>
        </View>
        <MonoText>{report.recipients.configuration_id}</MonoText>
      </View>
      <DataRow
        label="TO"
        value={report.recipients.to.map((recipient) => recipient.email).join(", ") || "설정 없음"}
        detail={report.recipients.to.map((recipient) => recipient.role).join(", ")}
        tone="verified"
      />
      <DataRow
        label="CC"
        value={report.recipients.cc.map((recipient) => recipient.email).join(", ") || "설정 없음"}
        detail={report.recipients.cc.map((recipient) => recipient.role).join(", ")}
        tone="verified"
      />
      <View style={styles.attachmentGate}>
        <Text style={styles.attachmentGateTitle}>APPROVAL ATTACHMENTS</Text>
        {report.attachments.length ? report.attachments.map((attachment) => (
          <DataRow
            key={attachment.version_id}
            label="CURRENT REPORT FILE"
            value={attachment.filename}
            detail={attachment.version_id}
            tone="verified"
          />
        )) : (
          <FeedbackPanel tone="warning" title="첨부파일이 없습니다" description="보고서 승인 또는 발송 전에 현재 첨부 버전을 확인하세요." />
        )}
      </View>
      <DataRow label="EXTERNAL COVER" value={report.cover.subject} detail={report.cover.body} />
    </View>
  );
}

function PackageReview({ pkg }: { pkg: MobileWorkflowView["packages"][number] }) {
  return (
    <View style={styles.taskStack}>
      <View style={styles.dataGrid}>
        <DataRow label="TO" value={pkg.recipients.to.join(", ") || "설정 없음"} detail={pkg.recipients.configuration_id} tone="verified" />
        <DataRow label="CC" value={pkg.recipients.cc.join(", ") || "설정 없음"} detail="구성된 수신자 규칙" tone="verified" />
        <DataRow label="PROTECTION" value={pkg.protected_material_status} detail={`${pkg.unresolved.length} unresolved`} tone="verified" />
      </View>
      <View style={styles.dataGrid}>
        {pkg.facts.map((fact) => (
          <DataRow
            key={fact.version_id}
            label={fact.label.toUpperCase()}
            value={`${fact.value} ${fact.unit}`}
            detail={`${fact.version_id} · ${fact.source_pointer}`}
            tone="verified"
          />
        ))}
        {pkg.files.map((file) => (
          <DataRow
            key={file.version_id}
            label="CURRENT ATTACHMENT"
            value={file.filename}
            detail={`${file.version_id} · ${file.source_pointer}`}
            tone="verified"
          />
        ))}
      </View>
    </View>
  );
}

function RequestSummary({ request }: { request: MobileWorkflowView["requests"][number] }) {
  const { summary } = request;
  return (
    <View style={styles.dataGrid}>
      <DataRow label="BUILDING" value={summary.building_id ?? "미확인"} tone="candidate" />
      <DataRow label="FLOOR" value={summary.floor ?? "미확인"} tone="candidate" />
      <DataRow label="FIELDS" value={summary.requested_fields.join(", ") || "없음"} tone="candidate" />
      <DataRow label="FILES" value={summary.requested_files.join(", ") || "없음"} tone="candidate" />
      <DataRow label="RECIPIENT" value={`${summary.recipient.name ?? "미확인"} · ${summary.recipient.organization ?? "미확인"}`} tone="candidate" />
      <DataRow label="DEADLINE" value={summary.deadline ?? "미확인"} tone="candidate" />
      {summary.ambiguities.length ? (
        <DataRow label="AMBIGUITIES" value={summary.ambiguities.map((item) => `${item.field}: ${item.reason}`).join("; ")} tone="candidate" />
      ) : null}
    </View>
  );
}

function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <View style={styles.diffGrid}>
      <View style={styles.diffBefore}>
        <Text style={styles.diffLabel}>BEFORE</Text>
        <Text style={styles.diffText}>{before || "변경 전 값 없음"}</Text>
      </View>
      <View style={styles.diffAfter}>
        <Text style={[styles.diffLabel, styles.diffLabelAfter]}>AFTER · CANDIDATE</Text>
        <Text style={styles.diffText}>{after || "변경 후 값 없음"}</Text>
      </View>
    </View>
  );
}

function SourceChips({ sourceIds }: { sourceIds: string[] }) {
  return (
    <View style={styles.sourceChips} accessibilityLabel={`근거 소스 ${sourceIds.join(", ")}`}>
      {sourceIds.map((sourceId) => (
        <View key={sourceId} style={styles.sourceChip}><MonoText>{sourceId}</MonoText></View>
      ))}
    </View>
  );
}

function TaskIntro({ label, title, description }: { label: string; title: string; description: string }) {
  return (
    <View style={styles.taskIntro}>
      <Text style={styles.taskLabel}>{label}</Text>
      <Text style={styles.taskTitle}>{title}</Text>
      <Text style={styles.taskDescription}>{description}</Text>
    </View>
  );
}

function requestWorkflowSteps(
  request: MobileWorkflowView["requests"][number] | undefined,
  pkg: MobileWorkflowView["packages"][number] | undefined,
) {
  return [
    { label: "요청 후보", state: request ? "complete" : "current" },
    { label: "사람 확인", state: !request ? "pending" : request.status === "candidate" ? "current" : "complete" },
    { label: "패키지 승인", state: !pkg ? "pending" : pkg.status === "stale" ? "blocked" : pkg.status === "draft" || pkg.status === "edit_pending" ? "current" : "complete" },
    { label: "샌드박스", state: !pkg || pkg.status === "draft" || pkg.status === "edit_pending" ? "pending" : pkg.status === "stale" ? "blocked" : pkg.status === "approved" ? "current" : "complete" },
  ] as Array<{ label: string; state: "pending" | "current" | "complete" | "blocked" }>;
}

function reportWorkflowSteps(report: MobileReportView | undefined) {
  return [
    { label: "건물별 초안", state: report ? "complete" : "current" },
    { label: "소스 조사", state: !report ? "pending" : report.status === "stale" ? "blocked" : report.status === "patch_pending" || (report.status === "draft" && report.accepted_patch_count === 0) ? "current" : "complete" },
    { label: "LM 승인", state: !report || report.status === "patch_pending" || (report.status === "draft" && report.accepted_patch_count === 0) ? "pending" : report.status === "stale" ? "blocked" : report.status === "draft" ? "current" : "complete" },
    { label: "샌드박스", state: !report || report.status === "draft" || report.status === "patch_pending" ? "pending" : report.status === "stale" ? "blocked" : report.status === "approved" ? "current" : "complete" },
  ] as Array<{ label: string; state: "pending" | "current" | "complete" | "blocked" }>;
}

function packageStatus(
  pkg: MobileWorkflowView["packages"][number] | undefined,
  request: MobileWorkflowView["requests"][number] | undefined,
): { label: string; tone: StatusTone } {
  if (pkg?.status === "sent") return { label: "샌드박스 완료", tone: "success" };
  if (pkg?.status === "stale") return { label: "최신 상태 아님", tone: "error" };
  if (pkg?.status === "approved") return { label: "승인됨 · 발송 전", tone: "warning" };
  if (pkg?.status === "edit_pending") return { label: "문구 후보 검토", tone: "info" };
  if (pkg?.status === "draft") return { label: "패키지 초안", tone: "info" };
  if (request?.status === "confirmed") return { label: "요청 확인됨", tone: "success" };
  if (request?.status === "candidate") return { label: "확인 필요", tone: "warning" };
  return { label: "새 요청 대기", tone: "neutral" };
}

function reportStatus(report: MobileReportView | undefined): { label: string; tone: StatusTone } {
  if (!report) return { label: "초안 준비", tone: "neutral" };
  if (report.status === "sent") return { label: "샌드박스 완료", tone: "success" };
  if (report.status === "stale") return { label: "최신 상태 아님", tone: "error" };
  if (report.status === "approved") return { label: "승인됨 · 발송 전", tone: "warning" };
  if (report.status === "patch_pending") return { label: "AI 후보 검토", tone: "info" };
  if (report.accepted_patch_count) return { label: "패치 반영 · 승인 전", tone: "success" };
  return { label: "조사 명령 대기", tone: "neutral" };
}

function surfaceError(title: string, error: unknown): SurfaceError {
  return {
    title,
    description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
  };
}

function isRevisionConflict(error: unknown): boolean {
  return error instanceof ReportWorkflowHttpError
    ? error.code === "REVISION_CONFLICT" || /revision/i.test(error.message)
    : error instanceof Error && /revision|conflict/i.test(error.message);
}

function formatPatchValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("\n") || "항목 없음";
  }
  if (value === null || value === undefined) return "값 없음";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { alignSelf: "center", gap: space.region, maxWidth: layout.contentMax, paddingBottom: space.page, paddingHorizontal: space.control, paddingTop: space.major, width: "100%" },
  contentTablet: { paddingHorizontal: space.panel, paddingTop: space.section },
  contentWide: { paddingHorizontal: space.region, paddingTop: space.page },
  topbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  brandCluster: { alignItems: "center", flexDirection: "row", gap: space.compact },
  brandMark: { alignItems: "center", backgroundColor: colors.surface0, borderColor: colors.accentBorder, borderRadius: radius.medium, borderWidth: control.border, height: icon.brand, justifyContent: "center", width: icon.brand },
  brandMarkInner: { backgroundColor: colors.emerald400, borderRadius: radius.small, height: icon.brandInner, transform: [{ rotate: "45deg" }], width: icon.brandInner },
  brand: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "500", letterSpacing: tracking.brand },
  brandSubline: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.label, letterSpacing: tracking.wide, marginTop: control.focusOffset },
  topbarMeta: { flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: space.tight, maxWidth: "100%", minWidth: 0, width: "100%" },
  topbarMetaTablet: { justifyContent: "flex-end", width: "auto" },
  hero: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: space.region },
  heroCopy: { flex: 1, maxWidth: "100%", minWidth: 0, paddingVertical: space.group },
  heroEyebrow: { color: colors.emerald400, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.widest, marginBottom: space.compact },
  heroTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h1, fontWeight: "400", letterSpacing: tracking.display, lineHeight: lineHeight.h1 },
  heroTitleTablet: { fontSize: type.display, lineHeight: lineHeight.display },
  heroDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.body, lineHeight: lineHeight.body, marginTop: space.control, maxWidth: layout.copyMax },
  heroStatus: { flexBasis: "100%" },
  heroStatusTablet: { alignSelf: "stretch", flexBasis: layout.heroStatusWidth, flexGrow: 0 },
  heroStatusHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between" },
  heroStatusLabel: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.label, letterSpacing: tracking.wide },
  heroStatusLine: { alignItems: "center", flexDirection: "row", gap: space.compact, marginVertical: space.group },
  heroStatusSignal: { backgroundColor: colors.warning, borderRadius: radius.pill, height: control.touch, width: icon.heroSignal },
  heroStatusSignalReady: { backgroundColor: colors.emerald400 },
  heroStatusCopy: { flex: 1, minWidth: 0 },
  heroStatusTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control, marginBottom: space.hairline },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  metricGridTablet: { gap: space.control },
  sectionSurface: { width: "100%" },
  dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  workspaceGrid: { gap: space.region },
  workspaceGridWide: { alignItems: "flex-start", flexDirection: "row" },
  workspaceSurface: { maxWidth: "100%", minWidth: 0, width: "100%" },
  workspaceSurfaceWide: { flex: 1, width: "auto" },
  railWrap: { marginTop: space.group },
  taskStack: { gap: space.control, marginTop: space.group },
  actionStack: { gap: space.compact },
  actionCluster: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.compact },
  taskIntro: { maxWidth: layout.taskCopyMax },
  taskLabel: { color: colors.emerald400, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.technical, marginBottom: space.tight },
  taskTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "500", letterSpacing: tracking.h3, lineHeight: lineHeight.h3 },
  taskDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.tight },
  commandGrid: { gap: space.tight },
  commandGridTwo: { flexDirection: "row", flexWrap: "wrap" },
  commandCell: { flexBasis: layout.commandFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0 },
  findingList: { gap: space.compact, maxWidth: "100%", minWidth: 0 },
  findingCard: { backgroundColor: colors.infoWash, borderColor: colors.info, borderRadius: radius.medium, borderWidth: control.border, maxWidth: "100%", minWidth: 0, padding: space.control },
  findingHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between" },
  findingText: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.compact },
  operationCard: { backgroundColor: colors.surface0, borderColor: colors.borderStrong, borderRadius: radius.inner, borderWidth: control.border, maxWidth: "100%", minWidth: 0, padding: space.control },
  operationHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between", marginBottom: space.compact },
  diffGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  diffBefore: { backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.diffFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.compact },
  diffAfter: { backgroundColor: colors.infoWash, borderColor: colors.info, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.diffFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.compact },
  diffLabel: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.technical, marginBottom: space.tight },
  diffLabelAfter: { color: colors.info },
  diffText: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  sourceChips: { flexDirection: "row", flexWrap: "wrap", gap: space.tight, marginTop: space.compact },
  sourceChip: { backgroundColor: colors.surface2, borderColor: colors.border, borderRadius: radius.small, borderWidth: control.border, paddingHorizontal: space.tight, paddingVertical: space.hairline },
  reportIdentity: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  reportIdentityCopy: { flex: 1, maxWidth: "100%", minWidth: 0 },
  reportTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "500", lineHeight: lineHeight.h3 },
  reportPeriod: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.data, lineHeight: lineHeight.data, marginTop: space.hairline, ...tabularNumbers },
  reportLineList: { gap: space.tight },
  reportLine: { alignItems: "flex-start", flexDirection: "row", gap: space.compact },
  reportLineMark: { backgroundColor: colors.text3, borderRadius: radius.pill, height: icon.listMark, marginTop: space.tight, width: icon.listMark },
  reportLineMarkAction: { backgroundColor: colors.emerald400 },
  reportLineText: { color: colors.text2, flex: 1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  sourceSummary: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, gap: space.tight, maxWidth: "100%", minWidth: 0, padding: space.control },
  sourceSummaryTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control },
  sourceRow: { alignItems: "flex-start", borderTopColor: colors.borderSubtle, borderTopWidth: control.border, gap: space.tight, paddingTop: space.tight },
  sourceText: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  recipientPanel: { backgroundColor: colors.surface0, borderColor: colors.borderStrong, borderRadius: radius.inner, borderWidth: control.border, gap: space.compact, maxWidth: "100%", minWidth: 0, padding: space.control },
  recipientHeader: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  recipientLabel: { color: colors.emerald400, fontFamily: fonts.mono, fontSize: type.label, letterSpacing: tracking.technical },
  recipientTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control, marginTop: space.hairline },
  attachmentGate: { borderTopColor: colors.borderSubtle, borderTopWidth: control.border, gap: space.tight, paddingTop: space.compact },
  attachmentGateTitle: { color: colors.emerald400, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.technical },
  footer: { borderTopColor: colors.borderSubtle, borderTopWidth: control.border, maxWidth: "100%", minWidth: 0, paddingTop: space.group },
  footerTitle: { color: colors.warning, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.wide },
  footerCopy: { color: colors.text3, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact, marginTop: space.tight, maxWidth: layout.longCopyMax },
});
