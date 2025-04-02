import React, { useState, useRef, useEffect } from 'react';
import { TextField, IconButton, Box, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading }) => {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState(1);
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the input field based on content
  useEffect(() => {
    if (textFieldRef.current) {
      // Reset rows to recalculate
      setRows(1);
      
      const lineHeight = 24; // Increased line height in pixels
      const maxRows = 12; // Increased maximum number of rows
      
      // Calculate required rows based on scrollHeight
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
    return "Type a message (Shift+Enter for new line)...";
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        display: 'flex',
        p: { xs: 1.5, sm: 2 },
        mx: { xs: 1, sm: 3, md: 4 },
        mb: { xs: 2, sm: 3 },
        mt: 1,
        borderRadius: '20px',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)'
        },
        maxWidth: '1200px',
        width: '100%',
        alignSelf: 'center'
      }}
    >
      <TextField
        fullWidth
        variant="standard"
        placeholder={getPlaceholderText()}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={loading}
        multiline
        rows={rows}
        inputRef={textFieldRef}
        sx={{ 
          mr: { xs: 1, sm: 2 },
          '& .MuiInputBase-root': {
            padding: { xs: '10px 14px', sm: '12px 16px' },
            borderRadius: '16px',
            transition: 'background-color 0.2s ease',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            fontSize: { xs: '15px', sm: '16px' },
          },
          '& .MuiInputBase-input': {
            padding: '0',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            fontSize: { xs: '15px', sm: '16px' },
            lineHeight: { xs: '22px', sm: '24px' },
          },
          '& .MuiInput-underline:before': { 
            borderBottom: 'none'
          },
          '& .MuiInput-underline:after': {
            borderBottom: 'none'
          },
          '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
            borderBottom: 'none'
          },
          '& .MuiInputBase-root.Mui-focused': {
            backgroundColor: 'rgba(25, 118, 210, 0.04)',
            boxShadow: 'inset 0 0 0 2px rgba(25, 118, 210, 0.3)'
          },
          '& .Mui-disabled': {
            opacity: 0.7,
            backgroundColor: 'rgba(0, 0, 0, 0.04)'
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
          width: { xs: '44px', sm: '50px' },
          height: { xs: '44px', sm: '50px' },
          borderRadius: '14px',
          boxShadow: input.trim() ? '0 3px 10px rgba(25, 118, 210, 0.18)' : 'none',
          transition: 'all 0.25s ease',
          '&:hover': {
            backgroundColor: 'primary.main',
            color: 'white',
            transform: 'translateY(-2px)',
            boxShadow: '0 5px 15px rgba(25, 118, 210, 0.25)'
          },
          '&.Mui-disabled': {
            opacity: 0.6
          },
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '1.4rem', sm: '1.6rem' }
          }
        }}
      >
        <SendIcon />
      </IconButton>
    </Paper>
  );
};

export default ChatInput; 