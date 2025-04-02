import React from 'react';
import { Box, Paper, Typography, CircularProgress, Avatar } from '@mui/material';
import { PersonOutline, AssistantOutlined } from '@mui/icons-material';
import { Message } from '../types'; // Import the Message type
import { format } from 'date-fns'; // Import date formatting library

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, loading, messagesEndRef }) => {
  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, bgcolor: 'grey.50' }}>
      {messages.map((msg, index) => {
        const formattedTime = msg.timestamp 
          ? format(msg.timestamp, 'p') // Format to time like '1:30 PM'
          : '';
          
        return (
          <Box 
            key={index} 
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
              alignItems: 'flex-start',
            }}
          >
            {msg.role === 'assistant' && (
              <Avatar sx={{ bgcolor: 'secondary.main', mr: 1.5 }}>
                <AssistantOutlined />
              </Avatar>
            )}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' 
            }}>
              <Paper
                elevation={2}
                sx={{
                  p: 1.5,
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
                  color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '75%',
                  wordWrap: 'break-word',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </Typography>
              </Paper>
              {formattedTime && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, px: 0.5 }}>
                  {formattedTime}
                </Typography>
              )}
            </Box>
            {msg.role === 'user' && (
              <Avatar sx={{ bgcolor: 'primary.main', ml: 1.5 }}>
                <PersonOutline />
              </Avatar>
            )}
          </Box>
        );
      })}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, mb: 2 }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography variant="body2" color="text.secondary">Assistant is thinking...</Typography>
        </Box>
      )}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default ChatMessageList; 