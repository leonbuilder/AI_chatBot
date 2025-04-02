import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
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
    <Box sx={{ display: 'flex', p: 2, borderTop: 1, borderColor: 'divider' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Type your message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={loading}
        multiline
        maxRows={4}
        sx={{ mr: 1 }}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={handleSendClick}
        disabled={loading || !input.trim()}
        sx={{ minWidth: 'auto', p: '10px' }} // Adjust padding for better icon fit
        aria-label="Send message"
      >
        <SendIcon />
      </Button>
    </Box>
  );
};

export default ChatInput; 