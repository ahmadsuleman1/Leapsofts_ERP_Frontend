import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Dialog,
  DialogContent,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import type { AiMessageAttachment } from '@/hooks/api/useAi';
import { showApiError } from '@/utils/apiError';

export const MAX_AI_SCREENSHOTS = 3;
export const MAX_AI_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export interface PendingScreenshotItem {
  file: File;
  previewUrl: string;
}

export const usePendingScreenshots = () => {
  const [items, setItems] = useState<PendingScreenshotItem[]>([]);

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;

    setItems((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (!ALLOWED_TYPES.has(file.type)) {
          showApiError(new Error('Only PNG, JPG, or WebP screenshots are supported'));
          continue;
        }
        if (file.size > MAX_AI_SCREENSHOT_BYTES) {
          showApiError(new Error(`${file.name} exceeds 5 MB limit`));
          continue;
        }
        if (next.length >= MAX_AI_SCREENSHOTS) {
          showApiError(new Error(`Maximum ${MAX_AI_SCREENSHOTS} screenshots per message`));
          break;
        }
        next.push({ file, previewUrl: URL.createObjectURL(file) });
      }
      return next;
    });
  }, []);

  const removeAt = useCallback((index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clear = useCallback(() => {
    // Do not revoke blob URLs here because optimistic chat messages still render them until server response arrives.
    setItems([]);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles],
  );

  return {
    items,
    files: items.map((i) => i.file),
    addFiles,
    removeAt,
    clear,
    handlePaste,
  };
};

export const AiPendingScreenshotsBar = ({
  items,
  onRemove,
}: {
  items: PendingScreenshotItem[];
  onRemove: (index: number) => void;
}) => {
  const theme = useTheme();
  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        px: 2,
        pt: 1.25,
      }}
    >
      {items.map((item, idx) => (
        <Box
          key={item.previewUrl}
          sx={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: '10px',
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
            bgcolor: 'background.paper',
          }}
        >
          <Box
            component="img"
            src={item.previewUrl}
            alt={item.file.name || 'Screenshot'}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <Tooltip title="Remove screenshot" arrow>
            <IconButton
              size="small"
              onClick={() => onRemove(idx)}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 18,
                height: 18,
                bgcolor: 'rgba(0,0,0,0.68)',
                color: '#fff',
                p: 0,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.88)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
        {items.length}/{MAX_AI_SCREENSHOTS} attached (auto-deleted after 30d)
      </Typography>
    </Box>
  );
};

export const AiMessageAttachments = ({
  attachments,
  isUser,
}: {
  attachments?: AiMessageAttachment[];
  isUser: boolean;
}) => {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {attachments.map((att, idx) => {
          if (att.expiredAt || !att.url) {
            return (
              <Chip
                key={idx}
                size="small"
                icon={<BrokenImageOutlinedIcon sx={{ fontSize: 14 }} />}
                label={att.expiredAt ? 'Screenshot expired (30d)' : 'Screenshot attached (no cloud preview)'}
                variant="outlined"
                sx={{
                  fontSize: '0.72rem',
                  color: isUser ? 'rgba(255,255,255,0.85)' : 'text.secondary',
                  borderColor: isUser ? 'rgba(255,255,255,0.35)' : 'divider',
                }}
              />
            );
          }

          return (
            <Box
              key={att.publicId || att.url || idx}
              onClick={() => setZoomUrl(att.url || null)}
              sx={{
                position: 'relative',
                width: 112,
                height: 76,
                borderRadius: '10px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: isUser ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(0,0,0,0.12)',
                '&:hover .zoom-overlay': { opacity: 1 },
              }}
            >
              <Box
                component="img"
                src={att.url}
                alt="Uploaded screenshot"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <Box
                className="zoom-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.36)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                  color: '#fff',
                }}
              >
                <ZoomInRoundedIcon fontSize="small" />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Dialog
        open={Boolean(zoomUrl)}
        onClose={() => setZoomUrl(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible' } }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setZoomUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.65)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          {zoomUrl && (
            <Box
              component="img"
              src={zoomUrl}
              alt="Screenshot preview"
              sx={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: '12px',
                display: 'block',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
