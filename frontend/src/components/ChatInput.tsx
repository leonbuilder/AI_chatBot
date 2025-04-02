import React, { useState, useRef, useEffect } from 'react';
import { TextField, IconButton, Box, Paper, useTheme, List, ListItem, ListItemButton, Typography, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import axios from 'axios';
import { API_BASE_URL } from '../constants';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  showSuggestions?: boolean; // Whether to show auto-suggestions
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

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading, showSuggestions = true }) => {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

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