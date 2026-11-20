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
  MenuItem,
  Paper,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SearchIcon from '@mui/icons-material/Search';
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
  const addToast = useUIStore((s) => s.addToast);

  const { data: templates = [], isLoading: templatesLoading } = useSalesKpiTemplates();
  const { data: assignments = [] } = useSalesKpiAssignments();
  const assignableUsers = useAssignableUsers();
  const deleteMutation = useDeleteSalesKpiTemplate();
  const assignMutation = useAssignSalesKpiTemplate();

  // Sub-tabs: 'assigned' (default) or 'templates'
  const [activeTab, setActiveTab] = useState<'assigned' | 'templates'>('assigned');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalesKpiTemplate | null>(null);
  const [assignTarget, setAssignTarget] = useState<SalesKpiTemplate | null>(null);
  const [assignUsers, setAssignUsers] = useState<User[]>([]);

  // Filter & Search states
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');

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

  // Filter templates list for the Templates tab
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

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addToast({ message: 'Sales KPI template deleted.', severity: 'success' });
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
            Manage sales KPI assignments for your team and configure reusable KPI templates.
          </Typography>
        </Box>

        {/* Action Button */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {activeTab === 'assigned' ? (
            <Button
              variant="contained"
              startIcon={<PersonAddAlt1Icon />}
              onClick={() => {
                if (templates.length > 0) {
                  const target =
                    selectedTemplateFilter !== 'all'
                      ? templates.find((t) => t._id === selectedTemplateFilter) ?? templates[0]
                      : templates[0];
                  setAssignTarget(target);
                }
                setAssignUsers([]);
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
              Assign Members
            </Button>
          ) : (
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
          )}
        </Box>
      </Box>

      {/* Sub-Tabs: Assigned Members vs Templates */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 0.5,
          borderRadius: '16px',
          bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          width: 'fit-content',
        }}
      >
        {[
          {
            id: 'assigned',
            label: `Assigned Members${assignments.length > 0 ? ` (${assignments.length})` : ''}`,
            icon: <PeopleOutlineIcon sx={{ fontSize: 18 }} />,
          },
          {
            id: 'templates',
            label: `KPI Templates${templates.length > 0 ? ` (${templates.length})` : ''}`,
            icon: <LayersOutlinedIcon sx={{ fontSize: 18 }} />,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'assigned' | 'templates')}
              startIcon={tab.icon}
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                px: { xs: 2, sm: 2.75 },
                py: 0.75,
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                bgcolor: isActive ? (isDarkMode ? '#fff' : '#1A1625') : 'transparent',
                color: isActive ? (isDarkMode ? '#1A1625' : '#fff') : 'text.secondary',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: isActive
                    ? (isDarkMode ? '#fff' : '#1A1625')
                    : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                },
              }}
            >
              {tab.label}
            </Button>
          );
        })}
      </Box>

      {/* ─── TAB 1: ASSIGNED MEMBERS ────────────────────────────────────────── */}
      {activeTab === 'assigned' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Controls: Search + Template Filter */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <TextField
                size="small"
                placeholder="Search member by name or email..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: { xs: '100%', sm: 280 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
                  },
                }}
              />

              <TextField
                select
                size="small"
                value={selectedTemplateFilter}
                onChange={(e) => setSelectedTemplateFilter(e.target.value)}
                sx={{
                  minWidth: { xs: '100%', sm: 220 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
                  },
                }}
              >
                <MenuItem value="all">All Templates</MenuItem>
                {templates.map((t) => (
                  <MenuItem key={t._id} value={t._id}>
                    {t.name} ({assigneeCounts.get(t._id) ?? 0})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          {/* Full-width Assignments List */}
          <SalesKpiAssignmentsPanel
            filterTemplateId={selectedTemplateFilter}
            searchQuery={assigneeSearch}
            onAssignClick={() => {
              if (templates.length > 0) {
                const target =
                  selectedTemplateFilter !== 'all'
                    ? templates.find((t) => t._id === selectedTemplateFilter) ?? templates[0]
                    : templates[0];
                setAssignTarget(target);
              }
              setAssignUsers([]);
            }}
          />
        </Box>
      )}

      {/* ─── TAB 2: KPI TEMPLATES ─────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Search bar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <TextField
              size="small"
              placeholder="Search templates by name, metric, or description..."
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
                minWidth: { xs: '100%', sm: 320 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff',
                },
              }}
            />
          </Box>

          {templatesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
              <CircularProgress sx={{ color: tokens.brand.primary }} />
            </Box>
          ) : filteredTemplates.length === 0 ? (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '24px',
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                border: `2px dashed ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: 'none',
              }}
            >
              <LayersOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.5, mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {templateSearch ? 'No matching templates found' : 'No Sales KPI templates yet'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
                {templateSearch
                  ? 'Try refining your search query.'
                  : 'Create a template to set up reusable Sales KPI targets for your sales team.'}
              </Typography>
              {!templateSearch && (
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
                    bgcolor: tokens.brand.solid,
                    '&:hover': { bgcolor: tokens.brand.solid },
                  }}
                >
                  Create First Template
                </Button>
              )}
            </Paper>
          ) : (
            <Box
              sx={{
                columnCount: { xs: 1, md: 2 },
                columnGap: 2.5,
              }}
            >
              {filteredTemplates.map((template) => {
                const count = assigneeCounts.get(template._id) ?? 0;
                return (
                  <Box
                    key={template._id}
                    sx={{
                      breakInside: 'avoid',
                      display: 'inline-block',
                      width: '100%',
                      mb: 2.5,
                    }}
                  >
                    <Card
                      sx={{
                        p: 2.5,
                        borderRadius: '20px',
                        bgcolor: isDarkMode ? 'rgba(30, 27, 36, 0.45)' : '#fff',
                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDarkMode ? 'none' : '0 2px 12px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'auto',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: tokens.brand.primary,
                          boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.06)',
                        },
                      }}
                    >
                      {/* Card Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: isDarkMode ? '#fff' : tokens.text.primary }}>
                            {template.name}
                          </Typography>
                          {template.description && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontWeight: 500 }}>
                              {template.description}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          size="small"
                          icon={<PeopleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                          label={`${count} assigned`}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(93, 26, 137, 0.08)',
                            color: tokens.brand.primary,
                          }}
                        />
                      </Box>

                      {/* Rules / Items inside template */}
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'text.secondary',
                          mb: 1,
                          display: 'block',
                        }}
                      >
                        KPI Rules ({template.items?.length ?? 0})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                        {(template.items ?? []).map((item, idx) => (
                          <Box
                            key={item._id ?? idx}
                            sx={{
                              p: 1.25,
                              borderRadius: '12px',
                              bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.75,
                            }}
                          >
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 750, minWidth: 120 }}>
                                {item.name}
                              </Typography>
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
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                {formatWeekdays(item.daysOfWeek)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                · {item.targetMode === 'manual' ? `Target: ${item.targetValue ?? '—'}` : 'Pipeline target'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>

                      {/* Actions Footer */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          pt: 1.5,
                          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonAddAlt1Icon />}
                          onClick={() => {
                            setAssignTarget(template);
                            setAssignUsers([]);
                          }}
                          sx={{
                            textTransform: 'none',
                            borderRadius: '10px',
                            fontWeight: 700,
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                            color: isDarkMode ? '#fff' : tokens.text.primary,
                          }}
                        >
                          Assign to Team
                        </Button>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditing(template);
                              setFormOpen(true);
                            }}
                            sx={{ color: 'text.secondary', '&:hover': { color: tokens.brand.primary } }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(template._id)}
                            sx={{ color: 'text.secondary', '&:hover': { color: tokens.semantic.error } }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Card>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Template Create/Edit Modal */}
      {formOpen && (
        <SalesKpiTemplateForm open onClose={() => setFormOpen(false)} template={editing} />
      )}

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
