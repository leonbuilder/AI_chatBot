import React, { useState, useRef, useEffect } from 'react';
import { TextField, IconButton, Box, Paper, useTheme } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading }) => {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState(1);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

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
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
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
        justifyContent: 'center',
        padding: { xs: '0 8px 16px', sm: '0 16px 24px' },
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
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