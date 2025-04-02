import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import axios from 'axios';
import { Message, CustomModel } from './types';
import { API_BASE_URL, purposes, modelTypes } from './constants';
import ChatMessageList from './components/ChatMessageList';
import ChatInput from './components/ChatInput';
import AppHeader from './components/AppHeader';
import CreateModelDialog from './components/dialogs/CreateModelDialog';
import FileUploadDialog from './components/dialogs/FileUploadDialog';
import AddWebsiteDialog from './components/dialogs/AddWebsiteDialog';

// --- Axios Instance with Interceptor ---
const apiClient = axios.create({
  baseURL: API_BASE_URL, 
});

// Function to get the token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Request interceptor to add the auth token header
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {}; 
      config.headers.Authorization = `Bearer ${token}`;
    } else {
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (optional, added previously)
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error("Unauthorized request - 401 Error");
      if (getAuthToken()) {
          localStorage.removeItem('authToken');
          window.location.reload(); 
      }
    }
    return Promise.reject(error);
  }
);
// --- End Axios Instance Setup ---

function App() {
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!getAuthToken());
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [registerUsername, setRegisterUsername] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string>('');

  // --- Chat & Streaming State ---
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [purpose, setPurpose] = useState('General Knowledge');
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchCustomModels = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const response = await apiClient.get(`/api/custom_models`); 
      setCustomModels(response.data);
    } catch (error) {
      console.error('Error fetching custom models:', error);
      if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
          showSnackbar('Failed to fetch custom models', 'error');
      }
    }
  }, [isLoggedIn]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    const checkBackend = async () => {
      try {
      } catch (error) {
        showSnackbar('Backend server not available', 'error');
      }
    };
    
    checkBackend();
    if (isLoggedIn) {
        fetchCustomModels();
    } else {
        setCustomModels([]);
    }
  }, [isLoggedIn, fetchCustomModels]);
  
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSend = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || !isLoggedIn) return;

    // --- Close previous connection if any ---
    currentEventSource?.close(); 
    setCurrentEventSource(null);
    // --- End close previous connection ---

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    const streamingAssistantMessageId = `assistant-${Date.now()}`;
    const assistantMessagePlaceholder: Message = {
      id: streamingAssistantMessageId,
      role: 'assistant',
      content: '', // Start with empty content
      timestamp: new Date(),
      isStreaming: true, // Mark as streaming
    };

    // Add user message and placeholder immediately
    setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);
    setLoading(false); // Reset general loading, streaming is handled differently

    // Prepare data for backend (assuming it accepts history in query/body)
    // NOTE: Adjust how history is sent based on backend requirements!
    const historyForBackend = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

    // Prepare query parameters for the streaming endpoint
    const token = getAuthToken(); // Get token from localStorage
    if (!token) {
      showSnackbar("Authentication token not found. Please log in.", "error");
      currentEventSource?.close(); // Close any old connection
      setCurrentEventSource(null);
      // Update placeholder to show auth error
      setMessages((prev) =>
         prev.map((msg) =>
            msg.id === streamingAssistantMessageId
            ? { ...msg, content: "Authentication Error", isStreaming: false, error: "Token not found" }
            : msg
        )
      );
      return; // Stop processing
    }

    const queryParams = new URLSearchParams({
        token: token, // Add token here
        history: JSON.stringify(historyForBackend),
        purpose: purpose,
        ...(selectedModelId && { model_id: selectedModelId })
    });

    // --- Setup EventSource --- 
    const eventSourceUrl = `${API_BASE_URL}/api/chat_stream?${queryParams.toString()}`;
    const es = new EventSource(eventSourceUrl);
    setCurrentEventSource(es); 

    es.onopen = () => {
      console.log("SSE connection opened.");
    };

    es.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.chunk) {
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === streamingAssistantMessageId
                ? { ...msg, content: msg.content + parsedData.chunk } 
                : msg
            )
          );
        } else if (parsedData.error) {
            // Handle specific error message from stream
            console.error("Error from stream:", parsedData.error);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageId
                  ? { ...msg, content: `Error: ${parsedData.error}`, isStreaming: false, error: parsedData.error }
                  : msg
              )
            );
            es.close(); // Close connection on error
            setCurrentEventSource(null);
        } else if (parsedData.done) {
             // Optional: Backend signals completion
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageId
                  ? { ...msg, isStreaming: false } 
                  : msg
              )
            );
            es.close();
            setCurrentEventSource(null);
        }
      } catch (err) {
        console.error("Failed to parse SSE message:", err, "Data:", event.data);
        // Update UI to show a generic parse error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingAssistantMessageId
              ? { ...msg, content: "Error receiving stream data.", isStreaming: false, error: "Stream parsing failed" }
              : msg
          )
        );
        es.close();
        setCurrentEventSource(null);
      }
    };

    es.onerror = (err) => {
      console.error("EventSource failed:", err);
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === streamingAssistantMessageId
            ? { ...msg, content: "Connection error with the server.", isStreaming: false, error: "Connection failed" }
            : msg
        )
      );
      es.close();
      setCurrentEventSource(null);
    };

    // setLoading(true); // Maybe use a different state for streaming indication
  
  }, [messages, purpose, selectedModelId, isLoggedIn, currentEventSource]); // Add currentEventSource dependency
  
  const handleRegenerate = useCallback((messageIdToRegenerate: string) => {
    if (!isLoggedIn) return;

    const messageIndex = messages.findIndex(msg => msg.id === messageIdToRegenerate);

    // Ensure the message exists, it's an assistant message, and it's not currently streaming
    if (messageIndex <= 0 || messages[messageIndex].role !== 'assistant' || messages[messageIndex].isStreaming) {
      console.error("Cannot regenerate this message:", messageIdToRegenerate, messages[messageIndex]);
      showSnackbar('Cannot regenerate this message.', 'warning');
      return;
    }

    // --- Close previous connection if any ---
    currentEventSource?.close(); 
    setCurrentEventSource(null);
    // --- End close previous connection ---

    // History includes messages up to (but not including) the one being regenerated
    const historyForBackend = messages.slice(0, messageIndex).map(m => ({ role: m.role, content: m.content }));

    // Create a new ID and placeholder for the regenerating message
    const streamingAssistantMessageId = `assistant-${Date.now()}-regen`;
    const assistantMessagePlaceholder: Message = {
      id: streamingAssistantMessageId,
      role: 'assistant',
      content: '', 
      timestamp: new Date(),
      isStreaming: true,
    };

    // Replace the old message and any subsequent ones with the new placeholder
    setMessages((prev) => [...prev.slice(0, messageIndex), assistantMessagePlaceholder]);
    setLoading(false); 

    // Prepare query parameters for the streaming endpoint
    const token = getAuthToken(); // Get token from localStorage
    if (!token) {
      showSnackbar("Authentication token not found. Please log in.", "error");
      currentEventSource?.close(); // Close any old connection
      setCurrentEventSource(null);
      // Update placeholder to show auth error
      setMessages((prev) =>
         prev.map((msg) =>
            msg.id === streamingAssistantMessageId
            ? { ...msg, content: "Authentication Error", isStreaming: false, error: "Token not found" }
            : msg
        )
      );
      return; // Stop processing
    }

    const queryParams = new URLSearchParams({
        token: token, // Add token
        history: JSON.stringify(historyForBackend),
        purpose: purpose,
        ...(selectedModelId && { model_id: selectedModelId })
    });

    // --- Setup EventSource (Similar to handleSend) --- 
    const eventSourceUrl = `${API_BASE_URL}/api/chat_stream?${queryParams.toString()}`;
    const es = new EventSource(eventSourceUrl);
    setCurrentEventSource(es);

    es.onopen = () => {
      console.log("SSE connection opened for regeneration.");
    };

    es.onmessage = (event) => {
       try {
        const parsedData = JSON.parse(event.data);
        if (parsedData.chunk) {
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === streamingAssistantMessageId
                ? { ...msg, content: msg.content + parsedData.chunk } 
                : msg
            )
          );
        } else if (parsedData.error) {
            console.error("Error from regeneration stream:", parsedData.error);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageId
                  ? { ...msg, content: `Error: ${parsedData.error}`, isStreaming: false, error: parsedData.error }
                  : msg
              )
            );
            es.close();
            setCurrentEventSource(null);
        } else if (parsedData.done) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingAssistantMessageId
                  ? { ...msg, isStreaming: false } 
                  : msg
              )
            );
            es.close();
            setCurrentEventSource(null);
        }
      } catch (err) {
        console.error("Failed to parse SSE message during regeneration:", err, "Data:", event.data);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingAssistantMessageId
              ? { ...msg, content: "Error receiving stream data.", isStreaming: false, error: "Stream parsing failed" }
              : msg
          )
        );
        es.close();
        setCurrentEventSource(null);
      }
    };

    es.onerror = (err) => {
      console.error("EventSource failed during regeneration:", err);
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === streamingAssistantMessageId
            ? { ...msg, content: "Connection error during regeneration.", isStreaming: false, error: "Connection failed" }
            : msg
        )
      );
      es.close();
      setCurrentEventSource(null);
    };

  }, [messages, purpose, selectedModelId, isLoggedIn, currentEventSource]); // Add dependencies
  
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await apiClient.post('/api/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.access_token) {
        localStorage.setItem('authToken', response.data.access_token);
        setIsLoggedIn(true);
        setUsername('');
        setPassword('');
        setViewMode('login');
        showSnackbar('Login successful!', 'success');
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('Login failed:', error);
      const errorMsg = axios.isAxiosError(error) && error.response?.data?.detail
        ? error.response.data.detail 
        : 'Login failed. Please check username/password.';
      setLoginError(errorMsg);
      showSnackbar(errorMsg, 'error');
      setIsLoggedIn(false);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterError('');

    if (registerPassword !== confirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }
    if (!registerUsername || !registerPassword) {
        setRegisterError('Username and password cannot be empty.');
        return;
    }

    setRegisterLoading(true);
    try {
      const payload = {
        username: registerUsername,
        password: registerPassword,
      };
      await apiClient.post('/api/users/register', payload);
      
      showSnackbar('Registration successful! Please log in.', 'success');
      setRegisterUsername('');
      setRegisterPassword('');
      setConfirmPassword('');
      setViewMode('login'); 
      setLoginError(''); 

    } catch (error) {
      console.error('Registration failed:', error);
       const errorMsg = axios.isAxiosError(error) && error.response?.data?.detail
        ? error.response.data.detail 
        : 'Registration failed. Please try again.';
      setRegisterError(errorMsg);
      showSnackbar(errorMsg, 'error'); 
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsLoggedIn(false);
    setMessages([]);
    setCustomModels([]);
    setSelectedModelId(null);
    setViewMode('login');
    showSnackbar('Logged out successfully.', 'info');
  };
  
  const handleCreateModel = async () => {
    try {
      let response;
      const modelPayload = {
        name: newModelName,
        description: newModelDesc,
        model_type: newModelType,
        instructions: newModelInstructions,
      };

      response = await apiClient.post(`/api/custom_models`, modelPayload); 
      
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
      await apiClient.post(`/api/custom_models/${modelId}/extract_website_content`, { 
        url: url
      });
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
      await apiClient.post( 
        `/api/custom_models/${selectedModelId}/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
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
      await apiClient.delete(`/api/custom_models/${modelId}`); 
      
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
    }
  };

  if (!isLoggedIn) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography component="h1" variant="h5">
            {viewMode === 'login' ? 'Sign in' : 'Register'}
          </Typography>
          
          {viewMode === 'login' ? (
            <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loginLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginLoading}
              />
              {loginError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {loginError}
                </Typography>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loginLoading}
              >
                {loginLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
              <Button 
                fullWidth 
                variant="text"
                onClick={() => { setViewMode('register'); setLoginError(''); }}
                sx={{ mb: 2 }}
              >
                Don't have an account? Register
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleRegister} noValidate sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="register-username"
                label="Username"
                name="register-username"
                autoComplete="username"
                autoFocus
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                disabled={registerLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="register-password"
                label="Password"
                type="password"
                id="register-password"
                autoComplete="new-password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                disabled={registerLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirm-password"
                label="Confirm Password"
                type="password"
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={registerPassword !== confirmPassword && confirmPassword !== ''}
                helperText={registerPassword !== confirmPassword && confirmPassword !== '' ? "Passwords do not match" : ""}
                disabled={registerLoading}
              />
              {registerError && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {registerError}
                </Typography>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={registerLoading || (registerPassword !== confirmPassword && confirmPassword !== '')}
              >
                {registerLoading ? <CircularProgress size={24} /> : 'Register'}
              </Button>
              <Button 
                fullWidth 
                variant="text"
                onClick={() => { setViewMode('login'); setRegisterError(''); }}
                 sx={{ mb: 2 }}
             >
                Already have an account? Sign in
              </Button>
            </Box>
          )}
        </Box>
         <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={() => setSnackbarOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 0 }}>
      <AppHeader 
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
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
          onRegenerate={handleRegenerate}
        />

        <ChatInput onSend={handleSend} loading={loading} />

        {/* Add Stop Generating Button */}
        {currentEventSource && (
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                currentEventSource.close();
                setCurrentEventSource(null);
                // Optional: Update the last message state to indicate it was stopped
                setMessages(prev => prev.map(msg => {
                  if (msg.id === prev[prev.length - 1].id && msg.isStreaming) {
                    return { ...msg, isStreaming: false, content: msg.content + ' [Stopped]' };
                  }
                  return msg;
                }));
              }}
            >
              Stop Generating
            </Button>
          </Box>
        )}
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