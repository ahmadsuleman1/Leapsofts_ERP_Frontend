import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Checkbox,
  TextField,
  Link,
  Divider,
  useTheme,
  FormControlLabel,
  Switch,
  InputAdornment,
  IconButton,
  Grid,
  MenuItem,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useUsers } from '@/hooks/api/useUsers';
import { useInvoices } from '@/hooks/api/useInvoices';
import { useKanbanBoards } from '@/hooks/api/useKanban';
import { useReport } from '@/hooks/api/useReports';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import DownloadIcon from '@mui/icons-material/Download';
import api from '@/lib/axios';
import { DEPARTMENT_OPTIONS } from '@/lib/constants';
import {
  useConfirmAiAction,
  useRejectAiAction,
  type AiPendingAction,
} from '@/hooks/api/useAi';
import { useUIStore } from '@/store/useUIStore';
import { showApiError } from '@/utils/apiError';
import { tokens } from '@/styles/tokens';
import { useCalendarStatus, useCalendarAuthUrl, openCalendarOAuthPopup } from '@/hooks/api/useCalendar';
import { useAuthStore } from '@/store/useAuthStore';
import {
  formatMeetingInstant,
  getDefaultMeetingTimeZone,
  utcToWallClock,
} from '@/utils/meetingTimezone';

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  prospectName: 'Prospect Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  jobTitle: 'Job Title',
  website: 'Website',
  industry: 'Industry',
  location: 'Location',
  companySize: 'Company Size',
  profileUrl: 'LinkedIn URL',
  icp: 'ICP',
  profile: 'Profile',
  notes: 'Notes',
  channel: 'Channel',
  futureLeadDate: 'Future lead date',
  leadCommentText: 'Invalid-lead comment',
  leadCommentLevel: 'Comment level',
  coldCallingOutreachStatus: 'Cold call — dial status',
  coldCallingResponseStatus: 'Cold call — response',
  coldCallingFutureLeadAt: 'Cold call — future date',
  note: 'Follow-up note',
  number: 'Follow-up #',
  followUpCount: 'Current follow-up #',
  name: 'Name',
  notificationBroadcastEnabled: 'Notification broadcast',
  automatedUserReportSchedule: 'Automated user reports',
  notificationPreferences: 'Notification preferences',
  aiSettings: 'AI defaults',
  connectionStatus: 'Connection Status',
  messageStatus: 'Message Status',
  bio: 'Bio',
  shiftStart: 'Shift Start',
  shiftEnd: 'Shift End',
  title: 'Title',
  scheduledAt: 'Scheduled Time (UTC)',
  scheduledAtLocal: 'Scheduled Time (your timezone)',
  description: 'Description',
  meetingLink: 'Meeting Link',
  participantNames: 'Participants',
  guestEmails: 'External guest emails',
  timeZone: 'Timezone',
  durationMinutes: 'Duration (minutes)',
  sendGoogleInvite: 'Google Calendar',
  assignees: 'Assignees',
  schedule: 'Schedule',
  days: 'Days',
  repeat: 'Repeat',
  scheduleMode: 'Task layout',
  startTime: 'Start time',
  endTime: 'End time',
  template: 'KPI template',
  itemCount: 'Items',
  itemSummary: 'Item details',
  metric: 'Metric',
  taskTitle: 'Task Title',
  parentTask: 'Parent Task',
  board: 'Board',
  column: 'Column',
  columnId: 'Column',
  priority: 'Priority',
  dueDate: 'Due Date',
  assignedTo: 'Assigned To',
  invoice: 'Invoice',
  effect: 'What happens',
  emailsClient: 'Emails the client',
  lines: 'Line items',
  sendsEmail: 'Email',
  issueDate: 'Issue date',
  client: 'Client',
  cardId: 'Card ID',
  projectId: 'Project ID',
  boardId: 'Board ID',
  tags: 'Tags',
  status: 'Status',
  role: 'Role',
  member: 'Team Member',
  project: 'Project',
  columns: 'Columns',
  isDone: 'Done',
};

const SOURCE_TIER_LABELS: Record<string, string> = {
  discovered_page: 'Discovered page',
  web_search: 'Web search',
  provider: 'Provider',
  generic_inbox: 'Generic inbox',
};

const HIDDEN_PROPOSED_KEYS = new Set([
  'participants',
  'googleCalendarConnected',
  'sendGoogleInvite',
  'scheduledAt',
  'operation',
  'items',
  // Immutable system IDs:
  'cardId',
  'subtaskId',
  'projectId',
  'boardId',
  'targetId',
  'userId',
  'clientId',
  'templateId',
  'meetingId',
  'reportId',
  'leadId',
  'teamId',
  'invoiceId',
  '_id',
  'id',
  '_leadInput',
  '_settingsPatch',
]);

const isArrayOfObjects = (value: unknown): boolean =>
  Array.isArray(value)
  && value.length > 0
  && value.every((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry));

const formatProposedFieldValue = (
  fieldKey: string,
  value: unknown,
  action: AiPendingAction,
  user?: { timezone?: string; timeZone?: string; organization?: { timezone?: string } },
): string => {
  if (fieldKey === 'guestEmails' && Array.isArray(value)) {
    return value.map((e) => String(e)).join(', ');
  }
  if (fieldKey === 'itemSummary' && Array.isArray(value)) {
    return value.map((line) => String(line)).join('\n');
  }
  if (
    (fieldKey === 'columnId' || fieldKey.endsWith('Id')) &&
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value.trim())
  ) {
    return `#${value.trim().slice(-4)}`;
  }
  if (isArrayOfObjects(value)) {
    const rows = value as Array<Record<string, unknown>>;
    const lines = rows.map((row) => {
      const name = typeof row.name === 'string' ? row.name : 'Item';
      const metric = typeof row.metric === 'string' ? row.metric.replace(/_/g, ' ') : '';
      const days = Array.isArray(row.daysOfWeek)
        ? (row.daysOfWeek as number[]).join(', ')
        : '';
      const parts = [name, metric, days].filter(Boolean);
      return parts.join(' — ');
    });
    return lines.length > 0 ? lines.join('\n') : '';
  }
  if (Array.isArray(value)) {
    return value.map((e) => String(e)).join(', ');
  }
  if (fieldKey === 'scheduledAtLocal' && typeof value === 'string') {
    return value;
  }
  if (fieldKey === 'scheduledAt' && typeof value === 'string') {
    const tz = String(
      action.proposed.timeZone || getDefaultMeetingTimeZone(user),
    );
    return utcToWallClock(value, tz);
  }
  if ((fieldKey === 'client' || fieldKey === 'clientSnapshot') && value !== null && typeof value === 'object') {
    const c = value as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name : '';
    const email = typeof c.email === 'string' && c.email ? ` · ${c.email}` : '';
    return name ? `${name}${email}` : JSON.stringify(value);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const ACTION_TYPE_TITLES: Record<AiPendingAction['actionType'], string> = {
  enrich_lead: 'AI Lead Enrichment Preview',
  create_lead: 'Create Lead Proposal',
  update_lead: 'Lead Edit Proposal',
  log_lead_follow_up: 'Log LinkedIn Follow-up',
  add_lead_comment: 'Add Lead Comment',
  update_lead_comment: 'Update Lead Comment',
  qualify_lead: 'Qualify Lead',
  disqualify_lead: 'Disqualify Lead',
  export_leads: 'Export Leads (Excel)',
  update_user: 'User Profile Edit Proposal',
  create_user: 'Create User / Member',
  add_team_member: 'Add Team Member',
  create_meeting: 'Meeting Booking Proposal',
  update_meeting: 'Update Meeting',
  generate_report: 'Generate Formal Report',
  create_kpi: 'Create KPI',
  update_kpi: 'Update KPI',
  assign_kpi_template: 'Assign standalone KPI template',
  create_sales_kpi_template: 'Create sales KPI template',
  update_sales_kpi_template: 'Update sales KPI template',
  assign_sales_kpi_template: 'Assign sales KPI template',
  create_invoice: 'Create invoice',
  update_invoice: 'Update invoice',
  send_invoice: 'Send invoice',
  send_invoice_reminder: 'Send invoice reminder',
  mark_invoice_paid: 'Mark invoice paid',
  dispute_invoice: 'Dispute invoice',
  create_kanban_card: 'Create board card',
  move_kanban_card: 'Move board card',
  update_kanban_card: 'Update board card',
  create_kanban_subtask: 'Create Subtask',
  update_kanban_subtask: 'Update Subtask',
  assign_kanban_subtask: 'Assign Subtask',
  create_project: 'Create Project',
  update_project: 'Update Project',
  add_project_member: 'Assign Project Member',
  create_kanban_board: 'Create Kanban Board',
  update_kanban_board: 'Update Kanban Board',
  assign_kanban_card: 'Assign Task Card',
  create_icp: 'Add ICP',
  rename_icp: 'Rename ICP',
  remove_icp: 'Remove ICP',
  create_profile: 'Add sales profile',
  rename_profile: 'Rename sales profile',
  remove_profile: 'Remove sales profile',
  update_org_settings: 'Update organization settings',
};

const EMAILS_CLIENT = new Set<AiPendingAction['actionType']>([
  'send_invoice',
  'send_invoice_reminder',
  'mark_invoice_paid',
]);

const DEFAULT_DUE_TIME = '23:59';

const parseDueParts = (iso?: string) => {
  if (!iso) return { date: '', time: '' };
  const trimmed = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { date: trimmed, time: DEFAULT_DUE_TIME };
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    const parts = String(iso).split('T');
    return { date: parts[0] || '', time: parts[1]?.slice(0, 5) || '' };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const time = hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : DEFAULT_DUE_TIME;
  return { date, time };
};

const combineDueDateTime = (dateStr: string, timeStr?: string): string => {
  if (!dateStr) return '';
  const time = timeStr?.trim() || DEFAULT_DUE_TIME;
  return `${dateStr}T${time}:00`;
};

const formatDueDateTimeDisplay = (val?: string): string => {
  if (!val) return 'No due date';
  const { date, time } = parseDueParts(val);
  if (!date) return 'No due date';
  const d = new Date(`${date}T${time || DEFAULT_DUE_TIME}:00`);
  const dateFormatted = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!time || time === '23:59') {
    return `${dateFormatted} (End of day)`;
  }
  const timeFormatted = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateFormatted} • ${timeFormatted}`;
};

interface AiActionPreviewCardProps {
  action: AiPendingAction;
  onConfirmed?: (action: AiPendingAction, entityResult: unknown) => void;
}

const ReportDownloadBox = ({ reportId }: { reportId: string }) => {
  const { data: report, isLoading } = useReport(reportId);
  const status = report?.status;

  if (isLoading || status === 'pending' || status === 'processing' || !status) {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Generating report PDF &amp; Excel...
        </Typography>
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
          {report?.error || 'Report generation failed.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <ReportExportButton reportId={reportId} />
    </Box>
  );
};

const LeadExportDownloadBox = ({ applied }: { applied: Record<string, unknown> }) => {
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setErrorMsg(null);
      const scope = applied.scope === 'all' ? 'all' : 'filtered';
      const fields = Array.isArray(applied.fields) ? applied.fields : ['firstName', 'lastName', 'email', 'icp', 'profile'];
      const filters = applied.filters && typeof applied.filters === 'object' ? applied.filters : undefined;
      const res = await api.post(
        '/leads/export',
        { scope, format: 'xlsx', fields, ...(filters ? { filters } : {}) },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      let msg = 'Failed to download leads export.';
      const respData = (err as { response?: { data?: unknown } })?.response?.data;
      if (respData instanceof Blob) {
        try {
          const text = await respData.text();
          const parsed = JSON.parse(text) as { message?: string; error?: { message?: string } };
          msg = parsed?.error?.message || parsed?.message || msg;
        } catch {
          // keep fallback
        }
      }
      setErrorMsg(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleDownload}
        disabled={downloading}
        fullWidth
        sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 650 }}
      >
        {downloading ? 'Preparing Excel...' : 'Download Leads (.xlsx)'}
      </Button>
      {errorMsg && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {errorMsg}
        </Typography>
      )}
    </Box>
  );
};

export const AiActionPreviewCard = ({
  action,
  onConfirmed,
}: AiActionPreviewCardProps) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const addToast = useUIStore((s) => s.addToast);
  const confirmAction = useConfirmAiAction();
  const rejectAction = useRejectAiAction();
  const { data: calendarStatus } = useCalendarStatus();
  const calendarAuth = useCalendarAuthUrl();
  const calendarConnected = calendarStatus?.connected === true;
  const user = useAuthStore((s) => s.user);
  const meetingTimeZone =
    action.actionType === 'create_meeting'
      ? String(action.proposed.timeZone || getDefaultMeetingTimeZone(user ?? undefined))
      : '';
  const [emailAck, setEmailAck] = useState(false);

  const proposedEntries = useMemo(() => {
    const contactFirst = ['email', 'phone'];
    return Object.entries(action.proposed || {})
      .filter(([k, v]) => {
        if (HIDDEN_PROPOSED_KEYS.has(k)) return false;
        if (v === undefined || v === null) return false;
        if (isArrayOfObjects(v)) {
          if (k === 'items' && Array.isArray(action.proposed.itemSummary)) return false;
          return (v as unknown[]).length > 0;
        }
        if (Array.isArray(v)) return v.length > 0;
        const text = String(v).trim();
        if (text === '[object Object]' || text.startsWith('[object Object]')) return false;
        return text !== '';
      })
      .sort(([a], [b]) => {
        if (action.actionType !== 'enrich_lead') return 0;
        const ai = contactFirst.indexOf(a);
        const bi = contactFirst.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [action.actionType, action.proposed]);

  const isTaskCard =
    action.actionType === 'create_kanban_card' ||
    action.actionType === 'update_kanban_card' ||
    action.actionType === 'create_kanban_subtask' ||
    action.actionType === 'update_kanban_subtask';
  const isAssignTaskCard =
    action.actionType === 'assign_kanban_card' ||
    action.actionType === 'assign_kanban_subtask';
  const isAddProjectMember = action.actionType === 'add_project_member';
  const isQualifyLead = action.actionType === 'qualify_lead';
  const isLeadComment = action.actionType === 'add_lead_comment' || action.actionType === 'update_lead_comment';
  const isUserAction = action.actionType === 'create_user' || action.actionType === 'update_user';
  const isCompactCard =
    action.actionType === 'create_project' ||
    action.actionType === 'update_project' ||
    isAddProjectMember ||
    action.actionType === 'create_kanban_board' ||
    action.actionType === 'update_kanban_board' ||
    action.actionType === 'move_kanban_card' ||
    action.actionType === 'update_meeting' ||
    action.actionType === 'generate_report' ||
    action.actionType === 'add_lead_comment' ||
    action.actionType === 'update_lead_comment' ||
    action.actionType === 'qualify_lead' ||
    action.actionType === 'disqualify_lead' ||
    action.actionType === 'export_leads' ||
    action.actionType === 'create_user' ||
    action.actionType === 'add_team_member';
  const hasTaskAssigneeField = isTaskCard || isAssignTaskCard;
  const isCreateInvoice = action.actionType === 'create_invoice';

  const invoiceTargetClientId = useMemo(() => {
    if (!isCreateInvoice) return '';
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    return String(action.proposed?.clientId || op?.clientId || '');
  }, [isCreateInvoice, action.proposed]);

  const { data: allInvoices = [] } = useInvoices();

  const autoInvoiceNumber = useMemo(() => {
    if (!isCreateInvoice) return '';
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    const issueDate = String(action.proposed?.issueDate || op?.issueDate || '');
    const currentYear = new Date(issueDate || Date.now()).getFullYear();
    let baseNumber = `${currentYear}-001`;

    if (Array.isArray(allInvoices) && allInvoices.length > 0) {
      const clientInvoices = invoiceTargetClientId
        ? allInvoices.filter((inv) => String(inv.clientId) === invoiceTargetClientId)
        : allInvoices;

      if (clientInvoices.length > 0) {
        const sorted = [...clientInvoices].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (dateA !== dateB) return dateB - dateA;
          return String(a._id) < String(b._id) ? 1 : -1;
        });

        const latestInvoice = sorted[0];
        if (latestInvoice && latestInvoice.invoiceNumber) {
          const match = latestInvoice.invoiceNumber.match(/(\d+)$/);
          if (match) {
            const numStr = match[1];
            const nextNum = parseInt(numStr, 10) + 1;
            const padding = Math.max(3, numStr.length);
            baseNumber = `${currentYear}-${String(nextNum).padStart(padding, '0')}`;
          }
        }
      }
    }
    return baseNumber;
  }, [isCreateInvoice, invoiceTargetClientId, allInvoices, action.proposed]);

  const [isInvoiceNumberCustom, setIsInvoiceNumberCustom] = useState(false);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');

  const displayInvoiceNumber = isInvoiceNumberCustom ? customInvoiceNumber : autoInvoiceNumber;

  const { data: dbUsers = [] } = useUsers({}, { enabled: hasTaskAssigneeField || isAddProjectMember });
  const { data: kanbanBoards = [] } = useKanbanBoards({ enabled: isQualifyLead });

  const initialAssigneeId = useMemo(() => {
    if (!hasTaskAssigneeField) return '';
    if (action.status === 'confirmed' && Array.isArray(action.applied?.assignedTo)) {
      return action.applied.assignedTo.length > 0 ? String(action.applied.assignedTo[0]) : '';
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    if (Array.isArray(op?.assignedTo) && op.assignedTo.length > 0) {
      return String(op.assignedTo[0]);
    }
    const propName = String(action.proposed?.assignedTo || '').trim().toLowerCase();
    if (propName && propName !== 'unassigned') {
      const match = dbUsers.find((u) => {
        const full = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
        return full === propName || (u.email || '').toLowerCase() === propName;
      });
      if (match) return match._id;
    }
    return '';
  }, [hasTaskAssigneeField, action.status, action.applied, action.proposed, dbUsers]);

  const [editedAssigneeId, setEditedAssigneeId] = useState<string>('');
  const userEditedAssigneeRef = useRef(false);

  const initialProjectMemberId = useMemo(() => {
    if (!isAddProjectMember) return '';
    if (action.status === 'confirmed' && action.applied?.userId) {
      return String(action.applied.userId);
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    if (op?.userId) return String(op.userId);
    return '';
  }, [isAddProjectMember, action.status, action.applied, action.proposed]);

  const [editedProjectMemberId, setEditedProjectMemberId] = useState<string>('');
  const userEditedProjectMemberRef = useRef(false);

  const initialProjectRole = useMemo(() => {
    if (!isAddProjectMember) return 'member';
    if (action.status === 'confirmed' && action.applied?.role) {
      return String(action.applied.role) === 'admin' ? 'admin' : 'member';
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    const raw = String(op?.role || action.proposed?.role || 'member').toLowerCase();
    return raw === 'admin' ? 'admin' : 'member';
  }, [isAddProjectMember, action.status, action.applied, action.proposed]);

  const [editedProjectRole, setEditedProjectRole] = useState<string>(initialProjectRole);
  const userEditedProjectRoleRef = useRef(false);

  const initialQualifyBoardId = useMemo(() => {
    if (!isQualifyLead) return '';
    if (action.status === 'confirmed' && action.applied?.boardId) {
      return String(action.applied.boardId);
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    return op?.boardId ? String(op.boardId) : '';
  }, [isQualifyLead, action.status, action.applied, action.proposed]);

  const [editedQualifyBoardId, setEditedQualifyBoardId] = useState<string>(initialQualifyBoardId);
  const userEditedQualifyBoardRef = useRef(false);

  const initialCommentLevel = useMemo(() => {
    if (!isLeadComment) return 'yellow';
    if (action.status === 'confirmed' && action.applied?.level) {
      return String(action.applied.level);
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    const raw = String(op?.level || action.proposed?.level || 'yellow').toLowerCase();
    return raw === 'red' || raw === 'green' || raw === 'yellow' ? raw : 'yellow';
  }, [isLeadComment, action.status, action.applied, action.proposed]);

  const [editedCommentLevel, setEditedCommentLevel] = useState<string>(initialCommentLevel);
  const userEditedCommentLevelRef = useRef(false);

  const initialUserRole = useMemo(() => {
    if (!isUserAction) return '';
    if (action.status === 'confirmed' && action.applied?.role) return String(action.applied.role);
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    return String(op?.role || action.proposed?.role || (action.actionType === 'create_user' ? 'user' : ''));
  }, [isUserAction, action.status, action.applied, action.proposed, action.actionType]);

  const initialUserDepartment = useMemo(() => {
    if (!isUserAction) return '';
    if (action.status === 'confirmed' && action.applied?.department) return String(action.applied.department);
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    return String(op?.department || action.proposed?.department || '');
  }, [isUserAction, action.status, action.applied, action.proposed]);

  const initialUserPermissions = useMemo(() => {
    if (!isUserAction) return {} as Record<string, boolean>;
    if (action.status === 'confirmed' && action.applied?.permissions && typeof action.applied.permissions === 'object') {
      return { ...(action.applied.permissions as Record<string, boolean>) };
    }
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    const raw = (op?.permissions || action.proposed?._permissionsOp) as Record<string, boolean> | undefined;
    return raw && typeof raw === 'object' ? { ...raw } : {};
  }, [isUserAction, action.status, action.applied, action.proposed]);

  const [editedUserRole, setEditedUserRole] = useState<string>(initialUserRole);
  const [editedUserDepartment, setEditedUserDepartment] = useState<string>(initialUserDepartment);
  const [editedUserPassword, setEditedUserPassword] = useState<string>(() => {
    if (action.actionType !== 'create_user') return '';
    const op = action.proposed?.operation as Record<string, unknown> | undefined;
    return String(op?.password || action.proposed?.password || '');
  });
  const [editedUserPermissions, setEditedUserPermissions] = useState<Record<string, boolean>>(initialUserPermissions);
  const userEditedUserMetaRef = useRef(false);

  useEffect(() => {
    userEditedAssigneeRef.current = false;
    userEditedProjectMemberRef.current = false;
    userEditedProjectRoleRef.current = false;
    userEditedQualifyBoardRef.current = false;
    userEditedCommentLevelRef.current = false;
    userEditedUserMetaRef.current = false;
  }, [action.actionId]);

  useEffect(() => {
    if (action.status === 'confirmed') {
      setEditedAssigneeId(initialAssigneeId);
      setEditedProjectMemberId(initialProjectMemberId);
      setEditedProjectRole(initialProjectRole);
      setEditedQualifyBoardId(initialQualifyBoardId);
      setEditedCommentLevel(initialCommentLevel);
      setEditedUserRole(initialUserRole);
      setEditedUserDepartment(initialUserDepartment);
      setEditedUserPermissions(initialUserPermissions);
      return;
    }
    if (!userEditedAssigneeRef.current && initialAssigneeId) {
      setEditedAssigneeId(initialAssigneeId);
    }
    if (!userEditedProjectMemberRef.current && initialProjectMemberId) {
      setEditedProjectMemberId(initialProjectMemberId);
    }
    if (!userEditedProjectRoleRef.current) {
      setEditedProjectRole(initialProjectRole);
    }
    if (!userEditedQualifyBoardRef.current) {
      setEditedQualifyBoardId(initialQualifyBoardId);
    }
    if (!userEditedCommentLevelRef.current) {
      setEditedCommentLevel(initialCommentLevel);
    }
    if (!userEditedUserMetaRef.current) {
      setEditedUserRole(initialUserRole);
      setEditedUserDepartment(initialUserDepartment);
      setEditedUserPermissions(initialUserPermissions);
    }
  }, [
    action.status,
    initialAssigneeId,
    initialProjectMemberId,
    initialProjectRole,
    initialQualifyBoardId,
    initialCommentLevel,
    initialUserRole,
    initialUserDepartment,
    initialUserPermissions,
  ]);

  const [showDescription, setShowDescription] = useState<boolean>(() => {
    return Boolean(action.proposed?.description && String(action.proposed.description).trim().length > 0);
  });

  const standardEntries = useMemo(() => {
    if (isTaskCard) {
      return proposedEntries.filter(
        ([k]) => k !== 'priority' && k !== 'dueDate' && k !== 'description' && k !== 'assignedTo',
      );
    }
    if (isAssignTaskCard) {
      return proposedEntries.filter(([k]) => k !== 'assignedTo');
    }
    if (isAddProjectMember) {
      return proposedEntries.filter(([k]) => k !== 'member' && k !== 'role');
    }
    if (isQualifyLead) {
      return proposedEntries.filter(([k]) => k !== 'isQualified' && k !== 'board' && k !== 'lead');
    }
    if (isLeadComment) {
      return proposedEntries.filter(([k]) => k !== 'level');
    }
    if (isUserAction) {
      return proposedEntries.filter(([k]) => k !== 'role' && k !== 'department' && k !== 'permissions' && k !== 'password');
    }
    return proposedEntries;
  }, [isTaskCard, isAssignTaskCard, isAddProjectMember, isQualifyLead, isLeadComment, isUserAction, proposedEntries]);

  const [sendGoogleInvite, setSendGoogleInvite] = useState<boolean>(() => {
    if (action.actionType !== 'create_meeting') return false;
    if (action.proposed.sendGoogleInvite === true) return true;
    if (action.proposed.sendGoogleInvite === false) return false;
    return Boolean(action.proposed.googleCalendarConnected);
  });

  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const [k] of proposedEntries) {
      initial[k] = true;
    }
    if (isTaskCard) {
      initial.priority = true;
      initial.dueDate = Boolean(action.proposed?.dueDate);
      initial.description = Boolean(action.proposed?.description && String(action.proposed.description).trim().length > 0);
      initial.assignedTo = Boolean(action.proposed?.assignedTo || (action.proposed?.operation as Record<string, unknown> | undefined)?.assignedTo);
    } else if (isAssignTaskCard) {
      initial.assignedTo = Boolean(action.proposed?.assignedTo || (action.proposed?.operation as Record<string, unknown> | undefined)?.assignedTo);
    }
    return initial;
  });

  const [editedValues, setEditedValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [k, v] of proposedEntries) {
      initial[k] = formatProposedFieldValue(k, v, action, user ?? undefined);
    }
    if (isTaskCard) {
      initial.priority = (initial.priority || String(action.proposed?.priority || 'medium')).toLowerCase();
      initial.dueDate = initial.dueDate || String(action.proposed?.dueDate || '');
      initial.description = initial.description || String(action.proposed?.description || '');
    }
    return initial;
  });

  const isPending = action.status === 'pending';

  const handleConfirm = () => {
    if (EMAILS_CLIENT.has(action.actionType) && !emailAck) {
      addToast({
        message: 'Confirm that this will email the client before approving.',
        severity: 'warning',
      });
      return;
    }
    const overrides: Record<string, unknown> = {};
    for (const [k] of proposedEntries) {
      if (isTaskCard && (k === 'priority' || k === 'dueDate' || k === 'description' || k === 'assignedTo')) {
        continue;
      }
      if (isAssignTaskCard && k === 'assignedTo') {
        continue;
      }
      if (isAddProjectMember && (k === 'member' || k === 'role')) {
        continue;
      }
      if (isQualifyLead && (k === 'isQualified' || k === 'board' || k === 'lead')) {
        continue;
      }
      if (isLeadComment && k === 'level') {
        continue;
      }
      if (action.actionType === 'export_leads') {
        continue;
      }
      if (isUserAction && (k === 'role' || k === 'department' || k === 'permissions' || k === 'password')) {
        continue;
      }
      if (selectedFields[k]) {
        if (k === 'columnId') continue;
        if (isCreateInvoice && k === 'client') continue;
        if (k === 'durationMinutes') {
          const n = Number(editedValues[k]);
          overrides[k] = Number.isFinite(n) ? n : action.proposed.durationMinutes;
        } else if (k === 'columns' && typeof editedValues[k] === 'string') {
          overrides[k] = editedValues[k].split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          overrides[k] = editedValues[k];
        }
      }
    }
    if (hasTaskAssigneeField) {
      if (isTaskCard && selectedFields.priority && editedValues.priority) {
        overrides.priority = editedValues.priority;
      }
      if (isTaskCard && selectedFields.dueDate && editedValues.dueDate) {
        overrides.dueDate = editedValues.dueDate;
      }
      if (isTaskCard && selectedFields.description && editedValues.description?.trim()) {
        overrides.description = editedValues.description.trim();
      }
      if (selectedFields.assignedTo) {
        overrides.assignedTo = editedAssigneeId ? [editedAssigneeId] : [];
      }
    }
    if (isAddProjectMember) {
      if (selectedFields.member && editedProjectMemberId) {
        overrides.userId = editedProjectMemberId;
      }
      if (selectedFields.role && editedProjectRole) {
        overrides.role = editedProjectRole;
      }
    }
    if (isQualifyLead) {
      if (editedQualifyBoardId) {
        overrides.boardId = editedQualifyBoardId;
      }
    }
    if (isLeadComment) {
      overrides.level = editedCommentLevel;
    }
    if (isUserAction) {
      if (editedUserRole) overrides.role = editedUserRole;
      if (editedUserDepartment) overrides.department = editedUserDepartment;
      if (action.actionType === 'create_user' && editedUserPassword.trim()) {
        overrides.password = editedUserPassword.trim();
      }
      if (Object.keys(editedUserPermissions).length > 0) {
        overrides.permissions = editedUserPermissions;
      }
    }
    if (isCreateInvoice) {
      const finalNum = displayInvoiceNumber.trim();
      if (finalNum) {
        overrides.invoiceNumber = finalNum;
      }
    }
    if (action.actionType === 'create_meeting' && action.proposed.participants) {
      overrides.participants = action.proposed.participants;
      overrides.sendGoogleInvite = sendGoogleInvite;
      overrides.timeZone =
        editedValues.timeZone || meetingTimeZone || action.proposed.timeZone;
      if (editedValues.scheduledAtLocal?.trim()) {
        overrides.scheduledAtLocal = editedValues.scheduledAtLocal.trim();
      }
      if (editedValues.guestEmails?.trim()) {
        overrides.guestEmails = editedValues.guestEmails
          .split(/[,;\n]+/)
          .map((e) => e.trim())
          .filter(Boolean);
      } else if (Array.isArray(action.proposed.guestEmails)) {
        overrides.guestEmails = action.proposed.guestEmails;
      }
      const link = String(overrides.meetingLink ?? editedValues.meetingLink ?? '').trim();
      if (sendGoogleInvite && !calendarConnected) {
        addToast({
          message: 'Connect Google Calendar first to book on Calendar and send invites.',
          severity: 'warning',
        });
        return;
      }
      if (!sendGoogleInvite && !link) {
        addToast({
          message: 'Add a meeting link or enable Google Calendar for this booking.',
          severity: 'warning',
        });
        return;
      }
    }

    confirmAction.mutate(
      { actionId: action.actionId, overrides },
      {
        onSuccess: (res) => {
          addToast({
            message: `${ACTION_TYPE_TITLES[action.actionType]} applied successfully!`,
            severity: 'success',
          });
          onConfirmed?.(res.action, res.entityResult);
        },
        onError: (err) => showApiError(err),
      },
    );
  };

  const handleReject = () => {
    rejectAction.mutate(action.actionId, {
      onSuccess: () => {
        addToast({
          message: 'Proposal discarded',
          severity: 'info',
        });
      },
      onError: (err) => showApiError(err),
    });
  };

  if (proposedEntries.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 2,
        width: '100%',
        maxWidth: isAssignTaskCard ? 340 : isTaskCard ? 520 : isCompactCard ? 460 : undefined,
        borderRadius: '16px',
        border: `1px solid ${
          action.status === 'confirmed'
            ? 'rgba(45, 138, 94, 0.4)'
            : action.status === 'rejected'
            ? 'rgba(211, 47, 47, 0.3)'
            : isDarkMode
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(93, 26, 137, 0.2)'
        }`,
        bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#faf8fc',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ fontSize: 18, color: tokens.brand.primary }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            {`${ACTION_TYPE_TITLES[action.actionType] || action.actionType} — ${action.targetLabel || ''}`}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={
            action.status === 'confirmed'
              ? 'Applied'
              : action.status === 'rejected'
              ? 'Discarded'
              : 'Needs Confirmation'
          }
          color={
            action.status === 'confirmed'
              ? 'success'
              : action.status === 'rejected'
              ? 'default'
              : 'warning'
          }
          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Target / Task ID badge (locked / immutable) */}
      {Boolean(action.targetId || action.proposed?.cardId) && (() => {
        const fullId = String(action.targetId || action.proposed?.cardId);
        const shortId = fullId.length > 6 ? `#${fullId.slice(-4)}` : fullId;
        return (
          <Tooltip title={`Full ID: ${fullId}`} arrow>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                width: 'fit-content',
                mb: 1.25,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: 'text.secondary',
                  fontSize: '0.73rem',
                }}
              >
                ID: {shortId}
              </Typography>
              <Chip
                size="small"
                label="Locked"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  color: 'text.secondary',
                }}
              />
            </Box>
          </Tooltip>
        );
      })()}

      {action.actionType === 'create_meeting' && isPending && (
        <Box
          sx={{
            mb: 1.25,
            p: 1.25,
            borderRadius: '12px',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(93, 26, 137, 0.15)'}`,
            bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fff',
          }}
        >
          {calendarConnected ? (
            <FormControlLabel
              control={
                <Switch
                  checked={sendGoogleInvite}
                  onChange={(e) => setSendGoogleInvite(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                  Create on Google Calendar and send invites
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', fontWeight: 500, mt: 0.25 }}
                  >
                    Generates a Google Meet link automatically if meeting link is left empty.
                  </Typography>
                </Typography>
              }
              sx={{ alignItems: 'flex-start', ml: 0, mr: 0 }}
            />
          ) : (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', mb: 0.75 }}>
                Google Calendar is not connected
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Connect your account to book meetings on Google Calendar with email invites and
                Meet links from AI booking.
              </Typography>
              <Button
                size="small"
                variant="outlined"
                disabled={calendarAuth.isPending}
                onClick={() => {
                  calendarAuth.mutate(undefined, {
                    onSuccess: (url) => openCalendarOAuthPopup(url),
                    onError: (err) => showApiError(err),
                  });
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Connect Google Calendar
              </Button>
            </Box>
          )}
        </Box>
      )}

      {action.actionType === 'create_meeting' &&
        !isPending &&
        action.applied?.sendGoogleInvite === true && (
        <Chip
          size="small"
          label="Booked on Google Calendar"
          color="success"
          sx={{ mb: 1, fontWeight: 700, fontSize: '0.7rem' }}
        />
      )}

      {/* Diff Rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, my: 1.5 }}>
        {standardEntries.map(([fieldKey]) => {
          const prevVal = action.before?.[fieldKey];
          const checked = Boolean(selectedFields[fieldKey]);
          return (
            <Box
              key={fieldKey}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1,
                borderRadius: '10px',
                bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              {isPending && (
                <Checkbox
                  size="small"
                  checked={(fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client')) ? true : checked}
                  disabled={fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client')}
                  onChange={(e) =>
                    setSelectedFields((prev) => ({ ...prev, [fieldKey]: e.target.checked }))
                  }
                  sx={{ p: 0.25, mt: 0.25 }}
                />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                    }}
                  >
                    {FIELD_LABELS[fieldKey] || fieldKey}
                  </Typography>
                  {(fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client')) ? (
                    <Chip
                      size="small"
                      icon={<LockOutlinedIcon sx={{ fontSize: '11px !important' }} />}
                      label="Locked"
                      sx={{
                        height: 16,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: 'text.secondary',
                      }}
                    />
                  ) : prevVal ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        textDecoration: 'line-through',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(prevVal)}
                    </Typography>
                  ) : (
                    <Chip
                      size="small"
                      label="New"
                      sx={{
                        height: 16,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(45, 138, 94, 0.12)',
                        color: tokens.semantic.success,
                      }}
                    />
                  )}
                </Box>
                {action.enrichmentMeta?.fields?.[fieldKey] && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                    {SOURCE_TIER_LABELS[action.enrichmentMeta.fields[fieldKey].tier] || action.enrichmentMeta.fields[fieldKey].tier}
                    {action.enrichmentMeta.fields[fieldKey].provider
                      ? ` · ${action.enrichmentMeta.fields[fieldKey].provider}`
                      : ''}
                    {action.enrichmentMeta.regionLabel
                      ? action.enrichmentMeta.fields[fieldKey].regionMatch
                        ? ` · matches ${action.enrichmentMeta.regionLabel}`
                        : ` · outside ${action.enrichmentMeta.regionLabel}`
                      : ''}
                    {action.enrichmentMeta.fields[fieldKey].sourceUrl
                      ? ` · ${action.enrichmentMeta.fields[fieldKey].sourceUrl}`
                      : ''}
                  </Typography>
                )}
                {isPending ? (
                  <TextField
                    fullWidth
                    size="small"
                    disabled={!checked || fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client')}
                    InputProps={{
                      readOnly: fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client'),
                      endAdornment: (fieldKey === 'columnId' || (isCreateInvoice && fieldKey === 'client')) ? (
                        <InputAdornment position="end">
                          <LockOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        </InputAdornment>
                      ) : undefined,
                    }}
                    multiline={
                      fieldKey === 'notes' ||
                      fieldKey === 'description' ||
                      fieldKey === 'guestEmails' ||
                      fieldKey === 'itemSummary'
                    }
                    maxRows={3}
                    placeholder={
                      fieldKey === 'scheduledAtLocal' ? '2026-10-20T17:00' : undefined
                    }
                    helperText={
                      fieldKey === 'scheduledAtLocal' && meetingTimeZone
                        ? `Wall-clock time in ${meetingTimeZone}. Saved as UTC in the database.`
                        : fieldKey === 'guestEmails'
                        ? 'Comma-separated emails for people outside your ERP workspace'
                        : undefined
                    }
                    value={editedValues[fieldKey] ?? ''}
                    onChange={(e) =>
                      setEditedValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                    }
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.82rem',
                        py: 0.6,
                        fontFamily: fieldKey === 'columnId' ? 'monospace' : 'inherit',
                      },
                    }}
                  />
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      wordBreak: 'break-word',
                      ...(fieldKey === 'itemSummary' ? { whiteSpace: 'pre-line' } : {}),
                    }}
                  >
                    {fieldKey === 'scheduledAtLocal' &&
                    (action.applied?.scheduledAt || action.proposed.scheduledAt) &&
                    meetingTimeZone
                      ? formatMeetingInstant(
                          String(action.applied?.scheduledAt ?? action.proposed.scheduledAt),
                          meetingTimeZone,
                        )
                      : fieldKey === 'guestEmails' && Array.isArray(action.applied?.guestEmails)
                      ? (action.applied.guestEmails as string[]).join(', ')
                      : formatProposedFieldValue(
                          fieldKey,
                          action.applied?.[fieldKey] ?? action.proposed[fieldKey],
                          action,
                          user ?? undefined,
                        )}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}

        {isCreateInvoice && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: 1,
              borderRadius: '10px',
              bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'text.secondary',
                  }}
                >
                  Invoice Number
                </Typography>
                <Chip
                  size="small"
                  label={isPending ? 'Auto-generated' : 'Assigned'}
                  sx={{
                    height: 16,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(45, 138, 94, 0.12)',
                    color: tokens.semantic.success,
                  }}
                />
              </Box>
              {isPending ? (
                <TextField
                  fullWidth
                  size="small"
                  value={displayInvoiceNumber}
                  onChange={(e) => {
                    setIsInvoiceNumberCustom(true);
                    setCustomInvoiceNumber(e.target.value);
                  }}
                  placeholder="e.g. 2026-001"
                  helperText="Auto-generated by frontend. You can adjust it before approving."
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.8rem',
                      py: 0.5,
                      fontWeight: 600,
                    },
                    '& .MuiFormHelperText-root': {
                      fontSize: '0.68rem',
                      mt: 0.3,
                    },
                  }}
                />
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {String(action.applied?.invoiceNumber || action.proposed?.invoiceNumber || displayInvoiceNumber || '—')}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {hasTaskAssigneeField && (
          <>
            {/* Priority, Due Date & Assignee Row */}
            <Grid container spacing={1}>
              {isTaskCard && (
                <Grid item xs={12} sm={5}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1,
                    height: '100%',
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {isPending && (
                    <Checkbox
                      size="small"
                      checked={Boolean(selectedFields.priority)}
                      onChange={(e) =>
                        setSelectedFields((prev) => ({ ...prev, priority: e.target.checked }))
                      }
                      sx={{ p: 0.25, mt: 0.25 }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'text.secondary',
                        }}
                      >
                        Priority
                      </Typography>
                      <Chip
                        size="small"
                        label="New"
                        sx={{
                          height: 16,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(45, 138, 94, 0.12)',
                          color: tokens.semantic.success,
                        }}
                      />
                    </Box>
                    {isPending ? (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        disabled={!selectedFields.priority}
                        value={editedValues.priority ? editedValues.priority.toLowerCase() : 'medium'}
                        onChange={(e) =>
                          setEditedValues((prev) => ({ ...prev, priority: e.target.value }))
                        }
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: '0.8rem',
                            py: 0.4,
                            display: 'flex',
                            alignItems: 'center',
                          },
                        }}
                      >
                        <MenuItem value="low">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981' }} />
                            <span>Low</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="medium">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3B82F6' }} />
                            <span>Medium</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="high">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F59E0B' }} />
                            <span>High</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="urgent">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444' }} />
                            <span>Urgent</span>
                          </Box>
                        </MenuItem>
                      </TextField>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {editedValues.priority || 'Medium'}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>

              )}

              {isTaskCard && (
                <Grid item xs={12} sm={7}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1,
                    height: '100%',
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {isPending && (
                    <Checkbox
                      size="small"
                      checked={Boolean(selectedFields.dueDate)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedFields((prev) => ({ ...prev, dueDate: isChecked }));
                        if (isChecked && !editedValues.dueDate) {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          const pad = (n: number) => String(n).padStart(2, '0');
                          const tomorrowDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                          setEditedValues((prev) => ({ ...prev, dueDate: combineDueDateTime(tomorrowDate, DEFAULT_DUE_TIME) }));
                        }
                      }}
                      sx={{ p: 0.25, mt: 0.25 }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'text.secondary',
                        }}
                      >
                        Due Date
                      </Typography>
                      <Chip
                        size="small"
                        label="New"
                        sx={{
                          height: 16,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(45, 138, 94, 0.12)',
                          color: tokens.semantic.success,
                        }}
                      />
                    </Box>
                    {isPending ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <TextField
                          type="date"
                          size="small"
                          disabled={!selectedFields.dueDate}
                          InputLabelProps={{ shrink: true }}
                          value={parseDueParts(editedValues.dueDate).date}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            const currentParts = parseDueParts(editedValues.dueDate);
                            const newCombined = newDate
                              ? combineDueDateTime(newDate, currentParts.time || DEFAULT_DUE_TIME)
                              : '';
                            setEditedValues((prev) => ({ ...prev, dueDate: newCombined }));
                            if (newDate) {
                              setSelectedFields((prev) => ({ ...prev, dueDate: true }));
                            }
                          }}
                          onFocus={() => {
                            if (!selectedFields.dueDate) {
                              setSelectedFields((prev) => ({ ...prev, dueDate: true }));
                            }
                          }}
                          sx={{
                            width: 118,
                            flexShrink: 0,
                            '& .MuiInputBase-input': {
                              fontSize: '0.78rem',
                              py: 0.4,
                              px: 0.6,
                            },
                          }}
                        />
                        <TextField
                          type="time"
                          size="small"
                          disabled={!selectedFields.dueDate || !parseDueParts(editedValues.dueDate).date}
                          InputLabelProps={{ shrink: true }}
                          value={parseDueParts(editedValues.dueDate).time || DEFAULT_DUE_TIME}
                          onChange={(e) => {
                            const newTime = e.target.value;
                            const currentParts = parseDueParts(editedValues.dueDate);
                            if (currentParts.date) {
                              const newCombined = combineDueDateTime(currentParts.date, newTime);
                              setEditedValues((prev) => ({ ...prev, dueDate: newCombined }));
                              if (newTime) {
                                setSelectedFields((prev) => ({ ...prev, dueDate: true }));
                              }
                            }
                          }}
                          onFocus={() => {
                            if (!selectedFields.dueDate) {
                              setSelectedFields((prev) => ({ ...prev, dueDate: true }));
                            }
                          }}
                          sx={{
                            width: 112,
                            flexShrink: 0,
                            '& .MuiInputBase-input': {
                              fontSize: '0.78rem',
                              py: 0.4,
                              px: 0.5,
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatDueDateTimeDisplay(editedValues.dueDate)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
              )}

              {/* Row 2: Assignee (Priority jitna) */}
              <Grid item xs={12} sm={isTaskCard ? 5 : 12}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1,
                    height: '100%',
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {isPending && (
                    <Checkbox
                      size="small"
                      checked={Boolean(selectedFields.assignedTo)}
                      onChange={(e) =>
                        setSelectedFields((prev) => ({ ...prev, assignedTo: e.target.checked }))
                      }
                      sx={{ p: 0.25, mt: 0.25 }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'text.secondary',
                        }}
                      >
                        Assignee
                      </Typography>
                      <Chip
                        size="small"
                        label={editedAssigneeId ? 'Assigned' : 'Empty'}
                        sx={{
                          height: 16,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          bgcolor: editedAssigneeId ? 'rgba(45, 138, 94, 0.12)' : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                          color: editedAssigneeId ? tokens.semantic.success : 'text.secondary',
                        }}
                      />
                    </Box>
                    {isPending ? (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        disabled={!selectedFields.assignedTo}
                        value={editedAssigneeId}
                        onChange={(e) => {
                          userEditedAssigneeRef.current = true;
                          setEditedAssigneeId(e.target.value);
                          setSelectedFields((prev) => ({ ...prev, assignedTo: true }));
                        }}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: '0.8rem',
                            py: 0.4,
                            display: 'flex',
                            alignItems: 'center',
                          },
                        }}
                      >
                        <MenuItem value="">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                            <PersonOutlineIcon sx={{ fontSize: 16 }} />
                            <span>Unassigned (Empty)</span>
                          </Box>
                        </MenuItem>
                        {dbUsers.map((u) => {
                          const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'User';
                          return (
                            <MenuItem key={u._id} value={u._id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonOutlineIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                                <span>{name}</span>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    ) : (() => {
                      const appliedAssigned =
                        action.status === 'confirmed' && Array.isArray(action.applied?.assignedTo)
                          ? (action.applied.assignedTo as unknown[]).map(String)
                          : null;
                      const resolvedId = appliedAssigned ? (appliedAssigned[0] || '') : editedAssigneeId;
                      const matchedUser = resolvedId ? dbUsers.find((u) => u._id === resolvedId) : undefined;
                      const displayLabel = matchedUser
                        ? [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(' ').trim() || matchedUser.email || 'Assigned'
                        : appliedAssigned
                          ? 'Unassigned'
                          : action.proposed?.assignedTo
                            ? String(action.proposed.assignedTo)
                            : 'Unassigned';
                      return (
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                          }}
                          title={displayLabel}
                        >
                          {displayLabel}
                        </Typography>
                      );
                    })()}
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Description (Collapsible / Expandable & Scroll-Managed) */}
            {isTaskCard && (
              <Box sx={{ mt: 0.5 }}>
              {showDescription ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {isPending && (
                    <Checkbox
                      size="small"
                      checked={Boolean(selectedFields.description)}
                      onChange={(e) =>
                        setSelectedFields((prev) => ({ ...prev, description: e.target.checked }))
                      }
                      sx={{ p: 0.25, mt: 0.25 }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'text.secondary',
                          }}
                        >
                          Description
                        </Typography>
                        <Chip
                          size="small"
                          label="New"
                          sx={{
                            height: 16,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(45, 138, 94, 0.12)',
                            color: tokens.semantic.success,
                          }}
                        />
                      </Box>
                      {isPending && !action.proposed?.description && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setShowDescription(false);
                            setSelectedFields((prev) => ({ ...prev, description: false }));
                          }}
                          sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'text.primary' } }}
                        >
                          <CloseOutlinedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                    {isPending ? (
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                        maxRows={5}
                        disabled={!selectedFields.description}
                        placeholder="Add task details, notes, or acceptance criteria..."
                        value={editedValues.description ?? ''}
                        onChange={(e) =>
                          setEditedValues((prev) => ({ ...prev, description: e.target.value }))
                        }
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: '0.82rem',
                            lineHeight: 1.5,
                            maxHeight: 140,
                            overflowY: 'auto !important',
                          },
                          '& .MuiInputBase-input': {
                            scrollbarWidth: 'thin',
                          },
                        }}
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.82rem',
                          color: 'text.secondary',
                          maxHeight: 140,
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          p: 0.5,
                        }}
                      >
                        {editedValues.description || 'No description provided'}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : isPending ? (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    setShowDescription(true);
                    setSelectedFields((prev) => ({ ...prev, description: true }));
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: tokens.brand.primary,
                    p: 0.5,
                    '&:hover': {
                      bgcolor: isDarkMode ? 'rgba(93, 26, 137, 0.15)' : 'rgba(93, 26, 137, 0.08)',
                    },
                  }}
                >
                  Add Description (optional)
                </Button>
              ) : null}
            </Box>
            )}
          </>
        )}

        {isAddProjectMember && (
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  p: 1,
                  borderRadius: '10px',
                  bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {isPending && (
                  <Checkbox
                    size="small"
                    checked={Boolean(selectedFields.member)}
                    onChange={(e) =>
                      setSelectedFields((prev) => ({ ...prev, member: e.target.checked }))
                    }
                    sx={{ p: 0.25, mt: 0.25 }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'text.secondary',
                      }}
                    >
                      Team Member
                    </Typography>
                    <Chip
                      size="small"
                      label="New"
                      sx={{
                        height: 16,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(45, 138, 94, 0.12)',
                        color: tokens.semantic.success,
                      }}
                    />
                  </Box>
                  {isPending ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      disabled={!selectedFields.member}
                      value={editedProjectMemberId}
                      onChange={(e) => {
                        userEditedProjectMemberRef.current = true;
                        setEditedProjectMemberId(e.target.value);
                        setSelectedFields((prev) => ({ ...prev, member: true }));
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: '0.8rem',
                          py: 0.4,
                          display: 'flex',
                          alignItems: 'center',
                        },
                      }}
                    >
                      {dbUsers.map((u) => {
                        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'User';
                        return (
                          <MenuItem key={u._id} value={u._id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PersonOutlineIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                              <span>{name}</span>
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  ) : (() => {
                    const resolvedId =
                      action.status === 'confirmed' && action.applied?.userId
                        ? String(action.applied.userId)
                        : editedProjectMemberId;
                    const matchedUser = resolvedId ? dbUsers.find((u) => u._id === resolvedId) : undefined;
                    const label = matchedUser
                      ? [matchedUser.firstName, matchedUser.lastName].filter(Boolean).join(' ').trim() || matchedUser.email || 'Member'
                      : action.proposed?.member
                        ? String(action.proposed.member)
                        : 'Member';
                    return (
                      <Typography variant="body2" sx={{ fontWeight: 600 }} title={label}>
                        {label}
                      </Typography>
                    );
                  })()}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  p: 1,
                  borderRadius: '10px',
                  bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {isPending && (
                  <Checkbox
                    size="small"
                    checked={Boolean(selectedFields.role)}
                    onChange={(e) =>
                      setSelectedFields((prev) => ({ ...prev, role: e.target.checked }))
                    }
                    sx={{ p: 0.25, mt: 0.25 }}
                  />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'text.secondary',
                      }}
                    >
                      Role
                    </Typography>
                    <Chip
                      size="small"
                      label="New"
                      sx={{
                        height: 16,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(45, 138, 94, 0.12)',
                        color: tokens.semantic.success,
                      }}
                    />
                  </Box>
                  {isPending ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      disabled={!selectedFields.role}
                      value={editedProjectRole}
                      onChange={(e) => {
                        userEditedProjectRoleRef.current = true;
                        setEditedProjectRole(e.target.value);
                        setSelectedFields((prev) => ({ ...prev, role: true }));
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: '0.8rem',
                          py: 0.4,
                        },
                      }}
                    >
                      <MenuItem value="member">Member</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </TextField>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {action.status === 'confirmed' && action.applied?.role
                        ? String(action.applied.role)
                        : editedProjectRole || 'member'}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        )}

        {isQualifyLead && (
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: '10px',
                  bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'text.secondary',
                    display: 'block',
                    mb: 0.3,
                  }}
                >
                  Lead
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {String(action.proposed?.lead || action.targetLabel || 'Lead')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: '10px',
                  bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                    }}
                  >
                    Target Board
                  </Typography>
                  <Chip
                    size="small"
                    label="Kanban"
                    sx={{
                      height: 16,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(45, 138, 94, 0.12)',
                      color: tokens.semantic.success,
                    }}
                  />
                </Box>
                {isPending ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={editedQualifyBoardId}
                    onChange={(e) => {
                      userEditedQualifyBoardRef.current = true;
                      setEditedQualifyBoardId(e.target.value);
                    }}
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.8rem',
                        py: 0.4,
                      },
                    }}
                  >
                    <MenuItem value="">Qualified (Default)</MenuItem>
                    {kanbanBoards.map((b) => (
                      <MenuItem key={b._id} value={b._id}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {kanbanBoards.find((b) => b._id === editedQualifyBoardId)?.name ||
                      String(action.proposed?.board || 'Qualified (Default)')}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        )}

        {isLeadComment && (
          <Box
            sx={{
              p: 1,
              borderRadius: '10px',
              bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'text.secondary',
                }}
              >
                Comment Level
              </Typography>
            </Box>
            {isPending ? (
              <TextField
                select
                fullWidth
                size="small"
                value={editedCommentLevel}
                onChange={(e) => {
                  userEditedCommentLevelRef.current = true;
                  setEditedCommentLevel(e.target.value);
                }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: '0.8rem',
                    py: 0.4,
                  },
                }}
              >
                <MenuItem value="green">Green (Positive)</MenuItem>
                <MenuItem value="yellow">Yellow (Neutral / Follow-up)</MenuItem>
                <MenuItem value="red">Red (Issue / Negative)</MenuItem>
              </TextField>
            ) : (
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {editedCommentLevel}
              </Typography>
            )}
          </Box>
        )}

        {isUserAction && (
          <Grid container spacing={1}>
            {action.actionType === 'create_user' && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.4,
                    }}
                  >
                    Password (Optional)
                  </Typography>
                  {isPending ? (
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Leave empty to auto-generate & email user"
                      value={editedUserPassword}
                      onChange={(e) => setEditedUserPassword(e.target.value)}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.4 } }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {editedUserPassword ? '••••••••' : 'Auto-generated & emailed'}
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}
            {(action.actionType === 'create_user' || Boolean(action.proposed?.role)) && (
              <Grid item xs={12} sm={6}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.4,
                    }}
                  >
                    Role
                  </Typography>
                  {isPending ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={editedUserRole || 'user'}
                      onChange={(e) => {
                        userEditedUserMetaRef.current = true;
                        setEditedUserRole(e.target.value);
                      }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.4 } }}
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="manager">Manager</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </TextField>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {editedUserRole || 'user'}
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}

            {(action.actionType === 'create_user' || Boolean(action.proposed?.department)) && (
              <Grid item xs={12} sm={6}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.4,
                    }}
                  >
                    Department
                  </Typography>
                  {isPending ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={editedUserDepartment}
                      onChange={(e) => {
                        userEditedUserMetaRef.current = true;
                        setEditedUserDepartment(e.target.value);
                      }}
                      sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.4 } }}
                    >
                      <MenuItem value="">None</MenuItem>
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {editedUserDepartment || 'None'}
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}

            {(action.actionType === 'create_user' || Boolean(action.proposed?.permissions)) && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 0.5,
                    }}
                  >
                    Permissions
                  </Typography>
                  <Grid container spacing={0.5}>
                    {[
                      ['viewSalesPage', 'Sales Page'],
                      ['accessAllOrgLeads', 'All Org Leads'],
                      ['accessTeam', 'Team Access'],
                      ['viewAllAttendance', 'All Attendance'],
                      ['manageSalesSettings', 'Sales Settings'],
                      ['manageSystemSettings', 'System Settings'],
                      ['createProjectsAndBoards', 'Projects & Boards'],
                      ['accessInvoicing', 'Invoicing'],
                    ].map(([key, label]) => {
                      const active = Boolean(editedUserPermissions[key]);
                      return (
                        <Grid item xs={12} sm={6} key={key}>
                          <Box
                            onClick={
                              isPending
                                ? () => {
                                    userEditedUserMetaRef.current = true;
                                    setEditedUserPermissions((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }));
                                  }
                                : undefined
                            }
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              px: 1,
                              py: 0.35,
                              borderRadius: '8px',
                              cursor: isPending ? 'pointer' : 'default',
                              bgcolor: active
                                ? isDarkMode
                                  ? 'rgba(93, 26, 137, 0.18)'
                                  : 'rgba(93, 26, 137, 0.06)'
                                : 'transparent',
                              border: `1px solid ${
                                active
                                  ? 'rgba(93, 26, 137, 0.3)'
                                  : isDarkMode
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.06)'
                              }`,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: active ? 700 : 500,
                                color: active ? 'text.primary' : 'text.secondary',
                                fontSize: '0.74rem',
                              }}
                            >
                              {label}
                            </Typography>
                            <Switch
                              size="small"
                              checked={active}
                              disabled={!isPending}
                              onClick={(e) => e.stopPropagation()}
                              onChange={
                                isPending
                                  ? () => {
                                      userEditedUserMetaRef.current = true;
                                      setEditedUserPermissions((prev) => ({
                                        ...prev,
                                        [key]: !prev[key],
                                      }));
                                    }
                                  : undefined
                              }
                            />
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </Box>

      {/* Sources */}
      {action.sources && action.sources.length > 0 && (
        <Box sx={{ mb: isPending ? 1.5 : 0 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Verified Web Sources:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {action.sources.map((src, idx) => (
              <Link
                key={`${src.url}-${idx}`}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.4,
                  fontSize: '0.72rem',
                  px: 1,
                  py: 0.25,
                  borderRadius: '8px',
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93, 26, 137, 0.06)',
                }}
              >
                {src.title || src.url}
                <OpenInNewIcon sx={{ fontSize: 11 }} />
              </Link>
            ))}
          </Box>
        </Box>
      )}

      {isPending && EMAILS_CLIENT.has(action.actionType) && (
        <FormControlLabel
          sx={{ mt: 1, alignItems: 'flex-start' }}
          control={<Checkbox checked={emailAck} onChange={(event) => setEmailAck(event.target.checked)} />}
          label="I understand this emails the client."
        />
      )}

      {/* Action Buttons */}
      {isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<CloseOutlinedIcon />}
            onClick={handleReject}
            disabled={confirmAction.isPending || rejectAction.isPending}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Discard
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={handleConfirm}
            disabled={
              confirmAction.isPending ||
              rejectAction.isPending ||
              Object.values(selectedFields).every((v) => !v)
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: tokens.brand.solid,
            }}
          >
            {confirmAction.isPending ? 'Applying...' : 'Approve & Apply'}
          </Button>
        </Box>
      )}

      {action.actionType === 'generate_report' &&
        action.status === 'confirmed' &&
        Boolean(action.applied?.reportId) && (
          <ReportDownloadBox reportId={String(action.applied?.reportId)} />
        )}

      {action.actionType === 'export_leads' &&
        action.status === 'confirmed' &&
        Boolean(action.applied) && (
          <LeadExportDownloadBox applied={action.applied as Record<string, unknown>} />
        )}
    </Box>
  );
};
