import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Head from "expo-router/head";
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

const investigationCommandLabels: Record<string, string> = {
  "통화내용 확인해서 이번주 변동사항 업데이트 해": "이번 주 통화 변동 확인",
  "이메일 확인해서 이번주 변동사항 업데이트 해": "이번 주 이메일 변동 확인",
  "협의 중인 면적 변동 있는지 확인해": "협의 면적 변동 확인",
  "협의 중인 층 변동 있는지 확인해": "협의 층 변동 확인",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐": "경쟁 빌딩 언급 확인",
};

const recipientRoleLabels: Record<string, string> = {
  asset_manager: "자산 관리",
  leasing_manager: "임대 관리",
  landlord: "소유주",
  property_manager: "시설 관리",
  to_landlord_practical: "소유주 실무 담당",
  cc_landlord_team: "소유주 팀",
  cc_landlord_exec: "소유주 책임자",
  cc_lm_team: "임대 관리팀",
  cc_lm_exec: "임대 관리 책임자",
};

const requestedFileLabels: Record<string, string> = {
  current_floor_plan: "최신 평면도",
  floor_plan: "평면도",
  stacking_plan: "스태킹 플랜",
  availability_schedule: "공실 일정",
};

function investigationCommandLabel(command: string) {
  return investigationCommandLabels[command] ?? "선택한 변동 확인";
}

function recipientRoleLabel(role: string) {
  return recipientRoleLabels[role] ?? "업무 담당자";
}

function requestedFileLabel(file: string) {
  return requestedFileLabels[file] ?? "요청 자료";
}

function friendlyFactValue(value: number, unit: string) {
  const units: Record<string, string> = { py: "평", months: "개월", spaces: "대" };
  return `${value}${units[unit] ?? ""}`;
}

function friendlyReportSentence(value: string) {
  const sentences: Record<string, string> = {
    "No source-backed competitor building was identified.": "확인한 자료에서 경쟁 빌딩 언급을 찾지 못했습니다.",
    "No external-reportable competitor evidence is available.": "현재 확인 가능한 자료에 경쟁 빌딩 언급이 없습니다.",
  };
  return sentences[value] ?? value;
}

function friendlyUnresolvedItem(field: string, question: string) {
  if (field === "competitor_buildings") return friendlyReportSentence(question);
  return `${friendlyFactLabel(field)} 정보를 추가로 확인해 주세요.`;
}

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
        setNotice("다른 작업에서 내용이 바뀌어 최신 정보를 다시 불러왔습니다.");
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
        const reason = error.code === "WORKFLOW_STALE"
          ? "보고서 기준 정보가 바뀌었습니다. 새 초안을 만들어 주세요."
          : "다른 작업에서 내용이 바뀌었습니다.";
        setNotice(`${reason} 최신 정보를 다시 불러왔습니다.`);
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

  return (
    <>
      <Head>
        <title>LeaseFlow 현장 업무</title>
        <meta name="description" content="LeaseFlow 현장 임대 업무" />
      </Head>
      <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, isTablet && styles.contentTablet, isWide && styles.contentWide]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="LeaseFlow 현장 업무"
    >
      <StatusBar style="dark" />

      <View style={styles.topbar}>
        <View style={styles.brandCluster}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <View style={styles.brandMarkInner} />
          </View>
          <View>
            <Text style={styles.brand}>LeaseFlow</Text>
            <Text style={styles.brandSubline}>현장 업무</Text>
          </View>
        </View>
        <View style={[styles.topbarMeta, isTablet && styles.topbarMetaTablet]}>
          <StatusBadge label="데모" tone="neutral" />
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>오늘의 업무</Text>
          <Text accessibilityRole="header" aria-level={1} style={[styles.heroTitle, isWide && styles.heroTitleTablet]}>
            요청과 주간 보고서를{`\n`}한곳에서 확인하세요.
          </Text>
          <Text style={styles.heroDescription}>
            확인이 필요한 일부터 차례로 처리하고, 준비된 자료를 바로 검토할 수 있습니다.
          </Text>
        </View>
        <GovernanceSurface
          accent={Boolean(publicationReady)}
          subtle={!publicationReady}
          style={[styles.heroStatus, isWide && styles.heroStatusTablet]}
          accessibilityLabel="운영 상태 요약"
        >
          <View style={styles.heroStatusHeader}>
            <Text style={styles.heroStatusLabel}>업무 현황</Text>
            <StatusBadge label={publicationReady ? "최신 정보" : "확인 필요"} tone={publicationReady ? "success" : "warning"} live />
          </View>
          <View style={styles.heroStatusLine}>
            <View style={[styles.heroStatusSignal, publicationReady && styles.heroStatusSignalReady]} />
            <View style={styles.heroStatusCopy}>
              <Text style={styles.heroStatusTitle}>Cobalt Finance Center · 5층</Text>
              <MonoText>요청 {packagePending}건 · 주간 보고서 {reportDue}건</MonoText>
            </View>
          </View>
          <ActionButton
            label="새로고침"
            variant="ghost"
            compact
            loading={busyKey === "refresh-all" || busyKey === "initial-load"}
            disabled={Boolean(busyKey) && busyKey !== "refresh-all" && busyKey !== "initial-load"}
            onPress={() => void refreshAll()}
            hint="임대 정보, 요청, 주간 보고서를 다시 불러옵니다"
          />
        </GovernanceSurface>
      </View>

      {notice ? (
        <FeedbackPanel tone="info" title="최신 상태로 동기화했습니다" description={notice} />
      ) : null}

      <View style={[styles.metricGrid, isTablet && styles.metricGridTablet]}>
        <MetricCard value={packagePending} label="검토할 요청" tone={packagePending ? "warning" : "success"} />
        <MetricCard value={reportDue} label="이번 주 보고서" tone={reportDue ? "warning" : "success"} />
        <MetricCard value={published ? `${published.marketed_area_py}평` : "—"} label="임대 가능 면적" tone={published ? "success" : "neutral"} />
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
        <Text style={styles.footerTitle}>데모 안내</Text>
        <Text style={styles.footerCopy}>
          데모 데이터만 사용하며 실제 메일·전화·로그인 연동은 없습니다.
        </Text>
      </View>
      </ScrollView>
    </>
  );
}

function PublishedSnapshot({ published, error, busy, onRefresh }: {
  published: MobilePublishedSnapshot | null;
  error: SurfaceError | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <GovernanceSurface style={styles.sectionSurface} accessibilityLabel="현재 임대 정보">
      <SectionHeading
        eyebrow="현재 임대 정보"
        title="Cobalt Finance Center · 5층"
        description="고객 안내에 필요한 핵심 정보를 확인하세요."
        action={<ActionButton label="새로고침" variant="ghost" compact onPress={onRefresh} loading={busy} />}
      />
      <Divider />
      {error ? (
        <FeedbackPanel tone="error" title={error.title} description="잠시 후 새로고침해 주세요." />
      ) : published ? (
        <View style={styles.dataGrid}>
          <DataRow label="임대 면적" value={`${published.marketed_area_py}평`} tone="verified" />
          <DataRow label="렌트프리" value={`${published.rent_free_months}개월`} tone="verified" />
          <DataRow label="지원 주차" value={`${published.supported_parking_spaces}대`} tone="verified" />
          <DataRow label="평면도" value={published.floor_plan.filename} tone="verified" />
        </View>
      ) : (
        <FeedbackPanel tone="info" title="임대 정보를 불러오는 중입니다" description="잠시만 기다려 주세요." />
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
    <GovernanceSurface style={[styles.workspaceSurface, isWide && styles.workspaceSurfaceWide]} accessibilityLabel="고객 요청 검토">
      <SectionHeading
        eyebrow="요청 검토"
        title="고객 안내 자료 준비"
        description="요청 내용을 확인하고 필요한 자료를 준비하세요."
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
        <FeedbackPanel tone="info" title="요청을 불러오는 중입니다" description="잠시만 기다려 주세요." />
      ) : null}

      {workflow && !request ? (
        <View style={styles.taskStack}>
          <TaskIntro
            label="새 요청"
            title="요청 내용을 불러오세요"
            description={demoRequest.text}
          />
          <FeedbackPanel tone="info" title="불러온 뒤 내용을 확인할 수 있습니다" description="통화 또는 이메일 예시 중 하나를 선택하세요." />
          <View style={styles.actionCluster}>
            <ActionButton
              label="통화 요청 불러오기"
              variant="primary"
              loading={busyKey === "import-call"}
              disabled={Boolean(busyKey) && busyKey !== "import-call"}
              onPress={() => void onAction({ action: "import", source: "call" }, "import-call")}
            />
            <ActionButton
              label="이메일 요청 불러오기"
              loading={busyKey === "import-email"}
              disabled={Boolean(busyKey) && busyKey !== "import-email"}
              onPress={() => void onAction({ action: "import", source: "email" }, "import-email")}
            />
          </View>
        </View>
      ) : null}

      {request?.status === "candidate" ? (
        <View style={styles.taskStack}>
          <TaskIntro label="확인이 필요한 요청" title="요청 내용을 확인하세요" description="건물, 층, 필요한 자료와 받는 사람을 확인해 주세요." />
          <RequestSummary request={request} />
          <ActionButton
            label="요청 확인"
            variant="primary"
            loading={busyKey === "confirm-request"}
            disabled={Boolean(busyKey) && busyKey !== "confirm-request"}
            onPress={() => void onAction({ action: "confirm", request_id: request.id }, "confirm-request")}
          />
        </View>
      ) : null}

      {request?.status === "confirmed" && !packageDraft ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="요청을 확인했습니다" description="고객에게 전달할 안내 자료를 준비할 수 있습니다." />
          <ActionButton
            label="안내 자료 만들기"
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
        title="임대 정보가 변경되었습니다"
        description="최신 정보로 안내 자료를 다시 만들어 주세요."
      />
    );
  }

  if (pkg.status === "sent") {
    return (
      <View style={styles.taskStack}>
        <FeedbackPanel tone="success" title="전달 기록을 저장했습니다" description="데모 전달 내역을 업무 기록에 저장했습니다." />
        <PackageReview pkg={pkg} />
      </View>
    );
  }

  if (pkg.status === "edit_pending") {
    return (
      <View style={styles.taskStack}>
        <TaskIntro label="제안 문구" title="변경 전후를 비교하세요" description="제안한 문구가 요청에 맞는지 확인해 주세요." />
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
        label={pkg.status === "approved" ? "승인된 안내 자료" : "안내 자료 초안"}
        title={pkg.subject}
        description={pkg.body}
      />
      <PackageReview pkg={pkg} />
      {pkg.status === "draft" ? (
        <View style={styles.actionStack}>
          <ActionButton
            label="문구 다듬기"
            loading={busyKey === "edit-package"}
            disabled={Boolean(busyKey) && busyKey !== "edit-package"}
            onPress={() => void onAction({ action: "edit", package_id: pkg.id, instruction: "Make the message concise and courteous" }, "edit-package")}
          />
          <ActionButton
            label="안내 자료 승인"
            variant="primary"
            loading={busyKey === "approve-package"}
            disabled={Boolean(busyKey) && busyKey !== "approve-package"}
            onPress={() => void onAction({ action: "approve", package_id: pkg.id }, "approve-package")}
          />
        </View>
      ) : null}
      {pkg.status === "approved" ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="승인이 완료되었습니다" description="받는 사람과 첨부 자료를 한 번 더 확인하세요." />
          <ActionButton
            label="데모로 전달하기"
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
    <GovernanceSurface style={[styles.workspaceSurface, isWide && styles.workspaceSurfaceWide]} accessibilityLabel="주간 보고서">
      <SectionHeading
        eyebrow="주간 보고서"
        title="이번 주 건물 보고서"
        description="활동 내역을 검토하고 보고서를 준비하세요."
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
        <FeedbackPanel tone="info" title="보고서를 불러오는 중입니다" description="잠시만 기다려 주세요." />
      ) : null}

      {workflow && !report ? (
        <View style={styles.taskStack}>
          <TaskIntro label="새 보고서" title="Cobalt Finance Center 주간 보고서" description="이번 주 활동과 데모 이메일 자료를 모아 초안을 만듭니다." />
          <FeedbackPanel tone="info" title="일부 자료는 보고서에서 제외됩니다" description="내부 전용으로 표시된 메시지는 포함하지 않습니다." />
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
              title="보고서 정보가 변경되었습니다"
              description="최신 정보로 보고서를 다시 만들어 주세요."
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
                  title="확인이 필요한 항목이 남아 있습니다"
                  description="질문을 확인하거나 이번 제안을 제외한 뒤 다시 검토해 주세요."
                />
              ) : null}
              <View style={styles.actionCluster}>
                <ActionButton
                  label="제안 반영"
                  variant="primary"
                  loading={busyKey === "accept-report-patch"}
                  disabled={Boolean(report.pending_candidate?.unresolved.length) || (Boolean(busyKey) && busyKey !== "accept-report-patch")}
                  onPress={() => void onAction({ action: "decide_patch", report_id: report.id, decision: "accept" }, "accept-report-patch")}
                  hint={report.pending_candidate?.unresolved.length ? "확인이 필요한 질문이 남아 있습니다" : "검토한 내용을 보고서에 반영합니다"}
                />
                <ActionButton
                  label="제안 제외"
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
                <FeedbackPanel tone="warning" title="보고서 내용을 먼저 확인하세요" description="확인할 항목을 선택하고 제안 내용을 검토한 뒤 승인할 수 있습니다." />
              ) : (
                <FeedbackPanel tone="success" title={`변경 ${report.accepted_patch_count}건을 반영했습니다`} description="받는 사람과 메일 내용을 확인한 뒤 승인하세요." />
              )}
              <ActionButton
                label="보고서 승인"
                variant="primary"
                loading={busyKey === "approve-report"}
                disabled={report.accepted_patch_count === 0 || (Boolean(busyKey) && busyKey !== "approve-report")}
                onPress={() => void onAction({ action: "approve", report_id: report.id }, "approve-report")}
              />
            </View>
          ) : null}

          {report.status === "approved" ? (
            <View style={styles.taskStack}>
              <FeedbackPanel tone="success" title="승인이 완료되었습니다" description="받는 사람과 첨부 파일을 한 번 더 확인하세요." />
              <ActionButton
                label="데모로 전달하기"
                variant="primary"
                loading={busyKey === "send-report"}
                disabled={Boolean(busyKey) && busyKey !== "send-report"}
                onPress={() => void onAction({ action: "send", report_id: report.id, idempotency_key: `mobile-report-demo-${report.id}` }, "send-report")}
              />
            </View>
          ) : null}

          {report.status === "sent" ? (
            <FeedbackPanel tone="success" title="보고서 전달 기록을 저장했습니다" description="데모 전달 내역을 건물 업무 기록에 저장했습니다." />
          ) : null}
        </View>
      ) : null}

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
      <TaskIntro label="보고서 확인" title="확인할 항목을 선택하세요" description="필요한 항목 하나를 선택하면 관련 자료를 찾아 변경 내용을 제안합니다." />
      <View style={[styles.commandGrid, columns === 2 && styles.commandGridTwo]}>
        {REPORT_INVESTIGATION_COMMANDS.map((command, index) => {
          const key = `report-command-${index}`;
          return (
            <View key={command} style={columns === 2 ? styles.commandCell : undefined}>
              <ActionButton
                label={investigationCommandLabel(command)}
                variant={index === 2 ? "primary" : "secondary"}
                loading={busyKey === key}
                disabled={Boolean(busyKey) && busyKey !== key}
                onPress={() => void onAction({ action: "investigate", report_id: reportId, command }, key)}
                hint="이번 주 데모 자료에서 관련 내용을 확인합니다"
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
      <TaskIntro label="제안 변경" title="변경 내용과 근거를 확인하세요" description={investigationCommandLabel(candidate.command)} />
      <View accessibilityRole="list" style={styles.findingList}>
        {candidate.findings.map((finding, index) => (
          <View key={`${candidate.id}:finding:${finding.finding}:${finding.source_reference_ids.join("|")}`} style={styles.findingCard}>
            <View style={styles.findingHeader}>
              <StatusBadge label={`신뢰도 ${Math.round(finding.confidence * 100)}%`} tone="info" />
              <MonoText>근거 {index + 1}</MonoText>
            </View>
            <Text style={styles.findingText}>{friendlyReportSentence(finding.finding)}</Text>
            <SourceChips sourceIds={finding.source_reference_ids} />
          </View>
        ))}
      </View>
      {candidate.operations.map((operation, index) => (
        <View key={`${candidate.id}:operation:${operation.section}:${operation.operation}:${operation.source_reference_ids.join("|")}`} style={styles.operationCard}>
          <View style={styles.operationHeader}>
            <StatusBadge label="확인 전" tone="info" />
            <MonoText>변경 {index + 1}</MonoText>
          </View>
          <BeforeAfter before={formatPatchValue(operation.before)} after={formatPatchValue(operation.after)} />
          <SourceChips sourceIds={operation.source_reference_ids} />
        </View>
      ))}
      {candidate.unresolved.length ? (
        <FeedbackPanel
          tone="warning"
          title="확인이 필요한 항목이 남았습니다"
          description={candidate.unresolved.map((item) => friendlyUnresolvedItem(item.field, item.question)).join(" · ")}
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
      </View>
      <DataRow label="핵심 이슈" value={report.sections.key_issue} detail={`업무 내용 ${sectionItems.length}건 · 참고 자료 ${report.sources.length}건`} tone={report.status === "approved" || report.status === "sent" ? "verified" : "neutral"} />
      <View style={styles.reportLineList}>
        {sectionItems.map((item) => (
          <View key={item} style={styles.reportLine}>
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
        <Text style={styles.sourceSummaryTitle}>사용한 자료</Text>
        {report.sources.map((source, index) => (
          <View key={source.id} style={styles.sourceRow}>
            <Text style={styles.sourceIndex}>자료 {index + 1}</Text>
            <Text style={styles.sourceText}>{source.summary}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecipientPanel({ report }: { report: MobileReportView }) {
  return (
    <View style={styles.recipientPanel} accessibilityLabel="보고서 받는 사람">
      <View style={styles.recipientHeader}>
        <View>
          <Text style={styles.recipientLabel}>받는 사람</Text>
          <Text style={styles.recipientTitle}>등록된 수신자</Text>
        </View>
      </View>
      <DataRow
        label="받는 사람"
        value={report.recipients.to.map((recipient) => recipient.email).join(", ") || "설정 없음"}
        detail={report.recipients.to.map((recipient) => recipientRoleLabel(recipient.role)).join(", ")}
        tone="verified"
      />
      <DataRow
        label="참조"
        value={report.recipients.cc.map((recipient) => recipient.email).join(", ") || "설정 없음"}
        detail={report.recipients.cc.map((recipient) => recipientRoleLabel(recipient.role)).join(", ")}
        tone="verified"
      />
      <View style={styles.attachmentGate}>
        <Text style={styles.attachmentGateTitle}>첨부 파일</Text>
        {report.attachments.length ? report.attachments.map((attachment) => (
          <DataRow
            key={attachment.version_id}
            label="보고서 파일"
            value={attachment.filename}
            tone="verified"
          />
        )) : (
          <FeedbackPanel tone="warning" title="첨부파일이 없습니다" description="보고서 승인 또는 발송 전에 현재 첨부 버전을 확인하세요." />
        )}
      </View>
      <DataRow label="메일 제목" value={report.cover.subject} detail={report.cover.body} />
    </View>
  );
}

function PackageReview({ pkg }: { pkg: MobileWorkflowView["packages"][number] }) {
  return (
    <View style={styles.taskStack}>
      <View style={styles.dataGrid}>
        <DataRow label="받는 사람" value={pkg.recipients.to.join(", ") || "설정 없음"} tone="verified" />
        <DataRow label="참조" value={pkg.recipients.cc.join(", ") || "설정 없음"} tone="verified" />
        <DataRow label="확인이 필요한 항목" value={`${pkg.unresolved.length}건`} tone={pkg.unresolved.length ? "candidate" : "verified"} />
      </View>
      <View style={styles.dataGrid}>
        {pkg.facts.map((fact) => (
          <DataRow
            key={fact.version_id}
            label={friendlyFactLabel(fact.label)}
            value={friendlyFactValue(fact.value, fact.unit)}
            tone="verified"
          />
        ))}
        {pkg.files.map((file) => (
          <DataRow
            key={file.version_id}
            label="첨부 파일"
            value={file.filename}
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
      <DataRow label="건물" value={summary.building_id ? "Cobalt Finance Center" : "미확인"} tone="candidate" />
      <DataRow label="층" value={summary.floor ?? "미확인"} tone="candidate" />
      <DataRow label="필요한 정보" value={summary.requested_fields.map(friendlyFactLabel).join(", ") || "없음"} tone="candidate" />
      <DataRow label="필요한 파일" value={summary.requested_files.map(requestedFileLabel).join(", ") || "없음"} tone="candidate" />
      <DataRow label="받는 사람" value={`${summary.recipient.name ?? "미확인"} · ${summary.recipient.organization ?? "미확인"}`} tone="candidate" />
      <DataRow label="요청 기한" value={summary.deadline ?? "미확인"} tone="candidate" />
      {summary.ambiguities.length ? (
        <DataRow label="확인이 필요한 항목" value={summary.ambiguities.map((item) => `${friendlyFactLabel(item.field)}: ${item.reason}`).join("; ")} tone="candidate" />
      ) : null}
    </View>
  );
}

function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <View style={styles.diffGrid}>
      <View style={styles.diffBefore}>
        <Text style={styles.diffLabel}>변경 전</Text>
        <Text style={styles.diffText}>{before || "변경 전 값 없음"}</Text>
      </View>
      <View style={styles.diffAfter}>
        <Text style={[styles.diffLabel, styles.diffLabelAfter]}>제안 내용</Text>
        <Text style={styles.diffText}>{after || "변경 후 값 없음"}</Text>
      </View>
    </View>
  );
}

function SourceChips({ sourceIds }: { sourceIds: string[] }) {
  return (
    <View style={styles.sourceChips} accessibilityLabel={`근거 자료 ${sourceIds.length}건`}>
      {sourceIds.map((sourceId, index) => (
        <View key={sourceId} style={styles.sourceChip}><Text style={styles.sourceChipText}>근거 자료 {index + 1}</Text></View>
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
    { label: "요청 받기", state: request ? "complete" : "current" },
    { label: "내용 확인", state: !request ? "pending" : request.status === "candidate" ? "current" : "complete" },
    { label: "자료 승인", state: !pkg ? "pending" : pkg.status === "stale" ? "blocked" : pkg.status === "draft" || pkg.status === "edit_pending" ? "current" : "complete" },
    { label: "전달", state: !pkg || pkg.status === "draft" || pkg.status === "edit_pending" ? "pending" : pkg.status === "stale" ? "blocked" : pkg.status === "approved" ? "current" : "complete" },
  ] as Array<{ label: string; state: "pending" | "current" | "complete" | "blocked" }>;
}

function reportWorkflowSteps(report: MobileReportView | undefined) {
  return [
    { label: "건물별 초안", state: report ? "complete" : "current" },
    { label: "내용 확인", state: !report ? "pending" : report.status === "stale" ? "blocked" : report.status === "patch_pending" || (report.status === "draft" && report.accepted_patch_count === 0) ? "current" : "complete" },
    { label: "보고서 승인", state: !report || report.status === "patch_pending" || (report.status === "draft" && report.accepted_patch_count === 0) ? "pending" : report.status === "stale" ? "blocked" : report.status === "draft" ? "current" : "complete" },
    { label: "전달", state: !report || report.status === "draft" || report.status === "patch_pending" ? "pending" : report.status === "stale" ? "blocked" : report.status === "approved" ? "current" : "complete" },
  ] as Array<{ label: string; state: "pending" | "current" | "complete" | "blocked" }>;
}

function packageStatus(
  pkg: MobileWorkflowView["packages"][number] | undefined,
  request: MobileWorkflowView["requests"][number] | undefined,
): { label: string; tone: StatusTone } {
  if (pkg?.status === "sent") return { label: "전달 완료", tone: "success" };
  if (pkg?.status === "stale") return { label: "최신 상태 아님", tone: "error" };
  if (pkg?.status === "approved") return { label: "승인됨 · 발송 전", tone: "warning" };
  if (pkg?.status === "edit_pending") return { label: "제안 문구 확인", tone: "info" };
  if (pkg?.status === "draft") return { label: "안내 자료 초안", tone: "info" };
  if (request?.status === "confirmed") return { label: "요청 확인됨", tone: "success" };
  if (request?.status === "candidate") return { label: "확인 필요", tone: "warning" };
  return { label: "새 요청 대기", tone: "neutral" };
}

function reportStatus(report: MobileReportView | undefined): { label: string; tone: StatusTone } {
  if (!report) return { label: "초안 준비", tone: "neutral" };
  if (report.status === "sent") return { label: "전달 완료", tone: "success" };
  if (report.status === "stale") return { label: "최신 상태 아님", tone: "error" };
  if (report.status === "approved") return { label: "승인됨 · 발송 전", tone: "warning" };
  if (report.status === "patch_pending") return { label: "제안 내용 확인", tone: "info" };
  if (report.accepted_patch_count) return { label: "변경 반영 · 승인 전", tone: "success" };
  return { label: "내용 확인 대기", tone: "neutral" };
}

function surfaceError(title: string, _error: unknown): SurfaceError {
  return {
    title,
    description: "잠시 후 다시 시도해 주세요.",
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

function friendlyFactLabel(label: string): string {
  const normalized = label.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const labels: Record<string, string> = {
    building: "건물",
    building_id: "건물",
    floor: "층",
    marketed_area: "임대 면적",
    marketed_area_py: "임대 면적",
    rent_free: "렌트프리",
    rent_free_months: "렌트프리",
    supported_parking: "지원 주차",
    supported_parking_spaces: "지원 주차",
    floor_plan: "평면도",
    parking: "주차",
  };
  return labels[normalized] ?? label.replaceAll("_", " ");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { alignSelf: "center", gap: space.region, maxWidth: layout.contentMax, paddingBottom: space.page, paddingHorizontal: space.control, paddingTop: space.panel, width: "100%" },
  contentTablet: { paddingHorizontal: space.panel, paddingTop: space.section },
  contentWide: { paddingHorizontal: space.region, paddingTop: space.page },
  topbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  brandCluster: { alignItems: "center", flexDirection: "row", gap: space.compact },
  brandMark: { alignItems: "center", backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.medium, borderWidth: control.border, height: icon.brand, justifyContent: "center", width: icon.brand },
  brandMarkInner: { backgroundColor: colors.emerald500, borderRadius: radius.small, height: icon.brandInner, transform: [{ rotate: "45deg" }], width: icon.brandInner },
  brand: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "600", letterSpacing: tracking.brand },
  brandSubline: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, letterSpacing: 0, marginTop: control.focusOffset },
  topbarMeta: { flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: space.tight, maxWidth: "100%", minWidth: 0, width: "auto" },
  topbarMetaTablet: { justifyContent: "flex-end", width: "auto" },
  hero: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: space.region },
  heroCopy: { flex: 1, maxWidth: "100%", minWidth: 0, paddingBottom: space.group, paddingTop: space.compact },
  heroEyebrow: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0, marginBottom: space.compact },
  heroTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h1, fontWeight: "600", letterSpacing: tracking.display, lineHeight: lineHeight.h1 },
  heroTitleTablet: { fontSize: type.display, lineHeight: lineHeight.display },
  heroDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.body, lineHeight: lineHeight.body, marginTop: space.control, maxWidth: layout.copyMax },
  heroStatus: { flexBasis: "100%" },
  heroStatusTablet: { alignSelf: "stretch", flexBasis: layout.heroStatusWidth, flexGrow: 0 },
  heroStatusHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between" },
  heroStatusLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0 },
  heroStatusLine: { alignItems: "center", flexDirection: "row", gap: space.compact, marginVertical: space.group },
  heroStatusSignal: { backgroundColor: colors.warning, borderRadius: radius.pill, height: 10, width: 10 },
  heroStatusSignalReady: { backgroundColor: colors.success },
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
  taskLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0, marginBottom: space.tight },
  taskTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "600", letterSpacing: tracking.h3, lineHeight: lineHeight.h3 },
  taskDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.tight },
  commandGrid: { gap: space.tight },
  commandGridTwo: { flexDirection: "row", flexWrap: "wrap" },
  commandCell: { flexBasis: layout.commandFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0 },
  findingList: { gap: space.compact, maxWidth: "100%", minWidth: 0 },
  findingCard: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, maxWidth: "100%", minWidth: 0, padding: space.control },
  findingHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between" },
  findingText: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.compact },
  operationCard: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.inner, borderWidth: control.border, maxWidth: "100%", minWidth: 0, padding: space.control },
  operationHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between", marginBottom: space.compact },
  diffGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  diffBefore: { backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.diffFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.compact },
  diffAfter: { backgroundColor: colors.infoWash, borderColor: colors.info, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.diffFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.compact },
  diffLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0, marginBottom: space.tight },
  diffLabelAfter: { color: colors.info },
  diffText: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  sourceChips: { flexDirection: "row", flexWrap: "wrap", gap: space.tight, marginTop: space.compact },
  sourceChip: { backgroundColor: colors.surface2, borderColor: colors.border, borderRadius: radius.small, borderWidth: control.border, paddingHorizontal: space.tight, paddingVertical: space.hairline },
  sourceChipText: { color: colors.text2, fontFamily: fonts.body, fontSize: type.data, lineHeight: lineHeight.data },
  reportIdentity: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  reportIdentityCopy: { flex: 1, maxWidth: "100%", minWidth: 0 },
  reportTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "500", lineHeight: lineHeight.h3 },
  reportPeriod: { color: colors.text3, fontFamily: fonts.body, fontSize: type.data, lineHeight: lineHeight.data, marginTop: space.hairline, ...tabularNumbers },
  reportLineList: { gap: space.tight },
  reportLine: { alignItems: "flex-start", flexDirection: "row", gap: space.compact },
  reportLineMark: { backgroundColor: colors.text3, borderRadius: radius.pill, height: icon.listMark, marginTop: space.tight, width: icon.listMark },
  reportLineMarkAction: { backgroundColor: colors.emerald400 },
  reportLineText: { color: colors.text2, flex: 1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  sourceSummary: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, gap: space.tight, maxWidth: "100%", minWidth: 0, padding: space.control },
  sourceSummaryTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control },
  sourceRow: { alignItems: "flex-start", borderTopColor: colors.borderSubtle, borderTopWidth: control.border, gap: space.tight, paddingTop: space.tight },
  sourceIndex: { color: colors.text2, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600" },
  sourceText: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  recipientPanel: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.inner, borderWidth: control.border, gap: space.compact, maxWidth: "100%", minWidth: 0, padding: space.control },
  recipientHeader: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  recipientLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0 },
  recipientTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "600", lineHeight: lineHeight.control, marginTop: space.hairline },
  attachmentGate: { borderTopColor: colors.borderSubtle, borderTopWidth: control.border, gap: space.tight, paddingTop: space.compact },
  attachmentGateTitle: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0 },
  footer: { borderTopColor: colors.borderSubtle, borderTopWidth: control.border, maxWidth: "100%", minWidth: 0, paddingTop: space.group },
  footerTitle: { color: colors.text2, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0 },
  footerCopy: { color: colors.text3, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact, marginTop: space.tight, maxWidth: layout.longCopyMax },
});
