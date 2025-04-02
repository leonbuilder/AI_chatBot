import React, { useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Divider,
  Box,
  SelectChangeEvent,
  useTheme
} from '@mui/material';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  purposes: string[];
  currentPurpose: string;
  onPurposeChange: (purpose: string) => void;
  systemPrompt: string | null;
  onSystemPromptChange: (prompt: string) => void;
  activeSessionId: string | null;
  // Additional settings
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  autoSuggest: boolean;
  onAutoSuggestChange: (enabled: boolean) => void;
  promptImprovement: boolean;
  onPromptImprovementChange: (enabled: boolean) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  purposes,
  currentPurpose,
  onPurposeChange,
  systemPrompt,
  onSystemPromptChange,
  activeSessionId,
  fontSize,
  onFontSizeChange,
  darkMode,
  onDarkModeChange,
  autoSuggest,
  onAutoSuggestChange,
  promptImprovement,
  onPromptImprovementChange
}) => {
  const theme = useTheme();
  const [localSystemPrompt, setLocalSystemPrompt] = useState<string>(systemPrompt || '');
  const [localPurpose, setLocalPurpose] = useState<string>(currentPurpose);
  const [localFontSize, setLocalFontSize] = useState<number>(fontSize);
  const [localDarkMode, setLocalDarkMode] = useState<boolean>(darkMode);
  const [localAutoSuggest, setLocalAutoSuggest] = useState<boolean>(autoSuggest);
  const [localPromptImprovement, setLocalPromptImprovement] = useState<boolean>(promptImprovement);

  React.useEffect(() => {
    if (open) {
      setLocalSystemPrompt(systemPrompt || '');
      setLocalPurpose(currentPurpose);
      setLocalFontSize(fontSize);
      setLocalDarkMode(darkMode);
      setLocalAutoSuggest(autoSuggest);
      setLocalPromptImprovement(promptImprovement);
    }
  }, [open, systemPrompt, currentPurpose, fontSize, darkMode, autoSuggest, promptImprovement]);

  const handlePurposeChange = (event: SelectChangeEvent<string>) => {
    setLocalPurpose(event.target.value);
  };

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(event.target.value);
    if (!isNaN(size)) {
      setLocalFontSize(size);
    }
  };

  const handleSystemPromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSystemPrompt(event.target.value);
  };

  const handleDarkModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDarkMode(event.target.checked);
  };

  const handleAutoSuggestChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalAutoSuggest(event.target.checked);
  };

  const handlePromptImprovementChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalPromptImprovement(event.target.checked);
  };

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    if (localPurpose !== currentPurpose) {
      onPurposeChange(localPurpose);
    }
    
    if (activeSessionId && localSystemPrompt !== systemPrompt) {
      onSystemPromptChange(localSystemPrompt);
    }
    
    if (localFontSize !== fontSize) {
      onFontSizeChange(localFontSize);
    }
    
    if (localDarkMode !== darkMode) {
      onDarkModeChange(localDarkMode);
    }
    
    if (localAutoSuggest !== autoSuggest) {
      onAutoSuggestChange(localAutoSuggest);
    }
    
    if (localPromptImprovement !== promptImprovement) {
      onPromptImprovementChange(localPromptImprovement);
    }
    
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Chat Settings Section */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Chat Settings
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Purpose</InputLabel>
              <Select 
                value={localPurpose} 
                label="Purpose" 
                onChange={handlePurposeChange}
              >
                {purposes.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Custom Context (System Prompt)"
              multiline
              rows={4}
              value={localSystemPrompt}
              onChange={handleSystemPromptChange}
              fullWidth
              variant="outlined"
              placeholder="Enter custom instructions for the AI..."
              disabled={!activeSessionId}
              helperText={!activeSessionId ? "Start a conversation first to set custom context" : ""}
            />
          </Box>

          <Divider />

          {/* Appearance Settings */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Appearance
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="body1" sx={{ mr: 2, flexGrow: 1 }}>
                Font Size
              </Typography>
              <TextField
                type="number"
                value={localFontSize}
                onChange={handleFontSizeChange}
                inputProps={{ min: 12, max: 24, step: 1 }}
                size="small"
                sx={{ width: '80px' }}
              />
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={localDarkMode}
                  onChange={handleDarkModeChange}
                  color="primary"
                />
              }
              label="Dark Mode"
            />
          </Box>

          <Divider />

          {/* Advanced Settings */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Advanced
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={localAutoSuggest}
                  onChange={handleAutoSuggestChange}
                  color="primary"
                />
              }
              label="Enable Auto-Suggestions"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={localPromptImprovement}
                  onChange={handlePromptImprovementChange}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Enable Prompt Improvement</Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI will analyze and suggest improvements to your prompts as you type
                  </Typography>
                </Box>
              }
              sx={{ mt: 1 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsDialog; 