import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Download,
  Delete,
  FilePresent,
  PictureAsPdf,
  Image,
  VideoFile,
  AudioFile,
  Description,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface File {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  tags?: string[];
  description?: string;
}

interface FileListProps {
  onFileDeleted?: () => void;
  refreshTrigger?: number;
  viewMode?: 'grid' | 'list';
}

export const FileList: React.FC<FileListProps> = ({ onFileDeleted, refreshTrigger, viewMode = 'list' }) => {
  const { token } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<File | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!token) {
        setError('No authentication token available');
        setLoading(false);
        return;
      }

      try {
        console.log('📁 Fetching user files...');
        setLoading(true);
        setError(null);

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Files fetched successfully:', data);
          setFiles(data.files || []);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(`Failed to fetch files: ${errorData.error || response.statusText}`);
          console.error('❌ Failed to fetch files:', response.status, errorData);
        }
      } catch (error) {
        console.error('❌ Error fetching files:', error);
        setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [token, refreshTrigger]);

  const refreshFiles = () => {
    if (!token) {
      setError('No authentication token available');
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        console.log('📁 Refreshing user files...');
        setLoading(true);
        setError(null);

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Files refreshed successfully:', data);
          setFiles(data.files || []);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(`Failed to fetch files: ${errorData.error || response.statusText}`);
          console.error('❌ Failed to fetch files:', response.status, errorData);
        }
      } catch (error) {
        console.error('❌ Error fetching files:', error);
        setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image color="primary" />;
    if (mimeType === 'application/pdf') return <PictureAsPdf color="error" />;
    if (mimeType.startsWith('video/')) return <VideoFile color="secondary" />;
    if (mimeType.startsWith('audio/')) return <AudioFile color="info" />;
    if (mimeType.startsWith('text/')) return <Description color="action" />;
    return <FilePresent color="action" />;
  };

  const handleDownload = async (file: File) => {
    try {
      console.log('📥 Downloading file:', file.filename);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.original_filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('✅ File downloaded successfully');
      } else {
        console.error('❌ Failed to download file:', response.status);
        setError('Failed to download file');
      }
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      setError('Error downloading file');
    }
  };

  const handleDeleteClick = (file: File) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete || !token) return;

    try {
      console.log('🗑️ Deleting file:', fileToDelete.filename);
      setDeleting(true);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        console.log('✅ File deleted successfully');
        setFiles(files.filter(f => f.id !== fileToDelete.id));
        setDeleteDialogOpen(false);
        setFileToDelete(null);
        if (onFileDeleted) {
          onFileDeleted();
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to delete file:', response.status, errorData);
        setError(`Failed to delete file: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      setError(`Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading files...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={refreshFiles} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (files.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <FilePresent sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No files uploaded yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload your first file to get started!
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          My Files ({files.length})
        </Typography>
        <Button variant="outlined" size="small" onClick={refreshFiles}>
          Refresh
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFileIcon(file.mime_type)}
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {file.original_filename}
                      </Typography>
                      {file.description && (
                        <Typography variant="caption" color="text.secondary">
                          {file.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatBytes(file.size)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={file.mime_type.split('/')[1].toUpperCase()} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(file.created_at)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(file)}
                        color="primary"
                      >
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(file)}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{fileToDelete?.original_filename}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};