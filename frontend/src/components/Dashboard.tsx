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
  TextField,
  Snackbar,
  Alert as MuiAlert,
  CircularProgress,
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
  Savings,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { FileUpload } from './FileUpload';
import { FileList } from './FileList';
import { AdminPanel } from './AdminPanel';

export const Dashboard: React.FC = () => {
  console.log('🏗️ Dashboard component rendering/mounting');
  console.log('🔧 Environment check:', {
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    nodeEnv: process.env.NODE_ENV
  });
  const { user, logout, token } = useAuth();
  const [stats, setStats] = useState({
    totalFiles: 0,
    foldersCreated: 0,
    filesShared: 0,
    totalUploadedBytes: 0,
    actualStorageBytes: 0,
    savedBytes: 0,
    savingsPercent: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [fileListRefresh, setFileListRefresh] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Folder creation state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreating, setFolderCreating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Add logging for state changes
  useEffect(() => {
    console.log('📊 Dialog State Changed:', {
      folderDialogOpen,
      timestamp: new Date().toISOString()
    });
  }, [folderDialogOpen]);

  useEffect(() => {
    console.log('📝 Folder Name Changed:', newFolderName);
  }, [newFolderName]);

  useEffect(() => {
    console.log('🔧 Folder Creating State:', folderCreating);
  }, [folderCreating]);

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

  // Folder creation functions
  const handleCreateFolder = async () => {
    console.log('🚀 handleCreateFolder called', {
      newFolderName: newFolderName,
      trimmed: newFolderName.trim(),
      token: token ? 'Token exists' : 'No token'
    });

    if (!newFolderName.trim()) {
      console.log('❌ Empty folder name, showing error');
      setSnackbarMessage('Please enter a folder name');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      console.log('🔄 Starting folder creation API call...');
      setFolderCreating(true);
      
      const requestBody = {
        name: newFolderName.trim(),
        parent_id: null, // Create at root level
      };
      
      console.log('📤 API Request:', {
        url: `${process.env.REACT_APP_API_URL}/api/v1/folders/`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: requestBody
      });

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/folders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Folder created successfully:', responseData);
        setSnackbarMessage('Folder created successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        setFolderDialogOpen(false);
        setNewFolderName('');
        setFileListRefresh(prev => prev + 1); // Refresh file list
      } else {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        setSnackbarMessage(errorData.error || 'Failed to create folder');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('💥 Network/JavaScript Error:', error);
      setSnackbarMessage('Error creating folder');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      console.log('🏁 Folder creation process finished');
      setFolderCreating(false);
    }
  };

  const handleCloseFolderDialog = () => {
    console.log('❌ Closing folder dialog');
    setFolderDialogOpen(false);
    setNewFolderName('');
  };

  const handleSnackbarClose = () => {
    console.log('📪 Closing snackbar');
    setSnackbarOpen(false);
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
            totalFiles: data.file_count || 0,
            foldersCreated: data.foldersCreated || 0,
            filesShared: data.filesShared || 0,
            totalUploadedBytes: data.total_uploaded_bytes || 0,
            actualStorageBytes: data.actual_storage_bytes || 0,
            savedBytes: data.saved_bytes || 0,
            savingsPercent: data.storage_efficiency || 0,
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
  }, [user, isAdmin, token]); // Added token to dependencies

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storagePercentage = user ? (user.storageUsed / user.storageQuota) * 100 : 0;

  const refreshStats = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalFiles: data.file_count || 0,
          foldersCreated: data.foldersCreated || 0,
          filesShared: data.filesShared || 0,
          totalUploadedBytes: data.total_uploaded_bytes || 0,
          actualStorageBytes: data.actual_storage_bytes || 0,
          savedBytes: data.saved_bytes || 0,
          savingsPercent: data.storage_efficiency || 0,
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
      bgcolor: 'background.default',
      color: 'text.primary',
      '& .MuiCard-root': {
        bgcolor: 'background.paper',
        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.05)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }
    }}>
      {/* Modern Dark Header */}
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          bgcolor: 'background.default', 
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Storage sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '22px' }}>
              FileVault
            </Typography>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* User Info & Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
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
                bgcolor: 'primary.main', 
                fontSize: 14,
                color: 'primary.contrastText'
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
                  boxShadow: '0 8px 32px rgba(255, 255, 255, 0.1)',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  minWidth: 200,
                  bgcolor: 'background.paper',
                }
              }}
            >
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {user?.username}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {user?.email}
                </Typography>
              </Box>
              <MenuItemMUI onClick={handleUserMenuClose} sx={{ py: 1.5 }}>
                <AccountCircle sx={{ mr: 2, color: 'text.secondary' }} />
                My Account
              </MenuItemMUI>
              <Divider />
              <MenuItemMUI onClick={handleLogout} sx={{ py: 1.5, color: 'text.primary' }}>
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
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              textTransform: 'none',
              borderRadius: '12px',
              px: 3,
              py: 1.5,
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 16px rgba(255, 255, 255, 0.15)',
              '&:hover': {
                bgcolor: 'primary.dark',
                boxShadow: '0 6px 20px rgba(255, 255, 255, 0.2)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease-in-out',
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
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  {formatBytes(user?.storageUsed || 0)} of {formatBytes(user?.storageQuota || 0)} used
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={storagePercentage}
                  sx={{ 
                    height: 8, 
                    borderRadius: 4,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: storagePercentage > 80 ? '#ffffff' : 'primary.main',
                      borderRadius: 4,
                    }
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2, minWidth: 'fit-content' }}>
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
                color: 'text.secondary',
                minHeight: '48px',
              },
              '& .Mui-selected': {
                color: 'primary.main',
              },
              '& .MuiTabs-indicator': {
                bgcolor: 'primary.main',
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
              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, mb: 2 }}>
                Quick access
              </Typography>
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: { 
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(5, 1fr)'
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
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.2s ease',
                    bgcolor: 'background.paper',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(255, 255, 255, 0.1)',
                    },
                  }}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 500, mb: 1 }}>
                    Upload Files
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Drag files here or click to browse
                  </Typography>
                </Paper>

                {/* Create Folder Card */}
                <Paper
                  component="div"
                  elevation={0}
                  onClick={(e) => {
                    console.log('🔥 NEW FOLDER CARD CLICKED!', {
                      event: e,
                      timestamp: new Date().toISOString(),
                      currentFolderDialogState: folderDialogOpen
                    });
                    console.log('🔥 Setting folderDialogOpen to true...');
                    setFolderDialogOpen(true);
                    console.log('🔥 setFolderDialogOpen called');
                  }}
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.2s ease',
                    backgroundColor: 'background.paper',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(255, 255, 255, 0.1)',
                    },
                    '&:active': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <FolderOpen sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 500, mb: 1 }}>
                    New Folder
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Organize your files
                  </Typography>
                </Paper>

                {/* Stats Cards */}
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <InsertDriveFile sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
                      {isLoadingStats ? '...' : stats.totalFiles}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Files
                    </Typography>
                  </CardContent>
                </Card>

                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Share sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
                      {isLoadingStats ? '...' : stats.filesShared}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Shared
                    </Typography>
                  </CardContent>
                </Card>

                {/* Storage Savings Card */}
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Savings sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
                      {isLoadingStats ? '...' : `${Math.round(stats.savingsPercent)}%`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Storage Saved
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Recent Files Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  Recent files
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => setViewMode('grid')}
                    sx={{ color: viewMode === 'grid' ? 'primary.main' : 'text.secondary' }}
                  >
                    <GridView />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setViewMode('list')}
                    sx={{ color: viewMode === 'list' ? 'primary.main' : 'text.secondary' }}
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
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            bgcolor: 'primary.dark',
            transform: 'scale(1.05)',
          },
          transition: 'all 0.2s ease-in-out',
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

      {/* Folder Creation Dialog */}
      {(() => {
        console.log('🪟 DIALOG RENDERING:', { folderDialogOpen, timestamp: new Date().toISOString() });
        return null;
      })()}
      <Dialog
        open={folderDialogOpen}
        onClose={handleCloseFolderDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !folderCreating) {
                handleCreateFolder();
              }
            }}
            disabled={folderCreating}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFolderDialog} disabled={folderCreating}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateFolder} 
            variant="contained"
            disabled={folderCreating || !newFolderName.trim()}
          >
            {folderCreating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};