import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box, // Use Box for layout
  CircularProgress // Show progress during upload
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFileUpload: () => void;
  selectedFile: File | null;
  uploading: boolean; // Add state for upload in progress
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  open,
  onClose,
  onFileSelect,
  onFileUpload,
  selectedFile,
  uploading,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Upload File</DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}> {/* Ensure padding top */} 
        <Typography variant="body2" sx={{ mb: 2.5 }}>
          Select a file to enhance the selected assistant model's knowledge (PDF, TXT, DOCX, etc.).
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<FileUploadIcon />}
            disabled={uploading}
          >
            Select File
            <input
              type="file"
              hidden
              onChange={onFileSelect}
              accept=".pdf,.txt,.docx,.csv,.json,.md" // Add markdown
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              Selected: {selectedFile.name}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} disabled={uploading}>Cancel</Button>
        <Button 
          onClick={onFileUpload} 
          disabled={!selectedFile || uploading}
          variant="contained"
          startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUploadDialog; 