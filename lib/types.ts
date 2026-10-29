export type Role = "client" | "staff" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  client_id: string | null;
  notify_email?: boolean;
  must_change_password?: boolean;
};

export type TeamMember = {
  id: string;
  full_name: string;
  title: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  calendly_url: string | null;
  is_admin_contact: boolean;
  active: boolean;
};

export type Health = "on_track" | "needs_attention" | "at_risk" | "on_hold";

export type Client = {
  id: string;
  name: string;
  slug: string;
  status: string;
  health: Health;
  summary: string;
  approach: string;
  expectations: string;
  priorities: string[];
  engagement_owner_id: string | null;
  spoc_id: string | null;
  slack_channel: string | null;
  last_updated_at: string;
  next_update_due: string | null;
  phases: string[];
  welcome_note: string;
  current_phase: number;
  created_at: string;
};

export type ClientTeamRow = {
  id: string;
  client_id: string;
  team_member_id: string;
  engagement_role: string;
  contact_for: string;
  sort_order: number;
  team_members: TeamMember;
};

export type DocCategory =
  "NDA" | "MSA" | "SOW" | "Onboarding" | "Invoice" | "Report" | "Other";
export const DOC_CATEGORIES: DocCategory[] = [
  "NDA",
  "MSA",
  "SOW",
  "Onboarding",
  "Invoice",
  "Report",
  "Other",
];

export type DocumentRow = {
  id: string;
  client_id: string;
  title: string;
  category: DocCategory;
  storage_path: string;
  file_name: string;
  file_size: number;
  published: boolean;
  is_signed: boolean;
  created_at: string;
};

export type UpdateKind =
  "milestone" | "completed" | "ongoing" | "update" | "change";
export const UPDATE_KINDS: UpdateKind[] = [
  "milestone",
  "completed",
  "ongoing",
  "update",
  "change",
];

export type UpdateRow = {
  id: string;
  client_id: string;
  kind: UpdateKind;
  title: string;
  body: string;
  occurred_on: string;
  published: boolean;
};

export type ProgressStatus =
  "completed" | "in_progress" | "upcoming" | "pending" | "next_step";
export const PROGRESS_STATUSES: ProgressStatus[] = [
  "next_step",
  "in_progress",
  "upcoming",
  "pending",
  "completed",
];

export type ProgressItem = {
  id: string;
  client_id: string;
  status: ProgressStatus;
  title: string;
  detail: string;
  due_date: string | null;
  owner_name: string | null;
  updated_at: string;
};

export type Meeting = {
  id: string;
  client_id: string;
  title: string;
  starts_at: string;
  location: string | null;
  agenda: string;
  notes: string;
};

export type QueryRow = {
  id: string;
  client_id: string;
  created_by: string;
  subject: string;
  category: string;
  status: "open" | "answered" | "closed";
  created_at: string;
};

export type QueryMessage = {
  id: string;
  query_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string; role: Role } | null;
};

export const QUERY_CATEGORIES = [
  "General",
  "Project / delivery",
  "Documents / legal",
  "Billing / invoices",
  "Scheduling / meetings",
  "Access / technical",
];
