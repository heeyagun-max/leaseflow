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
import { resetDemo } from "../src/data/demo-reset";
import { fetchOperationsSnapshot, type MobileOperationsSnapshot } from "../src/data/operations-snapshot";
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
  { key: "home", label: "Home", glyph: "⌂" },
  { key: "work", label: "Requests", glyph: "▣" },
  { key: "records", label: "Activity", glyph: "◴" },
  { key: "reports", label: "Weekly Reports", glyph: "□" },
] as const;

const investigationCommandLabels: Record<string, string> = {
  "통화내용 확인해서 이번주 변동사항 업데이트 해": "Review call updates",
  "이메일 확인해서 이번주 변동사항 업데이트 해": "Review email updates",
  "협의 중인 면적 변동 있는지 확인해": "Review negotiated area changes",
  "협의 중인 층 변동 있는지 확인해": "Review negotiated floor changes",
  "메일이랑 전화 확인해서 경쟁빌딩 파악해봐": "Review competitor mentions",
};

const recipientRoleLabels: Record<string, string> = {
  asset_manager: "Asset Manager",
  leasing_manager: "Leasing Manager",
  landlord: "Landlord",
  property_manager: "Property Manager",
  to_landlord_practical: "Landlord Operations",
  cc_landlord_team: "Landlord Team",
  cc_landlord_exec: "Landlord Executive",
  cc_lm_team: "Leasing Team",
  cc_lm_exec: "Leasing Executive",
  "LM Manager": "Leasing Manager",
};

const requestedFileLabels: Record<string, string> = {
  current_floor_plan: "Current floor plan",
  floor_plan: "Floor plan",
  stacking_plan: "Stacking plan",
  availability_schedule: "Availability schedule",
};

function investigationCommandLabel(command: string) {
  return investigationCommandLabels[command] ?? "Review selected changes";
}

function recipientRoleLabel(role: string) {
  return recipientRoleLabels[role] ?? "Assigned owner";
}

function requestedFileLabel(file: string) {
  return requestedFileLabels[file] ?? "Requested file";
}

function friendlyFactValue(value: number, unit: string) {
  const units: Record<string, string> = { py: " py", months: " months", spaces: " spaces" };
  return `${value}${units[unit] ?? ""}`;
}

function friendlyReportSentence(value: string) {
  return value;
}

function friendlyUnresolvedItem(field: string, question: string) {
  if (field === "competitor_buildings") return friendlyReportSentence(question);
  return `Review additional information for ${friendlyFactLabel(field)}.`;
}

async function confirmDemoReset(): Promise<boolean> {
  const message = "This removes all demo requests, packages, report progress, and returns to the initial state.";
  if (Platform.OS === "web") return globalThis.confirm(message);
  return new Promise((resolve) => {
    Alert.alert("Reset the demo?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Reset Demo", style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function Home() {
  const { width } = useWindowDimensions();
  const [hasHydrated, setHasHydrated] = useState(false);
  const isWide = hasHydrated && width >= layout.wideBreakpoint;
  const isTablet = hasHydrated && width >= layout.tabletBreakpoint;
  const [published, setPublished] = useState<MobilePublishedSnapshot | null>(null);
  const [publishedDocuments, setPublishedDocuments] = useState<MobileOperationsSnapshot["published_documents"]>([]);
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
      const snapshot = await fetchOperationsSnapshot();
      setPublished(snapshot.published);
      setPublishedDocuments(snapshot.published_documents);
      updateError("published", null);
    } catch (error) {
      updateError("published", surfaceError("Published data could not be loaded", error));
    }
  }, [updateError]);

  const refreshPackageWorkflow = useCallback(async () => {
    try {
      setWorkflow(await fetchMobileWorkflow());
      updateError("package", null);
    } catch (error) {
      updateError("package", surfaceError("Request workflow could not be loaded", error));
    }
  }, [updateError]);

  const refreshReportWorkflow = useCallback(async () => {
    try {
      setReportWorkflow(await fetchMobileReports());
      updateError("report", null);
    } catch (error) {
      updateError("report", surfaceError("Weekly reports could not be loaded", error));
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
      updateError("package", surfaceError("The request action could not be completed", error));
      if (isRevisionConflict(error)) {
        await Promise.all([refreshPackageWorkflow(), refreshReportWorkflow()]);
        setNotice("The data changed in another session. The latest version has been loaded.");
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
      updateError("report", surfaceError("The report action could not be completed", error));
      if (requiresReportWorkflowRefresh(error)) {
        await Promise.all([refreshPackageWorkflow(), refreshReportWorkflow()]);
        const reason = error.code === "WORKFLOW_STALE"
          ? "The report source data changed. Create a new draft."
          : "The data changed in another session.";
        setNotice(`${reason} The latest version has been loaded.`);
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
      setNotice("The demo has been reset and all leasing, package, and report states were refreshed.");
    } catch (error) {
      setNotice(null);
      setResetError(surfaceError("The demo could not be reset", error));
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
        <title>LeaseFlow Operations</title>
        <meta name="description" content="LeaseFlow mobile leasing operations" />
      </Head>
      <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, isTablet && styles.contentTablet, isWide && styles.contentWide]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="LeaseFlow mobile operations"
    >
      <StatusBar style="dark" />

      <View style={styles.topbar}>
        <View style={styles.brandCluster}>
          <View>
            <Text style={styles.brand}>LeaseFlow</Text>
          </View>
        </View>
        <View style={styles.profileMark} accessibilityLabel="Demo Manager"><Text style={styles.profileMarkText}>DM</Text></View>
      </View>

      <View style={styles.demoContext} accessibilityLabel="Demo context">
        <View style={styles.demoLabels}>
          <StatusBadge label="Demo" tone="neutral" />
          <StatusBadge label="Leasing Manager" tone="info" />
          <StatusBadge label="Sandbox Delivery" tone="warning" />
        </View>
        <View style={!isTablet ? styles.demoResetMobile : undefined}>
          <ActionButton
            label="Reset Demo"
            variant="ghost"
            compact
            loading={busyKey === "demo-reset"}
            disabled={!workflow || (Boolean(busyKey) && busyKey !== "demo-reset")}
            onPress={() => void runDemoReset()}
            hint="Removes demo progress after confirmation and returns to the initial state"
          />
        </View>
        <Text style={styles.demoBoundary}>Synthetic demo data · No live email, phone, or sign-in integration</Text>
      </View>

      <View style={styles.commandComposer} accessibilityLabel="Synthetic sample request">
        <View style={styles.commandRail} accessibilityElementsHidden />
        <View style={styles.commandBody}>
          <Text accessibilityRole="header" aria-level={1} style={styles.commandTitle}>Review a sample request</Text>
          <TextInput
            accessibilityLabel="Synthetic sample request content"
            multiline
            editable={false}
            style={styles.commandInput}
            value={commandText}
          />
          <View style={[styles.commandActions, !isTablet && styles.commandActionsMobile]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use voice input"
              onPress={() => setNotice("Voice input is not connected in this demo. Continue with the sample request.")}
              style={({ pressed }) => [styles.voiceButton, pressed && styles.voiceButtonPressed]}
            >
              <Text style={styles.voiceButtonIcon}>●</Text>
              <Text style={styles.voiceButtonText}>Voice</Text>
            </Pressable>
            <ActionButton
              label="Load Sample Request"
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
        <FeedbackPanel tone="info" title="Synced with current data" description={notice} />
      ) : null}
      {resetError ? <FeedbackPanel tone="error" title={resetError.title} description={resetError.description} /> : null}

      <GovernanceSurface style={[styles.workShell, isWide && styles.workShellWide]} accessibilityLabel="Work queue">
        <View style={styles.nextWorkHeading}>
          <Text style={styles.nextWorkTitle}>Next Task</Text>
          <Text style={styles.nextWorkContext}>Cobalt Finance Center · 5F</Text>
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
              buildingId={published?.building_id ?? "bld-cobalt"}
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
      <ApprovedReferenceDocuments
        documents={publishedDocuments}
      />

      </ScrollView>
      <BottomNavigation
        activeTab={activeTab}
        onSelect={(tab) => {
          setActiveTab(tab);
          if (tab === "work") setSelectedLane("request");
          if (tab === "reports") setSelectedLane("report");
          if (tab === "records") setNotice("Activity is available in each request and report decision history.");
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
      {isWide ? <Text style={styles.queueLabel}>Workflow</Text> : null}
      <View style={[styles.queueOptions, isWide && styles.queueOptionsWide]}>
        <WorkLaneButton
          label="Customer Request"
          status={requestStatus}
          selected={activeLane === "request"}
          onPress={() => onSelect("request")}
        />
        <WorkLaneButton
          label="Weekly Report"
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
    <GovernanceSurface style={styles.sectionSurface} accessibilityLabel="Current leasing information">
      <SectionHeading
        eyebrow="Current leasing information"
        title="Cobalt Finance Center · 5F"
      />
      <Divider />
      {error ? (
        <FeedbackPanel tone="error" title={error.title} description="Try loading the information again." />
      ) : published ? (
        <View style={styles.dataGrid}>
          <DataRow label="Available area" value={`${published.marketed_area_py} py`} tone="verified" />
          <DataRow label="Rent-free" value={`${published.rent_free_months} months`} tone="verified" />
          <DataRow label="Supported parking" value={`${published.supported_parking_spaces} spaces`} tone="verified" />
          <DataRow label="Floor plan" value={published.floor_plan.filename} tone="verified" />
        </View>
      ) : (
        <FeedbackPanel tone="info" title="Loading leasing information" description="Please wait a moment." />
      )}
    </GovernanceSurface>
  );
}

function ApprovedReferenceDocuments({ documents }: {
  documents: MobileOperationsSnapshot["published_documents"];
}) {
  const references = documents.filter((document) => document.document_type !== "area_workbook"
    && document.document_type !== "legal_document");
  if (!references.length) return null;
  return (
    <GovernanceSurface style={styles.sectionSurface} accessibilityLabel="Approved reference documents, not official leasing terms">
      <SectionHeading
        eyebrow="Senior published"
        title="Approved Reference Documents"
        action={<StatusBadge label="Not official terms" tone="warning" />}
      />
      <Divider />
      <Text style={styles.referenceNotice}>Additional building context kept separate from the current leasing information above.</Text>
      <View accessibilityRole="list" style={styles.referenceList}>
        {references.map((document) => (
          <View accessible accessibilityLabel={`${publishedDocumentTypeLabel(document.document_type)}, ${document.reviewed_summary}`} key={`${document.building_id}-${document.document_type}-${document.reviewed_summary}`} style={styles.referenceCard}>
            <Text style={styles.referenceBuilding}>{publishedDocumentBuildingLabel(document.building_id)}</Text>
            <Text style={styles.referenceType}>{publishedDocumentTypeLabel(document.document_type)}</Text>
            <Text style={styles.referenceSummary}>{document.reviewed_summary}</Text>
          </View>
        ))}
      </View>
    </GovernanceSurface>
  );
}

function publishedDocumentBuildingLabel(buildingId: string): string {
  if (buildingId === "bld-cobalt") return "Cobalt Finance Center";
  if (buildingId === "bld-pacific-gate") return "Pacific Gate Tower";
  if (buildingId === "bld-teheran-link") return "Teheran Link";
  return "Assigned building";
}

function publishedDocumentTypeLabel(type: MobileOperationsSnapshot["published_documents"][number]["document_type"]): string {
  if (type === "monthly_owner_update") return "Monthly leasing update";
  if (type === "floor_plan") return "Floor plan reference";
  return "Leasing reference";
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
    <View style={styles.workspaceBody} accessibilityLabel="Customer request review">
      <SectionHeading
        eyebrow="Customer Request"
        title={task.title}
      />
      <Divider />

      {error ? (
        <FeedbackPanel
          tone="error"
          title={error.title}
          description={error.description}
          action={<ActionButton label="Reload Request" variant="ghost" compact onPress={() => void onRefresh()} />}
        />
      ) : null}

      {!workflow ? (
        <FeedbackPanel tone="info" title="Loading request" description="Please wait a moment." />
      ) : null}

      {workflow && !request ? (
        <View style={styles.taskStack}>
          <FeedbackPanel
            tone="info"
            title="Load a request to begin"
            description="Use the sample request above to start the workflow."
          />
        </View>
      ) : null}

      {request?.status === "candidate" ? (
        <View style={styles.taskStack}>
          <RequestSummary request={request} />
          <ActionButton
            label="Confirm Request"
            variant="primary"
            loading={busyKey === "confirm-request"}
            disabled={Boolean(busyKey) && busyKey !== "confirm-request"}
            onPress={() => void onAction({ action: "confirm", request_id: request.id }, "confirm-request")}
          />
        </View>
      ) : null}

      {request?.status === "confirmed" && !packageDraft && publicationReady ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="Request confirmed" description="A customer package can now be prepared." />
          <ActionButton
            label="Prepare Customer Package"
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
          title="Waiting for current leasing information"
          description="The package can be prepared after the admin review is published."
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
        title="Leasing information changed"
        description="Rebuild the package using the current information."
      />
    );
  }

  if (pkg.status === "sent") {
    return (
      <View style={styles.taskStack}>
        <FeedbackPanel tone="success" title="Delivery recorded" description="The delivery result is saved in the activity history." />
        <PackageReview pkg={pkg} />
      </View>
    );
  }

  if (pkg.status === "edit_pending") {
    return (
      <View style={styles.taskStack}>
        <TaskIntro label="Suggested Copy" title="Compare the current and suggested versions" />
        <PackageReview pkg={pkg} />
        <BeforeAfter
          before={packageMessagePreview(pkg.subject, pkg.body)}
          after={packageMessagePreview(pkg.edit_candidate?.subject ?? "", pkg.edit_candidate?.body ?? "")}
        />
        <View style={styles.actionCluster}>
          <ActionButton
            label="Accept Suggested Copy"
            variant="primary"
            loading={busyKey === "accept-package-edit"}
            disabled={Boolean(busyKey) && busyKey !== "accept-package-edit"}
            onPress={() => void onAction({ action: "decide", package_id: pkg.id, decision: "accept" }, "accept-package-edit")}
          />
          <ActionButton
            label="Keep Current Copy"
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
        label={pkg.status === "approved" ? "Approved Package" : "Draft Package"}
        title={pkg.subject}
      />
      <PackageReview pkg={pkg} />
      {pkg.status === "draft" ? (
        <View style={styles.actionStack}>
          <ActionButton
            label="Approve Package"
            variant="primary"
            loading={busyKey === "approve-package"}
            disabled={Boolean(busyKey) && busyKey !== "approve-package"}
            onPress={() => void onAction({ action: "approve", package_id: pkg.id }, "approve-package")}
          />
          <ActionButton
            label="Refine Copy"
            loading={busyKey === "edit-package"}
            disabled={Boolean(busyKey) && busyKey !== "edit-package"}
            onPress={() => void onAction({ action: "edit", package_id: pkg.id, instruction: "Make the message concise and courteous" }, "edit-package")}
          />
        </View>
      ) : null}
      {pkg.status === "approved" ? (
        <View style={styles.taskStack}>
          <FeedbackPanel tone="success" title="Approval complete" description="Review the recipients and attachments once more." />
          <ActionButton
            label="Confirm and Record Delivery"
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

function ReportWorkspace({ workflow, report, buildingId, error, busyKey, publicationReady, onAction, onRefresh, isTablet }: {
  workflow: MobileReportWorkflowView | null;
  report: MobileReportView | undefined;
  buildingId: string;
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
    <View style={styles.workspaceBody} accessibilityLabel="Weekly report">
      <SectionHeading
        eyebrow="Weekly Report"
        title={task.title}
      />
      <Divider />

      {error ? (
        <FeedbackPanel
          tone="error"
          title={error.title}
          description={error.description}
          action={<ActionButton label="Reload Report" variant="ghost" compact onPress={() => void onRefresh()} />}
        />
      ) : null}

      {!workflow ? (
        <FeedbackPanel tone="info" title="Loading report" description="Please wait a moment." />
      ) : null}

      {workflow && !report && publicationReady ? (
        <View style={styles.taskStack}>
          <ActionButton
            label="Create Building Report Draft"
            variant="primary"
            loading={busyKey === "draft-report"}
            disabled={Boolean(busyKey) && busyKey !== "draft-report"}
            onPress={() => void onAction({ action: "draft", building_id: buildingId }, "draft-report")}
          />
        </View>
      ) : null}

      {workflow && !report && !publicationReady ? (
        <FeedbackPanel
          tone="info"
          title="Current leasing information is required"
          description="After admin publication, this week's activity can be assembled into a report draft."
        />
      ) : null}

      {report ? (
        <View style={styles.taskStack}>
          {showFinalReport ? <ReportSummary report={report} /> : <ReportOverview report={report} />}

          {report.status === "stale" ? (
            <FeedbackPanel
              tone="error"
              title="Report information changed"
              description="Rebuild the report using the current information."
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
                  title="Some items still require review"
                  description="Resolve the questions or exclude this suggestion before continuing."
                />
              ) : null}
              <View style={styles.actionCluster}>
                <ActionButton
                  label="Apply Suggestion"
                  variant="primary"
                  loading={busyKey === "accept-report-patch"}
                  disabled={Boolean(report.pending_candidate?.unresolved.length) || (Boolean(busyKey) && busyKey !== "accept-report-patch")}
                  onPress={() => void onAction({ action: "decide_patch", report_id: report.id, decision: "accept" }, "accept-report-patch")}
                  hint={report.pending_candidate?.unresolved.length ? "Some questions still require review" : "Apply the reviewed changes to the report"}
                />
                <ActionButton
                  label="Exclude Suggestion"
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
              <FeedbackPanel tone="success" title={`${report.accepted_patch_count} changes applied`} description="Review the recipients and message before approval." />
              <ActionButton
                label="Approve Report"
                variant="primary"
                loading={busyKey === "approve-report"}
                disabled={Boolean(busyKey) && busyKey !== "approve-report"}
                onPress={() => void onAction({ action: "approve", report_id: report.id }, "approve-report")}
              />
            </View>
          ) : null}

          {report.status === "approved" ? (
            <View style={styles.taskStack}>
              <FeedbackPanel tone="success" title="Approval complete" description="Review the recipients and attachments once more." />
              <ActionButton
                label="Confirm and Record Delivery"
                variant="primary"
                loading={busyKey === "send-report"}
                disabled={Boolean(busyKey) && busyKey !== "send-report"}
                onPress={() => void onAction({ action: "send", report_id: report.id, idempotency_key: `mobile-report-demo-${report.id}` }, "send-report")}
              />
            </View>
          ) : null}

          {report.status === "sent" ? (
            <FeedbackPanel tone="success" title="Report delivery recorded" description="The result is saved in the building activity history." />
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
      <TaskIntro label="Next Step" title="Choose what to review first" />
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
                hint="Review the related records saved this week"
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
      <TaskIntro label="Suggested Change" title="Review the change and its evidence" />
      <View accessibilityRole="list" style={styles.findingList}>
        {candidate.findings.map((finding, index) => (
          <View key={`${candidate.id}:finding:${finding.finding}:${finding.source_reference_ids.join("|")}`} style={styles.findingCard}>
            <View style={styles.findingHeader}>
              <StatusBadge label={`Confidence ${Math.round(finding.confidence * 100)}%`} tone="info" />
              <MonoText>Evidence {index + 1}</MonoText>
            </View>
            <Text style={styles.findingText}>{friendlyReportSentence(finding.finding)}</Text>
            <SourceChips sourceIds={finding.source_reference_ids} />
          </View>
        ))}
      </View>
      {candidate.operations.map((operation, index) => (
        <View key={`${candidate.id}:operation:${operation.section}:${operation.operation}:${operation.source_reference_ids.join("|")}`} style={styles.operationCard}>
          <View style={styles.operationHeader}>
            <StatusBadge label="Not reviewed" tone="info" />
            <MonoText>Change {index + 1}</MonoText>
          </View>
          <BeforeAfter before={formatPatchValue(operation.before)} after={formatPatchValue(operation.after)} />
          <SourceChips sourceIds={operation.source_reference_ids} />
        </View>
      ))}
      {candidate.unresolved.length ? (
        <FeedbackPanel
          tone="warning"
          title="Some items still require review"
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
      <DataRow label="Key issue" value={friendlyReportSentence(report.sections.key_issue)} detail={`${sectionItems.length} activity items · ${report.sources.length} references`} tone={report.status === "approved" || report.status === "sent" ? "verified" : "neutral"} />
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
        <Text style={styles.sourceSummaryTitle}>Sources Used</Text>
        {report.sources.map((source, index) => (
          <View key={source.id} style={styles.sourceRow}>
            <Text style={styles.sourceIndex}>Source {index + 1}</Text>
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
    <View style={styles.reviewList} accessibilityLabel="Weekly report summary">
      <ReviewRow label="Building" value="Cobalt Finance Center" />
      <ReviewRow label="Period" value={`${report.reporting_period.from} — ${report.reporting_period.to}`} />
      <ReviewRow label="Key issue" value={friendlyReportSentence(report.sections.key_issue)} />
      <ReviewRow label="Records to review" value={`${activityCount} items · ${report.sources.length} references`} />
    </View>
  );
}

function RecipientPanel({ report }: { report: MobileReportView }) {
  const to = report.recipients.to
    .map((recipient) => `${recipient.email} · ${recipientRoleLabel(recipient.role)}`)
    .join(", ") || "Not configured";
  const cc = report.recipients.cc
    .map((recipient) => `${recipient.email} · ${recipientRoleLabel(recipient.role)}`)
    .join(", ") || "Not configured";
  const attachments = report.attachments.map((attachment) => attachment.filename).join(", ") || "None";
  return (
    <View style={styles.recipientPanel} accessibilityLabel="Report recipients">
      <View style={styles.recipientHeader}>
        <View>
          <Text style={styles.recipientLabel}>Recipients</Text>
          <Text style={styles.recipientTitle}>Configured Recipient Group</Text>
        </View>
      </View>
      <View style={styles.reviewList}>
        <ReviewRow label="To" value={to} />
        <ReviewRow label="Cc" value={cc} />
        <ReviewRow label="Attachments" value={attachments} attention={!report.attachments.length} />
        <ReviewRow label="Subject" value={report.cover.subject} />
      </View>
    </View>
  );
}

function PackageReview({ pkg }: { pkg: MobileWorkflowView["packages"][number] }) {
  const recipients = [
    pkg.recipients.to.join(", "),
    pkg.recipients.cc.length ? `Cc ${pkg.recipients.cc.join(", ")}` : "",
  ].filter(Boolean).join(" · ") || "Not configured";
  const facts = pkg.facts
    .map((fact) => `${friendlyFactLabel(fact.label)} ${friendlyFactValue(fact.value, fact.unit)}`)
    .join(" · ") || "None";
  const files = pkg.files.map((file) => file.filename).join(", ") || "None";

  return (
    <View style={styles.reviewList} accessibilityLabel="Customer package review">
      <ReviewRow label="Recipients" value={recipients} />
      <ReviewRow label="Message" value={friendlyPackageMessage(pkg.body)} />
      <ReviewRow label="Leasing Terms" value={facts} />
      <ReviewRow label="Attachments" value={files} />
      {pkg.unresolved.length ? <ReviewRow label="Additional Review" value={`${pkg.unresolved.length} items`} attention /> : null}
    </View>
  );
}

function RequestSummary({ request }: { request: MobileWorkflowView["requests"][number] }) {
  const { summary } = request;
  const requestedContent = [
    summary.requested_fields.map(friendlyFactLabel).join(", "),
    summary.requested_files.map(requestedFileLabel).join(", "),
  ].filter(Boolean).join(" · ") || "None";

  return (
    <View style={styles.reviewList} accessibilityLabel="Request details">
      <ReviewRow label="Space" value={`${summary.building_id ? "Cobalt Finance Center" : "Not identified"} · ${summary.floor ?? "Not identified"}`} />
      <ReviewRow label="Requested Content" value={requestedContent} />
      <ReviewRow label="Recipient" value={`${summary.recipient.name ?? "Not identified"} · ${summary.recipient.organization ?? "Not identified"}`} />
      <ReviewRow label="Deadline" value={summary.deadline ?? "Not identified"} />
      {summary.ambiguities.length ? (
        <ReviewRow label="Additional Review" value={summary.ambiguities.map((item) => `${friendlyFactLabel(item.field)}: ${item.reason}`).join("; ")} attention />
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
        <Text style={styles.diffLabel}>Current</Text>
        <Text style={styles.diffText}>{before || "No current value"}</Text>
      </View>
      <View style={styles.diffAfter}>
        <Text style={[styles.diffLabel, styles.diffLabelAfter]}>Suggested</Text>
        <Text style={styles.diffText}>{after || "No suggested value"}</Text>
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
    <View style={styles.sourceChips} accessibilityLabel={`${sourceIds.length} evidence sources`}>
      {sourceIds.map((sourceId, index) => (
        <View key={sourceId} style={styles.sourceChip}><Text style={styles.sourceChipText}>Evidence {index + 1}</Text></View>
      ))}
    </View>
  );
}

function TaskIntro({ label, title }: { label: string; title: string }) {
  return (
    <View style={styles.taskIntro}>
      <Text style={styles.taskLabel}>{label}</Text>
      <Text style={styles.taskTitle}>{title}</Text>
    </View>
  );
}

function requestTaskCopy(
  request: MobileWorkflowView["requests"][number] | undefined,
  pkg: MobileWorkflowView["packages"][number] | undefined,
  publicationReady: boolean,
) {
  if (pkg?.status === "sent") return { title: "Delivery Recorded" };
  if (pkg?.status === "stale") return { title: "Rebuild Customer Package" };
  if (pkg?.status === "approved") return { title: "Review Recipients and Materials" };
  if (pkg?.status === "edit_pending") return { title: "Review Suggested Copy" };
  if (pkg?.status === "draft") return { title: "Review Customer Package" };
  if (request?.status === "confirmed" && !publicationReady) return { title: "Awaiting Current Information" };
  if (request?.status === "confirmed") return { title: "Prepare Customer Package" };
  if (request?.status === "candidate") return { title: "Review Request" };
  return { title: "Import a New Request" };
}

function reportTaskCopy(report: MobileReportView | undefined, publicationReady: boolean) {
  if (!report && !publicationReady) return { title: "Awaiting Current Information" };
  if (!report) return { title: "Prepare This Week's Report" };
  if (report.status === "sent") return { title: "Report Delivery Recorded" };
  if (report.status === "stale") return { title: "Rebuild Report" };
  if (report.status === "approved") return { title: "Review Recipients and Report" };
  if (report.status === "patch_pending") return { title: "Review Suggested Changes" };
  if (report.accepted_patch_count) return { title: "Approve Report" };
  return { title: "Review Report" };
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
  if (pkg?.status === "sent") return { label: "Delivered", tone: "success" };
  if (pkg?.status === "stale") return { label: "Current data required", tone: "error" };
  if (pkg?.status === "approved") return { label: "Approved · not sent", tone: "warning" };
  if (pkg?.status === "edit_pending") return { label: "Review suggested copy", tone: "info" };
  if (pkg?.status === "draft") return { label: "Draft package", tone: "info" };
  if (request?.status === "confirmed" && !publicationReady) return { label: "Awaiting publication", tone: "info" };
  if (request?.status === "confirmed") return { label: "Request confirmed", tone: "success" };
  if (request?.status === "candidate") return { label: "Review required", tone: "warning" };
  return { label: "Waiting for request", tone: "neutral" };
}

function reportStatus(report: MobileReportView | undefined, publicationReady = true): { label: string; tone: StatusTone } {
  if (!report && !publicationReady) return { label: "Awaiting publication", tone: "info" };
  if (!report) return { label: "Ready to draft", tone: "neutral" };
  if (report.status === "sent") return { label: "Delivered", tone: "success" };
  if (report.status === "stale") return { label: "Current data required", tone: "error" };
  if (report.status === "approved") return { label: "Approved · not sent", tone: "warning" };
  if (report.status === "patch_pending") return { label: "Review suggested changes", tone: "info" };
  if (report.accepted_patch_count) return { label: "Changes applied · approval required", tone: "success" };
  return { label: "Review required", tone: "neutral" };
}

function surfaceError(title: string, _error: unknown): SurfaceError {
  return {
    title,
    description: "Try again in a moment.",
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
    return value.map(formatPatchValue).join("\n") || "No items";
  }
  if (value === null || value === undefined) return "No value";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function friendlyFactLabel(label: string): string {
  const normalized = label.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const labels: Record<string, string> = {
    building: "Building",
    building_id: "Building",
    floor: "Floor",
    marketed_area: "Available area",
    marketed_area_py: "Available area",
    rent_free: "Rent-free",
    rent_free_months: "Rent-free",
    supported_parking: "Supported parking",
    supported_parking_spaces: "Supported parking",
    floor_plan: "Floor plan",
    parking: "Parking",
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
  referenceNotice: { color: colors.warning, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "600", lineHeight: lineHeight.bodySmall },
  referenceList: { gap: space.tight, marginTop: space.group },
  referenceCard: { backgroundColor: colors.surface2, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, gap: space.tight, padding: space.control },
  referenceBuilding: { color: colors.info, fontFamily: fonts.body, fontSize: type.label, fontWeight: "700", lineHeight: lineHeight.label },
  referenceType: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "600", lineHeight: lineHeight.control },
  referenceSummary: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall },
  taskStack: { gap: space.control, marginTop: space.group },
  actionStack: { gap: space.compact },
  actionCluster: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.compact },
  taskIntro: { maxWidth: layout.taskCopyMax },
  taskLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: 0, marginBottom: space.tight },
  taskTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h3, fontWeight: "600", letterSpacing: tracking.h3, lineHeight: lineHeight.h3 },
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
