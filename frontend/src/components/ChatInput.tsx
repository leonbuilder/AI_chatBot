import React, { useState } from 'react';
import { TextField, IconButton, Box } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading }) => {
  const [input, setInput] = useState('');

  const handleSendClick = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      p: 1.5, 
      borderTop: 1, 
      borderColor: 'divider',
      bgcolor: 'background.paper'
    }}>
      <TextField
        fullWidth
        variant="outlined"
        size="small"
        placeholder="Type your message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={loading}
        multiline
        maxRows={5}
        sx={{ 
          mr: 1, 
          '& .MuiOutlinedInput-root': {
             borderRadius: '20px',
             paddingRight: '8px',
          }
        }}
      />
      <IconButton
        color="primary"
        onClick={handleSendClick}
        disabled={loading || !input.trim()}
        aria-label="Send message"
        sx={{ 
          alignSelf: 'center',
        }}
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default ChatInput; 