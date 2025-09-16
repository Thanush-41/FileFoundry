import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem as MenuItemMUI,
  Divider,
  Container,
} from '@mui/material';
import {
  AdminPanelSettings,
  People,
  Storage,
  CloudUpload,
  TrendingUp,
  Delete,
  Edit,
  Logout,
  AccountCircle,
  Folder,
  Share,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface GlobalStats {
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  activeUsers: number;
  filesUploadedToday: number;
  totalFolders: number;
  totalSharedLinks: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  storageQuota: number;
  storageUsed: number;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
}

export const AdminPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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

  // API base URL
  const API_BASE = 'http://localhost:8080/api/v1';

  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  // Load users list
  const loadUsersExternal = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    }
  };

  // Update user role
  const updateUserRole = async (userId: string, role: 'user' | 'admin') => {
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      // Refresh users list
      await loadUsersExternal();
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Failed to update user role:', err);
      setError('Failed to update user role');
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      // Refresh users list
      await loadUsersExternal();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError('Failed to delete user');
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/stats`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to load statistics');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError('Failed to load statistics');
      }
    };

    const loadUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/users`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to load users');
        }

        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error('Failed to load users:', err);
        setError('Failed to load users');
      }
    };

    const initializeData = async () => {
      setIsLoading(true);
      await Promise.all([loadStats(), loadUsers()]);
      setIsLoading(false);
    };

    initializeData();
  }, []); // Empty dependency array since functions are defined inside

  if (!user || user.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#fafafa',
      '& .MuiCard-root': {
        bgcolor: '#ffffff',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e0e0e0',
      }
    }}>
      {/* Modern Header */}
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
          <AdminPanelSettings sx={{ fontSize: 28, color: '#000000', mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: '#000000', fontWeight: 600 }}>
            Admin Dashboard
          </Typography>
          
          {/* User Info & Logout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#666666' }}>
              Welcome, {user?.username}
            </Typography>
            <IconButton
              size="large"
              aria-label="account menu"
              aria-controls="user-menu"
              aria-haspopup="true"
              onClick={handleUserMenuOpen}
              color="inherit"
              sx={{ color: '#000000' }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#000000', fontSize: 14 }}>
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  border: '1px solid #e0e0e0',
                }
              }}
            >
              <MenuItemMUI onClick={handleUserMenuClose} sx={{ minWidth: 150 }}>
                <AccountCircle sx={{ mr: 2, color: '#666666' }} />
                Profile
              </MenuItemMUI>
              <Divider />
              <MenuItemMUI onClick={handleLogout} sx={{ color: '#d32f2f' }}>
                <Logout sx={{ mr: 2 }} />
                Logout
              </MenuItemMUI>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#fff', border: '1px solid #f44336' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Enhanced Statistics Cards */}
        {stats && (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 3, 
            mb: 4 
          }}>
            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <People sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.totalUsers}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Total Users
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Storage sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.totalFiles}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Total Files
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <CloudUpload sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.filesUploadedToday}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Uploads Today
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <TrendingUp sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.activeUsers}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Active Users
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Folder sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.totalFolders}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Total Folders
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ transition: 'transform 0.2s ease-in-out', '&:hover': { transform: 'translateY(-2px)' } }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Share sx={{ fontSize: 48, color: '#000000', mb: 2 }} />
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#000000', mb: 1 }}>
                  {stats.totalSharedLinks}
                </Typography>
                <Typography variant="body1" sx={{ color: '#666666', fontWeight: 500 }}>
                  Shared Links
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Enhanced Users Management */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#000000' }}>
                User Management
              </Typography>
              <Typography variant="body2" sx={{ color: '#666666', mt: 1 }}>
                Manage user accounts and permissions
              </Typography>
            </Box>
          
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>User</TableCell>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Email</TableCell>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Role</TableCell>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Status</TableCell>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Storage</TableCell>
                    <TableCell sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Last Login</TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#f8f9fa', fontWeight: 600, color: '#000000' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id}
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: '#fafafa' },
                        '&:hover': { bgcolor: '#f0f0f0' },
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#000000', fontSize: 12 }}>
                            {user.username?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#000000' }}>
                              {user.username}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#666666' }}>
                              {user.firstName} {user.lastName}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#000000' }}>
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={user.role === 'admin' ? 'default' : 'default'}
                          size="small"
                          sx={{
                            bgcolor: user.role === 'admin' ? '#000000' : '#f5f5f5',
                            color: user.role === 'admin' ? '#ffffff' : '#000000',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '0.75rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.isActive ? 'Active' : 'Inactive'}
                          color={user.isActive ? 'default' : 'default'}
                          size="small"
                          sx={{
                            bgcolor: user.isActive ? '#e8f5e8' : '#ffe8e8',
                            color: user.isActive ? '#2e7d32' : '#d32f2f',
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#000000' }}>
                          {(user.storageUsed / 1024 / 1024).toFixed(1)} MB / {(user.storageQuota / 1024 / 1024).toFixed(0)} MB
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#666666' }}>
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Edit />}
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role);
                              setIsEditDialogOpen(true);
                            }}
                            disabled={user.username === 'admin'}
                            sx={{
                              borderColor: '#000000',
                              color: '#000000',
                              '&:hover': {
                                borderColor: '#000000',
                                bgcolor: '#f5f5f5'
                              },
                              '&:disabled': {
                                borderColor: '#e0e0e0',
                                color: '#ccc'
                              }
                            }}
                          >
                            Edit
                          </Button>
                          {user.role !== 'admin' && user.username !== 'admin' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Delete />}
                              onClick={() => deleteUser(user.id)}
                              sx={{
                                borderColor: '#d32f2f',
                                color: '#d32f2f',
                                '&:hover': {
                                  borderColor: '#d32f2f',
                                  bgcolor: '#ffe8e8'
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Enhanced Edit User Dialog */}
        <Dialog 
          open={isEditDialogOpen} 
          onClose={() => setIsEditDialogOpen(false)}
          PaperProps={{
            sx: {
              minWidth: 400,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: '1px solid #e0e0e0'
            }
          }}
        >
          <DialogTitle sx={{ bgcolor: '#f8f9fa', color: '#000000', fontWeight: 600 }}>
            Edit User Role
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {selectedUser && (
              <Box>
                <Typography variant="body1" sx={{ color: '#000000', fontWeight: 600, mb: 1 }}>
                  User: {selectedUser.username}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666666', mb: 2 }}>
                  {selectedUser.email}
                </Typography>
                
                {selectedUser.username === 'admin' && (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      mt: 2, 
                      mb: 2,
                      bgcolor: '#fff8e1',
                      border: '1px solid #ffb74d',
                      '& .MuiAlert-icon': { color: '#f57c00' }
                    }}
                  >
                    The admin user's role cannot be modified for security reasons.
                  </Alert>
                )}
                
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={newRole}
                    label="Role"
                    onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                    disabled={selectedUser.username === 'admin'}
                    sx={{
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#e0e0e0'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#000000'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#000000'
                      }
                    }}
                  >
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, bgcolor: '#f8f9fa' }}>
            <Button 
              onClick={() => setIsEditDialogOpen(false)}
              sx={{ color: '#666666' }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedUser && updateUserRole(selectedUser.id, newRole)}
              variant="contained"
              sx={{
                bgcolor: '#000000',
                color: '#ffffff',
                '&:hover': {
                  bgcolor: '#333333'
                }
              }}
            >
              Update Role
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};