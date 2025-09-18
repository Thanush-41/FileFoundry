import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Close,
  Download,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';

interface FilePreviewProps {
  file: {
    id: string;
    filename: string;
    original_filename: string;
    mime_type: string;
    size: number;
  } | null;
  open: boolean;
  onClose: () => void;
  onDownload?: (file: any) => void;
  token: string | null;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  open,
  onClose,
  onDownload,
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Fetch file content with authentication when component mounts
  useEffect(() => {
    if (!file || !token || !open) return;

    const fetchFileContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}/view`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          setFileUrl(url);
          
          // For text files, also get the text content
          if (file.mime_type.startsWith('text/')) {
            const text = await blob.text();
            setFileContent(text);
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(`Failed to load file: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching file:', error);
        setError(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFileContent();

    // Cleanup blob URL when component unmounts or file changes
    return () => {
      if (fileUrl) {
        window.URL.revokeObjectURL(fileUrl);
      }
    };
  }, [file, token, open]);

  if (!file) return null;

  const getFileIconAndType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return { type: 'image', icon: '🖼️' };
    if (mimeType === 'application/pdf') return { type: 'pdf', icon: '📄' };
    if (mimeType.includes('word') || mimeType.includes('document')) return { type: 'document', icon: '📝' };
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return { type: 'presentation', icon: '📊' };
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { type: 'spreadsheet', icon: '📈' };
    if (mimeType.startsWith('video/')) return { type: 'video', icon: '🎥' };
    if (mimeType.startsWith('audio/')) return { type: 'audio', icon: '🎵' };
    if (mimeType.startsWith('text/')) return { type: 'text', icon: '📄' };
    return { type: 'unknown', icon: '📎' };
  };

  const { type, icon } = getFileIconAndType(file.mime_type);

  const renderPreview = () => {
    if (!fileUrl) return null;
    
    switch (type) {
      case 'image':
        return (
          <Box sx={{ textAlign: 'center', maxHeight: fullscreen ? '90vh' : '60vh', overflow: 'auto' }}>
            <img
              src={fileUrl}
              alt={file.original_filename}
              style={{
                maxWidth: '100%',
                maxHeight: fullscreen ? '85vh' : '55vh',
                objectFit: 'contain',
              }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load image');
              }}
            />
          </Box>
        );

      case 'pdf':
        return (
          <Box sx={{ height: fullscreen ? '85vh' : '60vh', width: '100%' }}>
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load PDF');
              }}
              title={file.original_filename}
            />
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ textAlign: 'center', maxHeight: fullscreen ? '85vh' : '60vh' }}>
            <video
              controls
              style={{
                maxWidth: '100%',
                maxHeight: fullscreen ? '80vh' : '55vh',
              }}
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load video');
              }}
            >
              <source src={fileUrl} type={file.mime_type} />
              Your browser does not support the video tag.
            </video>
          </Box>
        );

      case 'audio':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>🎵</Typography>
            <audio
              controls
              style={{ width: '100%', maxWidth: '400px' }}
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load audio');
              }}
            >
              <source src={fileUrl} type={file.mime_type} />
              Your browser does not support the audio tag.
            </audio>
          </Box>
        );

      case 'text':
        return (
          <Box sx={{ height: fullscreen ? '85vh' : '60vh', width: '100%', p: 2 }}>
            {fileContent ? (
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  height: '100%',
                  backgroundColor: 'background.paper',
                  color: 'text.primary',
                  padding: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {fileContent}
              </Box>
            ) : (
              <iframe
                src={fileUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'inherit',
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Failed to load text file');
                }}
                title={file.original_filename}
              />
            )}
          </Box>
        );

      default:
        // For office documents and other files, try to use iframe with download fallback
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>{icon}</Typography>
            <Typography variant="h6" gutterBottom>
              {file.original_filename}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              This file type ({file.mime_type}) cannot be previewed directly in the browser.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              For Office documents (Word, PowerPoint, Excel), you may need to download the file to view it properly.
            </Alert>
            {onDownload && (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => onDownload(file)}
                sx={{ mr: 2 }}
              >
                Download to View
              </Button>
            )}
          </Box>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={fullscreen ? false : 'lg'}
      fullWidth
      fullScreen={fullscreen}
      PaperProps={{
        sx: {
          height: fullscreen ? '100vh' : 'auto',
          maxHeight: fullscreen ? 'none' : '90vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Box>
          <Typography variant="h6" component="span">
            {icon} {file.original_filename}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            {formatFileSize(file.size)} • {file.mime_type}
          </Typography>
        </Box>
        <Box>
          <IconButton
            onClick={() => setFullscreen(!fullscreen)}
            size="small"
            sx={{ mr: 1 }}
          >
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, position: 'relative' }}>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px' 
          }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!error && renderPreview()}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {onDownload && (
          <Button
            startIcon={<Download />}
            onClick={() => onDownload(file)}
            variant="outlined"
          >
            Download
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};