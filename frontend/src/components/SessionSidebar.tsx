import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  useTheme,
  alpha
} from '@mui/material';
import { ChatBubbleOutline, DeleteOutline, Edit, Check, Close, Add } from '@mui/icons-material';
import { SessionInfo } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  loading,
  isOpen,
  onClose
}) => {
  const theme = useTheme();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'Unknown time';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid date";
    }
  };

  const getSessionTitle = (session: SessionInfo): string => {
    return session.title || `Chat ${session.session_id.substring(0, 6)}...`;
  };

  const handleStartEdit = (session: SessionInfo) => {
    setEditingSessionId(session.session_id);
    setNewTitle(getSessionTitle(session));
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setNewTitle('');
  };

  const handleSaveEdit = () => {
    if (editingSessionId && newTitle.trim()) {
      onRenameSession(editingSessionId, newTitle.trim());
    }
    handleCancelEdit();
  };

  const handleOpenConfirmDelete = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setConfirmDeleteDialogOpen(true);
  };
  
  const handleCloseConfirmDelete = () => {
    setSessionToDelete(null);
    setConfirmDeleteDialogOpen(false);
  };
  
  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
    }
    handleCloseConfirmDelete();
  };

  return (
    <>
      <Drawer 
        anchor="left" 
        open={isOpen} 
        onClose={onClose} 
        PaperProps={{ 
          sx: { 
            width: 280,
            borderRight: `1px solid ${theme.palette.divider}`,
          } 
        }}
      >
        <Box
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            bgcolor: theme.palette.background.paper,
          }}
          role="presentation"
        >
          {/* Header */}
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}>
            <Typography variant="h6" sx={{ 
              fontSize: '1rem',
              fontWeight: 600,
              color: theme.palette.text.primary
            }}>
              Conversations
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={onNewSession}
              startIcon={<Add fontSize="small" />}
              sx={{ 
                textTransform: 'none',
                fontSize: '0.85rem',
              }}
            >
              New Chat
            </Button>
          </Box>
          
          {/* Chat list */}
          <Box sx={{ 
            flexGrow: 1, 
            overflowY: 'auto',
            py: 1,
          }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', mt: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List sx={{ px: 1 }}>
                {sessions.length === 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                    mt: 2,
                    color: theme.palette.text.secondary,
                    textAlign: 'center'
                  }}>
                    <ChatBubbleOutline sx={{ fontSize: '2rem', mb: 1.5, opacity: 0.7 }} />
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      No conversations yet
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={onNewSession}
                      startIcon={<Add fontSize="small" />}
                    >
                      Start a new chat
                    </Button>
                  </Box>
                )}
                {sessions.map((session) => (
                  <ListItem 
                    key={session.session_id} 
                    disablePadding 
                    sx={{ mb: 0.5 }}
                  >
                    {editingSessionId === session.session_id ? (
                      <Box sx={{ py: 1, px: 1.5, width: '100%' }}>
                        <TextField 
                          variant="outlined" 
                          size="small"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          autoFocus
                          fullWidth
                          placeholder="Chat name"
                          InputProps={{
                            sx: { fontSize: '0.9rem' }
                          }}
                          onKeyDown={(e) => { 
                            if (e.key === 'Enter') handleSaveEdit(); 
                            if (e.key === 'Escape') handleCancelEdit(); 
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1 }}>
                          <IconButton 
                            size="small" 
                            onClick={handleSaveEdit} 
                            sx={{ color: theme.palette.primary.main }}
                          >
                            <Check fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={handleCancelEdit} 
                            sx={{ color: theme.palette.error.main }}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <ListItemButton
                        selected={session.session_id === activeSessionId}
                        onClick={() => onSelectSession(session.session_id)}
                        sx={{
                          py: 1.5,
                          px: 1.5,
                          borderRadius: theme.shape.borderRadius,
                          position: 'relative',
                          '&.Mui-selected': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                          },
                        }}
                      >
                        <ChatBubbleOutline sx={{ 
                          mr: 1.5, 
                          fontSize: '1.1rem', 
                          color: session.session_id === activeSessionId 
                            ? theme.palette.primary.main 
                            : theme.palette.text.secondary,
                          opacity: 0.75
                        }} />
                        <ListItemText 
                          primary={getSessionTitle(session)}
                          secondary={formatTimestamp(session.last_message_timestamp)}
                          primaryTypographyProps={{ 
                            noWrap: true, 
                            sx: { 
                              fontWeight: session.session_id === activeSessionId ? 500 : 400,
                              fontSize: '0.9rem',
                            } 
                          }}
                          secondaryTypographyProps={{ 
                            noWrap: true, 
                            sx: {
                              fontSize: '0.75rem',
                              mt: 0.5,
                              opacity: 0.7
                            }
                          }}
                        />
                        
                        {/* Action buttons */}
                        <Box sx={{ 
                          position: 'absolute',
                          right: 10,
                          opacity: 0,
                          '.MuiListItemButton-root:hover &': { opacity: 1 },
                          display: 'flex',
                          gap: 0.5
                        }}>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(session);
                            }} 
                            sx={{ 
                              color: theme.palette.text.secondary,
                              p: 0.5
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenConfirmDelete(session.session_id);
                            }} 
                            sx={{ 
                              color: theme.palette.error.main,
                              p: 0.5
                            }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemButton>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </Drawer>
      
      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteDialogOpen}
        onClose={handleCloseConfirmDelete}
        PaperProps={{
          sx: {
            borderRadius: theme.shape.borderRadius,
            maxWidth: '380px'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>Delete Conversation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button 
            onClick={handleCloseConfirmDelete} 
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            sx={{ ml: 1, textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SessionSidebar; 