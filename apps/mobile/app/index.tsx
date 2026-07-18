import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Head from "expo-router/head";
import { demoRequest, type MobilePublishedSnapshot } from "@leaseflow/demo-data";
import {
  ActionButton,
  DataRow,
  Divider,
  FeedbackPanel,
  GovernanceSurface,
  MonoText,
  SectionHeading,
  StatusBadge,
  type StatusTone,
} from "../src/components/operations-ui";
import { fetchPublishedData } from "../src/data/published-data";
import { resetDemo } from "../src/data/demo-reset";
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
  surfaceDepth,
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

const BOTTOM_NAV_TABS = [
  { key: "home", label: "홈", glyph: "⌂" },
  { key: "work", label: "담당 업무", glyph: "▣" },
  { key: "records", label: "업무 기록", glyph: "◴" },
  { key: "reports", label: "주간 보고", glyph: "□" },
] as const;

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
  "LM Manager": "임대 관리 책임자",
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
    "5F marketed area and floor plan revised after partial occupancy.": "부분 입주 후 5층 임대 면적과 평면도가 변경되었습니다.",
    "Marketed area 300 py → 200 py": "임대 면적 300평 → 200평",
    "Floor plan v1 → v2": "평면도 1차본 → 2차본",
    "Rent-free 3 months → 2 months": "렌트프리 3개월 → 2개월",
    "Supported parking 3 → 2": "지원 주차 3대 → 2대",
    "Broker requested current 5F package": "중개사에서 최신 5층 안내 자료를 요청했습니다.",
    "Revised package prepared after publication": "게시된 최신 정보로 안내 자료를 다시 준비했습니다.",
    "None after senior publication": "최종 게시 후 남은 승인 대기 항목이 없습니다.",
    "Confirm broker feedback on Monday": "월요일에 중개사 의견 확인",
    "Cobalt Finance Center 5F area update": "Cobalt Finance Center 5층 면적 변경",
    "Cobalt Finance Center 5F materials": "Cobalt Finance Center 5층 안내 자료",
    "marketed area 300 py -> 200 py": "임대 면적 300평 → 200평",
    "Negotiated marketed area confirmed at 200 py.": "협의 중인 임대 면적을 200평으로 확인했습니다.",
    "No source-backed competitor building was identified.": "확인한 자료에서 경쟁 빌딩 언급을 찾지 못했습니다.",
    "No external-reportable competitor evidence is available.": "현재 확인 가능한 자료에 경쟁 빌딩 언급이 없습니다.",
  };
  return sentences[value] ?? value;
}

function friendlyUnresolvedItem(field: string, question: string) {
  if (field === "competitor_buildings") return friendlyReportSentence(question);
  return `${friendlyFactLabel(field)} 정보를 추가로 확인해 주세요.`;
}

async function confirmDemoReset(): Promise<boolean> {
  const message = "현재까지 만든 요청, 안내 자료, 보고서 진행 기록이 모두 사라지고 처음 상태로 돌아갑니다.";
  if (Platform.OS === "web") return globalThis.confirm(message);
  return new Promise((resolve) => {
    Alert.alert("데모를 처음 상태로 되돌릴까요?", message, [
      { text: "취소", style: "cancel", onPress: () => resolve(false) },
      { text: "처음 상태로 되돌리기", style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function Home() {
  const { width } = useWindowDimensions();
  const [hasHydrated, setHasHydrated] = useState(false);
  const isWide = hasHydrated && width >= layout.wideBreakpoint;
  const isTablet = hasHydrated && width >= layout.tabletBreakpoint;
  const [published, setPublished] = useState<MobilePublishedSnapshot | null>(null);
  const [workflow, setWorkflow] = useState<MobileWorkflowView | null>(null);
  const [reportWorkflow, setReportWorkflow] = useState<MobileReportWorkflowView | null>(null);
  const [errors, setErrors] = useState<SurfaceErrors>(EMPTY_ERRORS);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetError, setResetError] = useState<SurfaceError | null>(null);
  const [busyKey, setBusyKey] = useState<BusyKey>("initial-load");
  const [selectedLane, setSelectedLane] = useState<"request" | "report" | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "work" | "records" | "reports">("home");
  const [commandText] = useState<string>(demoRequest.text);

  const updateError = useCallback((surface: keyof SurfaceErrors, next: SurfaceError | null) => {
    setErrors((current) => ({ ...current, [surface]: next }));
  }, []);

  useEffect(() => {
    setHasHydrated(true);
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

  const runDemoReset = useCallback(async () => {
    if (!workflow || busyKey || !(await confirmDemoReset())) return;
    setBusyKey("demo-reset");
    setNotice(null);
    setResetError(null);
    try {
      await resetDemo(workflow.revision);
      setSelectedLane(null);
      setActiveTab("home");
      setErrors(EMPTY_ERRORS);
      await refreshAll(false);
      setNotice("데모를 처음 상태로 되돌렸습니다. 임대 정보, 안내 자료, 주간 보고서 상태를 다시 확인했습니다.");
    } catch (error) {
      setNotice(null);
      setResetError(surfaceError("데모를 처음 상태로 되돌리지 못했습니다", error));
      if (isRevisionConflict(error)) await refreshAll(false);
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, refreshAll, workflow]);

  const request = workflow?.requests.at(-1);
  const packageDraft = workflow?.packages.at(-1);
  const report = reportWorkflow?.reports.at(-1);
  const publicationReady = workflow?.publication_stage === "published"
    && reportWorkflow?.publication_stage === "published";
  const activeLane = selectedLane ?? recommendedLane(request, packageDraft, report);

  return (
    <View style={styles.appFrame}>
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
          <View>
            <Text style={styles.brand}>LeaseFlow</Text>
          </View>
        </View>
        <View style={styles.profileMark} accessibilityLabel="김 매니저"><Text style={styles.profileMarkText}>김</Text></View>
      </View>

      <View style={styles.demoContext} accessibilityLabel="데모 실행 정보">
        <View style={styles.demoLabels}>
          <StatusBadge label="데모" tone="neutral" />
          <StatusBadge label="임대 관리 책임자" tone="info" />
          <StatusBadge label="모의 발송 전용" tone="warning" />
        </View>
        <View style={!isTablet ? styles.demoResetMobile : undefined}>
          <ActionButton
            label="처음 상태로 되돌리기"
            variant="ghost"
            compact
            loading={busyKey === "demo-reset"}
            disabled={!workflow || (Boolean(busyKey) && busyKey !== "demo-reset")}
            onPress={() => void runDemoReset()}
            hint="확인 후 모든 데모 진행 기록을 지우고 처음 상태로 되돌립니다"
          />
        </View>
        <Text style={styles.demoBoundary}>합성 데모 데이터 · 실제 이메일, 전화, 로그인 연결 없음</Text>
      </View>

      <View style={styles.commandComposer} accessibilityLabel="합성 예시 요청">
        <View style={styles.commandRail} accessibilityElementsHidden />
        <View style={styles.commandBody}>
          <Text accessibilityRole="header" aria-level={1} style={styles.commandTitle}>예시 요청을 확인해 보세요</Text>
          <TextInput
            accessibilityLabel="합성 예시 요청 내용"
            multiline
            editable={false}
            style={styles.commandInput}
            value={commandText}
          />
          <View style={[styles.commandActions, !isTablet && styles.commandActionsMobile]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="음성으로 요청하기"
              onPress={() => setNotice("음성 입력 연결 전입니다. 입력한 문장으로 요청을 확인해 주세요.")}
              style={({ pressed }) => [styles.voiceButton, pressed && styles.voiceButtonPressed]}
            >
              <Text style={styles.voiceButtonIcon}>●</Text>
              <Text style={styles.voiceButtonText}>음성</Text>
            </Pressable>
            <ActionButton
              label="예시 요청 불러오기"
              variant="primary"
              loading={busyKey === "import-call"}
              disabled={Boolean(busyKey) && busyKey !== "import-call"}
              onPress={() => {
                setActiveTab("work");
                setSelectedLane("request");
                if (!request) void runPackageAction({ action: "import", source: "call" }, "import-call");
              }}
            />
          </View>
        </View>
      </View>

      {notice ? (
        <FeedbackPanel tone="info" title="최신 상태로 동기화했습니다" description={notice} />
      ) : null}
      {resetError ? <FeedbackPanel tone="error" title={resetError.title} description={resetError.description} /> : null}

      <GovernanceSurface style={[styles.workShell, isWide && styles.workShellWide]} accessibilityLabel="업무 대기열">
        <View style={styles.nextWorkHeading}>
          <Text style={styles.nextWorkTitle}>다음 업무</Text>
          <Text style={styles.nextWorkContext}>Cobalt Finance Center · 5층</Text>
        </View>
        <WorkLanePicker
          activeLane={activeLane}
          requestStatus={packageStatus(packageDraft, request, publicationReady)}
          reportStatus={reportStatus(report, publicationReady)}
          isWide={isWide}
          onSelect={setSelectedLane}
        />
        <View style={[styles.workPanel, isWide && styles.workPanelWide]}>
          {activeLane === "request" ? (
            <RequestWorkspace
              workflow={workflow}
              request={request}
              packageDraft={packageDraft}
              error={errors.package}
              busyKey={busyKey}
              publicationReady={publicationReady}
              onAction={runPackageAction}
              onRefresh={refreshPackageWorkflow}
            />
          ) : (
            <ReportWorkspace
              workflow={reportWorkflow}
              report={report}
              error={errors.report}
              busyKey={busyKey}
              publicationReady={publicationReady}
              onAction={runReportAction}
              onRefresh={refreshReportWorkflow}
              isTablet={isTablet}
            />
          )}
        </View>
      </GovernanceSurface>

      <PublishedSnapshot
        published={published}
        error={errors.published}
      />

      </ScrollView>
      <BottomNavigation
        activeTab={activeTab}
        onSelect={(tab) => {
          setActiveTab(tab);
          if (tab === "work") setSelectedLane("request");
          if (tab === "reports") setSelectedLane("report");
          if (tab === "records") setNotice("업무 기록은 요청과 보고의 결정 이력에서 확인할 수 있습니다.");
        }}
      />
    </View>
  );
}

function BottomNavigation({ activeTab, onSelect }: {
  activeTab: "home" | "work" | "records" | "reports";
  onSelect: (tab: "home" | "work" | "records" | "reports") => void;
}) {
  return (
    <View style={styles.bottomNavigation} accessibilityRole="tablist">
      {BOTTOM_NAV_TABS.map((tab) => {
        const selected = tab.key === activeTab;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={({ pressed }) => [styles.bottomNavigationItem, selected && styles.bottomNavigationItemSelected, pressed && styles.bottomNavigationItemPressed]}
          >
            <Text style={[styles.bottomNavigationGlyph, selected && styles.bottomNavigationTextSelected]}>{tab.glyph}</Text>
            <Text style={[styles.bottomNavigationLabel, selected && styles.bottomNavigationTextSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function WorkLanePicker({ activeLane, requestStatus, reportStatus, isWide, onSelect }: {
  activeLane: "request" | "report";
  requestStatus: { label: string; tone: StatusTone };
  reportStatus: { label: string; tone: StatusTone };
  isWide: boolean;
  onSelect: (lane: "request" | "report") => void;
}) {
  return (
    <View style={[styles.queueRail, isWide && styles.queueRailWide]} accessibilityRole="tablist">
      {isWide ? <Text style={styles.queueLabel}>업무 흐름</Text> : null}
      <View style={[styles.queueOptions, isWide && styles.queueOptionsWide]}>
        <WorkLaneButton
          label="고객 요청"
          status={requestStatus}
          selected={activeLane === "request"}
          onPress={() => onSelect("request")}
        />
        <WorkLaneButton
          label="주간 보고서"
          status={reportStatus}
          selected={activeLane === "report"}
          onPress={() => onSelect("report")}
        />
      </View>
    </View>
  );
}

function WorkLaneButton({ label, status, selected, onPress }: {
  label: string;
  status: { label: string; tone: StatusTone };
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueOption,
        selected && styles.queueOptionSelected,
        hovered && !selected && styles.queueOptionHovered,
        focused && styles.queueOptionFocused,
        pressed && styles.queueOptionPressed,
      ]}
    >
      <Text style={[styles.queueOptionLabel, selected && styles.queueOptionLabelSelected]}>{label}</Text>
      <Text style={[styles.queueOptionStatus, styles[`queueOptionStatus_${status.tone}`]]}>{status.label}</Text>
    </Pressable>
  );
}

function PublishedSnapshot({ published, error }: {
  published: MobilePublishedSnapshot | null;
  error: SurfaceError | null;
}) {
  return (
    <GovernanceSurface style={styles.sectionSurface} accessibilityLabel="현재 임대 정보">
      <SectionHeading
        eyebrow="현재 임대 정보"
        title="Cobalt Finance Center · 5층"
        description="고객 안내에 사용하는 최신 정보입니다."
      />
      <Divider />
      {error ? (
        <FeedbackPanel tone="error" title={error.title} description="잠시 후 다시 불러와 주세요." />
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

function RequestWorkspace({ workflow, request, packageDraft, error, busyKey, publicationReady, onAction, onRefresh }: {
  workflow: MobileWorkflowView | null;
  request: MobileWorkflowView["requests"][number] | undefined;
  packageDraft: MobileWorkflowView["packages"][number] | undefined;
  error: SurfaceError | null;
  busyKey: BusyKey;
  publicationReady: boolean;
  onAction: (action: WorkflowAction, key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const task = requestTaskCopy(request, packageDraft, publicationReady);

  return (
    <View style={styles.workspaceBody} accessibilityLabel="고객 요청 검토">
      <SectionHeading
        eyebrow="고객 요청"
        title={task.title}
        description={task.description}
      />
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
          <FeedbackPanel
            tone="info"
            title="요청을 입력해 주세요"
            description="화면 위 입력란에서 요청을 확인하면 준비할 업무가 이곳에 이어집니다."
          />
        </View>
      ) : null}

      {request?.status === "candidate" ? (
        <View style={styles.taskStack}>
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

      {request?.status === "confirmed" && !packageDraft && publicationReady ? (
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

      {request?.status === "confirmed" && !packageDraft && !publicationReady ? (
        <FeedbackPanel
          tone="info"
          title="최신 임대 정보 반영을 기다리고 있습니다"
          description="관리자 검토가 끝나면 이 요청의 안내 자료를 바로 만들 수 있습니다."
        />
      ) : null}

      {packageDraft ? (
        <PackageStage pkg={packageDraft} busyKey={busyKey} onAction={onAction} />
      ) : null}

    </View>
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
        <FeedbackPanel tone="success" title="전달 기록을 저장했습니다" description="발송 결과를 업무 기록에 저장했습니다." />
        <PackageReview pkg={pkg} />
      </View>
    );
  }

  if (pkg.status === "edit_pending") {
    return (
      <View style={styles.taskStack}>
        <TaskIntro label="제안 문구" title="변경 전후를 비교하세요" description="제안한 문구가 요청에 맞는지 확인해 주세요." />
        <PackageReview pkg={pkg} />
        <BeforeAfter
          before={packageMessagePreview(pkg.subject, pkg.body)}
          after={packageMessagePreview(pkg.edit_candidate?.subject ?? "", pkg.edit_candidate?.body ?? "")}
        />
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
        description={friendlyPackageMessage(pkg.body)}
      />
      <PackageReview pkg={pkg} />
      {pkg.status === "draft" ? (
        <View style={styles.actionStack}>
          <ActionButton
            label="안내 자료 승인"
            variant="primary"
            loading={busyKey === "approve-package"}
            disabled={Boolean(busyKey) && busyKey !== "approve-package"}
            onPress={() => void onAction({ action: "approve", package_id: pkg.id }, "approve-package")}
          />
          <ActionButton
            label="문구 다듬기"
            loading={busyKey === "edit-package"}
            disabled={Boolean(busyKey) && busyKey !== "edit-package"}
            onPress={() => void onAction({ action: "edit", package_id: pkg.id, instruction: "Make the message concise and courteous" }, "edit-package")}
          />
        </View>
      ) : null}
      {pkg.status === "approved" ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="승인이 완료되었습니다" description="받는 사람과 첨부 자료를 한 번 더 확인하세요." />
          <ActionButton
            label="확인하고 발송하기"
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

function ReportWorkspace({ workflow, report, error, busyKey, publicationReady, onAction, onRefresh, isTablet }: {
  workflow: MobileReportWorkflowView | null;
  report: MobileReportView | undefined;
  error: SurfaceError | null;
  busyKey: BusyKey;
  publicationReady: boolean;
  onAction: (action: ReportWorkflowAction, key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isTablet: boolean;
}) {
  const task = reportTaskCopy(report, publicationReady);
  const reportReadyForApproval = Boolean(report?.status === "draft" && report.accepted_patch_count > 0);
  const showFinalReport = Boolean(report && (reportReadyForApproval || report.status === "approved" || report.status === "sent"));
  return (
    <View style={styles.workspaceBody} accessibilityLabel="주간 보고서">
      <SectionHeading
        eyebrow="주간 보고서"
        title={task.title}
        description={task.description}
      />
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

      {workflow && !report && publicationReady ? (
        <View style={styles.taskStack}>
          <ActionButton
            label="건물별 보고서 초안 만들기"
            variant="primary"
            loading={busyKey === "draft-report"}
            disabled={Boolean(busyKey) && busyKey !== "draft-report"}
            onPress={() => void onAction({ action: "draft" }, "draft-report")}
          />
        </View>
      ) : null}

      {workflow && !report && !publicationReady ? (
        <FeedbackPanel
          tone="info"
          title="최신 임대 정보 반영 후 만들 수 있습니다"
          description="관리자 검토가 끝나면 이번 주 활동을 불러와 보고서 초안을 준비합니다."
        />
      ) : null}

      {report ? (
        <View style={styles.taskStack}>
          {showFinalReport ? <ReportSummary report={report} /> : <ReportOverview report={report} />}

          {report.status === "stale" ? (
            <FeedbackPanel
              tone="error"
              title="보고서 정보가 변경되었습니다"
              description="최신 정보로 보고서를 다시 만들어 주세요."
            />
          ) : null}

          {report.status === "draft" && report.accepted_patch_count === 0 ? (
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

          {showFinalReport ? <RecipientPanel report={report} /> : null}

          {reportReadyForApproval ? (
            <View style={styles.taskStack}>
              <FeedbackPanel tone="success" title={`변경 ${report.accepted_patch_count}건을 반영했습니다`} description="받는 사람과 메일 내용을 확인한 뒤 승인하세요." />
              <ActionButton
                label="보고서 승인"
                variant="primary"
                loading={busyKey === "approve-report"}
                disabled={Boolean(busyKey) && busyKey !== "approve-report"}
                onPress={() => void onAction({ action: "approve", report_id: report.id }, "approve-report")}
              />
            </View>
          ) : null}

          {report.status === "approved" ? (
            <View style={styles.taskStack}>
              <FeedbackPanel tone="success" title="승인이 완료되었습니다" description="받는 사람과 첨부 파일을 한 번 더 확인하세요." />
              <ActionButton
                label="확인하고 발송하기"
                variant="primary"
                loading={busyKey === "send-report"}
                disabled={Boolean(busyKey) && busyKey !== "send-report"}
                onPress={() => void onAction({ action: "send", report_id: report.id, idempotency_key: `mobile-report-demo-${report.id}` }, "send-report")}
              />
            </View>
          ) : null}

          {report.status === "sent" ? (
            <FeedbackPanel tone="success" title="보고서 전달 기록을 저장했습니다" description="발송 결과를 건물 업무 기록에 저장했습니다." />
          ) : null}
        </View>
      ) : null}

    </View>
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
      <TaskIntro label="다음 단계" title="먼저 확인할 항목" description="하나를 선택하면 관련 기록과 변경 내용을 보여드립니다." />
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
                hint="이번 주 저장된 업무 자료에서 관련 내용을 확인합니다"
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
      <DataRow label="핵심 이슈" value={friendlyReportSentence(report.sections.key_issue)} detail={`업무 내용 ${sectionItems.length}건 · 참고 자료 ${report.sources.length}건`} tone={report.status === "approved" || report.status === "sent" ? "verified" : "neutral"} />
      <View style={styles.reportLineList}>
        {sectionItems.map((item) => (
          <View key={item} style={styles.reportLine}>
            <View style={styles.reportLineMark} />
            <Text style={styles.reportLineText}>{friendlyReportSentence(item)}</Text>
          </View>
        ))}
        {report.sections.next_actions.map((item) => (
          <View key={`${item.action}-${item.due_date}`} style={styles.reportLine}>
            <View style={[styles.reportLineMark, styles.reportLineMarkAction]} />
            <Text style={styles.reportLineText}>{friendlyReportSentence(item.action)} · {recipientRoleLabel(item.owner)} · {item.due_date}</Text>
          </View>
        ))}
      </View>
      <View style={styles.sourceSummary}>
        <Text style={styles.sourceSummaryTitle}>사용한 자료</Text>
        {report.sources.map((source, index) => (
          <View key={source.id} style={styles.sourceRow}>
            <Text style={styles.sourceIndex}>자료 {index + 1}</Text>
            <Text style={styles.sourceText}>{friendlyReportSentence(source.summary)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReportOverview({ report }: { report: MobileReportView }) {
  const activityCount = [
    ...report.sections.changes_since_last_report,
    ...report.sections.activity_summary,
    ...report.sections.negotiated_area_floor_changes,
    ...report.sections.competitor_buildings,
    ...report.sections.blocker_and_pending_approval,
  ].length;
  return (
    <View style={styles.reviewList} accessibilityLabel="주간 보고서 요약">
      <ReviewRow label="건물" value="Cobalt Finance Center" />
      <ReviewRow label="기간" value={`${report.reporting_period.from} — ${report.reporting_period.to}`} />
      <ReviewRow label="핵심 이슈" value={friendlyReportSentence(report.sections.key_issue)} />
      <ReviewRow label="확인할 기록" value={`${activityCount}건 · 참고 자료 ${report.sources.length}건`} />
    </View>
  );
}

function RecipientPanel({ report }: { report: MobileReportView }) {
  const to = report.recipients.to
    .map((recipient) => `${recipient.email} · ${recipientRoleLabel(recipient.role)}`)
    .join(", ") || "설정 없음";
  const cc = report.recipients.cc
    .map((recipient) => `${recipient.email} · ${recipientRoleLabel(recipient.role)}`)
    .join(", ") || "설정 없음";
  const attachments = report.attachments.map((attachment) => attachment.filename).join(", ") || "없음";
  return (
    <View style={styles.recipientPanel} accessibilityLabel="보고서 받는 사람">
      <View style={styles.recipientHeader}>
        <View>
          <Text style={styles.recipientLabel}>받는 사람</Text>
          <Text style={styles.recipientTitle}>등록된 수신자</Text>
        </View>
      </View>
      <View style={styles.reviewList}>
        <ReviewRow label="받는 사람" value={to} />
        <ReviewRow label="참조" value={cc} />
        <ReviewRow label="첨부" value={attachments} attention={!report.attachments.length} />
        <ReviewRow label="메일 제목" value={report.cover.subject} />
      </View>
    </View>
  );
}

function PackageReview({ pkg }: { pkg: MobileWorkflowView["packages"][number] }) {
  const recipients = [
    pkg.recipients.to.join(", "),
    pkg.recipients.cc.length ? `참조 ${pkg.recipients.cc.join(", ")}` : "",
  ].filter(Boolean).join(" · ") || "설정 없음";
  const facts = pkg.facts
    .map((fact) => `${friendlyFactLabel(fact.label)} ${friendlyFactValue(fact.value, fact.unit)}`)
    .join(" · ") || "없음";
  const files = pkg.files.map((file) => file.filename).join(", ") || "없음";

  return (
    <View style={styles.reviewList} accessibilityLabel="안내 자료 검토 내용">
      <ReviewRow label="전달 대상" value={recipients} />
      <ReviewRow label="임대 조건" value={facts} />
      <ReviewRow label="첨부" value={files} />
      {pkg.unresolved.length ? <ReviewRow label="추가 확인" value={`${pkg.unresolved.length}건`} attention /> : null}
    </View>
  );
}

function RequestSummary({ request }: { request: MobileWorkflowView["requests"][number] }) {
  const { summary } = request;
  const requestedContent = [
    summary.requested_fields.map(friendlyFactLabel).join(", "),
    summary.requested_files.map(requestedFileLabel).join(", "),
  ].filter(Boolean).join(" · ") || "없음";

  return (
    <View style={styles.reviewList} accessibilityLabel="요청 내용">
      <ReviewRow label="공간" value={`${summary.building_id ? "Cobalt Finance Center" : "미확인"} · ${summary.floor ?? "미확인"}`} />
      <ReviewRow label="필요한 내용" value={requestedContent} />
      <ReviewRow label="받는 사람" value={`${summary.recipient.name ?? "미확인"} · ${summary.recipient.organization ?? "미확인"}`} />
      <ReviewRow label="요청 기한" value={summary.deadline ?? "미확인"} />
      {summary.ambiguities.length ? (
        <ReviewRow label="추가 확인" value={summary.ambiguities.map((item) => `${friendlyFactLabel(item.field)}: ${item.reason}`).join("; ")} attention />
      ) : null}
    </View>
  );
}

function ReviewRow({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, attention && styles.reviewLabelAttention]}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
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

function friendlyPackageMessage(body: string): string {
  return body
    .replace(/--- PROTECTED PUBLISHED MATERIAL ---[\s\S]*?--- END PROTECTED PUBLISHED MATERIAL ---/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function packageMessagePreview(subject: string, body: string): string {
  return [subject.trim(), friendlyPackageMessage(body)].filter(Boolean).join("\n\n");
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

function requestTaskCopy(
  request: MobileWorkflowView["requests"][number] | undefined,
  pkg: MobileWorkflowView["packages"][number] | undefined,
  publicationReady: boolean,
) {
  if (pkg?.status === "sent") return { title: "전달 완료", description: "전달한 안내 자료와 기록을 확인할 수 있습니다." };
  if (pkg?.status === "stale") return { title: "안내 자료 다시 만들기", description: "임대 정보가 바뀌었습니다. 최신 내용으로 다시 준비해 주세요." };
  if (pkg?.status === "approved") return { title: "받는 사람과 자료 확인", description: "확인 후 발송 기록을 남기세요. 실제 이메일은 전송되지 않습니다." };
  if (pkg?.status === "edit_pending") return { title: "제안 문구 확인", description: "변경 전후를 비교하고 사용할 문구를 선택하세요." };
  if (pkg?.status === "draft") return { title: "안내 자료 검토", description: "고객에게 전달할 내용과 첨부 자료를 확인하세요." };
  if (request?.status === "confirmed" && !publicationReady) return { title: "최신 정보 반영 대기", description: "요청 확인을 마쳤습니다. 관리자 검토가 끝나면 안내 자료를 만들 수 있습니다." };
  if (request?.status === "confirmed") return { title: "안내 자료 만들기", description: "확인한 요청을 바탕으로 고객 안내 자료를 준비하세요." };
  if (request?.status === "candidate") return { title: "요청 내용 확인", description: "건물, 층, 필요한 자료와 받는 사람을 확인하세요." };
  return { title: "새 요청 가져오기", description: "통화 또는 이메일 예시를 선택하면 바로 검토를 시작합니다." };
}

function reportTaskCopy(report: MobileReportView | undefined, publicationReady: boolean) {
  if (!report && !publicationReady) return { title: "최신 정보 반영 대기", description: "관리자 검토가 끝나면 이번 주 보고서를 만들 수 있습니다." };
  if (!report) return { title: "이번 주 보고서 만들기", description: "이번 주 활동을 모아 건물별 초안을 준비합니다." };
  if (report.status === "sent") return { title: "보고서 전달 완료", description: "전달한 보고서와 기록을 확인할 수 있습니다." };
  if (report.status === "stale") return { title: "보고서 다시 만들기", description: "바뀐 정보를 반영해 새 초안을 준비해 주세요." };
  if (report.status === "approved") return { title: "받는 사람과 보고서 확인", description: "확인 후 발송 기록을 남기세요. 실제 이메일은 전송되지 않습니다." };
  if (report.status === "patch_pending") return { title: "제안 내용 확인", description: "변경 내용과 근거를 확인하고 반영 여부를 선택하세요." };
  if (report.accepted_patch_count) return { title: "보고서 승인", description: "반영된 내용과 받는 사람을 확인한 뒤 승인하세요." };
  return { title: "보고서 내용 확인", description: "확인할 항목을 선택해 이번 주 변동을 검토하세요." };
}

function recommendedLane(
  request: MobileWorkflowView["requests"][number] | undefined,
  pkg: MobileWorkflowView["packages"][number] | undefined,
  report: MobileReportView | undefined,
): "request" | "report" {
  const requestPriority = pkg?.status === "stale" ? 0
    : pkg?.status === "approved" ? 1
      : pkg?.status === "edit_pending" || request?.status === "candidate" ? 2
        : pkg?.status === "draft" ? 3
          : pkg?.status === "sent" ? 99
            : request?.status === "confirmed" ? 4
              : 5;
  const reportPriority = report?.status === "stale" ? 0
    : report?.status === "approved" ? 1
      : report?.status === "patch_pending" ? 2
        : report?.status === "draft" && report.accepted_patch_count > 0 ? 3
          : report?.status === "draft" ? 4
            : report?.status === "sent" ? 99
              : 6;
  return requestPriority <= reportPriority ? "request" : "report";
}

function packageStatus(
  pkg: MobileWorkflowView["packages"][number] | undefined,
  request: MobileWorkflowView["requests"][number] | undefined,
  publicationReady = true,
): { label: string; tone: StatusTone } {
  if (pkg?.status === "sent") return { label: "전달 완료", tone: "success" };
  if (pkg?.status === "stale") return { label: "최신 상태 아님", tone: "error" };
  if (pkg?.status === "approved") return { label: "승인됨 · 발송 전", tone: "warning" };
  if (pkg?.status === "edit_pending") return { label: "제안 문구 확인", tone: "info" };
  if (pkg?.status === "draft") return { label: "안내 자료 초안", tone: "info" };
  if (request?.status === "confirmed" && !publicationReady) return { label: "정보 반영 대기", tone: "info" };
  if (request?.status === "confirmed") return { label: "요청 확인됨", tone: "success" };
  if (request?.status === "candidate") return { label: "확인 필요", tone: "warning" };
  return { label: "새 요청 대기", tone: "neutral" };
}

function reportStatus(report: MobileReportView | undefined, publicationReady = true): { label: string; tone: StatusTone } {
  if (!report && !publicationReady) return { label: "정보 반영 대기", tone: "info" };
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
  if (typeof value === "string") return friendlyReportSentence(value);
  if (Array.isArray(value)) {
    return value.map(formatPatchValue).join("\n") || "항목 없음";
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
  appFrame: { backgroundColor: colors.canvas, flex: 1 },
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { alignSelf: "center", gap: space.region, maxWidth: layout.contentMax, paddingBottom: 132, paddingHorizontal: space.control, paddingTop: space.panel, width: "100%" },
  contentTablet: { paddingHorizontal: space.panel, paddingTop: space.section },
  contentWide: { paddingHorizontal: space.region, paddingTop: space.page },
  topbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  brandCluster: { alignItems: "center", flexDirection: "row", gap: space.compact },
  brandMark: { alignItems: "center", backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.medium, borderWidth: control.border, height: icon.brand, justifyContent: "center", width: icon.brand },
  brandMarkInner: { backgroundColor: colors.emerald500, borderRadius: radius.small, height: icon.brandInner, transform: [{ rotate: "45deg" }], width: icon.brandInner },
  brand: { color: "#173047", fontFamily: fonts.body, fontSize: 27, fontWeight: "700", letterSpacing: -0.8 },
  brandSubline: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, letterSpacing: 0, marginTop: control.focusOffset },
  topbarMeta: { flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: space.tight, maxWidth: "100%", minWidth: 0, width: "auto" },
  topbarMetaTablet: { justifyContent: "flex-end", width: "auto" },
  profileMark: { alignItems: "center", backgroundColor: "#173047", borderRadius: radius.pill, height: control.touch, justifyContent: "center", width: control.touch },
  profileMarkText: { color: colors.surface1, fontFamily: fonts.body, fontSize: type.body, fontWeight: "600" },
  demoContext: { alignItems: "center", backgroundColor: colors.surface1, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, flexDirection: "row", flexWrap: "wrap", gap: space.compact, padding: space.compact },
  demoLabels: { alignItems: "center", flexBasis: 220, flexDirection: "row", flexGrow: 1, flexShrink: 1, flexWrap: "wrap", gap: space.tight, minWidth: 0 },
  demoResetMobile: { flexBasis: "100%", minWidth: 0 },
  demoBoundary: { color: colors.text3, flexBasis: "100%", fontFamily: fonts.body, fontSize: type.label, lineHeight: lineHeight.label },
  commandComposer: { alignItems: "stretch", flexDirection: "row", gap: space.control, maxWidth: layout.longCopyMax, minWidth: 0, width: "100%" },
  commandRail: { backgroundColor: colors.emerald500, borderRadius: radius.pill, width: 3 },
  commandBody: { flex: 1, gap: space.group, minWidth: 0, paddingVertical: space.tight },
  commandTitle: { color: "#173047", fontFamily: fonts.body, fontSize: 31, fontWeight: "600", letterSpacing: -0.9, lineHeight: 39 },
  commandInput: { backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.inner, borderWidth: control.border, color: colors.text1, fontFamily: fonts.body, fontSize: type.body, lineHeight: lineHeight.body, minHeight: 112, minWidth: 0, padding: space.control, width: "100%", textAlignVertical: "top" },
  commandActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: space.compact, justifyContent: "flex-end" },
  commandActionsMobile: { alignItems: "stretch", flexDirection: "column" },
  voiceButton: { alignItems: "center", backgroundColor: colors.surface1, borderColor: colors.border, borderRadius: radius.pill, borderWidth: control.border, flexDirection: "row", gap: space.tight, minHeight: control.touch, paddingHorizontal: space.control },
  voiceButtonPressed: { backgroundColor: colors.surface2, transform: [{ scale: 0.985 }] },
  voiceButtonIcon: { color: "#173047", fontSize: 9 },
  voiceButtonText: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "600" },
  nextWorkHeading: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: space.tight, justifyContent: "space-between", marginBottom: space.group },
  nextWorkTitle: { color: "#173047", fontFamily: fonts.body, fontSize: type.h2, fontWeight: "600", letterSpacing: tracking.h2 },
  nextWorkContext: { color: colors.text3, fontFamily: fonts.body, fontSize: type.bodySmall },
  bottomNavigation: { alignItems: "stretch", backgroundColor: "rgba(255,255,255,0.98)", borderTopColor: colors.border, borderTopWidth: control.border, bottom: 0, flexDirection: "row", left: 0, paddingBottom: Platform.OS === "ios" ? 24 : 10, paddingHorizontal: space.tight, paddingTop: space.tight, position: "absolute", right: 0, ...surfaceDepth },
  bottomNavigationItem: { alignItems: "center", borderTopColor: "transparent", borderTopWidth: 2, flex: 1, gap: space.hairline, justifyContent: "center", minHeight: 54, paddingHorizontal: space.hairline },
  bottomNavigationItemSelected: { borderTopColor: colors.emerald500 },
  bottomNavigationItemPressed: { backgroundColor: colors.surface2 },
  bottomNavigationGlyph: { color: colors.text3, fontFamily: fonts.body, fontSize: type.h3, lineHeight: lineHeight.h3 },
  bottomNavigationLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "500", lineHeight: lineHeight.label, textAlign: "center" },
  bottomNavigationTextSelected: { color: colors.emerald500, fontWeight: "700" },
  pageHeading: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  pageHeadingCopy: { flexGrow: 1, flexShrink: 1, maxWidth: "100%", minWidth: 0 },
  pageTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: 28, fontWeight: "600", letterSpacing: tracking.h2, lineHeight: 34 },
  pageContext: { color: colors.text3, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.hairline },
  pageHeadingAction: { alignItems: "flex-end" },
  workShell: { width: "100%" },
  workShellWide: { alignItems: "flex-start", flexDirection: "row" },
  queueRail: { maxWidth: "100%", minWidth: 0, width: "100%" },
  queueRailWide: { borderRightColor: colors.borderSubtle, borderRightWidth: control.border, flexBasis: 228, flexGrow: 0, flexShrink: 0, paddingRight: space.panel, width: "auto" },
  queueLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", lineHeight: lineHeight.label, marginBottom: space.compact },
  queueOptions: { flexDirection: "row", gap: space.tight, maxWidth: "100%", minWidth: 0 },
  queueOptionsWide: { flexDirection: "column" },
  queueOption: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, flex: 1, minHeight: control.standard, minWidth: 0, paddingHorizontal: space.compact, paddingVertical: space.compact },
  queueOptionSelected: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  queueOptionHovered: { backgroundColor: colors.surface3, borderColor: colors.border },
  queueOptionFocused: { borderColor: colors.emerald500, outlineColor: colors.emerald500, outlineOffset: control.focusOffset, outlineStyle: "solid", outlineWidth: control.focusOutline },
  queueOptionPressed: { opacity: 0.78 },
  queueOptionLabel: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "600", lineHeight: lineHeight.control },
  queueOptionLabelSelected: { color: colors.text1 },
  queueOptionStatus: { fontFamily: fonts.body, fontSize: type.label, lineHeight: lineHeight.label, marginTop: space.hairline },
  queueOptionStatus_neutral: { color: colors.text3 },
  queueOptionStatus_info: { color: colors.info },
  queueOptionStatus_warning: { color: colors.warning },
  queueOptionStatus_success: { color: colors.success },
  queueOptionStatus_error: { color: colors.error },
  workPanel: { marginTop: space.panel, maxWidth: "100%", minWidth: 0, width: "100%" },
  workPanelWide: { flex: 1, marginTop: 0, paddingLeft: space.panel, width: "auto" },
  workspaceBody: { maxWidth: "100%", minWidth: 0, width: "100%" },
  sectionSurface: { width: "100%" },
  dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  taskStack: { gap: space.control, marginTop: space.group },
  actionStack: { gap: space.compact },
  actionCluster: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.compact },
  taskIntro: { maxWidth: layout.taskCopyMax },
  taskLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0, marginBottom: space.tight },
  taskTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "600", letterSpacing: tracking.h3, lineHeight: lineHeight.h3 },
  taskDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.tight },
  sourcePreview: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, padding: space.control },
  reviewList: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, maxWidth: "100%", minWidth: 0, paddingHorizontal: space.control },
  reviewRow: { alignItems: "flex-start", borderBottomColor: colors.borderSubtle, borderBottomWidth: control.border, flexDirection: "row", gap: space.compact, minHeight: control.touch, paddingVertical: space.compact },
  reviewLabel: { color: colors.text3, flexBasis: 78, flexGrow: 0, flexShrink: 0, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", lineHeight: lineHeight.label },
  reviewLabelAttention: { color: colors.warning },
  reviewValue: { color: colors.text1, flex: 1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.compact, minWidth: 0 },
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
});
