import React, { useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Avatar, IconButton, Tooltip } from '@mui/material';
import { PersonOutline, AssistantOutlined, Replay, ContentCopy } from '@mui/icons-material';
import { Message } from '../types'; // Import the Message type
import { format } from 'date-fns'; // Import date formatting library
import ReactMarkdown from 'react-markdown';
// Use type assertion for SyntaxHighlighter to avoid JSX compatibility issues
import { Prism } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Choose a style
import FileDownloadIcon from '@mui/icons-material/FileDownload'; // For download button

// Define SyntaxHighlighter with type assertion to fix JSX compatibility issues
const SyntaxHighlighter = Prism as any;

// Helper function to copy text to clipboard
const copyToClipboard = (text: string): boolean => {
  try {
    // Use the more modern navigator.clipboard API when available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to document.execCommand for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

interface ChatMessageListProps {
    messages: Message[];
    isLoading: boolean;
    onRegenerate: (messageId: string) => void; // Callback for regeneration
    onCopy: (content: string) => void; // Callback for copy
    messagesEndRef: React.RefObject<HTMLDivElement>; // Ref for auto-scrolling
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isLoading, onRegenerate, onCopy, messagesEndRef }) => {
    const [showSnackbar, setShowSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // Custom renderer for code blocks
    const CodeRenderer = ({ node, inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : 'text'; // Default to 'text' if no language specified
        const codeString = String(children).replace(/\n$/, ''); // Extract code string

        const handleCopyCode = () => {
            if (copyToClipboard(codeString)) {
                setSnackbarMessage('Code copied to clipboard!');
                setShowSnackbar(true);
            } else {
                setSnackbarMessage('Failed to copy code.');
                setShowSnackbar(true);
            }
        };

        return !inline ? (
            <Box sx={{ position: 'relative', my: 1 }}>
                <IconButton
                    size="small"
                    onClick={handleCopyCode}
                    sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 1,
                        color: 'common.white',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.7)'
                        }
                    }}
                >
                    <ContentCopy fontSize="small" />
                </IconButton>
                <SyntaxHighlighter
                    style={coy}
                    language={language}
                    PreTag="div"
                    {...props}
                >
                    {codeString}
                </SyntaxHighlighter>
            </Box>
        ) : (
            <code className={className} {...props}>
                {children}
            </code>
        );
    };

    // Map the custom renderer to the 'code' element
    const components = {
        code: CodeRenderer, // Use the defined renderer
    };

    return (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            {messages.map((message, index) => {
                const isUser = message.role === 'user';
                // Find the index of the last assistant message that is *not* streaming
                let lastAssistantMessageIndex = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'assistant' && !messages[i].isStreaming) {
                        lastAssistantMessageIndex = i;
                        break;
                    }
                }

                return (
                    <Box
                        key={message.id || index}
                        sx={{
                            display: 'flex',
                            justifyContent: isUser ? 'flex-end' : 'flex-start',
                            mb: 2,
                        }}
                    >
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5,
                                maxWidth: '80%',
                                bgcolor: isUser ? 'primary.light' : 'background.paper',
                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                                position: 'relative' // Needed for absolute positioning of icons
                            }}
                        >
                             <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: isUser ? 'transparent' : 'secondary.main' }}>
                                    {isUser ? <PersonOutline fontSize="small" /> : <AssistantOutlined fontSize="small" />}
                                </Avatar>
                                <Typography variant="caption" sx={{ color: isUser ? 'primary.contrastText' : 'text.secondary' }}>
                                     {message.timestamp ? format(new Date(message.timestamp), 'p') : 'Sending...'}
                                 </Typography>
                             </Box>
                             <ReactMarkdown components={components}>
                                {message.content}
                            </ReactMarkdown>
                            {/* Attachments Display */}
                            {message.attachments && message.attachments.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {message.attachments.map(attachment => (
                                        <Tooltip key={attachment.id} title={`Download ${attachment.filename} (${(attachment.filesize / 1024).toFixed(1)} KB)`}>
                                            <a
                                                href={attachment.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={attachment.filename}
                                                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', marginLeft: '8px' }}
                                            >
                                                <FileDownloadIcon fontSize="small" />
                                            </a>
                                        </Tooltip>
                                    ))}
                                </Box>
                            )}
                            {message.isStreaming && <CircularProgress size={16} sx={{ ml: 1 }} />}
                            {message.error && <Typography color="error" variant="caption"> {message.error}</Typography>}

                           {/* Action Buttons - Placed at the bottom right */}
                            {!isUser && !message.isStreaming && (
                                <Box sx={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 0.5 }}>
                                    {index === lastAssistantMessageIndex && (
                                        <Tooltip title="Regenerate Response">
                                            <IconButton size="small" onClick={() => onRegenerate(message.id)} color="inherit">
                                                <Replay fontSize="inherit" />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    <Tooltip title="Copy Content">
                                        <IconButton size="small" onClick={() => onCopy(message.content)} color="inherit">
                                            <ContentCopy fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                        </Paper>
                    </Box>
                );
            })}
            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress />
                </Box>
            )}
             {/* Snackbar for copy feedback */}
             {/* This should ideally be managed globally (e.g., in App.tsx) using context or Zustand */}
             {showSnackbar && (
                 <Box sx={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', bgcolor: 'background.paper', p: 1, borderRadius: 1, boxShadow: 3 }}>
                     <Typography variant="body2">{snackbarMessage}</Typography>
                </Box>
             )}
             <div ref={messagesEndRef} />
        </Box>
    );
};

export default ChatMessageList; 