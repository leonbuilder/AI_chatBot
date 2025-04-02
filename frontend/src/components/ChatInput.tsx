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
  Button
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
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

interface PromptImprovement {
  suggestions: string[];
  improved_prompt: string;
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
      if (!enablePromptImprovement || promptText.length < 10) {
        setPromptImprovement(null);
        setShowImprovementPanel(false);
        return;
      }

      try {
        setLoadingImprovement(true);
        const response = await apiClient.post('/api/improve-prompt', { prompt: promptText });
        
        if (response.data.suggestions && response.data.suggestions.length > 0) {
          setPromptImprovement(response.data);
          setShowImprovementPanel(true);
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

    // Debounce the prompt improvement API calls
    if (improvementDebounceTimeout.current) {
      clearTimeout(improvementDebounceTimeout.current);
    }

    improvementDebounceTimeout.current = setTimeout(() => {
      if (input.trim()) {
        fetchPromptImprovement(input);
      } else {
        setPromptImprovement(null);
        setShowImprovementPanel(false);
      }
    }, 1000); // 1000ms debounce for improvement analysis

    // Cleanup function
    return () => {
      if (improvementDebounceTimeout.current) {
        clearTimeout(improvementDebounceTimeout.current);
      }
    };
  }, [input, enablePromptImprovement]);

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
  
  const handleApplyImprovedPrompt = () => {
    if (promptImprovement && promptImprovement.improved_prompt) {
      setInput(promptImprovement.improved_prompt);
      setShowImprovementPanel(false);
      if (textFieldRef.current) {
        textFieldRef.current.focus();
      }
    }
  };

  const getPlaceholderText = () => {
    if (loading) return "Please wait...";
    return "Type a message (Shift+Enter for new line)";
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
      
      {/* Prompt improvement panel */}
      <Collapse in={showImprovementPanel}>
        <Paper
          elevation={3}
          sx={{
            mb: 2,
            p: 2,
            borderRadius: '12px',
            border: `1px solid ${theme.palette.primary.light}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(66, 133, 244, 0.1)' : 'rgba(66, 133, 244, 0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TipsAndUpdatesIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
              Prompt Improvement Suggestions
            </Typography>
          </Box>
          
          {loadingImprovement ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                {promptImprovement?.suggestions.map((suggestion, index) => (
                  <Typography key={index} variant="body2" sx={{ mt: 0.5 }}>
                    • {suggestion}
                  </Typography>
                ))}
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleApplyImprovedPrompt}
                  color="primary"
                >
                  Apply Improved Prompt
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Collapse>
      
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