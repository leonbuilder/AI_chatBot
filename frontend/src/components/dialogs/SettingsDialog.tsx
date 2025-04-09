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
  Chip,
  Slider,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox
} from '@mui/material';
import { AutoFixHigh, Close as CloseIcon, SettingsApplications, Tune, Accessibility as AccessibilityIcon, Code as CodeIcon, Keyboard as KeyboardIcon, History as HistoryIcon, Security as SecurityIcon, Notifications as NotificationsIcon, Storage as StorageIcon, Compress as CompressIcon, Psychology as PsychologyIcon, DataSaverOn as DataSaverIcon, QueryStats as QueryStatsIcon } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';
import { API_BASE_URL } from '../../constants';
import HierarchicalPurposeSelector from '../HierarchicalPurposeSelector';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DomainIcon from '@mui/icons-material/Domain';
import BrushIcon from '@mui/icons-material/Brush';
import { useSettings } from '../../contexts/SettingsContext';

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

// AI Models (for example purposes)
const AI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Default)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-3', label: 'Claude 3' },
  { value: 'custom', label: 'Custom Endpoint' }
];

// Settings tabs
enum SettingsTabs {
  Chat = 0,
  Appearance = 1,
  AI = 2,
  Accessibility = 3,
  Advanced = 4
}

// TabPanel component for switching between tabs
function TabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// KeyboardShortcutsManager component for managing keyboard shortcuts with better UI
const KeyboardShortcutsManager: React.FC<{
  shortcuts: Record<string, string>;
  onUpdate: (newShortcuts: Record<string, string>) => void;
}> = ({ shortcuts, onUpdate }) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [listeningForKey, setListeningForKey] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  
  const actionLabels: Record<string, string> = {
    sendMessage: 'Send Message',
    newLine: 'New Line',
    improvePrompt: 'Improve Prompt',
    clearChat: 'Clear Chat',
    newChat: 'New Chat',
    focusInput: 'Focus Input',
    navigateUp: 'Navigate Up',
    navigateDown: 'Navigate Down'
  };
  
  const formatShortcut = (shortcut: string): string => {
    return shortcut
      .replace('Control', 'Ctrl')
      .replace('Arrow', '')
      .split('+')
      .map(key => key.charAt(0).toUpperCase() + key.slice(1))
      .join(' + ');
  };
  
  const startListening = (action: string) => {
    setEditingKey(action);
    setListeningForKey(true);
    setRecordedKeys([]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!listeningForKey) return;
    e.preventDefault();
    
    const key = e.key;
    // Skip modifier keys until they're paired with another key
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return;
    
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');
    if (e.metaKey) modifiers.push('Meta');
    
    const keyCombo = [...modifiers, key].join('+');
    
    // Update the shortcuts
    if (editingKey) {
      const newShortcuts = { ...shortcuts, [editingKey]: keyCombo };
      onUpdate(newShortcuts);
      setEditingKey(null);
      setListeningForKey(false);
    }
  };
  
  const handleCancel = () => {
    setEditingKey(null);
    setListeningForKey(false);
    setRecordedKeys([]);
  };
  
  return (
    <Box tabIndex={0} onKeyDown={handleKeyDown}>
      <List dense>
        {Object.entries(shortcuts).map(([action, shortcut]) => (
          <ListItem
            key={action}
            secondaryAction={
              editingKey === action ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip 
                    label="Press keys..."
                    color="primary"
                    size="small"
                  />
                  <IconButton edge="end" onClick={handleCancel} size="small">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Chip 
                  label={formatShortcut(shortcut)}
                  variant="outlined"
                  size="small"
                  onClick={() => startListening(action)}
                  sx={{ cursor: 'pointer' }}
                />
              )
            }
          >
            <ListItemIcon>
              <KeyboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={actionLabels[action] || action} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  purposes,
  currentPurpose,
  onPurposeChange,
  systemPrompt,
  onSystemPromptChange,
  activeSessionId
}) => {
  const theme = useTheme();
  const { settings, updateSetting, getMessageDensityLabel } = useSettings();
  
  const [localSystemPrompt, setLocalSystemPrompt] = useState<string>(systemPrompt || '');
  const [localPurpose, setLocalPurpose] = useState<string>(currentPurpose);
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabs>(SettingsTabs.Chat);
  const [purposeTabValue, setPurposeTabValue] = useState(0);
  const [useHierarchicalSelector, setUseHierarchicalSelector] = useState(true);

  useEffect(() => {
    if (open) {
      setLocalSystemPrompt(systemPrompt || '');
      setLocalPurpose(currentPurpose);
    }
  }, [open, systemPrompt, currentPurpose]);

  const handlePurposeChange = (event: SelectChangeEvent<string>) => {
    setLocalPurpose(event.target.value);
  };
  
  const handleHierarchicalPurposeChange = (purpose: string, generatedSystemPrompt?: string) => {
    setLocalPurpose(purpose);
    
    if (generatedSystemPrompt && 
        (localSystemPrompt === '' || 
         window.confirm('Replace current system prompt with the purpose-specific one?'))) {
      setLocalSystemPrompt(generatedSystemPrompt);
    }
  };

  const handleSystemPromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSystemPrompt(event.target.value);
  };

  const handleSettingsTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSettingsTab(newValue);
  };
  
  const handlePurposeTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setPurposeTabValue(newValue);
  };

  const handleImproveSystemPrompt = async () => {
    if (!localSystemPrompt.trim()) return;
    
    setImprovingPrompt(true);
    try {
      const response = await apiClient.post('/api/improve-prompt', { 
        prompt: localSystemPrompt,
        style: settings.improvementStyle,
        domain: settings.domainContext
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
    // Save chat-specific settings that aren't in the global context
    if (localPurpose !== currentPurpose) {
      onPurposeChange(localPurpose);
    }
    
    // Always save system prompt changes, regardless of active session
    if (localSystemPrompt !== systemPrompt) {
      onSystemPromptChange(localSystemPrompt);
    }
    
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsApplications sx={{ mr: 1, color: theme.palette.primary.main }} />
          <Typography variant="h6">Settings</Typography>
        </Box>
        <IconButton onClick={handleCancel} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Tabs
          value={settingsTab}
          onChange={handleSettingsTabChange}
          aria-label="settings tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Chat" icon={<PsychologyIcon />} iconPosition="start" />
          <Tab label="Appearance" icon={<BrushIcon />} iconPosition="start" />
          <Tab label="AI & Models" icon={<CodeIcon />} iconPosition="start" />
          <Tab label="Accessibility" icon={<AccessibilityIcon />} iconPosition="start" />
          <Tab label="Advanced" icon={<Tune />} iconPosition="start" />
        </Tabs>

        {/* Chat Settings Tab */}
        <TabPanel value={settingsTab} index={SettingsTabs.Chat}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Chat Behavior
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoSaveChats}
                      onChange={(e) => updateSetting('autoSaveChats', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Auto-save conversations"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Automatically save all conversations
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.sendTypingIndicator}
                      onChange={(e) => updateSetting('sendTypingIndicator', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Show typing indicator"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Show when the AI is generating a response
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.messageGrouping}
                      onChange={(e) => updateSetting('messageGrouping', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Group consecutive messages"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Combine messages sent in sequence
                </Typography>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Purpose & System Prompt
            </Typography>
            
            <Tabs
              value={purposeTabValue}
              onChange={handlePurposeTabChange}
              aria-label="purpose selection tabs"
              sx={{ mb: 2 }}
            >
              <Tab label="Smart Purpose Selector" />
              <Tab label="Simple Dropdown" />
            </Tabs>
            
            {purposeTabValue === 0 ? (
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
                disabled={improvingPrompt}
                helperText={!activeSessionId ? "This system prompt will be used for new chats" : ""}
              />
              {localSystemPrompt.trim() && (
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
        </TabPanel>

        {/* Appearance Settings Tab */}
        <TabPanel value={settingsTab} index={SettingsTabs.Appearance}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Theme & Display
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.darkMode}
                      onChange={(e) => updateSetting('darkMode', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Dark Mode"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ mr: 2, minWidth: '80px' }}>Font Size:</Typography>
                  <TextField
                    type="number"
                    variant="outlined"
                    value={settings.fontSize}
                    onChange={(e) => {
                      const size = parseInt(e.target.value);
                      if (!isNaN(size) && size >= 12 && size <= 24) {
                        updateSetting('fontSize', size);
                      }
                    }}
                    size="small"
                    inputProps={{ min: 12, max: 24, step: 1 }}
                    sx={{ width: '80px' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>px</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Typography gutterBottom>Message Density</Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={settings.messageDensity}
                    onChange={(_, value) => updateSetting('messageDensity', value as number)}
                    step={1}
                    marks={[
                      { value: 0, label: 'Compact' },
                      { value: 1, label: 'Normal' },
                      { value: 2, label: 'Spacious' },
                    ]}
                    min={0}
                    max={2}
                    valueLabelDisplay="off"
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                  Current: {getMessageDensityLabel()}
                </Typography>
              </Grid>
            </Grid>
            
            <Divider />
            
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Theme Customization
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, bgcolor: 'background.paper' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Additional theme settings will be available in a future update.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label="Coming Soon" color="primary" variant="outlined" />
                <Chip label="Custom Colors" disabled />
                <Chip label="Font Selection" disabled />
              </Box>
            </Paper>
          </Box>
        </TabPanel>

        {/* AI & Models Settings Tab */}
        <TabPanel value={settingsTab} index={SettingsTabs.AI}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              AI Features
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoSuggest}
                    onChange={(e) => updateSetting('autoSuggest', e.target.checked)}
                    color="primary"
                  />
                }
                label="Show Auto-Suggestions"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                AI will suggest message completions as you type
              </Typography>
            </Box>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AutoFixHigh sx={{ mr: 1, color: theme.palette.primary.main }} />
                  <Box>
                    <Typography>Prompt Improvement</Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.promptImprovement}
                          onChange={(e) => updateSetting('promptImprovement', e.target.checked)}
                          color="primary"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          size="small"
                        />
                      }
                      label=""
                      sx={{ m: 0, ml: -1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    AI will help improve your prompts to get better responses
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoImprove}
                        onChange={(e) => updateSetting('autoImprove', e.target.checked)}
                        color="primary"
                        disabled={!settings.promptImprovement}
                      />
                    }
                    label="Auto-improve prompts"
                  />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small" disabled={!settings.promptImprovement}>
                        <InputLabel>Improvement Style</InputLabel>
                        <Select
                          value={settings.improvementStyle}
                          label="Improvement Style"
                          onChange={(e) => updateSetting('improvementStyle', e.target.value)}
                          startAdornment={<BrushIcon sx={{ mr: 1, ml: -0.5 }} fontSize="small" />}
                        >
                          {IMPROVEMENT_STYLES.map((style) => (
                            <MenuItem key={style.value} value={style.value}>
                              {style.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small" disabled={!settings.promptImprovement}>
                        <InputLabel>Domain Context</InputLabel>
                        <Select
                          value={settings.domainContext}
                          label="Domain Context"
                          onChange={(e) => updateSetting('domainContext', e.target.value)}
                          startAdornment={<DomainIcon sx={{ mr: 1, ml: -0.5 }} fontSize="small" />}
                        >
                          {DOMAINS.map((domain) => (
                            <MenuItem key={domain.value} value={domain.value}>
                              {domain.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              </AccordionDetails>
            </Accordion>
            
            <Divider />
            
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Model Selection & Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>AI Model</InputLabel>
                  <Select
                    value={settings.aiModel}
                    label="AI Model"
                    onChange={(e) => updateSetting('aiModel', e.target.value)}
                  >
                    {AI_MODELS.map((model) => (
                      <MenuItem key={model.value} value={model.value}>
                        {model.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {settings.aiModel === 'custom' && (
                <Grid item xs={12}>
                  <TextField
                    label="Custom Model Endpoint"
                    value={settings.customModelEndpoint}
                    onChange={(e) => updateSetting('customModelEndpoint', e.target.value)}
                    fullWidth
                    placeholder="https://api.example.com/v1/chat/completions"
                  />
                </Grid>
              )}
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Context Window (messages)"
                  type="number"
                  value={settings.contextWindow}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value > 0 && value <= 100) {
                      updateSetting('contextWindow', value);
                    }
                  }}
                  fullWidth
                  inputProps={{ min: 1, max: 100 }}
                  helperText="Number of previous messages to include for context"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Response Length (tokens)"
                  type="number"
                  value={settings.responseTokenLimit}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= 100 && value <= 8000) {
                      updateSetting('responseTokenLimit', value);
                    }
                  }}
                  fullWidth
                  inputProps={{ min: 100, max: 8000 }}
                  helperText="Maximum length of AI response"
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Accessibility Settings Tab */}
        <TabPanel value={settingsTab} index={SettingsTabs.Accessibility}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Visual Accessibility
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.highContrastMode}
                      onChange={(e) => updateSetting('highContrastMode', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="High Contrast Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Enhance text and UI contrast for better readability
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.reduceAnimations}
                      onChange={(e) => updateSetting('reduceAnimations', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Reduce Animations"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Minimize motion and animations in the interface
                </Typography>
              </Grid>
            </Grid>
            
            <Divider />
            
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Screen Reader & Keyboard
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.screenReaderOptimized}
                      onChange={(e) => updateSetting('screenReaderOptimized', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Screen Reader Optimized Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Enhance compatibility with screen readers and assistive technologies
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Advanced Settings Tab */}
        <TabPanel value={settingsTab} index={SettingsTabs.Advanced}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Data & Privacy
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.analyticsEnabled}
                      onChange={(e) => updateSetting('analyticsEnabled', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Enable Analytics"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Share anonymous usage data to help improve the app
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.dataSaverMode}
                      onChange={(e) => updateSetting('dataSaverMode', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Data Saver Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                  Reduce bandwidth usage by optimizing requests
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoDeleteHistory}
                      onChange={(e) => updateSetting('autoDeleteHistory', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Auto-delete Message History"
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', ml: 4, mt: 1 }}>
                  <TextField
                    label="Days to keep"
                    type="number"
                    value={settings.autoDeleteDays}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value > 0 && value <= 365) {
                        updateSetting('autoDeleteDays', value);
                      }
                    }}
                    size="small"
                    disabled={!settings.autoDeleteHistory}
                    inputProps={{ min: 1, max: 365 }}
                    sx={{ width: '100px' }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    days
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Divider />
            
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Keyboard Shortcuts
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Customize keyboard shortcuts for common actions
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => updateSetting('keyboardShortcuts', {
                    sendMessage: 'Enter',
                    newLine: 'Shift+Enter',
                    improvePrompt: 'Control+I',
                    clearChat: 'Alt+C',
                    newChat: 'Control+N',
                    focusInput: '/',
                    navigateUp: 'ArrowUp',
                    navigateDown: 'ArrowDown'
                  })}
                  startIcon={<KeyboardIcon />}
                >
                  Reset to Default
                </Button>
              </Box>
              
              <KeyboardShortcutsManager 
                shortcuts={settings.keyboardShortcuts}
                onUpdate={(newShortcuts) => updateSetting('keyboardShortcuts', newShortcuts)}
              />
            </Paper>
          </Box>
        </TabPanel>
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