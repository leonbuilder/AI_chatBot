import React, { useState, useRef, useEffect } from 'react';
import { TextField, IconButton, Box, Paper, useTheme, List, ListItem, ListItemButton, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  showSuggestions?: boolean; // Whether to show auto-suggestions
}

// Some basic suggestions based on input
const getSuggestions = (input: string): string[] => {
  input = input.toLowerCase().trim();
  
  if (!input) return [];
  
  // Common questions that might be asked
  const commonQueries = [
    "How can I create a custom model?",
    "What's the difference between GPT and Assistant models?",
    "How do I upload a file to my assistant?",
    "Can I integrate my website content?",
    "How do I change the settings?",
    "What are the available chat purposes?",
    "How do I delete a model?",
    "Can I edit my messages after sending?"
  ];
  
  // Return suggestions that contain the input text
  return commonQueries
    .filter(suggestion => suggestion.toLowerCase().includes(input))
    .slice(0, 3); // Limit to 3 suggestions
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading, showSuggestions = true }) => {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  // Generate suggestions when input changes
  useEffect(() => {
    if (showSuggestions && input.length > 2) {
      const newSuggestions = getSuggestions(input);
      setSuggestions(newSuggestions);
      setShowSuggestionsList(newSuggestions.length > 0);
    } else {
      setShowSuggestionsList(false);
    }
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
            {suggestions.map((suggestion, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton 
                  onClick={() => handleSuggestionClick(suggestion)}
                  sx={{ py: 1 }}
                >
                  <Typography variant="body2">{suggestion}</Typography>
                </ListItemButton>
              </ListItem>
            ))}
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