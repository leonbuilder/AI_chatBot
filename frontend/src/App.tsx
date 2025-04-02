import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  SelectChangeEvent,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import axios from 'axios';
import { mockApi } from './mockBackend';
import { Message, CustomModel } from './types';
import { API_BASE_URL, purposes, modelTypes } from './constants';
import ChatMessageList from './components/ChatMessageList';
import ChatInput from './components/ChatInput';
import AppHeader from './components/AppHeader';
import CreateModelDialog from './components/dialogs/CreateModelDialog';
import FileUploadDialog from './components/dialogs/FileUploadDialog';
import AddWebsiteDialog from './components/dialogs/AddWebsiteDialog';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [purpose, setPurpose] = useState('General Knowledge');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  const [useRealBackend, setUseRealBackend] = useState(false);
  
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
  
  const [uploading, setUploading] = useState(false);
  
  const [websiteExtracting, setWebsiteExtracting] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/health`);
        setUseRealBackend(false);
        showSnackbar('Backend server detected! You can toggle between real and mock mode.', 'success');
      } catch (error) {
        setUseRealBackend(false);
        showSnackbar('Using mock backend - real server not available', 'error');
      }
    };
    
    checkBackend();
    fetchCustomModels();
  }, []);
  
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

  const handleSend = useCallback(async (messageContent: string) => {
    if (!messageContent.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let response;
      const messagesToSend = [...messages, userMessage];
      if (useRealBackend) {
        response = await axios.post(`${API_BASE_URL}/api/chat`, {
          messages: messagesToSend,
          purpose,
          model_id: selectedModelId,
        });
      } else {
        response = await mockApi.chat({
          messages: messagesToSend,
          purpose,
          model_id: selectedModelId,
        });
      }

      console.log('Server response:', response.data);
      const responseMessage = response.data.message || "No response received";
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [messages, purpose, selectedModelId, useRealBackend]);
  
  const handleCreateModel = async () => {
    try {
      let response;
      const modelPayload = {
        name: newModelName,
        description: newModelDesc,
        model_type: newModelType,
        instructions: newModelInstructions,
      };

      if (useRealBackend) {
        response = await axios.post(`${API_BASE_URL}/api/custom_models`, modelPayload);
      } else {
        response = await mockApi.createCustomModel(modelPayload);
      }
      
      setCustomModels([...customModels, response.data]);
      setModelDialogOpen(false);
      resetModelForm();
      showSnackbar('Custom model created successfully', 'success');
      setSelectedModelId(response.data.id);

    } catch (error) {
      console.error('Error creating model:', error);
      showSnackbar('Failed to create custom model', 'error');
    }
  };
  
  const extractWebsiteContent = async (modelId: string, url: string) => {
    setWebsiteExtracting(true);
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
      throw error;
    } finally {
      setWebsiteExtracting(false);
    }
  };
  
  const handleFileUpload = async () => {
    if (!selectedFile || !selectedModelId) return;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    setUploading(true);
    
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
    } finally {
      setUploading(false);
    }
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };
  
  const handleDeleteModel = async (modelId: string) => {
    try {
      if (useRealBackend) {
        await axios.delete(`${API_BASE_URL}/api/custom_models/${modelId}`);
      } else {
        await mockApi.deleteCustomModel(modelId);
      }
      
      setCustomModels(customModels.filter(model => model.id !== modelId));
      
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
  };
  
  const handleWebsiteIntegration = async () => {
    if (!websiteUrl || !selectedModelId) return;
    try {
      await extractWebsiteContent(selectedModelId, websiteUrl);
      setWebsiteDialogOpen(false);
      setWebsiteUrl('');
      showSnackbar('Website content extraction initiated.', 'success');
    } catch (error) {
      // Error is already logged and snackbar shown in extractWebsiteContent
      // No need to show another snackbar here
    }
  };

  return (
    <Container maxWidth="lg" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 0 }}>
      <AppHeader 
        useRealBackend={useRealBackend}
        onBackendToggle={(checked: boolean) => setUseRealBackend(checked)}
        tabValue={tabValue}
        onTabChange={(_event: React.SyntheticEvent, newValue: number) => setTabValue(newValue)}
        purposes={purposes}
        purpose={purpose}
        onPurposeChange={(e: SelectChangeEvent<string>) => setPurpose(e.target.value)}
        customModels={customModels}
        selectedModelId={selectedModelId}
        onModelSelect={(e: SelectChangeEvent<string>) => setSelectedModelId(e.target.value)}
        onCreateModelClick={() => setModelDialogOpen(true)}
        onUploadFileClick={() => setFileDialogOpen(true)}
        onAddWebsiteClick={() => setWebsiteDialogOpen(true)}
        onDeleteModelClick={(modelId: string) => {
          if (window.confirm('Are you sure you want to delete this model?')) {
            handleDeleteModel(modelId);
          }
        }}
      />

      <Paper 
        elevation={0} 
        sx={{ 
          flexGrow: 1,
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          bgcolor: 'background.default'
        }}
      >
        <ChatMessageList 
          messages={messages}
          loading={loading}
          messagesEndRef={messagesEndRef}
        />

        <ChatInput onSend={handleSend} loading={loading} />
      </Paper>
      
      <CreateModelDialog
        open={modelDialogOpen}
        onClose={() => {
          setModelDialogOpen(false);
        }}
        modelName={newModelName}
        setModelName={setNewModelName}
        modelDesc={newModelDesc}
        setModelDesc={setNewModelDesc}
        modelType={newModelType}
        setModelType={setNewModelType}
        modelInstructions={newModelInstructions}
        setModelInstructions={setNewModelInstructions}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        onSubmit={handleCreateModel}
        modelTypes={modelTypes}
      />
      
      <FileUploadDialog
        open={fileDialogOpen}
        onClose={() => {
          setFileDialogOpen(false);
          setSelectedFile(null);
        }}
        onFileSelect={handleFileSelect}
        onFileUpload={handleFileUpload}
        selectedFile={selectedFile}
        uploading={uploading}
      />
      
      <AddWebsiteDialog
        open={websiteDialogOpen}
        onClose={() => {
          setWebsiteDialogOpen(false);
        }}
        onSubmit={handleWebsiteIntegration}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        loading={websiteExtracting}
      />
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 8, sm: 24 } }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          variant="filled"
          sx={{ width: '100%', boxShadow: 6 }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App; 