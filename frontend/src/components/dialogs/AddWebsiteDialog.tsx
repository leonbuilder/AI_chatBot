import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress // Show progress
} from '@mui/material';

interface AddWebsiteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  loading: boolean; // Add loading state for extraction
}

const AddWebsiteDialog: React.FC<AddWebsiteDialogProps> = ({
  open,
  onClose,
  onSubmit,
  websiteUrl,
  setWebsiteUrl,
  loading,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Website Content</DialogTitle>
      <DialogContent sx={{ pt: '20px !important' }}>
        <Typography variant="body2" sx={{ mb: 2.5 }}>
          Enter a website URL. The system will attempt to extract the main content to make it available to the selected custom model.
        </Typography>
        <TextField
          fullWidth
          autoFocus
          margin="dense"
          label="Website URL"
          variant="outlined"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://example.com"
          disabled={loading}
        />
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button 
          onClick={onSubmit} 
          disabled={!websiteUrl || loading}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {loading ? 'Extracting...' : 'Extract Content'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddWebsiteDialog; 