import React, { useState, useEffect } from 'react';
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
  useTheme,
  IconButton,
  CircularProgress,
  Tab,
  Tabs,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Chip
} from '@mui/material';
import { AutoFixHigh, Close as CloseIcon, SettingsApplications, Tune } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';
import HierarchicalPurposeSelector from '../HierarchicalPurposeSelector';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DomainIcon from '@mui/icons-material/Domain';
import BrushIcon from '@mui/icons-material/Brush';

// Create an axios instance with auth header
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add the auth token header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

// Improvement styles for prompt improver
const IMPROVEMENT_STYLES = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'technical', label: 'Technical' },
  { value: 'creative', label: 'Creative' }
];

// Domains for prompt improver
const DOMAINS = [
  { value: '', label: 'General' },
  { value: 'business', label: 'Business' },
  { value: 'technical', label: 'Technical' },
  { value: 'academic', label: 'Academic' },
  { value: 'creative', label: 'Creative' },
  { value: 'scientific', label: 'Scientific' },
  { value: 'medical', label: 'Medical' }
];

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
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  // Prompt improvement settings
  const [autoImprove, setAutoImprove] = useState<boolean>(
    localStorage.getItem('autoImprovePrompts') === 'true'
  );
  const [improvementStyle, setImprovementStyle] = useState<string>(
    localStorage.getItem('promptImprovementStyle') || 'balanced'
  );
  const [domainContext, setDomainContext] = useState<string>(
    localStorage.getItem('promptImprovementDomain') || ''
  );
  
  // Add state for using new purpose selector
  const [useHierarchicalSelector, setUseHierarchicalSelector] = useState(true);

  React.useEffect(() => {
    if (open) {
      setLocalSystemPrompt(systemPrompt || '');
      setLocalPurpose(currentPurpose);
      setLocalFontSize(fontSize);
      setLocalDarkMode(darkMode);
      setLocalAutoSuggest(autoSuggest);
      setLocalPromptImprovement(promptImprovement);
      
      // Update prompt improvement settings
      setAutoImprove(localStorage.getItem('autoImprovePrompts') === 'true');
      setImprovementStyle(localStorage.getItem('promptImprovementStyle') || 'balanced');
      setDomainContext(localStorage.getItem('promptImprovementDomain') || '');
    }
  }, [open, systemPrompt, currentPurpose, fontSize, darkMode, autoSuggest, promptImprovement]);

  const handlePurposeChange = (event: SelectChangeEvent<string>) => {
    setLocalPurpose(event.target.value);
  };
  
  // Handle hierarchical purpose selection
  const handleHierarchicalPurposeChange = (purpose: string, generatedSystemPrompt?: string) => {
    setLocalPurpose(purpose);
    
    // If a system prompt was provided and the field is empty or the user confirms
    if (generatedSystemPrompt && 
        (localSystemPrompt === '' || 
         window.confirm('Replace current system prompt with the purpose-specific one?'))) {
      setLocalSystemPrompt(generatedSystemPrompt);
    }
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
  
  const handleAutoImproveChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setAutoImprove(newValue);
    localStorage.setItem('autoImprovePrompts', String(newValue));
  };
  
  const handleImprovementStyleChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setImprovementStyle(newValue);
    localStorage.setItem('promptImprovementStyle', newValue);
  };
  
  const handleDomainContextChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setDomainContext(newValue);
    localStorage.setItem('promptImprovementDomain', newValue);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleImproveSystemPrompt = async () => {
    if (!localSystemPrompt.trim() || !activeSessionId) return;
    
    setImprovingPrompt(true);
    try {
      const response = await apiClient.post('/api/improve-prompt', { 
        prompt: localSystemPrompt,
        style: improvementStyle,
        domain: domainContext
      });
      
      if (response.data.improved_prompt) {
        setLocalSystemPrompt(response.data.improved_prompt);
      }
    } catch (error) {
      console.error('Error improving system prompt:', error);
    } finally {
      setImprovingPrompt(false);
    }
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Chat Settings Section */}
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Chat Settings
            </Typography>
            
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="purpose selection tabs"
              sx={{ mb: 2 }}
            >
              <Tab label="Smart Purpose Selector" />
              <Tab label="Simple Dropdown" />
            </Tabs>
            
            {tabValue === 0 ? (
              <HierarchicalPurposeSelector 
                onChange={handleHierarchicalPurposeChange} 
                currentPurpose={localPurpose}
              />
            ) : (
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
            )}

            <Box sx={{ position: 'relative', mt: 2 }}>
              <TextField
                label="Custom Context (System Prompt)"
                multiline
                rows={4}
                value={localSystemPrompt}
                onChange={handleSystemPromptChange}
                fullWidth
                variant="outlined"
                placeholder="Enter custom instructions for the AI..."
                disabled={!activeSessionId || improvingPrompt}
                helperText={!activeSessionId ? "Start a conversation first to set custom context" : ""}
              />
              {activeSessionId && localSystemPrompt.trim() && (
                <Box sx={{ position: 'absolute', top: 0, right: 0, mt: 1, mr: 1 }}>
                  <IconButton 
                    onClick={handleImproveSystemPrompt}
                    size="small"
                    color="primary"
                    disabled={improvingPrompt}
                    title="Improve with AI"
                  >
                    {improvingPrompt ? <CircularProgress size={20} /> : <AutoFixHigh />}
                  </IconButton>
                </Box>
              )}
            </Box>
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