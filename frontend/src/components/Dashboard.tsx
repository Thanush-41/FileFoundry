import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Paper,
  Button,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem as MenuItemMUI,
  Divider,
  Fab,
} from '@mui/material';
import {
  CloudUpload,
  Share,
  Storage,
  Logout,
  AccountCircle,
  Add,
  FolderOpen,
  InsertDriveFile,
  GridView,
  ViewList,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { FileUpload } from './FileUpload';
import { FileList } from './FileList';
import { AdminPanel } from './AdminPanel';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalFiles: 0,
    foldersCreated: 0,
    filesShared: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [fileListRefresh, setFileListRefresh] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Handle user menu
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Log user data for debugging (always run this hook)
  useEffect(() => {
    console.log('📊 Dashboard mounted, user data:', user);
    if (user) {
      console.log('👤 User details:', {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storageQuota: user.storageQuota,
        storageUsed: user.storageUsed,
      });
    } else {
      console.log('❌ No user data available');
    }
  }, [user]);

  // Fetch real stats from backend (always run this hook)
  useEffect(() => {
    // Only fetch stats for regular users, not admins
    if (isAdmin) {
      return;
    }

    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token available for stats');
        return;
      }

      try {
        console.log('📈 Fetching user stats...');
        setIsLoadingStats(true);
        
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Stats fetched successfully:', data);
          setStats({
            totalFiles: data.totalFiles || 0,
            foldersCreated: data.foldersCreated || 0,
            filesShared: data.filesShared || 0,
          });
        } else {
          console.error('❌ Failed to fetch stats:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error fetching stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (user && !isAdmin) {
      fetchStats();
    }
  }, [user, isAdmin]); // Added isAdmin to dependencies

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storagePercentage = user ? (user.storageUsed / user.storageQuota) * 100 : 0;

  const refreshStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalFiles: data.totalFiles || 0,
          foldersCreated: data.foldersCreated || 0,
          filesShared: data.filesShared || 0,
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing stats:', error);
    }
  };

  const handleFileDeleted = () => {
    console.log('🗑️ File deleted, refreshing stats...');
    refreshStats();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // If user is admin, show admin panel (after all hooks are called)
  if (isAdmin) {
    return <AdminPanel />;
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#fafafa',
      '& .MuiCard-root': {
        bgcolor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
      }
    }}>
      {/* Google Drive Style Header */}
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          bgcolor: '#ffffff', 
          borderBottom: '1px solid #e0e0e0',
          color: '#000000'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Storage sx={{ fontSize: 28, color: '#4285f4' }} />
            <Typography variant="h6" sx={{ color: '#5f6368', fontWeight: 400, fontSize: '22px' }}>
              Drive
            </Typography>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* User Info & Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#5f6368', display: { xs: 'none', sm: 'block' } }}>
              {user?.email}
            </Typography>
            <IconButton
              size="large"
              onClick={handleUserMenuOpen}
              sx={{ p: 0 }}
            >
              <Avatar sx={{ 
                width: 32, 
                height: 32, 
                bgcolor: '#1a73e8', 
                fontSize: 14,
                color: '#ffffff'
              }}>
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  minWidth: 200,
                }
              }}
            >
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#202124' }}>
                  {user?.username}
                </Typography>
                <Typography variant="caption" sx={{ color: '#5f6368' }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItemMUI onClick={handleUserMenuClose} sx={{ py: 1.5 }}>
                <AccountCircle sx={{ mr: 2, color: '#5f6368' }} />
                My Account
              </MenuItemMUI>
              <Divider />
              <MenuItemMUI onClick={handleLogout} sx={{ py: 1.5, color: '#ea4335' }}>
                <Logout sx={{ mr: 2 }} />
                Sign out
              </MenuItemMUI>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Quick Actions Bar */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{
              bgcolor: '#1a73e8',
              color: '#ffffff',
              textTransform: 'none',
              borderRadius: '20px',
              px: 3,
              py: 1,
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
              '&:hover': {
                bgcolor: '#1557b0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              }
            }}
          >
            New
          </Button>
        </Box>

        {/* Storage Usage Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#5f6368', mb: 1 }}>
                  {formatBytes(user?.storageUsed || 0)} of {formatBytes(user?.storageQuota || 0)} used
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={storagePercentage}
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: '#f1f3f4',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: storagePercentage > 80 ? '#ea4335' : '#1a73e8',
                      borderRadius: 3,
                    }
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#5f6368', ml: 2, minWidth: 'fit-content' }}>
                {storagePercentage.toFixed(1)}%
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <Box sx={{ mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                color: '#5f6368',
                minHeight: '48px',
              },
              '& .Mui-selected': {
                color: '#1a73e8',
              },
              '& .MuiTabs-indicator': {
                bgcolor: '#1a73e8',
                height: '3px',
              }
            }}
          >
            <Tab label="My Drive" />
            <Tab label="Recent" />
            <Tab label="Starred" disabled />
            <Tab label="Shared with me" disabled />
          </Tabs>
        </Box>

        {/* Main Content */}
        {activeTab === 0 && (
          <Box>
            {/* Quick Access Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="body1" sx={{ color: '#202124', fontWeight: 500, mb: 2 }}>
                Quick access
              </Typography>
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: { 
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(4, 1fr)'
                  },
                  gap: 2
                }}
              >
                {/* File Upload Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '2px dashed #e0e0e0',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#1a73e8',
                      bgcolor: '#f8f9ff',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    },
                  }}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <CloudUpload sx={{ fontSize: 48, color: '#5f6368', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#202124', fontWeight: 500, mb: 1 }}>
                    Upload Files
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5f6368' }}>
                    Drag files here or click to browse
                  </Typography>
                </Paper>

                {/* Create Folder Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#1a73e8',
                      bgcolor: '#f8f9ff',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    },
                  }}
                >
                  <FolderOpen sx={{ fontSize: 48, color: '#5f6368', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#202124', fontWeight: 500, mb: 1 }}>
                    New Folder
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5f6368' }}>
                    Organize your files
                  </Typography>
                </Paper>

                {/* Stats Cards */}
                <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <InsertDriveFile sx={{ fontSize: 32, color: '#1a73e8', mb: 1 }} />
                    <Typography variant="h4" sx={{ color: '#202124', fontWeight: 600, mb: 0.5 }}>
                      {isLoadingStats ? '...' : stats.totalFiles}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#5f6368' }}>
                      Files
                    </Typography>
                  </CardContent>
                </Card>

                <Card elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Share sx={{ fontSize: 32, color: '#34a853', mb: 1 }} />
                    <Typography variant="h4" sx={{ color: '#202124', fontWeight: 600, mb: 0.5 }}>
                      {isLoadingStats ? '...' : stats.filesShared}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#5f6368' }}>
                      Shared
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Recent Files Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body1" sx={{ color: '#202124', fontWeight: 500 }}>
                  Recent files
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => setViewMode('grid')}
                    sx={{ color: viewMode === 'grid' ? '#1a73e8' : '#5f6368' }}
                  >
                    <GridView />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setViewMode('list')}
                    sx={{ color: viewMode === 'list' ? '#1a73e8' : '#5f6368' }}
                  >
                    <ViewList />
                  </IconButton>
                </Box>
              </Box>
              <FileList 
                onFileDeleted={handleFileDeleted}
                refreshTrigger={fileListRefresh}
                viewMode={viewMode}
              />
            </Box>
          </Box>
        )}

        {activeTab === 1 && (
          <FileList 
            onFileDeleted={handleFileDeleted}
            refreshTrigger={fileListRefresh}
            viewMode={viewMode}
          />
        )}
      </Container>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: '#1a73e8',
          '&:hover': {
            bgcolor: '#1557b0',
          }
        }}
        onClick={() => setUploadDialogOpen(true)}
      >
        <Add />
      </Fab>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Files</DialogTitle>
        <DialogContent>
          <FileUpload 
            onUploadComplete={() => {
              console.log('� Upload completed, refreshing file list...');
              setUploadDialogOpen(false);
              refreshStats(); // Refresh stats
              setFileListRefresh(prev => prev + 1); // Trigger file list refresh
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};