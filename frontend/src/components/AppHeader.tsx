import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  SelectChangeEvent // Import SelectChangeEvent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { CustomModel } from '../types'; // Import CustomModel type

interface AppHeaderProps {
  useRealBackend: boolean;
  onBackendToggle: (checked: boolean) => void;
  tabValue: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  purposes: string[];
  purpose: string;
  onPurposeChange: (event: SelectChangeEvent<string>) => void; // Use specific event type
  customModels: CustomModel[];
  selectedModelId: string | null;
  onModelSelect: (event: SelectChangeEvent<string>) => void; // Use specific event type
  onCreateModelClick: () => void;
  onUploadFileClick: () => void;
  onAddWebsiteClick: () => void;
  onDeleteModelClick: (modelId: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  useRealBackend,
  onBackendToggle,
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
}) => {

  const selectedModel = customModels.find(m => m.id === selectedModelId);

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', pt: 1, pb: 1 }}>
        {/* Top Row: Title and Backend Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            AI Chatbot
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={useRealBackend}
                onChange={(e) => onBackendToggle(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            labelPlacement="start"
            label={<Typography variant="caption">{useRealBackend ? 'Real Backend' : 'Mock Backend'}</Typography>}
            sx={{ mr: 0, ml: 'auto' }} // Adjust margin
          />
        </Box>

        {/* Second Row: Tabs */}
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

        {/* Third Row: Contextual Controls (Purpose/Model Selection & Actions) */}
        <Box sx={{ pt: 2 }}>
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
                  sx={{ flexShrink: 0 }} // Prevent shrinking
                >
                  Create
                </Button>
              </Box>
              
              {selectedModelId && selectedModel && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {/* Conditionally show Upload File only for assistant models */}
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
                    onClick={() => onDeleteModelClick(selectedModelId)} // No need for confirm here, handled in App
                    sx={{ ml: 'auto' }} // Push delete to the right
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