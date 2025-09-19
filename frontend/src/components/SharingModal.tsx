import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
} from '@mui/material';
import {
  Share as ShareIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface SharingModalProps {
  open: boolean;
  onClose: () => void;
  file: {
    id: string;
    filename: string;
    original_filename: string;
    mime_type?: string;
    size?: number;
    created_at?: string;
  } | null;
}

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
      id={`sharing-tabpanel-${index}`}
      aria-labelledby={`sharing-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export const SharingModal: React.FC<SharingModalProps> = ({ open, onClose, file }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [permission, setPermission] = useState('view');
  const [expiresAt, setExpiresAt] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileShares, setFileShares] = useState<any[]>([]);
  const [shareLinks, setShareLinks] = useState<any[]>([]);

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchFileShares = useCallback(async () => {
    if (!file || !token) return;
    console.log('🔑 Token for file shares:', token?.substring(0, 20) + '...');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}/shares`, {
        headers: getAuthHeaders()
      });
      console.log('📊 File shares response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        setFileShares(data.shares || []);
      }
    } catch (error) {
      console.error('Error fetching file shares:', error);
    }
  }, [file, token]);

  const fetchShareLinks = useCallback(async () => {
    if (!file || !token) return;
    console.log('🔑 Token for share links:', token?.substring(0, 20) + '...');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/share-links`, {
        headers: getAuthHeaders()
      });
      console.log('🔗 Share links response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        setShareLinks(data.share_links?.filter((link: any) => link.file.id === file.id) || []);
      }
    } catch (error) {
      console.error('Error fetching share links:', error);
    }
  }, [file, token]);

  // Fetch data when modal opens
  useEffect(() => {
    if (open && file && token) {
      fetchFileShares();
      fetchShareLinks();
    }
  }, [open, file?.id, token, fetchFileShares, fetchShareLinks]);

  // Return early if no file - after all hooks
  if (!file) {
    return null;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setAlert(null);
  };

  const handleShareWithUser = async () => {
    if (!token) {
      setAlert({ type: 'error', message: 'Authentication required' });
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}/share`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email,
          message,
          permission,
          expires_at: expiresAt || null,
        }),
      });

      if (response.ok) {
        setAlert({ type: 'success', message: 'File shared successfully!' });
        setEmail('');
        setMessage('');
        fetchFileShares(); // Refresh the shares list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error sharing file');
      }
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Error sharing file' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!token) {
      setAlert({ type: 'error', message: 'Authentication required' });
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/files/${file.id}/share-link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password: usePassword ? linkPassword : null,
          max_downloads: maxDownloads ? parseInt(maxDownloads) : null,
          expires_at: expiresAt || null,
          permission,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/share/${data.share_link.share_token}`;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setAlert({ type: 'success', message: 'Share link created and copied to clipboard!' });
        
        // Reset form
        setLinkPassword('');
        setMaxDownloads('');
        setUsePassword(false);
        
        fetchShareLinks(); // Refresh the links list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creating share link');
      }
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Error creating share link' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setAlert({ type: 'success', message: 'Link copied to clipboard!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to copy link' });
    }
  };

  const shareViaWhatsApp = (url: string) => {
    const message = `Check out this file: ${file.original_filename}\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareViaEmail = (url: string) => {
    const subject = `Shared file: ${file.original_filename}`;
    const body = `I've shared a file with you: ${file.original_filename}\n\nAccess it here: ${url}`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ShareIcon />
          Share "{file.original_filename}"
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {alert && (
          <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={handleTabChange} aria-label="sharing options">
          <Tab icon={<PersonIcon />} label="Share with User" />
          <Tab icon={<LinkIcon />} label="Create Link" />
          <Tab icon={<ShareIcon />} label="Manage Shares" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              helperText="Enter the email address of a registered user"
            />
            
            <TextField
              fullWidth
              label="Message (Optional)"
              multiline
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="Add a personal message..."
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Permission</InputLabel>
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                label="Permission"
              >
                <MenuItem value="view">View Only</MenuItem>
                <MenuItem value="download">View & Download</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Expires At (Optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              onClick={handleShareWithUser}
              disabled={!email || loading}
              startIcon={loading ? <CircularProgress size={16} /> : <EmailIcon />}
              fullWidth
            >
              {loading ? 'Sharing...' : 'Share with User'}
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box component="form" sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Permission</InputLabel>
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                label="Permission"
              >
                <MenuItem value="view">View Only</MenuItem>
                <MenuItem value="download">View & Download</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                />
              }
              label="Password Protection"
              sx={{ mb: 2 }}
            />

            {usePassword && (
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              fullWidth
              label="Max Downloads (Optional)"
              type="number"
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Leave empty for unlimited downloads"
            />

            <TextField
              fullWidth
              label="Expires At (Optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              onClick={handleCreateShareLink}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <LinkIcon />}
              fullWidth
              sx={{ mb: 2 }}
            >
              {loading ? 'Creating...' : 'Create Share Link'}
            </Button>

            {shareLinks && shareLinks.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Existing Share Links
                </Typography>
                <List>
                  {shareLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/share/${link.share_token}`;
                      return (
                        <ListItem key={link.id} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                  {shareUrl}
                                </Typography>
                                <Chip
                                  label={link.permission}
                                  size="small"
                                  color={link.permission === 'download' ? 'primary' : 'default'}
                                />
                              </Box>
                            }
                            secondary={
                              <span>
                                Downloads: {link.download_count}
                                {link.max_downloads && ` / ${link.max_downloads}`}
                                {link.expires_at && (
                                  <> • Expires: {new Date(link.expires_at).toLocaleDateString()}</>
                                )}
                              </span>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Box display="flex" gap={1}>
                              <Tooltip title="Copy Link">
                                <IconButton onClick={() => copyToClipboard(shareUrl)} size="small">
                                  <CopyIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Share via WhatsApp">
                                <IconButton onClick={() => shareViaWhatsApp(shareUrl)} size="small">
                                  <WhatsAppIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Share via Email">
                                <IconButton onClick={() => shareViaEmail(shareUrl)} size="small">
                                  <EmailIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
                </List>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Users with Access
            </Typography>
            
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress />
              </Box>
            ) : fileShares?.length > 0 ? (
              <List>
                {fileShares.map((share: any) => (
                  <ListItem key={share.id} divider>
                    <ListItemText
                      primary={`${share.shared_with_user?.firstName || 'Unknown'} ${share.shared_with_user?.lastName || 'User'}`}
                      secondary={
                        <span>
                          {share.shared_with_user?.email || 'Unknown email'} • {share.permission}
                          {share.expires_at && (
                            <> • Expires: {new Date(share.expires_at).toLocaleDateString()}</>
                          )}
                          {share.message && (
                            <span style={{ display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                              "{share.message}"
                            </span>
                          )}
                        </span>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Revoke Access">
                        <IconButton edge="end" size="small">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                This file is not shared with any users yet.
              </Typography>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};