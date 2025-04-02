import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import axios from 'axios';
import { mockApi } from './mockBackend';

// API base URL
const API_BASE_URL = 'http://localhost:8001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CustomModel {
  id: string;
  name: string;
  description: string;
  model_type: 'gpt' | 'assistant' | 'fine-tuned';
  instructions: string;
  created_at: string;
  updated_at: string;
}

const purposes = [
  'General Knowledge',
  'Technical Support',
  'Writing Assistant',
  'Language Learning',
  'Math Tutor',
  'Science Expert',
];

const modelTypes = [
  { value: 'gpt', label: 'GPT - Text Generation' },
  { value: 'assistant', label: 'Assistant - File Search & Retrieval' },
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [purpose, setPurpose] = useState('General Knowledge');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // Add a state to control using real backend vs mock
  const [useRealBackend, setUseRealBackend] = useState(false);
  
  // Create model states
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelType, setNewModelType] = useState<'gpt' | 'assistant'>('gpt');
  const [newModelInstructions, setNewModelInstructions] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [websiteDialogOpen, setWebsiteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    // Check if backend is available
    const checkBackend = async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/health`);
        // Backend is available, but default to mock mode and let user toggle
        setUseRealBackend(false);
        showSnackbar('Backend server detected! You can toggle between real and mock mode.', 'success');
      } catch (error) {
        // Backend not available, force mock mode
        setUseRealBackend(false);
        showSnackbar('Using mock backend - real server not available', 'error');
      }
    };
    
    checkBackend();
    fetchCustomModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const fetchCustomModels = async () => {
    try {
      let response;
      if (useRealBackend) {
        response = await axios.get(`${API_BASE_URL}/api/custom_models`);
      } else {
        response = await mockApi.getCustomModels();
      }
      setCustomModels(response.data);
    } catch (error) {
      console.error('Error fetching custom models:', error);
      // If real backend fails, fall back to mock
      if (useRealBackend) {
        const mockResponse = await mockApi.getCustomModels();
        setCustomModels(mockResponse.data);
        showSnackbar('Failed to fetch from backend, using mock data', 'error');
        setUseRealBackend(false);
      }
    }
  };
  
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let response;
      if (useRealBackend) {
        response = await axios.post(`${API_BASE_URL}/api/chat`, {
          messages: [...messages, userMessage],
          purpose,
          model_id: selectedModelId,
        });
      } else {
        response = await mockApi.chat({
          messages: [...messages, userMessage],
          purpose,
          model_id: selectedModelId,
        });
      }

      // Log the response for debugging
      console.log('Server response:', response.data);

      // Make sure we extract the message content correctly
      const responseMessage = response.data.message || "No response received";
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseMessage,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };
  
  const handleCreateModel = async () => {
    try {
      let response;
      if (useRealBackend) {
        response = await axios.post(`${API_BASE_URL}/api/custom_models`, {
          name: newModelName,
          description: newModelDesc,
          model_type: newModelType,
          instructions: newModelInstructions,
          website_url: websiteUrl || undefined,
        });
      } else {
        response = await mockApi.createCustomModel({
          name: newModelName,
          description: newModelDesc,
          model_type: newModelType,
          instructions: newModelInstructions,
          website_url: websiteUrl || undefined,
        });
      }
      
      setCustomModels([...customModels, response.data]);
      setModelDialogOpen(false);
      resetModelForm();
      showSnackbar('Custom model created successfully', 'success');
      
      // Select the newly created model
      setSelectedModelId(response.data.id);
      
      // If website URL was provided, extract content
      if (websiteUrl) {
        await extractWebsiteContent(response.data.id, websiteUrl);
      }
    } catch (error) {
      console.error('Error creating model:', error);
      showSnackbar('Failed to create custom model', 'error');
    }
  };
  
  const extractWebsiteContent = async (modelId: string, url: string) => {
    try {
      if (useRealBackend) {
        await axios.post(`${API_BASE_URL}/api/custom_models/${modelId}/extract_website_content`, {
          url: url
        });
      } else {
        await mockApi.extractWebsiteContent();
      }
      showSnackbar('Website content extracted successfully', 'success');
    } catch (error) {
      console.error('Error extracting website content:', error);
      showSnackbar('Failed to extract website content', 'error');
    }
  };
  
  const handleFileUpload = async () => {
    if (!selectedFile || !selectedModelId) return;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      if (useRealBackend) {
        await axios.post(
          `${API_BASE_URL}/api/custom_models/${selectedModelId}/files`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        await mockApi.uploadFile();
      }
      
      setFileDialogOpen(false);
      setSelectedFile(null);
      showSnackbar('File uploaded successfully', 'success');
    } catch (error) {
      console.error('Error uploading file:', error);
      showSnackbar('Failed to upload file', 'error');
    }
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };
  
  const handleDeleteModel = async (modelId: string) => {
    try {
      if (useRealBackend) {
        await axios.delete(`${API_BASE_URL}/api/custom_models/${modelId}`);
      } else {
        await mockApi.deleteCustomModel(modelId);
      }
      
      // Remove the model from the list
      setCustomModels(customModels.filter(model => model.id !== modelId));
      
      // Unselect if it was selected
      if (selectedModelId === modelId) {
        setSelectedModelId(null);
      }
      
      showSnackbar('Model deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting model:', error);
      showSnackbar('Failed to delete model', 'error');
    }
  };
  
  const resetModelForm = () => {
    setNewModelName('');
    setNewModelDesc('');
    setNewModelType('gpt');
    setNewModelInstructions('');
    setWebsiteUrl('');
  };
  
  const handleWebsiteIntegration = async () => {
    if (!websiteUrl || !selectedModelId) return;
    
    try {
      await extractWebsiteContent(selectedModelId, websiteUrl);
      setWebsiteDialogOpen(false);
      setWebsiteUrl('');
    } catch (error) {
      console.error('Error with website integration:', error);
      showSnackbar('Failed to integrate website content', 'error');
    }
  };

  return (
    <Container maxWidth="md" sx={{ height: '100vh', py: 4 }}>
      <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" gutterBottom>
            AI Chatbot
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'info.light', p: 1, borderRadius: 1, mb: 2 }}>
            <Typography variant="body2" color="info.contrastText">
              {useRealBackend 
                ? 'Using real backend server for responses' 
                : 'Using mock data for demonstration'}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={useRealBackend}
                  onChange={(e) => setUseRealBackend(e.target.checked)}
                  color="primary"
                />
              }
              label="Use real server"
            />
          </Box>
          
          <Tabs 
            value={tabValue} 
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{ mb: 2 }}
          >
            <Tab label="General Chat" />
            <Tab label="Custom Models" />
          </Tabs>
          
          {tabValue === 0 ? (
            <FormControl fullWidth>
              <InputLabel>Purpose</InputLabel>
              <Select
                value={purpose}
                label="Purpose"
                onChange={(e) => setPurpose(e.target.value)}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <FormControl fullWidth sx={{ mr: 2 }}>
                  <InputLabel>Custom Model</InputLabel>
                  <Select
                    value={selectedModelId || ''}
                    label="Custom Model"
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>None</em>
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
                  startIcon={<AddIcon />}
                  onClick={() => setModelDialogOpen(true)}
                >
                  Create
                </Button>
              </Box>
              
              {selectedModelId && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileUploadIcon />}
                    onClick={() => setFileDialogOpen(true)}
                    disabled={!customModels.find(m => m.id === selectedModelId)?.model_type.includes('assistant')}
                  >
                    Upload File
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<LinkIcon />}
                    onClick={() => setWebsiteDialogOpen(true)}
                  >
                    Add Website
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this model?')) {
                        handleDeleteModel(selectedModelId);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '70%',
                  backgroundColor: message.role === 'user' ? 'primary.light' : 'grey.100',
                  color: message.role === 'user' ? 'white' : 'text.primary',
                }}
              >
                <Typography sx={{ whiteSpace: 'pre-line' }}>
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress />
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Paper>
      
      {/* Create Model Dialog */}
      <Dialog open={modelDialogOpen} onClose={() => setModelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Custom Model</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label="Model Name"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Description"
            value={newModelDesc}
            onChange={(e) => setNewModelDesc(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Model Type</InputLabel>
            <Select
              value={newModelType}
              label="Model Type"
              onChange={(e) => setNewModelType(e.target.value as 'gpt' | 'assistant')}
            >
              {modelTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="dense"
            label="Instructions"
            multiline
            rows={4}
            value={newModelInstructions}
            onChange={(e) => setNewModelInstructions(e.target.value)}
            placeholder="Provide detailed instructions on how the model should behave, what information it should use, etc."
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Website URL (Optional)"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            helperText="Content from this website will be extracted and provided to the model"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModelDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateModel} 
            disabled={!newModelName || !newModelInstructions}
            variant="contained"
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* File Upload Dialog */}
      <Dialog open={fileDialogOpen} onClose={() => setFileDialogOpen(false)}>
        <DialogTitle>Upload File</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload a file to enhance your assistant's knowledge. Supported formats: PDF, TXT, DOCX, CSV, JSON.
          </Typography>
          <Button
            variant="outlined"
            component="label"
            startIcon={<FileUploadIcon />}
          >
            Select File
            <input
              type="file"
              hidden
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.txt,.docx,.csv,.json"
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Selected: {selectedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleFileUpload} 
            disabled={!selectedFile}
            variant="contained"
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Website Integration Dialog */}
      <Dialog open={websiteDialogOpen} onClose={() => setWebsiteDialogOpen(false)}>
        <DialogTitle>Add Website Content</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter a website URL to extract content and make it available to your custom model.
          </Typography>
          <TextField
            fullWidth
            margin="dense"
            label="Website URL"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWebsiteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleWebsiteIntegration} 
            disabled={!websiteUrl}
            variant="contained"
          >
            Extract Content
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App; 