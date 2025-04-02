import React from 'react';
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
  Stack,
  SelectChangeEvent
} from '@mui/material';

interface CreateModelDialogProps {
  open: boolean;
  onClose: () => void;
  modelName: string;
  setModelName: (name: string) => void;
  modelDesc: string;
  setModelDesc: (desc: string) => void;
  modelType: 'gpt' | 'assistant';
  setModelType: (type: 'gpt' | 'assistant') => void;
  modelInstructions: string;
  setModelInstructions: (instructions: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (url: string) => void;
  onSubmit: () => void;
  modelTypes: { value: string; label: string }[];
}

const CreateModelDialog: React.FC<CreateModelDialogProps> = ({
  open,
  onClose,
  modelName,
  setModelName,
  modelDesc,
  setModelDesc,
  modelType,
  setModelType,
  modelInstructions,
  setModelInstructions,
  websiteUrl,
  setWebsiteUrl,
  onSubmit,
  modelTypes,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Custom Model</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Model Name"
            fullWidth
            variant="outlined"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            value={modelDesc}
            onChange={(e) => setModelDesc(e.target.value)}
            multiline
            rows={2}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel>Model Type</InputLabel>
            <Select
              value={modelType}
              label="Model Type"
              onChange={(e: SelectChangeEvent<'gpt' | 'assistant'>) => setModelType(e.target.value as 'gpt' | 'assistant')}
            >
              {modelTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Instructions (System Prompt)"
            fullWidth
            variant="outlined"
            value={modelInstructions}
            onChange={(e) => setModelInstructions(e.target.value)}
            multiline
            rows={4}
            helperText="Provide detailed instructions for how the AI should behave."
          />
          <TextField
            margin="dense"
            label="Website URL (Optional - for initial content extraction)"
            fullWidth
            variant="outlined"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onSubmit} 
          variant="contained" 
          disabled={!modelName || !modelDesc || !modelInstructions}
        >
          Create Model
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateModelDialog; 