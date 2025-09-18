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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
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
  Visibility,
  DriveFileMove,
  Folder as FolderIcon,
  Home,
  ChevronRight,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { FilePreview } from './FilePreview';

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

interface Folder {
  id: string;
  name: string;
  path: string;
  parent_id?: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
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
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<File | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [moving, setMoving] = useState(false);
  
  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolders, setCurrentFolders] = useState<Folder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);

  useEffect(() => {
    fetchFoldersAndFiles();
  }, [token, refreshTrigger, currentFolderId]);

  const fetchFoldersAndFiles = async () => {
    if (!token) {
      setError('No authentication token available');
      setLoading(false);
      return;
    }

    try {
      console.log('📁 Fetching folders and files for folder:', currentFolderId || 'root');
      setLoading(true);
      setError(null);

      // Fetch folders for current directory
      const foldersUrl = currentFolderId 
        ? `${process.env.REACT_APP_API_URL}/api/v1/folders/?parent_id=${currentFolderId}`
        : `${process.env.REACT_APP_API_URL}/api/v1/folders/?parent_id=root`;
      
      const foldersResponse = await fetch(foldersUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Fetch files for current directory
      const filesUrl = currentFolderId 
        ? `${process.env.REACT_APP_API_URL}/api/v1/files/?folder_id=${currentFolderId}`
        : `${process.env.REACT_APP_API_URL}/api/v1/files/?folder_id=root`;
      
      const filesResponse = await fetch(filesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (foldersResponse.ok && filesResponse.ok) {
        const foldersData = await foldersResponse.json();
        const filesData = await filesResponse.json();
        
        console.log('✅ Folders fetched successfully:', foldersData);
        console.log('✅ Files fetched successfully:', filesData);
        
        setCurrentFolders(foldersData.folders || []);
        setFiles(filesData.files || []);
        
        // Update breadcrumbs if we're in a specific folder
        if (currentFolderId) {
          updateBreadcrumbs(currentFolderId);
        } else {
          setBreadcrumbs([]);
        }
      } else {
        const foldersError = await foldersResponse.json().catch(() => ({ error: 'Unknown folder error' }));
        const filesError = await filesResponse.json().catch(() => ({ error: 'Unknown file error' }));
        setError(`Failed to fetch data: ${foldersError.error || filesError.error}`);
        console.error('❌ Failed to fetch data:', foldersError, filesError);
      }
    } catch (error) {
      console.error('❌ Error fetching folders and files:', error);
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBreadcrumbs = async (folderId: string) => {
    if (!token) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/folders/${folderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const folder = data.folder;
        console.log('📂 Current folder:', folder);
        
        // Build breadcrumb trail
        const crumbs = [];
        let current = folder;
        while (current) {
          crumbs.unshift(current);
          current = current.parent;
        }
        setBreadcrumbs(crumbs);
      }
    } catch (error) {
      console.error('❌ Error fetching folder details:', error);
    }
  };

  const refreshFiles = () => {
    fetchFoldersAndFiles();
  };

  // Fetch folders for move dialog
  const fetchFolders = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/folders/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  // Handle move file to folder
  const handleMoveFile = async () => {
    if (!fileToMove || !token) return;

    try {
      setMoving(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${fileToMove.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          folder_id: selectedFolderId || null,
        }),
      });

      if (response.ok) {
        setMoveDialogOpen(false);
        refreshFiles(); // Refresh the file list
        if (onFileDeleted) onFileDeleted(); // Notify parent component
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to move file');
      }
    } catch (error) {
      console.error('Error moving file:', error);
      setError('Error moving file');
    } finally {
      setMoving(false);
    }
  };

  const openMoveDialog = (file: File) => {
    setFileToMove(file);
    setSelectedFolderId('');
    setMoveDialogOpen(true);
    fetchFolders();
  };

  const closeMoveDialog = () => {
    setMoveDialogOpen(false);
    setFileToMove(null);
    setSelectedFolderId('');
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

  // Navigation functions
  const handleFolderClick = (folderId: string) => {
    console.log('📂 Navigating to folder:', folderId);
    setCurrentFolderId(folderId);
  };

  const handleNavigateToRoot = () => {
    console.log('🏠 Navigating to root');
    setCurrentFolderId(null);
  };

  const handleBreadcrumbClick = (folderId: string | null) => {
    console.log('🍞 Breadcrumb navigation to:', folderId || 'root');
    setCurrentFolderId(folderId);
  };

  const handleDownload = async (file: File) => {
    try {
      console.log('📥 Downloading file:', file.filename);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}/view`, {
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

  const handlePreview = (file: File) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewFile(null);
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

  if (files.length === 0 && currentFolders.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <FilePresent sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {currentFolderId ? 'This folder is empty' : 'No files uploaded yet'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentFolderId ? 'Upload files or create folders to get started!' : 'Upload your first file to get started!'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Breadcrumbs for navigation removed as requested */}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {currentFolders.length + files.length} item{currentFolders.length + files.length !== 1 ? 's' : ''} ({currentFolders.length} folder{currentFolders.length !== 1 ? 's' : ''}, {files.length} file{files.length !== 1 ? 's' : ''})
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
            {/* Folders */}
            {currentFolders.map((folder) => (
              <TableRow 
                key={`folder-${folder.id}`} 
                hover 
                sx={{ cursor: 'pointer' }}
                onClick={() => handleFolderClick(folder.id)}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon color="primary" />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {folder.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Folder
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label="FOLDER" 
                    size="small" 
                    variant="outlined"
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(folder.created_at)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Open Folder">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFolderClick(folder.id);
                        }}
                        color="primary"
                      >
                        <FolderIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            
            {/* Files */}
            {files.map((file) => (
              <TableRow key={`file-${file.id}`} hover>
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
                    <Tooltip title="View">
                      <IconButton
                        size="small"
                        onClick={() => handlePreview(file)}
                        color="secondary"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(file)}
                        color="primary"
                      >
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Move to Folder">
                      <IconButton
                        size="small"
                        onClick={() => openMoveDialog(file)}
                        color="secondary"
                      >
                        <DriveFileMove fontSize="small" />
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

      {/* Move File Dialog */}
      <Dialog open={moveDialogOpen} onClose={closeMoveDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Move File to Folder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Move "{fileToMove?.original_filename}" to:
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Destination Folder</InputLabel>
            <Select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              label="Destination Folder"
              disabled={moving}
            >
              <MenuItem value="">
                <em>Root Directory</em>
              </MenuItem>
              {folders.map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.path || folder.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMoveDialog} disabled={moving}>
            Cancel
          </Button>
          <Button 
            onClick={handleMoveFile} 
            color="primary" 
            variant="contained"
            disabled={moving}
            startIcon={moving ? <CircularProgress size={16} /> : undefined}
          >
            {moving ? 'Moving...' : 'Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Preview Dialog */}
      <FilePreview
        file={previewFile}
        open={previewOpen}
        onClose={handleClosePreview}
        onDownload={handleDownload}
        token={token}
      />
    </Box>
  );
};