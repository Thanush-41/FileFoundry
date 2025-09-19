import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`shared-files-tabpanel-${index}`}
      aria-labelledby={`shared-files-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const SharedFilesView: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  const [myShareLinks, setMyShareLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedFiles();
    fetchMyShareLinks();
  }, []);

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchSharedFiles = async () => {
    try {
      console.log('🔍 Fetching shared files with token:', token ? 'Present' : 'Missing');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/shared-files`, {
        headers: getAuthHeaders()
      });
      
      console.log('📊 Shared files response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📁 Shared files data:', data);
        setSharedWithMe(data.shared_files || []);
      } else {
        const errorText = await response.text();
        console.error('❌ Shared files error:', response.status, errorText);
        throw new Error(`Failed to fetch shared files: ${response.status}`);
      }
    } catch (error: any) {
      console.error('🚨 Shared files fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyShareLinks = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/share-links`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setMyShareLinks(data.share_links || []);
      } else {
        throw new Error('Failed to fetch share links');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
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

  const copyShareLink = async (token: string) => {
    const shareUrl = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      // You could show a toast notification here
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Shared Files
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab icon={<PersonIcon />} label={`Shared with Me (${sharedWithMe.length})`} />
        <Tab icon={<LinkIcon />} label={`My Share Links (${myShareLinks.length})`} />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {sharedWithMe.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" textAlign="center">
                No files have been shared with you yet.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box>
            {sharedWithMe.map((share) => (
              <Card key={share.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar>
                      <FileIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" noWrap>
                        {share.file.original_filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Shared by {share.shared_by_user.first_name} {share.shared_by_user.last_name}
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Chip 
                          size="small" 
                          label={share.permission} 
                          color={share.permission === 'download' ? 'primary' : 'default'}
                        />
                        <Chip 
                          size="small" 
                          label={formatFileSize(share.file.size)} 
                        />
                        <Chip 
                          size="small" 
                          label={`Shared ${formatDate(share.created_at)}`}
                          icon={<ScheduleIcon />}
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Tooltip title="View File">
                        <IconButton color="primary">
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {share.permission === 'download' && (
                        <Tooltip title="Download File">
                          <IconButton color="primary">
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {myShareLinks.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" textAlign="center">
                You haven't created any share links yet.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box>
            {myShareLinks.map((link) => (
              <Card key={link.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar>
                      <LinkIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" noWrap>
                        {link.file.original_filename}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Share link created {formatDate(link.created_at)}
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Chip 
                          size="small" 
                          label={link.permission} 
                          color={link.permission === 'download' ? 'primary' : 'default'}
                        />
                        <Chip 
                          size="small" 
                          label={`${link.download_count} downloads`}
                        />
                        {link.max_downloads && (
                          <Chip 
                            size="small" 
                            label={`Max: ${link.max_downloads}`}
                          />
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <Tooltip title="Copy Share Link">
                        <IconButton 
                          color="primary"
                          onClick={() => copyShareLink(link.share_token)}
                        >
                          <LinkIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};