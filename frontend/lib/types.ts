export type UserRole = "trainee" | "employer" | "admin";

export type ApiUserRole = "TRAINEE" | "EMPLOYER" | "GOVERNMENT_ADMIN";

export function normalizeRole(role: string): UserRole {
  const value = role.toUpperCase();
  if (value === "EMPLOYER") return "employer";
  if (value === "GOVERNMENT_ADMIN" || value === "ADMIN") return "admin";
  return "trainee";
}

/** Single source of truth for post-login navigation. Takes the BACKEND role. */
export function getDashboardRoute(role: UserRole): string {
  if (role === "employer") return "/employer/dashboard";
  if (role === "admin") return "/dashboard";
  return "/trainee/dashboard";
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorPayload {
  success?: false;
  detail?: string;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  district?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  role?: UserRole;
}

export interface ApiUser {
  id: string;
  role: ApiUserRole;
  email: string;
  full_name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type?: string;
  user: ApiUser;
  expires_at?: string;
}

export type DistrictRiskLevel = "low" | "moderate" | "medium" | "high";

export interface DistrictOutcome {
  id: string;
  name: string;
  trained: number;
  placed: number;
  employed_rate: number;
  retention_6m_rate: number;
  self_employment_rate: number;
  median_wage: number | null;
  top_risk_drivers: string[];
  risk_level: DistrictRiskLevel;
  lat: number | null;
  lng: number | null;
  pending_verification?: number;
  followup_due?: number;
}

export interface TrendPoint {
  label: string;
  total_trained: number;
  employed_rate: number;
  placement_rate?: number;
  retention_6m_rate?: number;
}

export interface ApiTrendPoint {
  month: string;
  trained: number;
  placed: number;
  employed: number;
  eligible_6m: number;
  retained_6m: number;
  placement_rate: number;
  employed_rate: number;
  retention_6m_rate: number;
}

export interface DashboardOverview {
  total_trained: number;
  total_placed: number;
  employed_rate: number;
  retention_6m_rate: number;
  median_monthly_wage: number | null;
  trend: TrendPoint[];
  province: string;
  updated_at: string;
  pending_verification?: number;
  self_employed?: number;
  training_completed?: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
}

export interface TrainingFunnel {
  stages: FunnelStage[];
}

export interface SkillGap {
  skill: string;
  supply: number;
  demand: number;
  gap: number;
  ratio: number;
}

export interface SkillGapSector {
  sector: string;
  skills: SkillGap[];
}

export interface SkillGaps {
  sectors: SkillGapSector[];
}

export interface AttritionReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface AttritionData {
  total: number;
  reasons: AttritionReason[];
}

export type InsightSeverity = "opportunity" | "watch" | "critical";
export type ApiInsightSeverity = "low" | "medium" | "high" | InsightSeverity;

export interface OutcomeInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidence: string;
  recommendation: string;
  metric: string;
  sector: string;
  district: string;
}

export interface ApiInsight {
  id: string;
  severity: ApiInsightSeverity;
  title: string;
  summary: string;
  evidence: Record<string, unknown> | string;
  recommendation: string;
  metric: string;
  sector: string | null;
  district: string | null;
}

export interface InsightsData {
  insights: OutcomeInsight[];
}

export interface ApiDistrictsData {
  districts: DistrictOutcome[];
}

export interface ApiInsightsData {
  insights: ApiInsight[];
}

export interface ApiDashboardData {
  overview: Omit<DashboardOverview, "trend"> & { trend: ApiTrendPoint[] };
  districts: ApiDistrictsData;
  funnel: TrainingFunnel;
  "skill-gaps": SkillGaps;
  attrition: AttritionData;
  insights: ApiInsightsData;
}

export interface DashboardData {
  overview: DashboardOverview;
  districts: DistrictOutcome[];
  funnel: TrainingFunnel;
  "skill-gaps": SkillGaps;
  attrition: AttritionData;
  insights: InsightsData;
}

export type VerificationStatus = "verified" | "pending" | "needs_correction";
export type ApiVerificationStatus =
  | "REPORTED"
  | "PENDING"
  | "VERIFIED"
  | "NEEDS_CORRECTION"
  | "REJECTED";

export interface EmployerTrainee {
  name: string;
  internal_identifier: string;
  district: string;
}

export interface EmployerCourse {
  name: string;
  sector: string;
  pass_year: number | null;
}

export interface ReportedEmployment {
  role: string | null;
  start_date: string | null;
  wage_band: string | null;
  location: string | null;
}

export interface ApiVerificationQueueRow {
  employment_id: string;
  trainee: EmployerTrainee;
  course: EmployerCourse;
  reported: ReportedEmployment;
  status: ApiVerificationStatus;
  confidence: number;
  submitted_at: string;
  employer_confirmed: boolean;
}

export interface VerificationQueueRow
  extends Omit<ApiVerificationQueueRow, "status" | "reported"> {
  reported: {
    role: string;
    start_date: string;
    wage_band: string;
    location: string;
  };
  status: VerificationStatus;
}

export interface VerificationUpdate {
  employment_status: "employed" | "apprenticeship" | "left";
  joining_date: string;
  wage_band: string;
  role: string;
  location: string;
  skill_relevance: number;
  feedback: string;
  correction_reason?: string;
  decision?: "confirm" | "correction" | "reject";
}

export type OutcomeStatus =
  | "employed"
  | "apprenticeship"
  | "self_employed"
  | "seeking_job"
  | "exited";

export type ApiOutcomeType =
  | "EMPLOYED"
  | "SELF_EMPLOYED"
  | "APPRENTICESHIP"
  | "SEEKING_JOB";

export interface OutcomeUpdatePayload {
  status: OutcomeStatus;
  organization?: string;
  role?: string;
  start_date?: string;
  monthly_wage?: number;
  location?: string;
  business_type?: string;
  monthly_revenue?: number;
  employees_created?: number;
  preferred_role?: string;
  preferred_location?: string;
  exit_reason?: string;
  proof_file?: File | null;
}

export interface OutcomeUpdateResult {
  update_id: string;
  status: "submitted" | "verified";
  submitted_at: string;
  message: string;
}

export interface ApiOutcomeSummary {
  id: string;
  outcome_type: ApiOutcomeType;
  status: ApiVerificationStatus;
  role: string | null;
  company_name: string | null;
  start_date: string | null;
  ended_at: string | null;
  wage_value: number | null;
  wage_band: string | null;
  location: string | null;
  business_type: string | null;
  monthly_revenue: number | null;
  employees_created: number | null;
  exit_reason: string | null;
  correction_notes: string | null;
  submitted_at: string;
}

export interface ApiProof {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  description: string | null;
  uploaded_at: string;
}

export interface ApiPassport {
  trainee: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    internal_identifier: string;
    district: string;
    state: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    consent_given: boolean;
    data_processing_allowed: boolean;
    employer_verification_consent?: boolean;
    followup_consent?: boolean;
    email_followup_consent?: boolean;
    whatsapp_followup_consent?: boolean;
  };
  training: {
    id: string;
    course_name: string;
    course_code: string;
    qualification_level: string | null;
    sector: string;
    institution: string;
    district: string;
    duration_weeks: number;
    training_hours: number;
    taught_skills: string[];
    enrollment_status: string;
    pass_year: number | null;
    completed_at: string | null;
    final_score: number | null;
    certificate_number: string | null;
  } | null;
  current_outcome: ApiOutcomeSummary | null;
  confidence_score: 60 | 95;
  confidence_label: "Medium" | "High";
  skill_relevance_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_reasons: string[];
  retention: {
    status: string;
    is_retained: boolean;
    months_in_role: number;
    eligible_for_6m: boolean;
    followup_count: number;
    last_followup_date: string | null;
    next_followup_date: string | null;
  };
  retention_milestones: Array<{
    label: "3M" | "6M" | "12M";
    status: string;
    due_date: string | null;
    evidence_date: string | null;
    evidence: string | null;
  }>;
  wage_progression: Array<{
    employment_id: string;
    start_date: string | null;
    ended_at: string | null;
    wage_value: number | null;
    wage_band: string | null;
    outcome_type: ApiOutcomeType;
  }>;
  next_followup: string | null;
  proof_status: string;
  last_updated: string;
}

export interface CertificateData {
  name: string;
  certificate_id: string;
  issued_at: string;
  status: "verified" | "pending";
}

export interface TraineeProfile {
  id: string;
  name: string;
  internal_identifier: string;
  district: string;
  course: string;
  sector: string;
  passport_id: string;
  verified: boolean;
  training_hours: number;
  certificate: CertificateData;
  employment: {
    type: OutcomeStatus;
    role: string;
    employer: string;
    location: string;
    start_date: string;
  };
  starting_wage: number;
  current_wage: number;
  retention: {
    month_3: number;
    month_6: number;
    month_12: number;
  };
  milestones: Array<{
    label: "3M" | "6M" | "12M";
    status: string;
    due_date: string | null;
  }>;
  skill_relevance: {
    score: number;
    label: string;
    matched_skills: string[];
    role_skills: string[];
  };
  confidence: {
    score: number;
    label: string;
  };
  risk: {
    level: "low" | "medium" | "high";
    summary: string;
  };
  activity: Array<{
    id: string;
    title: string;
    detail: string;
    timestamp: string;
    type: "verified" | "update" | "credential";
  }>;
  updated_at: string;
}

export interface DataSourceState {
  source: "live" | "demo";
  lastUpdated: string;
  message?: string;
}

export interface ConsentPreferences {
  data_processing_allowed: boolean;
  consent_given: boolean;
  employer_verification_consent: boolean;
  followup_consent: boolean;
  email_followup_consent: boolean;
  whatsapp_followup_consent: boolean;
}

export interface ApiFollowup {
  id: string;
  employment_id: string | null;
  status: string;
  scheduled_for: string;
  completed_at: string | null;
  contact_method: string | null;
  channel: string | null;
  notes: string | null;
  next_followup_date: string | null;
  attempt_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  last_error: string | null;
  template: string | null;
  response: string | null;
  responded_at: string | null;
  provider_message_id: string | null;
}

export interface WhatsAppDemoMessage {
  to_masked: string;
  message: string;
  wa_link: string;
  provider: string;
  sent: boolean;
  notice: string;
}

export interface WhatsAppStatus {
  consent: boolean;
  phone_masked: string | null;
  frequency: string;
  next_followup: string | null;
  last_message: string | null;
  provider: string;
}

export interface WhatsAppHistoryItem {
  id: string;
  scheduled_for: string;
  template: string | null;
  status: string;
  display_status: string;
  sent_at: string | null;
  delivered_at: string | null;
  response: string | null;
  responded_at: string | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  template_key: string;
  channel: string;
  body: string;
  variables: string[];
  is_active: boolean;
}

export interface AudienceFilter {
  district?: string;
  course?: string;
  employment_status?: string;
  followup_due?: boolean;
  consent_given?: boolean;
  search?: string;
  trainee_ids?: string[];
}

export interface Campaign {
  id: string;
  name: string;
  template_key: string | null;
  audience_filter: Record<string, unknown> | null;
  channel: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  delay_days: number[];
  is_active: boolean;
  enrolled: number;
  scheduled: number;
  delivered: number;
  failed: number;
  pending: number;
}

export interface OutreachAnalytics {
  active_automations: number;
  total_automations: number;
  enrolled: number;
  messages_scheduled: number;
  delivered: number;
  failed: number;
  pending: number;
  simulated: number;
  next_run: string;
}

export interface TraineeOutreachRow {
  trainee_id: string;
  name: string;
  district: string;
  training: string | null;
  employment: string | null;
  company: string | null;
  next_followup: string | null;
  whatsapp_consent: boolean;
  phone_masked: string | null;
  last_updated: string;
  status: string;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  notifications: ApiNotification[];
  unread_count: number;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  phone?: string;
  district?: string;
  address?: string;
}

export interface ApiEmployerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  organization_name: string;
  organization_type: string | null;
  registration_number: string | null;
  district: string;
  address: string | null;
  website: string | null;
  is_verified: boolean;
}

export interface EmployerProfileUpdatePayload {
  full_name?: string;
  phone?: string;
  organization_name?: string;
  district?: string;
  address?: string;
  website?: string;
}
