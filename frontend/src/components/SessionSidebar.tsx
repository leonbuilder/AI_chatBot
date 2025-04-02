import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Divider,
  CircularProgress,
  IconButton,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button
} from '@mui/material';
import { AddCircleOutline, ChatBubbleOutline, DeleteOutline, Edit, Check, Close } from '@mui/icons-material';
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
      <Drawer anchor="left" open={isOpen} onClose={onClose}>
        <Box
          sx={{ width: 250, display: 'flex', flexDirection: 'column', height: '100%' }}
          role="presentation"
        >
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Chat History</Typography>
            <IconButton onClick={onNewSession} color="primary" title="New Chat">
                <AddCircleOutline />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : (
              <List dense>
                {sessions.length === 0 && (
                    <ListItem>
                         <ListItemText primary="No chat history found." />
                    </ListItem>
                )}
                {sessions.map((session) => (
                  <ListItem 
                    key={session.session_id} 
                    disablePadding 
                    secondaryAction={
                      editingSessionId === session.session_id ? (
                        <>
                          <IconButton edge="end" size="small" onClick={handleSaveEdit} color="primary">
                            <Check fontSize="inherit" />
                          </IconButton>
                          <IconButton edge="end" size="small" onClick={handleCancelEdit} sx={{ ml: 0.5 }}>
                            <Close fontSize="inherit" />
                          </IconButton>
                        </>
                      ) : (
                        <Box sx={{ display: 'flex'}}> 
                          <IconButton edge="end" size="small" onClick={() => handleStartEdit(session)} sx={{ mr: 0.5 }} title="Rename">
                            <Edit fontSize="inherit" />
                          </IconButton>
                          <IconButton edge="end" size="small" onClick={() => handleOpenConfirmDelete(session.session_id)} color="error" title="Delete">
                            <DeleteOutline fontSize="inherit" />
                          </IconButton>
                        </Box>
                      )
                    }
                   >
                   {editingSessionId === session.session_id ? (
                       <TextField 
                           variant="standard" 
                           size="small"
                           value={newTitle}
                           onChange={(e) => setNewTitle(e.target.value)}
                           autoFocus
                           fullWidth
                           sx={{ ml: 1, mr: 1}}
                           onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                       />
                    ) : (
                      <ListItemButton
                        selected={session.session_id === activeSessionId}
                        onClick={() => onSelectSession(session.session_id)}
                      >
                        <ChatBubbleOutline sx={{ mr: 1, fontSize: '1rem', color: 'text.secondary' }} />
                        <ListItemText 
                          primary={getSessionTitle(session)}
                          secondary={formatTimestamp(session.last_message_timestamp)}
                          primaryTypographyProps={{ noWrap: true, sx: { fontWeight: session.session_id === activeSessionId ? 'bold' : 'normal'} }}
                          secondaryTypographyProps={{ noWrap: true, fontSize: '0.75rem' }}
                        />
                      </ListItemButton>
                     )}
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </Drawer>
      
      <Dialog
          open={confirmDeleteDialogOpen}
          onClose={handleCloseConfirmDelete}
      >
          <DialogTitle>Delete Chat?</DialogTitle>
          <DialogContent>
              <DialogContentText>
                  Are you sure you want to permanently delete this chat session?
              </DialogContentText>
          </DialogContent>
          <DialogActions>
              <Button onClick={handleCloseConfirmDelete}>Cancel</Button>
              <Button onClick={handleConfirmDelete} color="error" autoFocus>
                  Delete
              </Button>
          </DialogActions>
      </Dialog>
    </>
  );
};

export default SessionSidebar; 