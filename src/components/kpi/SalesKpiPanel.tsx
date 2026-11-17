import { useState, useMemo } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { PriorityBadge } from '@/components/kpi/PriorityBadge';
import { SalesKpiAssignmentsPanel } from '@/components/kpi/SalesKpiAssignmentsPanel';
import { SalesKpiTemplateForm } from '@/components/kpi/SalesKpiTemplateForm';
import {
  useAssignSalesKpiTemplate,
  useDeleteSalesKpiTemplate,
  useSalesKpiTemplates,
  useSalesKpiAssignments,
} from '@/hooks/api/useSalesKpis';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { SALES_KPI_METRIC_LABELS } from '@/lib/constants';
import { formatWeekdays } from '@/lib/salesKpi';
import { useUIStore } from '@/store/useUIStore';
import { showApiError } from '@/utils/apiError';
import { tokens } from '@/styles/tokens';
import type { SalesKpiTemplate, User } from '@/types';

export const SalesKpiPanel = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const addToast = useUIStore((s) => s.addToast);

  const { data: templates = [], isLoading: templatesLoading } = useSalesKpiTemplates();
  const { data: assignments = [] } = useSalesKpiAssignments();
  const assignableUsers = useAssignableUsers();
  const deleteMutation = useDeleteSalesKpiTemplate();
  const assignMutation = useAssignSalesKpiTemplate();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalesKpiTemplate | null>(null);
  const [assignTarget, setAssignTarget] = useState<SalesKpiTemplate | null>(null);
  const [assignUsers, setAssignUsers] = useState<User[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTemplate, setMenuTemplate] = useState<SalesKpiTemplate | null>(null);

  // Split-view selection state: 'all' or specific templateId
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'templates' | 'assignees'>('templates');

  // Compute assignees count per template
  const assigneeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      const tid =
        typeof a.templateId === 'object' && a.templateId !== null
          ? String((a.templateId as any)._id)
          : String(a.templateId);
      map.set(tid, (map.get(tid) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase().trim();
    return templates.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const descMatch = (t.description ?? '').toLowerCase().includes(q);
      const itemMatch = (t.items ?? []).some(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (SALES_KPI_METRIC_LABELS[it.metric] ?? it.metric).toLowerCase().includes(q),
      );
      return nameMatch || descMatch || itemMatch;
    });
  }, [templates, templateSearch]);

  // Current active template
  const activeTemplate = useMemo(() => {
    if (selectedTemplateId === 'all') return null;
    return templates.find((t) => t._id === selectedTemplateId) ?? null;
  }, [templates, selectedTemplateId]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, template: SalesKpiTemplate) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuTemplate(template);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuTemplate(null);
  };

  const handleMenuAssign = () => {
    if (menuTemplate) {
      setAssignTarget(menuTemplate);
      setAssignUsers([]);
    }
    handleCloseMenu();
  };

  const handleMenuEdit = () => {
    if (menuTemplate) {
      setEditing(menuTemplate);
      setFormOpen(true);
    }
    handleCloseMenu();
  };

  const handleMenuDelete = () => {
    if (menuTemplate) {
      handleDelete(menuTemplate._id);
    }
    handleCloseMenu();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ message: 'Sales KPI template deleted.', severity: 'success' });
      if (selectedTemplateId === id) {
        setSelectedTemplateId('all');
      }
    } catch (err) {
      showApiError(err);
    }
  };

  const handleAssign = async () => {
    if (!assignTarget || assignUsers.length === 0) return;
    try {
      await assignMutation.mutateAsync({
        id: assignTarget._id,
        userIds: assignUsers.map((u) => u._id),
      });
      addToast({ message: 'Sales KPI template assigned.', severity: 'success' });
      setAssignTarget(null);
      setAssignUsers([]);
    } catch (err) {
      showApiError(err);
    }
  };

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    if (isMobile) {
      setMobileTab('assignees');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: isDarkMode ? '#fff' : tokens.text.primary,
              letterSpacing: '-0.02em',
            }}
          >
            Sales KPI Management
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: isDarkMode ? 'rgba(255,255,255,0.6)' : tokens.text.secondary,
              fontWeight: 500,
              mt: 0.25,
            }}
          >
            Select a template on the left to review rules and manage team member assignments on the right.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          sx={{
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            boxShadow: 'none',
            bgcolor: tokens.brand.solid,
            '&:hover': { bgcolor: tokens.brand.solid },
            whiteSpace: 'nowrap',
          }}
        >
          Create Template
        </Button>
      </Box>

      {/* Mobile Tab switcher (only when on small screens) */}
      {isMobile && (
        <Paper
          sx={{
            p: 0.5,
            borderRadius: '14px',
            bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: 'none',
          }}
        >
          <Tabs
            value={mobileTab}
            onChange={(_, val) => setMobileTab(val)}
            variant="fullWidth"
            sx={{
              minHeight: 38,
              '& .MuiTab-root': {
                minHeight: 38,
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.82rem',
                textTransform: 'none',
              },
              '& .Mui-selected': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#fff',
                color: `${tokens.brand.primary} !important`,
                boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab
              value="templates"
              label={`Templates (${templates.length})`}
              icon={<LayersOutlinedIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
            />
            <Tab
              value="assignees"
              label={`Assignments (${assignments.length})`}
              icon={<PeopleOutlineIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>
      )}

      {/* Main Split Grid */}
      <Grid container spacing={3}>
        {/* ─── LEFT PANE: TEMPLATES MASTER LIST ───────────────────────── */}
        {(!isMobile || mobileTab === 'templates') && (
          <Grid item xs={12} md={4.8} lg={4.2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Template Search Bar */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
                  },
                }}
              />

              {/* "All Templates" Selection Card */}
              <Card
                onClick={() => selectTemplate('all')}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderRadius: '16px',
                  bgcolor:
                    selectedTemplateId === 'all'
                      ? alpha(theme.palette.primary.main, isDarkMode ? 0.16 : 0.08)
                      : isDarkMode
                      ? 'rgba(30, 27, 36, 0.45)'
                      : '#fff',
                  border: `2px solid ${
                    selectedTemplateId === 'all'
                      ? tokens.brand.primary
                      : isDarkMode
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.05)'
                  }`,
                  boxShadow: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: tokens.brand.primary,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93, 26, 137, 0.08)',
                        color: tokens.brand.primary,
                      }}
                    >
                      <LayersOutlinedIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        All Team Assignments
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        View all active assignees across all templates
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    size="small"
                    label={`${assignments.length} total`}
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    }}
                  />
                </Box>
              </Card>

              {/* Templates List */}
              {templatesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={28} sx={{ color: tokens.brand.primary }} />
                </Box>
              ) : filteredTemplates.length === 0 ? (
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: '18px',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    boxShadow: 'none',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {templateSearch ? 'No matching templates' : 'No sales KPI templates yet.'}
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    maxHeight: { md: 'calc(100vh - 280px)' },
                    overflowY: { md: 'auto' },
                    pr: { md: 0.5 },
                  }}
                >
                  {filteredTemplates.map((template) => {
                    const isSelected = selectedTemplateId === template._id;
                    const count = assigneeCounts.get(template._id) ?? 0;
                    return (
                      <Card
                        key={template._id}
                        onClick={() => selectTemplate(template._id)}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          borderRadius: '16px',
                          bgcolor: isSelected
                            ? alpha(theme.palette.primary.main, isDarkMode ? 0.16 : 0.08)
                            : isDarkMode
                            ? 'rgba(30, 27, 36, 0.45)'
                            : '#fff',
                          border: `2px solid ${
                            isSelected
                              ? tokens.brand.primary
                              : isDarkMode
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.05)'
                          }`,
                          boxShadow: 'none',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: tokens.brand.primary,
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: 800,
                                  color: isDarkMode ? '#fff' : tokens.text.primary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {template.name}
                              </Typography>
                              {isSelected && (
                                <Chip
                                  size="small"
                                  label="Active"
                                  color="primary"
                                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, px: 0.2 }}
                                />
                              )}
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                fontWeight: 500,
                              }}
                            >
                              {template.description || `${template.items?.length ?? 0} KPI items`}
                            </Typography>
                          </Box>

                          <Tooltip title="Actions" arrow placement="top">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenMenu(e, template)}
                              sx={{
                                color: isDarkMode ? 'rgba(255,255,255,0.6)' : tokens.text.secondary,
                                borderRadius: '8px',
                                p: 0.5,
                                '&:hover': {
                                  color: tokens.brand.primary,
                                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(93, 26, 137, 0.08)',
                                },
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Metric Tags & Assigned Count */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mt: 1.5,
                            pt: 1,
                            borderTop: `1px solid ${
                              isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
                            }`,
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(template.items ?? []).slice(0, 2).map((item, idx) => (
                              <Chip
                                key={idx}
                                size="small"
                                label={SALES_KPI_METRIC_LABELS[item.metric] ?? item.metric}
                                sx={{
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93, 26, 137, 0.06)',
                                  color: tokens.brand.primary,
                                }}
                              />
                            ))}
                            {(template.items?.length ?? 0) > 2 && (
                              <Chip
                                size="small"
                                label={`+${template.items.length - 2}`}
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                              />
                            )}
                          </Box>

                          <Chip
                            size="small"
                            icon={<PeopleOutlineIcon sx={{ fontSize: '13px !important' }} />}
                            label={`${count} assigned`}
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor:
                                count > 0
                                  ? isDarkMode
                                    ? 'rgba(45, 138, 94, 0.15)'
                                    : 'rgba(45, 138, 94, 0.1)'
                                  : isDarkMode
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(0,0,0,0.04)',
                              color: count > 0 ? tokens.semantic.success : 'text.disabled',
                            }}
                          />
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Grid>
        )}

        {/* ─── RIGHT PANE: DETAIL & ASSIGNMENTS ──────────────────────── */}
        {(!isMobile || mobileTab === 'assignees') && (
          <Grid item xs={12} md={7.2} lg={7.8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Mobile Back Button */}
              {isMobile && (
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setMobileTab('templates')}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                >
                  Back to Templates
                </Button>
              )}

              {/* Template Banner / Detail Card */}
              {activeTemplate ? (
                <Card
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: '20px',
                    bgcolor: isDarkMode ? 'rgba(30, 27, 36, 0.6)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.03)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                        {activeTemplate.name}
                      </Typography>
                      {activeTemplate.description && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                          {activeTemplate.description}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => {
                          setEditing(activeTemplate);
                          setFormOpen(true);
                        }}
                        sx={{
                          textTransform: 'none',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PersonAddAlt1Icon />}
                        onClick={() => {
                          setAssignTarget(activeTemplate);
                          setAssignUsers([]);
                        }}
                        sx={{
                          textTransform: 'none',
                          borderRadius: '10px',
                          fontWeight: 700,
                          boxShadow: 'none',
                          bgcolor: tokens.brand.solid,
                          '&:hover': { bgcolor: tokens.brand.solid },
                        }}
                      >
                        Assign Members
                      </Button>
                    </Box>
                  </Box>

                  {/* Items List in Template */}
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Template KPI Rules ({activeTemplate.items?.length ?? 0})
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(activeTemplate.items ?? []).map((item, idx) => (
                      <Box
                        key={item._id ?? idx}
                        sx={{
                          display: 'flex',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1,
                          p: 1.25,
                          borderRadius: '12px',
                          bgcolor: isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 750, minWidth: { sm: 140 } }}>
                          {item.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={SALES_KPI_METRIC_LABELS[item.metric] ?? item.metric}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(93, 26, 137, 0.08)',
                              color: tokens.brand.primary,
                            }}
                          />
                          <Chip
                            label={item.scheduleMode === 'span' ? 'Single task' : 'Per day'}
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                          />
                          <PriorityBadge priority={item.priority} />
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {formatWeekdays(item.daysOfWeek)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            · {item.targetMode === 'manual' ? `Target: ${item.targetValue ?? '—'}` : 'Pipeline target'}
                          </Typography>
                          {(item.startTime || item.endTime) && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                              · {item.startTime || '00:00'} – {item.endTime || '23:59'}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Card>
              ) : (
                <Card
                  sx={{
                    p: 2.5,
                    borderRadius: '20px',
                    bgcolor: isDarkMode ? 'rgba(30, 27, 36, 0.45)' : '#fff',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                    boxShadow: 'none',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    All Member Assignments
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.25 }}>
                    Showing all sales team member assignments across all active templates.
                  </Typography>
                </Card>
              )}

              {/* Assignee Search & Filter Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                  mt: 1,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Assigned Members
                </Typography>
                <TextField
                  size="small"
                  placeholder="Filter members..."
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    width: { xs: 160, sm: 220 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
                    },
                  }}
                />
              </Box>

              {/* Assignments List */}
              <SalesKpiAssignmentsPanel
                filterTemplateId={selectedTemplateId}
                searchQuery={assigneeSearch}
                onAssignClick={() => {
                  if (activeTemplate) {
                    setAssignTarget(activeTemplate);
                  } else if (templates.length > 0) {
                    setAssignTarget(templates[0]);
                  }
                  setAssignUsers([]);
                }}
              />
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Template Create/Edit Modal */}
      {formOpen && (
        <SalesKpiTemplateForm open onClose={() => setFormOpen(false)} template={editing} />
      )}

      {/* 3-dots Actions Menu */}
      <Menu
        id="template-action-menu"
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              minWidth: 160,
              borderRadius: '16px',
              bgcolor: isDarkMode ? 'rgba(28, 25, 34, 0.98)' : '#fff',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDarkMode ? '0 12px 32px rgba(0,0,0,0.6)' : '0 12px 30px rgba(0,0,0,0.08)',
              p: 0.75,
            },
          },
        }}
      >
        <MenuItem
          onClick={handleMenuAssign}
          sx={{
            py: 1,
            px: 1.5,
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: tokens.brand.primary,
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: isDarkMode ? 'rgba(93, 26, 137, 0.2)' : 'rgba(93, 26, 137, 0.08)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: tokens.brand.primary }}>
            <PersonAddAlt1Icon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 700 }}>
            Assign
          </ListItemText>
        </MenuItem>

        <MenuItem
          onClick={handleMenuEdit}
          sx={{
            py: 1,
            px: 1.5,
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: isDarkMode ? '#fff' : tokens.text.primary,
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: isDarkMode ? 'rgba(255,255,255,0.7)' : tokens.text.secondary }}>
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Edit
          </ListItemText>
        </MenuItem>

        <MenuItem
          disabled={deleteMutation.isPending}
          onClick={handleMenuDelete}
          sx={{
            py: 1,
            px: 1.5,
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: tokens.semantic.error,
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: tokens.semantic.error }}>
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600, color: tokens.semantic.error }}>
            Delete
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Assign Users Modal */}
      <Dialog
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 2, sm: 4 },
            width: { xs: 'calc(100% - 32px)', sm: 'auto' },
            borderRadius: '20px',
            bgcolor: isDarkMode ? 'rgba(30, 27, 36, 0.95)' : '#fff',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Assign “{assignTarget?.name}”</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Autocomplete
            multiple
            options={assignableUsers}
            getOptionLabel={(u) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email}
            value={assignUsers}
            onChange={(_, v) => setAssignUsers(v)}
            renderInput={(params) => <TextField {...params} label="Assign to users" autoFocus />}
            sx={{ '& .MuiChip-root': { borderRadius: '8px' }, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setAssignTarget(null)} sx={{ textTransform: 'none', fontWeight: 700, color: tokens.text.secondary }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={assignUsers.length === 0 || assignMutation.isPending}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '12px',
              boxShadow: 'none',
              bgcolor: tokens.brand.solid,
              '&:hover': { bgcolor: tokens.brand.solid },
            }}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
