import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  Share as ShareIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

interface SharedFileData {
  file: {
    id: string;
    filename: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    canPreview: boolean;
  };
  permission: string;
  shareInfo: {
    createdAt: string;
    expiresAt?: string;
    downloadCount: number;
    maxDownloads?: number;
  };
}

export const PublicSharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [sharedFile, setSharedFile] = useState<SharedFileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSharedFile();
    }
  }, [token]);

  const fetchSharedFile = async (pwd?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL(`/share/${token}`, window.location.origin);
      if (pwd) {
        url.searchParams.append('password', pwd);
      }

      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        setSharedFile(data);
        setPasswordRequired(false);
      } else if (response.status === 404) {
        const errorData = await response.json();
        if (errorData.error.includes('password required')) {
          setPasswordRequired(true);
          setError('This shared file is password protected.');
        } else {
          setError('This share link is invalid, expired, or has been revoked.');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load shared file.');
      }
    } catch (error: any) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (password.trim()) {
      fetchSharedFile(password);
    }
  };

  const handleDownload = async () => {
    if (!sharedFile || sharedFile.permission !== 'download') return;

    try {
      setDownloading(true);
      
      const url = new URL(`/share/${token}/download`, window.location.origin);
      if (password) {
        url.searchParams.append('password', password);
      }

      const response = await fetch(url.toString());

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = sharedFile.file.originalFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        // Refresh the share info to update download count
        setTimeout(() => fetchSharedFile(password), 1000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Download failed.');
      }
    } catch (error: any) {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiresAt?: string): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isDownloadLimitReached = (): boolean => {
    if (!sharedFile?.shareInfo.maxDownloads) return false;
    return sharedFile.shareInfo.downloadCount >= sharedFile.shareInfo.maxDownloads;
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={40} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <ShareIcon color="primary" />
        <Typography variant="h4">Shared File</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {passwordRequired && !sharedFile && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <LockIcon color="warning" />
              <Typography variant="h6">Password Required</Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" mb={3}>
              This shared file is protected with a password. Please enter the password to access it.
            </Typography>

            <Box display="flex" gap={2}>
              <TextField
                fullWidth
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              <Button 
                variant="contained" 
                onClick={handlePasswordSubmit}
                disabled={!password.trim()}
              >
                Access
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {sharedFile && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={3} mb={3}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                <FileIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Box flex={1}>
                <Typography variant="h5" gutterBottom>
                  {sharedFile.file.originalFilename}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip 
                    size="small" 
                    label={formatFileSize(sharedFile.file.size)} 
                  />
                  <Chip 
                    size="small" 
                    label={sharedFile.permission} 
                    color={sharedFile.permission === 'download' ? 'primary' : 'default'}
                  />
                  <Chip 
                    size="small" 
                    label={sharedFile.file.mimeType} 
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Share Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Shared on {formatDate(sharedFile.shareInfo.createdAt)}
              </Typography>
              
              {sharedFile.shareInfo.expiresAt && (
                <Typography 
                  variant="body2" 
                  color={isExpired(sharedFile.shareInfo.expiresAt) ? 'error' : 'warning.main'}
                >
                  {isExpired(sharedFile.shareInfo.expiresAt) ? 'Expired' : 'Expires'} on {formatDate(sharedFile.shareInfo.expiresAt)}
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                Downloads: {sharedFile.shareInfo.downloadCount}
                {sharedFile.shareInfo.maxDownloads && ` / ${sharedFile.shareInfo.maxDownloads}`}
              </Typography>
            </Box>

            {isExpired(sharedFile.shareInfo.expiresAt) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                This share link has expired and is no longer accessible.
              </Alert>
            )}

            {isDownloadLimitReached() && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This file has reached its download limit.
              </Alert>
            )}

            <Box display="flex" gap={2}>
              {sharedFile.file.canPreview && (
                <Button
                  variant="outlined"
                  startIcon={<ViewIcon />}
                  fullWidth
                  disabled={isExpired(sharedFile.shareInfo.expiresAt)}
                >
                  Preview
                </Button>
              )}
              
              {sharedFile.permission === 'download' && (
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                  disabled={
                    downloading || 
                    isExpired(sharedFile.shareInfo.expiresAt) || 
                    isDownloadLimitReached()
                  }
                  fullWidth
                >
                  {downloading ? 'Downloading...' : 'Download'}
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box mt={4} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Powered by File Vault System
        </Typography>
      </Box>
    </Container>
  );
};