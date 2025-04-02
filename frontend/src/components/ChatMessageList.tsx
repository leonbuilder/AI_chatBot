import React, { useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Avatar, IconButton, Tooltip, TextField, useTheme } from '@mui/material';
import { PersonOutline, SmartToyOutlined, Replay, ContentCopy, Edit, Check, Close } from '@mui/icons-material';
import { Message } from '../types'; // Import the Message type
import { format } from 'date-fns'; // Import date formatting library
import ReactMarkdown from 'react-markdown';
import FileDownloadIcon from '@mui/icons-material/FileDownload'; // For download button
import copy from 'copy-to-clipboard'; // For copy-to-clipboard functionality

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
    onEditMessage?: (messageId: string, newContent: string, isEnteringEditMode?: boolean) => Promise<void>; // Added isEnteringEditMode parameter
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, isLoading, onRegenerate, onCopy, messagesEndRef, onEditMessage }) => {
    const theme = useTheme(); // Get the theme object
    const [showSnackbar, setShowSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [editInput, setEditInput] = useState(''); // State for edit input field

    console.log('Messages in ChatMessageList:', messages.map(msg => ({ id: msg.id, role: msg.role })));

    // Handle starting edit mode
    const handleStartEdit = (message: Message) => {
        setEditInput(message.content);
    };

    // Handle saving edit
    const handleSaveEdit = async (messageId: string) => {
        if (onEditMessage) {
            await onEditMessage(messageId, editInput);
        }
    };

    // Custom renderer for code blocks
    const CodeRenderer = ({ node, inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : 'text'; // Default to 'text' if no language specified
        const codeString = String(children).replace(/\n$/, ''); // Extract code string

        const handleCopyCode = () => {
            if (copyToClipboard(codeString)) {
                setSnackbarMessage('Code copied');
                setShowSnackbar(true);
                setTimeout(() => setShowSnackbar(false), 2000);
            }
        };

        return !inline ? (
            <Box sx={{ position: 'relative', my: 1.5 }}>
                <IconButton
                    size="small"
                    onClick={handleCopyCode}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 1,
                        color: theme.palette.text.secondary,
                        backgroundColor: 'rgba(0, 0, 0, 0.03)',
                        padding: '4px',
                    }}
                >
                    <ContentCopy fontSize="small" />
                </IconButton>
                <Box
                    component="pre"
                    sx={{
                        backgroundColor: '#f1f5f9',
                        borderRadius: theme.shape.borderRadius,
                        padding: theme.spacing(1.5, 2),
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                    }}
                >
                    <Box
                        component="code"
                        sx={{ fontFamily: 'inherit', color: theme.palette.text.primary }}
                    >
                        {codeString}
                    </Box>
                </Box>
            </Box>
        ) : (
            // Inline code styling
            <Box
                component="code"
                className={className}
                sx={{
                    backgroundColor: '#f1f5f9',
                    borderRadius: 3,
                    padding: '0.1em 0.3em',
                    fontSize: '0.85em',
                    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                }}
                {...props}
            >
                {children}
            </Box>
        );
    };

    const components = {
        code: CodeRenderer,
    };

    return (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 1.5, md: 2.5 } }}> {/* Responsive padding */}
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
                        {/* Assistant Avatar */} 
                        {!isUser && (
                             <Avatar sx={{ 
                                 width: 34, 
                                 height: 34, 
                                 mr: 1.5, 
                                 mt: 0.5,
                                 bgcolor: theme.palette.secondary.light,
                                 }}>
                                <SmartToyOutlined fontSize="small" />
                            </Avatar>
                        )}
                        <Paper
                            variant={isUser ? "elevation" : "outlined"}
                            elevation={isUser ? 0 : 0}
                            sx={{
                                p: theme.spacing(1.5, 2),
                                maxWidth: '85%',
                                bgcolor: isUser ? theme.palette.primary.main : theme.palette.background.paper,
                                color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
                                borderRadius: '1rem',
                                borderColor: isUser ? 'transparent' : theme.palette.divider,
                                position: 'relative',
                                wordWrap: 'break-word',
                            }}
                        >
                             <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, minHeight: '20px' }}>
                                 {/* Timestamp */} 
                                 <Typography variant="caption" sx={{ 
                                     color: isUser ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
                                     fontSize: '0.7rem',
                                     marginRight: 0.5,
                                     }}>
                                     {message.timestamp ? format(new Date(message.timestamp), 'p') : 'Sending...'}
                                 </Typography>
                                 {message.edited_at && (
                                     <Typography variant="caption" sx={{ 
                                         fontStyle: 'italic', 
                                         fontSize: '0.7rem',
                                         color: isUser ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary 
                                         }}>
                                         (edited)
                                     </Typography>
                                 )}
                             </Box>

                             {message.isEditing ? (
                                // Edit mode styling
                                <Box sx={{ mt: 1, mb: 0.5 }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        autoFocus
                                        value={editInput}
                                        onChange={(e) => setEditInput(e.target.value)}
                                        variant="outlined"
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': {
                                                backgroundColor: isUser ? 'rgba(255,255,255,0.1)' : theme.palette.background.default,
                                                color: 'inherit',
                                                fontSize: '0.875rem',
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: isUser ? 'rgba(255, 255, 255, 0.3)' : theme.palette.divider,
                                                },
                                            },
                                        }}
                                    />
                                    {/* Edit Actions */} 
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1 }}>
                                        <Tooltip title="Save">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleSaveEdit(message.id)}
                                                sx={{ color: isUser ? 'white' : theme.palette.primary.main }}
                                            >
                                                <Check fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Cancel">
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    if (onEditMessage) {
                                                        onEditMessage(message.id, message.content, false);
                                                    }
                                                }}
                                                sx={{ color: isUser ? 'white' : theme.palette.error.main }}
                                            >
                                                <Close fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                             ) : (
                                <Box sx={{ color: 'inherit', '& p': { margin: 0 } }}>
                                    <ReactMarkdown components={components}>
                                        {message.content}
                                    </ReactMarkdown>
                                </Box>
                             )}

                            {/* Attachments Display */}
                            {message.attachments && message.attachments.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {message.attachments.map(attachment => (
                                        <Tooltip key={attachment.id} title={`Download ${attachment.filename} (${(attachment.filesize / 1024).toFixed(1)} KB)`}>
                                            <IconButton 
                                                size="small" 
                                                href={attachment.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={attachment.filename} 
                                                sx={{ 
                                                    color: 'inherit',
                                                    opacity: 0.8,
                                                }}
                                            >
                                                <FileDownloadIcon fontSize="inherit" />
                                            </IconButton>
                                        </Tooltip>
                                    ))}
                                </Box>
                            )}
                            {message.isStreaming && <CircularProgress size={16} sx={{ ml: 1, color: 'inherit' }} />}
                            {message.error && <Typography color="error" variant="caption"> {message.error}</Typography>}

                           {/* Action Buttons - Simple row at the bottom */}
                            {!message.isEditing && (
                                <Box sx={{ 
                                    mt: 0.75, 
                                    display: 'flex', 
                                    justifyContent: 'flex-end',
                                    gap: 1,
                                    opacity: 0.7,
                                }}>
                                    {isUser && onEditMessage && (
                                        <Tooltip title="Edit">
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    handleStartEdit(message);
                                                    onEditMessage(message.id, message.content, true);
                                                }}
                                                sx={{ color: 'inherit' }}
                                            >
                                                <Edit sx={{ fontSize: '0.9rem' }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {!isUser && !message.isStreaming && index === lastAssistantMessageIndex && (
                                        <Tooltip title="Regenerate">
                                            <IconButton 
                                                size="small" 
                                                onClick={() => onRegenerate(message.id)} 
                                                sx={{ color: 'inherit' }}
                                            >
                                                <Replay sx={{ fontSize: '0.9rem' }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    <Tooltip title="Copy">
                                        <IconButton 
                                            size="small" 
                                            onClick={() => {
                                                if (copyToClipboard(message.content)) {
                                                    setSnackbarMessage('Copied to clipboard');
                                                    setShowSnackbar(true);
                                                    setTimeout(() => setShowSnackbar(false), 2000);
                                                }
                                            }} 
                                            sx={{ color: 'inherit' }}
                                        >
                                            <ContentCopy sx={{ fontSize: '0.9rem' }} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                        </Paper>
                        {/* User Avatar */} 
                        {isUser && (
                           <Avatar sx={{ 
                               width: 34, 
                               height: 34, 
                               ml: 1.5, 
                               mt: 0.5, 
                               bgcolor: theme.palette.primary.dark,
                           }}>
                              <PersonOutline fontSize="small" />
                          </Avatar>
                      )}
                    </Box>
                );
            })}
            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            )}
            {/* Simplified snackbar */}
            {showSnackbar && (
                <Box sx={{ 
                    position: 'fixed', 
                    bottom: 20, 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    py: 0.75,
                    px: 2, 
                    borderRadius: '100px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                }}>
                    {snackbarMessage}
                </Box>
            )}
            <div ref={messagesEndRef} />
        </Box>
    );
};

export default ChatMessageList; 