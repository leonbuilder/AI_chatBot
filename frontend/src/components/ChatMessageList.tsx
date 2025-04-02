import React, { useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Avatar, IconButton, Tooltip } from '@mui/material';
import { PersonOutline, AssistantOutlined, Replay, ContentCopy } from '@mui/icons-material';
import { Message } from '../types'; // Import the Message type
import { format } from 'date-fns'; // Import date formatting library
import ReactMarkdown, { Components } from 'react-markdown'; // Import Components type
import remarkGfm from 'remark-gfm'; // Import remark-gfm for GitHub Flavored Markdown
import { Prism } from 'react-syntax-highlighter'; // Import Prism directly
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Import a style (e.g., vscDarkPlus)

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onRegenerate: (messageId: string) => void;
}

// Helper function to handle copying text
const copyToClipboard = async (text: string, callback: () => void) => {
  try {
    await navigator.clipboard.writeText(text);
    callback(); // Indicate success
  } catch (err) {
    console.error('Failed to copy:', err);
    // Optionally show an error message to the user
  }
};

// Explicitly type props based on expected usage from react-markdown
interface CustomCodeProps {
    node?: any; // Keep node for potential future use, but avoid relying on its structure heavily
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    [key: string]: any; // Allow other props passed by react-markdown
}

const CodeRenderer: React.FC<CustomCodeProps> = ({ node, inline, className, children, style, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    copyToClipboard(codeString, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!inline) {
    const PrismComponent = Prism as any; // Type assertion as workaround
    return (
      <Box sx={{ position: 'relative', my: 1, mx: 0 }}>
        <PrismComponent
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.875rem',
            padding: '12px',
            backgroundColor: '#1e1e1e'
          }}
        >
          {codeString}
        </PrismComponent>
        <Tooltip title={copied ? "Copied!" : "Copy code"} placement="top">
          <IconButton
            size="small"
            onClick={handleCopy}
            className="copy-button"
            sx={{ 
              position: 'absolute', 
              top: 4, 
              right: 4,
              opacity: 0.4,
              transition: 'opacity 0.2s',
              color: 'grey.300',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                color: 'common.white',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              }
            }}
          >
            <ContentCopy fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  } else {
    return (
      <code 
        className={className} 
        style={{
           backgroundColor: 'rgba(0,0,0,0.05)',
           padding: '0.1em 0.3em',
           borderRadius: '3px',
           fontFamily: 'monospace',
           ...style
        }}
        {...props}
      >
        {children}
      </code>
    );
  }
};

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, loading, messagesEndRef, onRegenerate }) => {
  // Define components mapping using the CodeRenderer
  const markdownComponents: Components = {
    p: ({ node, ...props }) => <p style={{ margin: '0.5em 12px' }} {...props} />,
    a: ({ node, ...props }) => {
      // Safely check node structure before accessing tagName
      const firstChild = node?.children?.[0];
      const containsOnlyCode = firstChild && firstChild.type === 'element' && firstChild.tagName === 'code';
      return <a style={{ padding: '0 12px', color: containsOnlyCode ? 'inherit' : '#1976d2' }} {...props} />;
    },
    table: ({ node, ...props }) => <Box sx={{p: 1.5}}><table style={{ borderCollapse: 'collapse', width: 'auto', border: '1px solid grey' }} {...props} /></Box>,
    th: ({ node, ...props }) => <th style={{ border: '1px solid grey', padding: '6px', backgroundColor: '#f0f0f0' }} {...props} />,
    td: ({ node, ...props }) => <td style={{ border: '1px solid grey', padding: '6px' }} {...props} />,
    code: CodeRenderer, // Use the defined renderer
  };

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, bgcolor: 'grey.50' }}>
      {messages.map((msg, index) => {
        const formattedTime = msg.timestamp 
          ? format(msg.timestamp, 'p') // Format to time like '1:30 PM'
          : '';
          
        const isLastAssistantMessage = index === messages.length - 1 && msg.role === 'assistant';
        const canRegenerate = msg.role === 'assistant' && !msg.isStreaming && !msg.error;

        return (
          <Box 
            key={msg.id}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
              alignItems: 'flex-end',
              position: 'relative',
              pl: msg.role === 'assistant' ? 0 : '56px',
              pr: msg.role === 'user' ? 0 : '56px',
              '&:hover .regenerate-button': {
                opacity: 1,
              },
              '&:hover .copy-button': {
                opacity: 1
              }
            }}
          >
            {msg.role === 'assistant' && (
              <Avatar sx={{ bgcolor: 'secondary.main', mr: 1.5, alignSelf: 'flex-start' }}>
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
                  p: 0,
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'white',
                  color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  maxWidth: 'calc(100% - 30px)',
                  wordWrap: 'break-word',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]} 
                  components={markdownComponents}
                >
                  {msg.content}
                </ReactMarkdown>
                {canRegenerate && (
                  <IconButton
                    size="small"
                    onClick={() => onRegenerate(msg.id)}
                    className="regenerate-button"
                    sx={{
                      position: 'absolute', 
                      bottom: -5,
                      right: -5,
                      opacity: 0.2,
                      transition: 'opacity 0.2s',
                      bgcolor: 'background.paper',
                      '&:hover': {
                          bgcolor: 'action.hover'
                      },
                      zIndex: 1
                    }}
                  >
                    <Replay fontSize="inherit" />
                  </IconButton>
                )}
                {msg.isStreaming && (
                   <CircularProgress size={12} sx={{ position: 'absolute', bottom: 5, right: 5, color: msg.role === 'user' ? 'inherit' : 'text.secondary', zIndex: 1 }} />
                )}
              </Paper>
              {formattedTime && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, px: 0.5 }}>
                  {formattedTime}
                </Typography>
              )}
            </Box>
            {msg.role === 'user' && (
              <Avatar sx={{ bgcolor: 'primary.main', ml: 1.5, alignSelf: 'flex-start' }}>
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