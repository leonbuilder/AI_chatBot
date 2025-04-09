import React, { useState, useEffect } from 'react';
import {
    AppBar, Toolbar, Typography, IconButton, MenuItem, Button, Box, TextField, Tooltip,
    Tabs, Tab, Select, FormControl, InputLabel, SelectChangeEvent, useTheme, alpha
} from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LogoutIcon from '@mui/icons-material/Logout';
import { Edit, Save, Cancel, Settings, SettingsOutlined } from '@mui/icons-material';
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
    onOpenSettings?: () => void;
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
    onLogout,
    onOpenSettings
}) => {
    const theme = useTheme();
    const selectedModel = customModels.find(m => m.id === selectedModelId);

    return (
        <AppBar position="static" color="default" elevation={0}>
            <Toolbar sx={{ 
                flexDirection: 'column', 
                alignItems: 'stretch', 
                p: { xs: 1.5, sm: 2 },
                pt: { xs: 1.5, sm: 2 },
                pb: 0,
            }}>
                {/* Top Bar */}
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 1.5
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {isLoggedIn && (
                            <IconButton
                                onClick={onToggleSidebar}
                                size="small"
                                sx={{ 
                                    mr: 1.5,
                                    color: theme.palette.text.secondary,
                                }}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}
                        <Typography variant="h6" sx={{ 
                            fontWeight: 600,
                            fontSize: '1.2rem', 
                            color: theme.palette.primary.main,
                        }}>
                            AI Chatbot
                        </Typography>
                    </Box>
                    
                    {isLoggedIn && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {onOpenSettings && (
                                <Tooltip title="Settings">
                                    <IconButton
                                        size="small"
                                        onClick={onOpenSettings}
                                        sx={{ 
                                            mr: 1,
                                            color: theme.palette.text.secondary,
                                        }}
                                    >
                                        <SettingsOutlined />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Button
                                variant="text"
                                onClick={onLogout}
                                startIcon={<LogoutIcon />}
                                size="small"
                                sx={{ color: theme.palette.text.secondary }}
                            >
                                Logout
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* Tabs */}
                <Tabs
                    value={tabValue}
                    onChange={onTabChange}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                    sx={{ 
                        '.MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 500,
                            minHeight: 40,
                        }
                    }}
                >
                    <Tab label="General Chat" />
                    <Tab label="Custom Models" />
                </Tabs>

                <Box sx={{ py: 1.5 }}>
                    {/* Tab Content */}
                    {tabValue === 0 ? (
                        <Box sx={{ height: 56, display: 'flex', alignItems: 'center' }}>
                            {/* Purpose selector moved to settings dialog */}
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    color: theme.palette.text.secondary, 
                                    fontStyle: 'italic'
                                }}
                            >
                                Purpose: {purpose}
                            </Typography>
                        </Box>
                    ) : (
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: selectedModelId ? 1.5 : 0, gap: 1.5 }}>
                                <FormControl fullWidth size="small">
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
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={onCreateModelClick}
                                >
                                    Create
                                </Button>
                            </Box>
                            
                            {selectedModelId && selectedModel && (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                                    {selectedModel.model_type === 'assistant' && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<FileUploadIcon fontSize="small" />}
                                            onClick={onUploadFileClick}
                                        >
                                            Upload File
                                        </Button>
                                    )}
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<LinkIcon fontSize="small" />}
                                        onClick={onAddWebsiteClick}
                                    >
                                        Add Website
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon fontSize="small" />}
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