import React, { useState, useRef, useEffect } from 'react';
import { 
  TextField, 
  IconButton, 
  Box, 
  Paper, 
  useTheme, 
  List, 
  ListItem, 
  ListItemButton, 
  Typography, 
  CircularProgress,
  Chip,
  Tooltip,
  Collapse,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Snackbar,
  Alert
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import ShortTextIcon from '@mui/icons-material/ShortText';
import BrushIcon from '@mui/icons-material/Brush';
import BalanceIcon from '@mui/icons-material/Balance';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import BusinessIcon from '@mui/icons-material/Business';
import SchoolIcon from '@mui/icons-material/School';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import BiotechIcon from '@mui/icons-material/Biotech';
import ComputerIcon from '@mui/icons-material/Computer';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import MagicIcon from '@mui/icons-material/AutoAwesome';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { API_BASE_URL } from '../constants';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  showSuggestions?: boolean; // Whether to show auto-suggestions
  enablePromptImprovement?: boolean; // Whether to enable prompt improvement assistance
}

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

// Domain options with icons for contextual improvement
const DOMAINS = [
  { value: 'business', label: 'Business', icon: <BusinessIcon fontSize="small" /> },
  { value: 'technical', label: 'Technical', icon: <ComputerIcon fontSize="small" /> },
  { value: 'academic', label: 'Academic', icon: <SchoolIcon fontSize="small" /> },
  { value: 'creative', label: 'Creative', icon: <BrushIcon fontSize="small" /> },
  { value: 'scientific', label: 'Scientific', icon: <ScienceIcon fontSize="small" /> },
  { value: 'medical', label: 'Medical', icon: <BiotechIcon fontSize="small" /> },
  { value: 'general', label: 'General', icon: <LightbulbIcon fontSize="small" /> }
];

// Style options for improvements
const IMPROVEMENT_STYLES = [
  { value: 'balanced', label: 'Balanced', icon: <BalanceIcon fontSize="small" /> },
  { value: 'concise', label: 'Concise', icon: <ShortTextIcon fontSize="small" /> },
  { value: 'detailed', label: 'Detailed', icon: <DescriptionIcon fontSize="small" /> },
  { value: 'technical', label: 'Technical', icon: <CodeIcon fontSize="small" /> },
  { value: 'creative', label: 'Creative', icon: <BrushIcon fontSize="small" /> }
];

interface PromptImprovement {
  improved_prompt: string;
  alternatives: string[];
  id?: string; // To track which improvement received feedback
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  loading, 
  showSuggestions = true,
  enablePromptImprovement = false
}) => {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Prompt improvement state
  const [promptImprovement, setPromptImprovement] = useState<PromptImprovement | null>(null);
  const [loadingImprovement, setLoadingImprovement] = useState(false);
  const [showImprovementPanel, setShowImprovementPanel] = useState(false);
  const improvementDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // New improvement options state
  const [improvementStyle, setImprovementStyle] = useState('balanced');
  const [domainContext, setDomainContext] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [autoImprove, setAutoImprove] = useState(false);
  const [optionsAnchorEl, setOptionsAnchorEl] = useState<null | HTMLElement>(null);
  const [domainAnchorEl, setDomainAnchorEl] = useState<null | HTMLElement>(null);
  const [styleAnchorEl, setStyleAnchorEl] = useState<null | HTMLElement>(null);
  
  // Improvement strength slider
  const [improvementStrength, setImprovementStrength] = useState(0.5);
  const [showStrengthSlider, setShowStrengthSlider] = useState(false);
  
  // Feedback mechanism
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSnackbarOpen, setFeedbackSnackbarOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  
  // Load user preferences from localStorage
  useEffect(() => {
    const savedAutoImprove = localStorage.getItem('autoImprovePrompts');
    if (savedAutoImprove !== null) {
      setAutoImprove(savedAutoImprove === 'true');
    }
    
    const savedStyle = localStorage.getItem('promptImprovementStyle');
    if (savedStyle) {
      setImprovementStyle(savedStyle);
    }
    
    const savedDomain = localStorage.getItem('promptImprovementDomain');
    if (savedDomain) {
      setDomainContext(savedDomain);
    }
    
    const savedStrength = localStorage.getItem('improvementStrength');
    if (savedStrength) {
      setImprovementStrength(parseFloat(savedStrength));
    }
  }, []);

  // Fetch AI-powered suggestions when input changes
  useEffect(() => {
    const fetchSuggestions = async (inputText: string) => {
      if (!showSuggestions || inputText.length < 2) {
        setSuggestions([]);
        setShowSuggestionsList(false);
        return;
      }

      try {
        setLoadingSuggestions(true);
        const response = await apiClient.post('/api/suggestions', { input: inputText });
        const newSuggestions = response.data.suggestions || [];
        setSuggestions(newSuggestions);
        setShowSuggestionsList(newSuggestions.length > 0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestionsList(false);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    // Debounce the suggestion API calls to avoid hammering the backend
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      if (input.trim()) {
        fetchSuggestions(input);
      } else {
        setSuggestions([]);
        setShowSuggestionsList(false);
      }
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [input, showSuggestions]);
  
  // Fetch prompt improvements when input changes
  useEffect(() => {
    const fetchPromptImprovement = async (promptText: string) => {
      if (!enablePromptImprovement || promptText.length < 5 || (!autoImprove && !showImprovementPanel)) {
        setPromptImprovement(null);
        return;
      }

      try {
        setLoadingImprovement(true);
        const response = await apiClient.post('/api/improve-prompt', { 
          prompt: promptText,
          style: improvementStyle,
          domain: domainContext,
          strength: improvementStrength // Send the strength parameter
        });
        
        if (response.data.improved_prompt && response.data.improved_prompt !== promptText) {
          // Generate a random ID to track this improvement for feedback
          const improvementId = Math.random().toString(36).substring(2, 15);
          setPromptImprovement({
            ...response.data,
            id: improvementId
          });
          
          setShowImprovementPanel(true);
          
          // If auto-improve is enabled, apply the improvement immediately
          if (autoImprove && !showImprovementPanel) {
            setInput(response.data.improved_prompt);
            setShowImprovementPanel(false);
          }
        } else {
          setPromptImprovement(null);
          setShowImprovementPanel(false);
        }
      } catch (error) {
        console.error('Error fetching prompt improvements:', error);
        setPromptImprovement(null);
        setShowImprovementPanel(false);
      } finally {
        setLoadingImprovement(false);
      }
    };

    // Debounce API calls
    if (improvementDebounceTimeout.current) {
      clearTimeout(improvementDebounceTimeout.current);
    }

    improvementDebounceTimeout.current = setTimeout(() => {
      if (input.trim() && (enablePromptImprovement && (autoImprove || showImprovementPanel))) {
        fetchPromptImprovement(input);
      } else {
        setPromptImprovement(null);
        if (!input.trim()) {
          setShowImprovementPanel(false);
        }
      }
    }, 800); // Reduced from 1000ms

    return () => {
      if (improvementDebounceTimeout.current) {
        clearTimeout(improvementDebounceTimeout.current);
      }
    };
  }, [input, enablePromptImprovement, autoImprove, improvementStyle, domainContext, showImprovementPanel, improvementStrength]);

  // Auto-resize the input field based on content
  useEffect(() => {
    if (textFieldRef.current) {
      setRows(1);
      
      const lineHeight = 24;
      const maxRows = 8;
      
      const textArea = textFieldRef.current;
      const calculatedRows = Math.min(
        Math.max(1, Math.ceil(textArea.scrollHeight / lineHeight)), 
        maxRows
      );
      
      setRows(calculatedRows);
    }
  }, [input]);

  const handleSendClick = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    setRows(1);
    setShowSuggestionsList(false);
    setShowImprovementPanel(false);
    setPromptImprovement(null);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestionsList(false);
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  };
  
  const handleApplyImprovedPrompt = (text = '') => {
    if (text) {
      setInput(text);
    } else if (promptImprovement && promptImprovement.improved_prompt) {
      setInput(promptImprovement.improved_prompt);
    }
    
    setShowImprovementPanel(false);
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  };

  const getPlaceholderText = () => {
    if (loading) return "Please wait...";
    return "Type a message (Shift+Enter for new line)";
  };
  
  const handleToggleImprovement = () => {
    setShowImprovementPanel(!showImprovementPanel);
  };
  
  const handleOptionsClick = (event: React.MouseEvent<HTMLElement>) => {
    setOptionsAnchorEl(event.currentTarget);
  };
  
  const handleOptionsClose = () => {
    setOptionsAnchorEl(null);
  };
  
  const handleDomainMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setDomainAnchorEl(event.currentTarget);
    handleOptionsClose();
  };
  
  const handleDomainMenuClose = () => {
    setDomainAnchorEl(null);
  };
  
  const handleStyleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setStyleAnchorEl(event.currentTarget);
    handleOptionsClose();
  };
  
  const handleStyleMenuClose = () => {
    setStyleAnchorEl(null);
  };
  
  const handleDomainSelect = (domain: string) => {
    setDomainContext(domain);
    localStorage.setItem('promptImprovementDomain', domain);
    handleDomainMenuClose();
  };
  
  const handleStyleSelect = (style: string) => {
    setImprovementStyle(style);
    localStorage.setItem('promptImprovementStyle', style);
    handleStyleMenuClose();
  };
  
  const handleAutoImproveToggle = () => {
    const newValue = !autoImprove;
    setAutoImprove(newValue);
    localStorage.setItem('autoImprovePrompts', String(newValue));
    handleOptionsClose();
  };
  
  const handleToggleAlternatives = () => {
    setShowAlternatives(!showAlternatives);
  };
  
  const getCurrentDomainIcon = () => {
    const domain = DOMAINS.find(d => d.value === domainContext);
    return domain ? domain.icon : <LightbulbIcon fontSize="small" />;
  };
  
  const getCurrentStyleIcon = () => {
    const style = IMPROVEMENT_STYLES.find(s => s.value === improvementStyle);
    return style ? style.icon : <BalanceIcon fontSize="small" />;
  };
  
  const getCurrentDomainLabel = () => {
    const domain = DOMAINS.find(d => d.value === domainContext);
    return domain ? domain.label : 'General';
  };
  
  const getCurrentStyleLabel = () => {
    const style = IMPROVEMENT_STYLES.find(s => s.value === improvementStyle);
    return style ? style.label : 'Balanced';
  };

  // Handle the strength slider change
  const handleStrengthChange = (event: Event, newValue: number | number[]) => {
    const strength = newValue as number;
    setImprovementStrength(strength);
    localStorage.setItem('improvementStrength', strength.toString());
  };
  
  // Toggle the strength slider visibility
  const handleToggleStrengthSlider = () => {
    setShowStrengthSlider(!showStrengthSlider);
  };
  
  // Send feedback about the prompt improvement
  const handleSendFeedback = async (isPositive: boolean) => {
    if (!promptImprovement || !promptImprovement.id || feedbackSent) return;
    
    try {
      await apiClient.post('/api/feedback/improvement', {
        improvementId: promptImprovement.id,
        originalPrompt: input,
        improvedPrompt: promptImprovement.improved_prompt,
        isPositive: isPositive,
        style: improvementStyle,
        domain: domainContext,
        strength: improvementStrength
      });
      
      setFeedbackSent(true);
      setFeedbackMessage(isPositive ? 
        "Thanks for the positive feedback! We'll use it to improve suggestions." : 
        "Thanks for the feedback. We'll work to make improvements better.");
      setFeedbackSnackbarOpen(true);
      
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };
  
  // Close the feedback snackbar
  const handleCloseFeedbackSnackbar = () => {
    setFeedbackSnackbarOpen(false);
  };

  // Render the improvement strength label
  const getStrengthLabel = () => {
    if (improvementStrength <= 0.3) return "Subtle";
    if (improvementStrength <= 0.6) return "Balanced";
    return "Aggressive";
  };

  return (
    <Box 
      sx={{ 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: { xs: '0 8px 16px', sm: '0 16px 24px' },
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Auto-suggestions panel */}
      {showSuggestionsList && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: { xs: 8, sm: 16 },
            right: { xs: 8, sm: 16 },
            mb: 1,
            zIndex: 10,
            maxHeight: '200px',
            overflow: 'auto',
            borderRadius: '12px',
          }}
        >
          <List disablePadding>
            {loadingSuggestions ? (
              <ListItem sx={{ justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </ListItem>
            ) : (
              suggestions.map((suggestion, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemButton 
                    onClick={() => handleSuggestionClick(suggestion)}
                    sx={{ py: 1 }}
                  >
                    <Typography variant="body2">{suggestion}</Typography>
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        </Paper>
      )}
      
      {/* Prompt improvement panel with new features */}
      <Collapse in={showImprovementPanel}>
        <Paper
          elevation={4}
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: '12px',
            border: `1px solid ${theme.palette.primary.light}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(66, 133, 244, 0.1)' : 'rgba(66, 133, 244, 0.05)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <MagicIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="primary.main" fontWeight="medium">
                  AI Prompt Improver ({getCurrentStyleLabel()} / {getCurrentDomainLabel()})
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Adjustment strength">
                  <IconButton 
                    size="small" 
                    onClick={handleToggleStrengthSlider}
                    color="primary"
                  >
                    <TuneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Improvement settings">
                  <IconButton 
                    size="small" 
                    onClick={handleOptionsClick}
                    color="primary"
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title={showAlternatives ? "Hide alternatives" : "Show alternatives"}>
                  <IconButton 
                    size="small" 
                    onClick={handleToggleAlternatives}
                    color="primary"
                  >
                    <ExpandMoreIcon 
                      fontSize="small"
                      sx={{
                        transform: showAlternatives ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    />
                  </IconButton>
                </Tooltip>
                
                {loadingImprovement ? (
                  <CircularProgress size={24} color="primary" />
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleApplyImprovedPrompt()}
                    color="primary"
                    sx={{ minHeight: '30px', py: 0.5 }}
                  >
                    Apply
                  </Button>
                )}
              </Box>
            </Box>
            
            {/* Improvement Strength Slider */}
            <Collapse in={showStrengthSlider}>
              <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    Adjustment Strength:
                  </Typography>
                  <Chip 
                    label={getStrengthLabel()} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                    sx={{ height: 20, '& .MuiChip-label': { px: 1, py: 0 } }}
                  />
                </Box>
                <Slider
                  value={improvementStrength}
                  onChange={handleStrengthChange}
                  aria-label="Improvement strength"
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  sx={{ mx: 0.5 }}
                  marks={[
                    { value: 0.1, label: 'Subtle' },
                    { value: 0.5, label: 'Balanced' },
                    { value: 0.9, label: 'Aggressive' },
                  ]}
                />
              </Box>
            </Collapse>
            
            {promptImprovement && (
              <>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2">
                    {promptImprovement.improved_prompt}
                  </Typography>
                </Paper>
                
                {/* Feedback buttons */}
                {!feedbackSent && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
                      Was this helpful?
                    </Typography>
                    <Tooltip title="This improvement was helpful">
                      <IconButton 
                        size="small"
                        onClick={() => handleSendFeedback(true)}
                        sx={{ color: theme.palette.success.main }}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="This improvement wasn't helpful">
                      <IconButton 
                        size="small"
                        onClick={() => handleSendFeedback(false)}
                        sx={{ color: theme.palette.error.main }}
                      >
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                
                <Collapse in={showAlternatives}>
                  {promptImprovement.alternatives && promptImprovement.alternatives.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
                        Alternative improvements:
                      </Typography>
                      {promptImprovement.alternatives.map((alt, index) => (
                        <Paper
                          key={index}
                          variant="outlined"
                          sx={{
                            p: 1,
                            backgroundColor: theme.palette.background.paper,
                            borderRadius: 1,
                            mb: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {alt}
                          </Typography>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleApplyImprovedPrompt(alt)}
                            sx={{ ml: 1, minWidth: 'auto' }}
                          >
                            Use
                          </Button>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Collapse>
              </>
            )}
          </Box>
        </Paper>
      </Collapse>
      
      {/* Improvement options menu */}
      <Menu
        anchorEl={optionsAnchorEl}
        open={Boolean(optionsAnchorEl)}
        onClose={handleOptionsClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleStyleMenuOpen}>
          <ListItemIcon>
            {getCurrentStyleIcon()}
          </ListItemIcon>
          <ListItemText>Style: {getCurrentStyleLabel()}</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleDomainMenuOpen}>
          <ListItemIcon>
            {getCurrentDomainIcon()}
          </ListItemIcon>
          <ListItemText>Domain: {getCurrentDomainLabel()}</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={handleAutoImproveToggle}>
          <ListItemIcon>
            <Switch
              size="small"
              checked={autoImprove}
              onChange={handleAutoImproveToggle}
            />
          </ListItemIcon>
          <ListItemText>Auto-improve prompts</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Domain selection menu */}
      <Menu
        anchorEl={domainAnchorEl}
        open={Boolean(domainAnchorEl)}
        onClose={handleDomainMenuClose}
      >
        {DOMAINS.map((domain) => (
          <MenuItem 
            key={domain.value} 
            onClick={() => handleDomainSelect(domain.value)}
            selected={domainContext === domain.value}
          >
            <ListItemIcon>
              {domain.icon}
            </ListItemIcon>
            <ListItemText>{domain.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      
      {/* Style selection menu */}
      <Menu
        anchorEl={styleAnchorEl}
        open={Boolean(styleAnchorEl)}
        onClose={handleStyleMenuClose}
      >
        {IMPROVEMENT_STYLES.map((style) => (
          <MenuItem 
            key={style.value} 
            onClick={() => handleStyleSelect(style.value)}
            selected={improvementStyle === style.value}
          >
            <ListItemIcon>
              {style.icon}
            </ListItemIcon>
            <ListItemText>{style.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      
      {/* Feedback Snackbar */}
      <Snackbar
        open={feedbackSnackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseFeedbackSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseFeedbackSnackbar} 
          severity="success" 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {feedbackMessage}
        </Alert>
      </Snackbar>
      
      {/* Chat input */}
      <Paper 
        variant="outlined"
        sx={{ 
          display: 'flex',
          width: '100%',
          p: 1,
          px: 2,
          borderRadius: '12px',
          borderColor: theme.palette.divider,
          bgcolor: theme.palette.background.paper,
        }}
      >
        {enablePromptImprovement && (
          <Tooltip title={autoImprove ? "Auto-improve enabled" : "Show improvement options"}>
            <IconButton
              size="small"
              onClick={handleToggleImprovement}
              color={showImprovementPanel || autoImprove ? "primary" : "default"}
              sx={{ mr: 1, alignSelf: 'flex-end', mb: '10px' }}
            >
              {autoImprove ? (
                <Badge
                  variant="dot"
                  color="primary"
                >
                  <AutoFixHighIcon fontSize="small" />
                </Badge>
              ) : (
                <AutoFixHighIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}
        
        <TextField
          fullWidth
          variant="standard"
          placeholder={getPlaceholderText()}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={loading}
          multiline
          rows={rows}
          inputRef={textFieldRef}
          InputProps={{
            disableUnderline: true,
          }}
          sx={{ 
            '& .MuiInputBase-root': {
              padding: '12px 0px',
              fontSize: '0.95rem',
              fontFamily: theme.typography.fontFamily,
            }
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSendClick}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          sx={{ 
            alignSelf: 'flex-end',
            mb: '6px',
            width: 40,
            height: 40,
            backgroundColor: input.trim() ? theme.palette.primary.main : 'transparent',
            color: input.trim() ? theme.palette.primary.contrastText : theme.palette.text.disabled,
            '&:hover': {
              backgroundColor: input.trim() ? theme.palette.primary.dark : 'transparent',
            },
            '&.Mui-disabled': {
              backgroundColor: 'transparent',
              color: theme.palette.text.disabled,
            }
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Box>
  );
};

export default ChatInput; 