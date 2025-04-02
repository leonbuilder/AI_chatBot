import React, { useState, useEffect } from 'react';
import {
    AppBar, Toolbar, Typography, IconButton, MenuItem, Button, Box, TextField, Tooltip,
    Tabs, Tab, Select, FormControl, InputLabel, SelectChangeEvent
} from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LogoutIcon from '@mui/icons-material/Logout';
import { Edit, Save, Cancel } from '@mui/icons-material';
import { CustomModel, SessionInfo } from '../types';

// Define the props for the component
interface AppHeaderProps {
    tabValue: number;
    onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
    purposes: string[];
    purpose: string;
    onPurposeChange: (event: SelectChangeEvent<string>) => void;
    customModels: CustomModel[];
    selectedModelId: string | null;
    onModelSelect: (event: SelectChangeEvent<string>) => void;
    onCreateModelClick: () => void;
    onUploadFileClick: () => void;
    onAddWebsiteClick: () => void;
    onDeleteModelClick: (modelId: string) => void;
    isLoggedIn: boolean;
    username: string | null;
    sessions: SessionInfo[];
    sessionsLoading: boolean;
    activeSessionId: string | null;
    activeSessionSystemPrompt: string | null;
    onUpdateSystemPrompt: (sessionId: string, newPrompt: string) => void;
    onToggleSidebar: () => void;
    onLogout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    tabValue,
    onTabChange,
    purposes,
    purpose,
    onPurposeChange,
    customModels,
    selectedModelId,
    onModelSelect,
    onCreateModelClick,
    onUploadFileClick,
    onAddWebsiteClick,
    onDeleteModelClick,
    isLoggedIn,
    username,
    sessions,
    sessionsLoading,
    activeSessionId,
    activeSessionSystemPrompt,
    onUpdateSystemPrompt,
    onToggleSidebar,
    onLogout
}) => {

    const selectedModel = customModels.find(m => m.id === selectedModelId);
    const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
    const [editedPrompt, setEditedPrompt] = useState<string>('');

    useEffect(() => {
        setEditedPrompt(activeSessionSystemPrompt || '');
        if (!activeSessionId) {
            setIsEditingPrompt(false);
        }
    }, [activeSessionSystemPrompt, activeSessionId]);

    const handleStartEditPrompt = () => {
        setIsEditingPrompt(true);
    };

    const handleCancelEditPrompt = () => {
        setIsEditingPrompt(false);
        setEditedPrompt(activeSessionSystemPrompt || '');
    };

    const handleSavePrompt = () => {
        if (activeSessionId) {
            onUpdateSystemPrompt(activeSessionId, editedPrompt);
            setIsEditingPrompt(false);
        }
    };

    return (
        <AppBar position="static" color="default" elevation={1}>
            <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', pt: 1, pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    {isLoggedIn && (
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={onToggleSidebar}
                            sx={{ mr: 1 }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        AI Chatbot
                    </Typography>
                    {isLoggedIn && (
                        <Button
                            color="inherit"
                            onClick={onLogout}
                            startIcon={<LogoutIcon />}
                            size="small"
                        >
                            Logout
                        </Button>
                    )}
                </Box>

                <Tabs
                    value={tabValue}
                    onChange={onTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="General Chat" />
                    <Tab label="Custom Models" />
                </Tabs>

                <Box sx={{ pt: 2 }}>
                    {activeSessionId && (
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isEditingPrompt ? (
                                <TextField
                                    label="System Prompt / Context"
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    multiline
                                    maxRows={4}
                                    value={editedPrompt}
                                    onChange={(e) => setEditedPrompt(e.target.value)}
                                    autoFocus
                                />
                            ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', flexGrow: 1 }}>
                                    {activeSessionSystemPrompt ? `Context: ${activeSessionSystemPrompt}` : "No custom context set for this chat."}
                                </Typography>
                            )}
                            
                            {isEditingPrompt ? (
                                <>
                                    <Tooltip title="Save Prompt">
                                        <IconButton onClick={handleSavePrompt} color="primary" size="small"><Save /></IconButton>
                                    </Tooltip>
                                    <Tooltip title="Cancel Edit">
                                        <IconButton onClick={handleCancelEditPrompt} size="small"><Cancel /></IconButton>
                                    </Tooltip>
                                </>
                            ) : (
                                <Tooltip title="Edit Context">
                                    <IconButton onClick={handleStartEditPrompt} size="small"><Edit /></IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    )}
                    
                    {tabValue === 0 ? (
                        <FormControl fullWidth size="small">
                            <InputLabel>Purpose</InputLabel>
                            <Select
                                value={purpose}
                                label="Purpose"
                                onChange={onPurposeChange}
                            >
                                {purposes.map((p) => (
                                    <MenuItem key={p} value={p}>
                                        {p}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : (
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: selectedModelId ? 1.5 : 0, gap: 2 }}>
                                <FormControl fullWidth size="small" sx={{ flexGrow: 1 }}>
                                    <InputLabel>Custom Model</InputLabel>
                                    <Select
                                        value={selectedModelId || ''}
                                        label="Custom Model"
                                        onChange={onModelSelect}
                                        displayEmpty
                                    >
                                        <MenuItem value="">
                                            <em>Default Model</em>
                                        </MenuItem>
                                        {customModels.map((model) => (
                                            <MenuItem key={model.id} value={model.id}>
                                                {model.name} ({model.model_type})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="medium"
                                    startIcon={<AddIcon />}
                                    onClick={onCreateModelClick}
                                    sx={{ flexShrink: 0 }}
                                >
                                    Create
                                </Button>
                            </Box>
                            
                            {selectedModelId && selectedModel && (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {selectedModel.model_type === 'assistant' && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<FileUploadIcon />}
                                            onClick={onUploadFileClick}
                                        >
                                            Upload File
                                        </Button>
                                    )}
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<LinkIcon />}
                                        onClick={onAddWebsiteClick}
                                    >
                                        Add Website
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => onDeleteModelClick(selectedModelId)}
                                        sx={{ ml: 'auto' }}
                                    >
                                        Delete Model
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default AppHeader; 