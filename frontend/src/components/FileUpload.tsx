import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface Folder {
  id: string;
  name: string;
  path: string;
}

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const { user, token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  // Fetch folders on component mount
  useEffect(() => {
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

    fetchFolders();
  }, [token]);

  const handleFileSelect = () => {
    console.log('📁 File selector clicked');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📤 File selected for upload:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    if (!token) {
      setError('No authentication token found. Please log in again.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      console.log('🚀 Starting file upload...');
      console.log('📝 Using token:', token ? 'Token available' : 'No token');
      console.log('🌐 API URL:', process.env.REACT_APP_API_URL);
      console.log('🔑 Full authorization header:', `Bearer ${token?.substring(0, 20)}...`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Add folder_id if a folder is selected
      if (selectedFolderId) {
        formData.append('folder_id', selectedFolderId);
      }

      const uploadUrl = `${process.env.REACT_APP_API_URL}/api/v1/files/upload`;
      console.log('📡 Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      console.log('📡 Upload response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Upload successful:', result);
        setSuccess(`File "${file.name}" uploaded successfully!`);
        setUploadProgress(100);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Notify parent component
        onUploadComplete?.();
      } else {
        const errorData = await response.json();
        console.error('❌ Upload failed:', errorData);
        setError(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError('Network error during upload');
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setError(null);
        setSuccess(null);
      }, 3000);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ textAlign: 'center' }}>
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Upload Files
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a file to upload to your vault
          </Typography>
          
          {/* Folder Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Upload to Folder (Optional)</InputLabel>
            <Select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              label="Upload to Folder (Optional)"
              disabled={uploading}
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
          
          <Button
            variant="contained"
            onClick={handleFileSelect}
            disabled={uploading}
            startIcon={<CloudUpload />}
            sx={{ mb: 2 }}
          >
            {uploading ? 'Uploading...' : 'Choose File'}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept={process.env.REACT_APP_ALLOWED_FILE_TYPES}
          />
          
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress 
                variant="indeterminate" 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Uploading file...
              </Typography>
            </Box>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};