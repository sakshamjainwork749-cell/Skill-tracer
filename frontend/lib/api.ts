import type {
  ApiDashboardData,
  ApiEnvelope,
  ApiErrorPayload,
  ApiFollowup,
  ApiInsight,
  ApiEmployerProfile,
  ApiNotification,
  ApiPassport,
  AudienceFilter,
  Automation,
  ApiProof,
  ApiUser,
  ApiVerificationQueueRow,
  ApiVerificationStatus,
  ConsentPreferences,
  DashboardData,
  DistrictOutcome,
  EmployerProfileUpdatePayload,
  LoginCredentials,
  LoginResponse,
  MessageTemplate,
  Campaign,
  NotificationList,
  OutreachAnalytics,
  OutcomeStatus,
  OutcomeUpdatePayload,
  OutcomeUpdateResult,
  ProfileUpdatePayload,
  TraineeOutreachRow,
  WhatsAppHistoryItem,
  WhatsAppStatus,
  TraineeProfile,
  VerificationQueueRow,
  VerificationStatus,
  VerificationUpdate,
  WhatsAppDemoMessage,
} from "./types";
import { normalizeRole } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

const DEFAULT_TIMEOUT_MS = 2200;

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status = 0, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const url = `${API_BASE_URL}${path}`;
    if (path === "/auth/login") {
      console.debug("[API DEBUG] login request started");
      console.debug("[API DEBUG] URL:", url);
    }
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });

    const raw = await response.text();
    if (path === "/auth/login") {
      console.debug("[API DEBUG] response status:", response.status);
      console.debug("[API DEBUG] response body received:", raw.length > 0);
    }
    let payload: ApiEnvelope<T> | ApiErrorPayload | T | undefined;

    if (raw) {
      try {
        payload = JSON.parse(raw) as ApiEnvelope<T> | ApiErrorPayload | T;
      } catch {
        payload = undefined;
      }
    }

    if (!response.ok) {
      const errorPayload = payload as ApiErrorPayload | undefined;
      const rawMessage =
        errorPayload?.detail ||
        errorPayload?.message ||
        errorPayload?.error ||
        `Request failed (${response.status})`;
      if (response.status === 401 && typeof window !== "undefined" && path !== "/auth/login") {
        // Session is invalid: drop it and send the user to sign in.
        // Backend is the source of truth; demo (demo-*) tokens never reach here.
        // A failed /auth/login attempt must never wipe an existing session.
        try {
          window.localStorage.removeItem("skilltrace.session.v1");
        } catch {
          // Storage unavailable; the redirect below still protects the route.
        }
        if (!window.location.pathname.startsWith("/login")) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login";
        }
      }
      // Map status codes to actionable messages for loading/error/empty states.
      // Login failures surface the backend reason (e.g. "Incorrect email or password").
      const friendly =
        response.status === 401 && path !== "/auth/login"
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to perform this action."
            : response.status === 422
              ? rawMessage
              : response.status === 429
                ? "Too many requests. Please wait a moment and try again."
                : response.status >= 500
                  ? "SkillTrace services are temporarily unavailable. Please retry."
                  : rawMessage;
      throw new ApiError(friendly, response.status, errorPayload?.errors);
    }

    if (payload && typeof payload === "object" && "success" in payload) {
      const envelope = payload as ApiEnvelope<T>;
      if (!envelope.success) {
        throw new ApiError(envelope.message || "The request was not successful");
      }
      return envelope.data;
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The service did not respond in time");
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Unable to reach SkillTrace services",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function withAuth(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat("en-IN", { month: "short" })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
};

const statusFromApi = (status: ApiVerificationStatus): VerificationStatus => {
  if (status === "VERIFIED") return "verified";
  if (status === "NEEDS_CORRECTION") return "needs_correction";
  return "pending";
};

const insightSeverity = (severity: string) => {
  if (severity === "high") return "critical" as const;
  if (severity === "low") return "opportunity" as const;
  return "watch" as const;
};

const wageBandFromValue = (value: number | null) => {
  if (value == null) return "Not disclosed";
  if (value < 15000) return "Below ₹15k";
  if (value < 20000) return "₹15k–₹20k";
  if (value < 30000) return "₹20k–₹30k";
  if (value < 40000) return "₹30k–₹40k";
  return "₹40k+";
};

const outcomeTypeToStatus = (type: string): TraineeProfile["employment"]["type"] => {
  if (type === "SELF_EMPLOYED") return "self_employed";
  if (type === "APPRENTICESHIP") return "apprenticeship";
  if (type === "SEEKING_JOB") return "seeking_job";
  return "employed";
};

export function mapPassportToProfile(passport: ApiPassport): TraineeProfile {
  const training = passport.training;
  const outcome = passport.current_outcome;
  const currentWage = outcome?.wage_value ?? 0;
  const previousWage = [...passport.wage_progression]
    .reverse()
    .find((point) => point.employment_id !== outcome?.id)?.wage_value;
  const startingWage = previousWage ?? currentWage;
  const taughtSkills = training?.taught_skills ?? [];
  const role = outcome?.role ?? "Outcome update required";
  const normalizedRoleSkills = role
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 2);
  const matchedSkills = taughtSkills.filter((skill) => {
    const normalized = skill.toLowerCase();
    return (
      normalizedRoleSkills.some(
        (token) => normalized.includes(token) || token.includes(normalized),
      ) || normalized.includes("quality") || normalized.includes("safety")
    );
  });
  const displayedMatched = matchedSkills.length
    ? matchedSkills
    : taughtSkills.slice(0, 4);

  return {
    id: passport.trainee.id,
    name: passport.trainee.full_name,
    internal_identifier: passport.trainee.internal_identifier,
    district: passport.trainee.district,
    course: training
      ? `${training.course_name} – ${training.training_hours} hrs`
      : "Training record not available",
    sector: training?.sector ?? "General",
    passport_id: `ST-PASSPORT-${passport.trainee.internal_identifier.slice(-8)}`,
    verified: Boolean(training?.certificate_number && passport.proof_status),
    training_hours: training?.training_hours ?? 0,
    certificate: {
      name: training?.qualification_level
        ? `${training.qualification_level} · ${training.course_name}`
        : training?.course_name ?? "Course certification",
      certificate_id: training?.certificate_number ?? "Pending",
      issued_at: training?.completed_at ?? "",
      status: training?.certificate_number ? "verified" : "pending",
    },
    employment: {
      type: outcomeTypeToStatus(outcome?.outcome_type ?? "SEEKING_JOB"),
      role: outcome?.role ?? "Seeking opportunity",
      employer:
        outcome?.company_name ||
        (outcome?.outcome_type === "SELF_EMPLOYED"
          ? outcome.business_type || "Independent enterprise"
          : "Seeking opportunity"),
      location: outcome?.location ?? passport.trainee.district,
      start_date: outcome?.start_date ?? "",
    },
    starting_wage: startingWage,
    current_wage: currentWage,
    retention: {
      month_3: passport.retention_milestones.find((item) => item.label === "3M")?.status === "RETAINED" ? 100 : 0,
      month_6: passport.retention_milestones.find((item) => item.label === "6M")?.status === "RETAINED" ? 100 : 0,
      month_12: passport.retention_milestones.find((item) => item.label === "12M")?.status === "RETAINED" ? 100 : 0,
    },
    milestones: passport.retention_milestones.map((item) => ({
      label: item.label,
      status: item.status,
      due_date: item.due_date,
    })),
    skill_relevance: {
      score: passport.skill_relevance_score,
      label:
        passport.skill_relevance_score >= 80
          ? "High relevance"
          : passport.skill_relevance_score >= 60
            ? "Good relevance"
            : "Needs validation",
      matched_skills: displayedMatched.slice(0, 4),
      role_skills: displayedMatched,
    },
    confidence: {
      score: passport.confidence_score,
      label: `${passport.confidence_label} – ${
        passport.confidence_score === 95 ? "Verified" : "Self reported"
      }`,
    },
    risk: {
      level: passport.risk_level.toLowerCase() as TraineeProfile["risk"]["level"],
      summary: passport.risk_reasons.join(". "),
    },
    activity: [
      {
        id: `outcome-${outcome?.id ?? "none"}`,
        title:
          outcome?.status === "VERIFIED"
            ? "Employment verified by employer"
            : "Outcome update recorded",
        detail: outcome?.status === "VERIFIED"
          ? `${outcome.company_name ?? "Your employer"} confirmed your role and wage band.`
          : "Your latest work status is waiting for authorised verification.",
        timestamp: outcome?.submitted_at ?? passport.last_updated,
        type: outcome?.status === "VERIFIED" ? "verified" : "update",
      },
      ...(passport.retention.eligible_for_6m
        ? [
            {
              id: `retention-${passport.retention.last_followup_date ?? "6m"}`,
              title: "Six-month retention follow-up",
              detail: `Outcome reviewed after ${passport.retention.months_in_role} months in role.`,
              timestamp: passport.last_updated,
              type: "update" as const,
            },
          ]
        : []),
      ...(training?.certificate_number
        ? [
            {
              id: `certificate-${training.id}`,
              title: "Training certification verified",
              detail: `${training.training_hours} training hours are now part of the Outcome Passport.`,
              timestamp: `${training.completed_at ?? passport.last_updated}T09:00:00.000Z`,
              type: "credential" as const,
            },
          ]
        : []),
    ],
    updated_at: passport.last_updated,
  };
}

export function mapApiDashboard(response: ApiDashboardData): DashboardData {
  const overview = response.overview;
  const monthlyTraining = new Map(
    overview.trend.map((point) => [point.month, point.trained]),
  );

  return {
    overview: {
      total_trained: overview.total_trained,
      total_placed: overview.total_placed,
      employed_rate: overview.employed_rate,
      retention_6m_rate: overview.retention_6m_rate,
      median_monthly_wage: overview.median_monthly_wage ?? 0,
      province: overview.province,
      updated_at: overview.updated_at,
      pending_verification: overview.pending_verification ?? 0,
      self_employed: overview.self_employed ?? 0,
      training_completed: overview.training_completed ?? 0,
      trend: overview.trend.map((point) => {
        return {
          label: monthLabel(point.month),
          total_trained: monthlyTraining.get(point.month) ?? 0,
          placement_rate: point.placement_rate,
          employed_rate: point.employed_rate,
          retention_6m_rate: point.retention_6m_rate,
        };
      }),
    },
    districts: response.districts.districts.map(
      (district): DistrictOutcome => ({
        ...district,
        risk_level: district.risk_level.toLowerCase() as DistrictOutcome["risk_level"],
        median_wage: district.median_wage ?? 0,
        lat: district.lat ?? 0,
        lng: district.lng ?? 0,
        self_employment_rate: district.self_employment_rate,
      }),
    ),
    funnel: response.funnel,
    "skill-gaps": response["skill-gaps"],
    attrition: response.attrition,
    insights: {
      insights: response.insights.insights.map((insight: ApiInsight) => ({
        id: insight.id,
        severity: insightSeverity(insight.severity),
        title: insight.title,
        summary: insight.summary,
        evidence:
          typeof insight.evidence === "string"
            ? insight.evidence
            : JSON.stringify(insight.evidence, null, 2),
        recommendation: insight.recommendation,
        metric: insight.metric,
        sector: insight.sector ?? "Cross-sector",
        district: insight.district ?? "Maharashtra",
      })),
    },
  };
}

export function mapQueueRow(row: ApiVerificationQueueRow): VerificationQueueRow {
  return {
    ...row,
    reported: {
      role: row.reported.role ?? "Role not provided",
      start_date: row.reported.start_date ?? "",
      wage_band: row.reported.wage_band ?? "Not disclosed",
      location: row.reported.location ?? "Not provided",
    },
    status: statusFromApi(row.status),
  };
}

const outcomeTypeFromStatus = (status: OutcomeStatus) => {
  if (status === "apprenticeship") return "APPRENTICESHIP" as const;
  if (status === "self_employed") return "SELF_EMPLOYED" as const;
  if (status === "seeking_job" || status === "exited") return "SEEKING_JOB" as const;
  return "EMPLOYED" as const;
};

export const api = {
  async login(credentials: LoginCredentials) {
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now() % 100000);
    console.debug("[API DEBUG] request id:", requestId);
    const result = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      timeoutMs: 3500,
    });
    console.debug("[API DEBUG] login success:", !!result?.access_token);
    return result;
  },

  async getDashboard(
    params?: { district?: string; period?: string; startDate?: string; endDate?: string },
    token?: string | null,
  ) {
    const query = buildQuery({
      district: params?.district,
      period: params?.period,
      start_date: params?.startDate,
      end_date: params?.endDate,
    });
    const [overview, districts, funnel, skillGaps, attrition, insights] =
      await Promise.all([
        request<ApiDashboardData["overview"]>(`/analytics/overview${query}`, {
          headers: withAuth(token),
        }),
        request<ApiDashboardData["districts"]>(`/analytics/districts${query}`, {
          headers: withAuth(token),
        }),
        request<ApiDashboardData["funnel"]>(`/analytics/funnel${query}`, {
          headers: withAuth(token),
        }),
        request<ApiDashboardData["skill-gaps"]>(`/analytics/skill-gaps${query}`, {
          headers: withAuth(token),
        }),
        request<ApiDashboardData["attrition"]>(`/analytics/attrition${query}`, {
          headers: withAuth(token),
        }),
        request<ApiDashboardData["insights"]>(`/analytics/insights${query}`, {
          headers: withAuth(token),
        }),
      ]);
    return mapApiDashboard({
      overview,
      districts,
      funnel,
      "skill-gaps": skillGaps,
      attrition,
      insights,
    });
  },

  async getTraineePassport(token?: string | null) {
    return request<ApiPassport>("/trainees/me/passport", {
      headers: withAuth(token),
    });
  },

  /** Role-neutral session validation. Works for TRAINEE, EMPLOYER and GOVERNMENT_ADMIN. */
  async getCurrentUser(token?: string | null) {
    return request<ApiUser>("/auth/me", {
      headers: withAuth(token),
    });
  },

  async getMyFollowups(token?: string | null) {
    return request<ApiFollowup[]>("/trainees/me/followups", {
      headers: withAuth(token),
    });
  },

  async getWhatsAppDemoMessage(token?: string | null) {
    return request<WhatsAppDemoMessage>("/trainees/me/followups/demo-message", {
      method: "POST",
      headers: withAuth(token),
    });
  },

  async getWhatsAppStatus(token?: string | null) {
    return request<WhatsAppStatus>("/notifications/whatsapp/status", {
      headers: withAuth(token),
    });
  },

  async setWhatsAppConsent(consent: boolean, token?: string | null) {
    return request<{ whatsapp_followup_consent: boolean; cancelled_future: number }>(
      "/trainees/me/whatsapp-consent",
      {
        method: "PATCH",
        body: JSON.stringify({ consent_given: consent }),
        headers: withAuth(token),
      },
    );
  },

  async setWhatsAppNumber(phone: string, token?: string | null) {
    return request<{ phone_saved: boolean; phone_suffix: string }>(
      "/trainees/me/whatsapp-number",
      {
        method: "PATCH",
        body: JSON.stringify({ phone }),
        headers: withAuth(token),
      },
    );
  },

  async getWhatsAppHistory(token?: string | null) {
    return request<WhatsAppHistoryItem[]>("/trainees/me/whatsapp/history", {
      headers: withAuth(token),
    });
  },

  async demoSendWhatsApp(token?: string | null) {
    return request<{ followup_id: string; status: string; simulated: boolean; sent: boolean; notice: string }>(
      "/trainees/me/followups/demo-send",
      {
        method: "POST",
        headers: withAuth(token),
      },
    );
  },

  // ---- government outreach (admin JWT required) ----

  async getOutreachAnalytics(token?: string | null) {
    return request<OutreachAnalytics>("/admin/messaging/analytics", {
      headers: withAuth(token),
    });
  },

  async getMessageTemplates(token?: string | null) {
    return request<MessageTemplate[]>("/admin/messaging/templates", {
      headers: withAuth(token),
    });
  },

  async createMessageTemplate(
    payload: { name: string; template_key: string; body: string; variables?: string[] },
    token?: string | null,
  ) {
    return request<MessageTemplate>("/admin/messaging/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: withAuth(token),
    });
  },

  async getCampaigns(token?: string | null) {
    return request<Campaign[]>("/admin/messaging/campaigns", {
      headers: withAuth(token),
    });
  },

  async previewAudience(filter: AudienceFilter, token?: string | null) {
    return request<{ eligible: number; consent_available: number; excluded: number; total: number; sample: string[] }>(
      "/admin/messaging/audience/preview",
      {
        method: "POST",
        body: JSON.stringify(filter),
        headers: withAuth(token),
      },
    );
  },

  async createCampaign(
    payload: { name: string; template_key: string; audience?: AudienceFilter; scheduled_at?: string },
    token?: string | null,
  ) {
    return request<Campaign>("/admin/messaging/campaigns", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: withAuth(token),
    });
  },

  async scheduleCampaign(campaignId: string, token?: string | null) {
    return request<{ jobs: number; campaign: Campaign }>(
      `/admin/messaging/campaigns/${campaignId}/schedule`,
      {
        method: "POST",
        headers: withAuth(token),
      },
    );
  },

  async runCampaignDemo(campaignId: string, token?: string | null) {
    return request<{ checked: number; sent: number; failed: number; cancelled: number; campaign: Campaign }>(
      `/admin/messaging/campaigns/${campaignId}/run-demo`,
      {
        method: "POST",
        headers: withAuth(token),
      },
    );
  },

  async cancelCampaign(campaignId: string, token?: string | null) {
    return request<Campaign>(`/admin/messaging/campaigns/${campaignId}/cancel`, {
      method: "POST",
      headers: withAuth(token),
    });
  },

  async getAutomations(token?: string | null) {
    return request<Automation[]>("/admin/messaging/automations", {
      headers: withAuth(token),
    });
  },

  async createAutomation(
    payload: { name: string; trigger_type?: string; delay_days?: number[]; template_key?: string },
    token?: string | null,
  ) {
    return request<Automation>("/admin/messaging/automations", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: withAuth(token),
    });
  },

  async updateAutomation(
    automationId: string,
    payload: { name?: string; is_active?: boolean; delay_days?: number[] },
    token?: string | null,
  ) {
    return request<Automation>(`/admin/messaging/automations/${automationId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: withAuth(token),
    });
  },

  async getOutreachTrainees(params: Record<string, string | undefined>, token?: string | null) {
    const query = buildQuery(params);
    return request<{ rows: TraineeOutreachRow[]; counts: { eligible: number; excluded: number; total: number } }>(
      `/admin/messaging/trainees${query}`,
      {
        headers: withAuth(token),
      },
    );
  },

  async getOutreachTrainee(traineeId: string, token?: string | null) {
    return request<{
      profile: TraineeOutreachRow;
      outcomes: Array<Record<string, unknown>>;
      followups: Array<Record<string, unknown>>;
    }>(`/admin/messaging/trainees/${traineeId}`, {
      headers: withAuth(token),
    });
  },

  async sendOneMessage(traineeId: string, templateKey: string, token?: string | null) {
    return request<{ job_id: string; status: string; simulated: boolean; notice: string }>(
      "/admin/messaging/send-one",
      {
        method: "POST",
        body: JSON.stringify({ trainee_id: traineeId, template_key: templateKey }),
        headers: withAuth(token),
      },
    );
  },

  async runSchedulerNow(token?: string | null) {
    return request<{ started: number; checked: number; sent: number; failed: number; cancelled: number }>(
      "/admin/messaging/run-scheduler",
      {
        method: "POST",
        headers: withAuth(token),
      },
    );
  },

  async getMyProofs(token?: string | null) {
    return request<ApiProof[]>("/trainees/me/proofs", {
      headers: withAuth(token),
    });
  },

  async getNotifications(token?: string | null) {
    return request<NotificationList>("/notifications", {
      headers: withAuth(token),
    });
  },

  async markNotificationRead(notificationId: string, token?: string | null) {
    return request<ApiNotification>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: withAuth(token),
    });
  },

  async updateProfile(payload: ProfileUpdatePayload, token?: string | null) {
    return request<ApiUser & { phone?: string | null } & Record<string, unknown>>(
      "/trainees/me/profile",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: withAuth(token),
      },
    );
  },

  async updateConsent(preferences: Partial<ConsentPreferences>, token?: string | null) {
    return request<ConsentPreferences>("/trainees/me/consent", {
      method: "PATCH",
      body: JSON.stringify(preferences),
      headers: withAuth(token),
    });
  },

  async exportReport(
    params?: { district?: string; period?: string; startDate?: string; endDate?: string; lens?: string; format?: "csv" | "pdf" },
    token?: string | null,
  ) {
    const query = buildQuery({
      district: params?.district,
      period: params?.period,
      start_date: params?.startDate,
      end_date: params?.endDate,
      lens: params?.lens,
    });
    const endpoint = params?.format === "pdf" ? "/analytics/export-pdf" : "/analytics/export";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}${query}`, {
        headers: {
          Accept: params?.format === "pdf" ? "application/pdf" : "text/csv",
          ...withAuth(token),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined"
            && !window.location.pathname.startsWith("/login")) {
          try {
            window.localStorage.removeItem("skilltrace.session.v1");
          } catch { /* ignore */ }
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login";
        }
        throw new ApiError(
          response.status === 403
            ? "You do not have permission to perform this action."
            : `Export failed (${response.status})`,
          response.status,
        );
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename=([^;]+)/);
      return { blob, filename: (match?.[1] ?? "").trim() || "skilltrace-report" };
    } finally {
      clearTimeout(timeout);
    }
  },

  async getTraineeProfile(token?: string | null) {
    return mapPassportToProfile(await api.getTraineePassport(token));
  },

  async uploadProof(file: File, token?: string | null) {
    const form = new FormData();
    form.append("file", file);
    return request<ApiProof>("/trainees/me/proofs", {
      method: "POST",
      body: form,
      headers: withAuth(token),
      timeoutMs: 5000,
    });
  },

  async submitOutcome(
    payload: OutcomeUpdatePayload,
    token?: string | null,
    followupToken?: string | null,
  ): Promise<OutcomeUpdateResult> {
    const outcomeType = outcomeTypeFromStatus(payload.status);
    let proofId: string | undefined;
    if (payload.proof_file) {
      const proof = await api.uploadProof(payload.proof_file, token);
      proofId = proof.id;
    }

    const body: Record<string, unknown> = { outcome_type: outcomeType };
    if (payload.role) body.role = payload.role;
    if (payload.preferred_role) body.role = payload.preferred_role;
    if (payload.preferred_location) body.location = payload.preferred_location;
    if (payload.organization) body.company_name = payload.organization;
    if (payload.start_date) body.start_date = payload.start_date;
    if (payload.monthly_wage != null) body.wage_value = payload.monthly_wage;
    if (payload.location) body.location = payload.location;
    if (payload.business_type) body.business_type = payload.business_type;
    if (payload.monthly_revenue != null) body.monthly_revenue = payload.monthly_revenue;
    if (payload.employees_created != null) body.employees_created = payload.employees_created;
    if (payload.exit_reason) body.exit_reason = payload.exit_reason;
    if (proofId) body.proof_id = proofId;

    const record = await request<{
      id: string;
      submitted_at: string;
      status: ApiVerificationStatus;
    }>(`/trainees/me/outcomes${followupToken ? `?followup_token=${encodeURIComponent(followupToken)}` : ""}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: withAuth(token),
      timeoutMs: 5000,
    });

    return {
      update_id: record.id,
      status: record.status === "VERIFIED" ? "verified" : "submitted",
      submitted_at: record.submitted_at,
      message: "Outcome recorded and follow-up scheduled.",
    };
  },

  async getVerificationQueue(token?: string | null) {
    console.debug("[EMPLOYER QUEUE] request started");
    try {
      const rows = await request<ApiVerificationQueueRow[]>(
        "/employer/verification-queue",
        { headers: withAuth(token) },
      );
      console.debug("[EMPLOYER QUEUE] response status:", 200);
      console.debug("[EMPLOYER QUEUE] rendered records count:", rows.length);
      return rows.map(mapQueueRow);
    } catch (caught) {
      console.debug(
        "[EMPLOYER QUEUE] response status:",
        caught instanceof ApiError ? caught.status : 0,
      );
      throw caught;
    }
  },

  async updateVerification(
    employmentId: string,
    update: VerificationUpdate,
    token?: string | null,
  ) {
    const status = update.decision === "reject"
      ? "Rejected"
      : update.correction_reason
        ? "Needs Correction"
        : "Verified";
    const body: Record<string, unknown> = {
      status,
      role: update.role,
      start_date: update.joining_date,
      wage_band: update.wage_band,
      location: update.location,
      rating: update.skill_relevance,
      notes: update.feedback,
      skill_alignment_feedback: {
        overall_alignment: update.skill_relevance,
        aligned_skills: [],
        missing_skills: update.correction_reason ? [update.correction_reason] : [],
        additional_comments: update.feedback,
      },
    };
    if (update.correction_reason) body.notes = update.correction_reason;
    return request<{
      employment_id: string;
      status: ApiVerificationStatus;
      verified_at: string | null;
    }>(`/employer/verifications/${employmentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: withAuth(token),
      timeoutMs: 4500,
    });
  },

  async getEmployerProfile(token?: string | null) {
    return request<ApiEmployerProfile>("/employer/me", {
      headers: withAuth(token),
    });
  },

  async updateEmployerProfile(payload: EmployerProfileUpdatePayload, token?: string | null) {
    return request<ApiEmployerProfile>("/employer/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: withAuth(token),
    });
  },

  normalizeRole,
  wageBandFromValue,
};

export function isOfflineError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 0 || error.status >= 500 || error.message.includes("respond"))
  );
}
