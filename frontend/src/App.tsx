import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { Message, CustomModel, SessionInfo } from './types';
import { API_BASE_URL, purposes, modelTypes } from './constants';
import ChatMessageList from './components/ChatMessageList';
import ChatInput from './components/ChatInput';
import AppHeader from './components/AppHeader';
import SessionSidebar from './components/SessionSidebar';
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

  // --- Session History State ---
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const initialLoadComplete = useRef<boolean>(false); // Ref to track initial load
  const titleGenerationRequested = useRef<Set<string>>(new Set()); // Track sessions where title generation has been requested
  // --- End Session History State ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, [setSnackbarMessage, setSnackbarSeverity, setSnackbarOpen]);

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
  }, [isLoggedIn, showSnackbar]);
  
  const fetchSessions = useCallback(async () => {
    if (!isLoggedIn) return;
    setSessionsLoading(true);
    console.log("Fetching chat sessions...");
    try {
      const response = await apiClient.get<{ sessions: SessionInfo[] }>('/api/chat_sessions');
      const fetchedSessions = response.data.sessions || [];
      setSessions(fetchedSessions);
      console.log(`Fetched ${fetchedSessions.length} sessions.`);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
        showSnackbar('Failed to load chat sessions', 'error');
      }
    } finally {
      setSessionsLoading(false);
    }
  }, [isLoggedIn, showSnackbar]);

  const fetchMessagesForSession = useCallback(async (sessionId: string) => {
    if (!isLoggedIn) return;
    setLoading(true);
    console.log(`Fetching messages for session: ${sessionId}`);
    
    try {
      // Always use the debug endpoint which doesn't filter by user_id
      const response = await apiClient.get(`/api/debug/session_messages/${sessionId}`);
      
      if (response.data.error) {
        console.error(`Error from debug endpoint: ${response.data.error}`);
        showSnackbar('Failed to load messages for this chat', 'error');
        setMessages([]);
        setActiveSessionId(null);
        setLoading(false);
        return;
      }
      
      console.log('Debug endpoint data:', response.data);
      
      // Define interface for debug endpoint message data
      interface DebugMessage {
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
        model_used?: string;
        edited_at?: string;
        is_deleted: boolean;
      }
      
      // Map of existing message IDs to preserve editing state if needed
      const existingMsgMap = new Map(messages.map(msg => [msg.id, msg]));
      
      // Transform the debug endpoint data to match the expected Message format
      const fetchedMessages = response.data.messages as DebugMessage[] || [];
      const processedMessages = fetchedMessages
        .filter((msg: DebugMessage) => !msg.is_deleted) // Only include non-deleted messages
        .map((msg: DebugMessage) => {
          // Check if this message already exists in our state to preserve properties
          const existingMsg = existingMsgMap.get(msg.id);
          
          return {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
            model_used: msg.model_used,
            edited_at: msg.edited_at ? new Date(msg.edited_at) : undefined,
            // Preserve isEditing and isRegenerated states from existing message if any
            isEditing: existingMsg?.isEditing || false,
            isRegenerated: existingMsg?.isRegenerated || false
          };
        });
      
      console.log(`Message roles breakdown: ${processedMessages.filter(msg => msg.role === 'user').length} user messages, ${processedMessages.filter(msg => msg.role === 'assistant').length} assistant messages`);
      
      setMessages(processedMessages);
      setActiveSessionId(sessionId);
      console.log(`Loaded ${processedMessages.length} messages for session ${sessionId}`);
    } catch (error) {
      console.error(`Error fetching messages for session ${sessionId}:`, error);
      showSnackbar('Failed to load messages for this chat', 'error');
      setMessages([]);
      setActiveSessionId(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, showSnackbar, messages]);

  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) {
        setSidebarOpen(false);
        return;
    } 
    console.log("Selected session:", sessionId);
    currentEventSource?.close(); 
    setCurrentEventSource(null);
    
    fetchMessagesForSession(sessionId);
    setSidebarOpen(false);
  }, [activeSessionId, fetchMessagesForSession, currentEventSource]);
  
  const handleNewSession = useCallback(() => {
    console.log("Creating new session");
    currentEventSource?.close();
    setCurrentEventSource(null);
    
    setActiveSessionId(null);
    setMessages([]);
    setLoading(false);
    setSidebarOpen(false);
  }, [currentEventSource]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    console.log("Deleting session:", sessionId);
    try {
      await apiClient.delete(`/api/chat_sessions/${sessionId}`);
      showSnackbar("Chat session deleted.", "success");
      // Remove from local state and potentially select another session or go to new chat
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      if (activeSessionId === sessionId) {
          handleNewSession(); // Go to new chat view if active session was deleted
      } else {
          // If a different session was deleted, just refresh the list (already done by filter)
      }
    } catch (error) {
        console.error(`Error deleting session ${sessionId}:`, error);
        showSnackbar("Failed to delete chat session.", "error");
    }
  }, [activeSessionId, handleNewSession, showSnackbar]);

  const handleRenameSession = useCallback(async (sessionId: string, newTitle: string) => {
     console.log(`Renaming session ${sessionId} to: ${newTitle}`);
     try {
        const response = await apiClient.patch<SessionInfo>(`/api/chat_sessions/${sessionId}`, { title: newTitle });
        showSnackbar("Chat session renamed.", "success");
        // Update local state
        setSessions(prev => prev.map(s => s.session_id === sessionId ? response.data : s));
        // No need to change active session
     } catch (error) {
        console.error(`Error renaming session ${sessionId}:`, error);
        showSnackbar("Failed to rename chat session.", "error");
     }
  }, [showSnackbar]);

  // Function to update system prompt via API
  const handleUpdateSystemPrompt = useCallback(async (sessionId: string, newPrompt: string) => {
    if (!sessionId) return;
    console.log(`Updating system prompt for session ${sessionId}`);
    try {
      const response = await apiClient.patch<SessionInfo>(`/api/chat_sessions/${sessionId}`, { system_prompt: newPrompt });
      showSnackbar("Chat context updated.", "success");
      // Update local session state immediately
      setSessions(prev => prev.map(s => s.session_id === sessionId ? response.data : s));
    } catch (error) {
      console.error(`Error updating system prompt for session ${sessionId}:`, error);
      showSnackbar("Failed to update chat context.", "error");
    }
  }, [showSnackbar]);

  // Function to generate a session title using the AI
  const generateSessionTitle = useCallback(async (sessionId: string, chatMessages: Message[]) => {
    // Don't generate again if we've already requested a title for this session
    if (titleGenerationRequested.current.has(sessionId)) {
      return;
    }
    
    try {
      // Mark this session as having a title generation request
      titleGenerationRequested.current.add(sessionId);
      
      // We need at least one user message and one AI response
      if (chatMessages.length < 2) {
        return;
      }
      
      // Prepare a modified history where we ask the AI to generate a title
      const historyForTitleGeneration = [
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { 
          role: 'user', 
          content: 'Generate a concise, descriptive title (5-7 words) for this conversation that accurately reflects its content and context. Return ONLY the title text.'
        }
      ];
      
      // Use a special URL parameter to indicate this is a title generation request that shouldn't create a session
      const response = await apiClient.post('/api/chat?title_generation=true', {
        messages: historyForTitleGeneration,
        purpose: 'Generate title',
        // Pass the existing session ID but mark it for backend to know this is just for title generation
        session_id: `${sessionId}__title_gen`
      });
      
      if (response.data && response.data.message) {
        // Process the AI response to extract just the title (remove quotes, etc.)
        let title = response.data.message.trim();
        // Remove quotes if present
        title = title.replace(/^["'](.*)["']$/, '$1');
        // Truncate if too long
        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }
        
        console.log(`Generated title for session ${sessionId}: "${title}"`);
        
        // Update the session with the new title
        await handleRenameSession(sessionId, title);
      }
    } catch (error) {
      console.error('Error generating session title:', error);
      // Don't show an error notification, as this is a background task
    }
  }, [handleRenameSession]);

  // useEffect for initial data fetching
  useEffect(() => {
    if (isLoggedIn) {
        // Only fetch/reset state on initial login/load, not subsequent renders
        if (!initialLoadComplete.current) {
            console.log("User logged in, performing initial data fetch and state reset.");
            fetchCustomModels();
            fetchSessions();
            setActiveSessionId(null); // Start with no active session
            setMessages([]);          // Start with empty messages
            initialLoadComplete.current = true; // Mark initial load as done
        } else {
             console.log("User already logged in, skipping initial fetch/reset in useEffect.");
             // Potentially refresh sessions/models periodically or based on other triggers if needed
             // fetchSessions(); // Example: Maybe refresh sessions here if needed on other dep changes?
        }
    } else {
      // Clear all state on logout and reset the ref
      console.log("User logged out, clearing state.");
      setCustomModels([]);
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      initialLoadComplete.current = false; // Reset for next login
    }
    // Dependencies remain the same, but the logic inside now prevents constant resets
  }, [isLoggedIn, fetchCustomModels, fetchSessions]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSend = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || !isLoggedIn) return;

    currentEventSource?.close(); 
    setCurrentEventSource(null);

    // Use a temporary ID for display purposes only
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const userMessage: Message = {
      id: tempUserMessageId, // This will be replaced with the real ID from the server
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    const streamingAssistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessagePlaceholder: Message = {
      id: streamingAssistantMessageId, // This will be replaced with the real ID from the server
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    const currentMessages = [...messages, userMessage, assistantMessagePlaceholder];
    setMessages(currentMessages); 
    setLoading(false);

    const historyForBackend = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

    const token = getAuthToken();
    if (!token) {
      showSnackbar("Authentication token not found. Please log in.", "error");
      setMessages((prev) => prev.map((msg) => msg.id === streamingAssistantMessageId ? { ...msg, content: "Authentication Error", isStreaming: false, error: "Token not found" } : msg));
      return;
    }

    const queryParams = new URLSearchParams({
        token: token,
        history: JSON.stringify(historyForBackend),
        purpose: purpose,
        ...(selectedModelId && { model_id: selectedModelId }),
        ...(activeSessionId && { session_id: activeSessionId })
    });

    const eventSourceUrl = `${API_BASE_URL}/api/chat_stream?${queryParams.toString()}`;
    const es = new EventSource(eventSourceUrl);
    setCurrentEventSource(es);

    let errorOccurred = false;

    es.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);

        if (parsedData.chunk) {
            // Append chunk to the streaming message
            setMessages((prev) => 
                prev.map((msg) => 
                    msg.id === streamingAssistantMessageId
                    ? { ...msg, content: msg.content + parsedData.chunk } 
                    : msg
                )
            );
        } else if (parsedData.error) {
            // Handle stream error
            console.error("Error from stream:", parsedData.error);
            setMessages((prev) => prev.map((msg) => msg.id === streamingAssistantMessageId ? { ...msg, content: `Error: ${parsedData.error}`, isStreaming: false, error: parsedData.error } : msg));
            errorOccurred = true;
            es.close(); // Close on error
            setCurrentEventSource(null); 
        } else if (parsedData.done) {
            // Stream finished successfully
            const completedSessionId = parsedData.session_id;
            
            // Final update to message state (remove streaming indicator)
             setMessages((prev) => prev.map((msg) => msg.id === streamingAssistantMessageId ? { ...msg, isStreaming: false } : msg));
            
            // Update session state *before* closing EventSource
             if (!errorOccurred && completedSessionId && !activeSessionId) {
                 // New session was created
                  console.log("Stream done. Setting active session ID and adding session to list:", completedSessionId);
                  setActiveSessionId(completedSessionId);
                  const newSessionInfo: SessionInfo = {
                      session_id: completedSessionId,
                      title: userMessage.content.substring(0, 50) + (userMessage.content.length > 50 ? "..." : ""), // Temporary title
                      last_message_timestamp: new Date().toISOString()
                  };
                  setSessions(prev => [newSessionInfo, ...prev]); // Add to top

                  // After creating a new session, fetch the actual messages with server IDs
                  setTimeout(() => {
                    if (completedSessionId) {
                      fetchMessagesForSession(completedSessionId);
                      // Then generate a title based on the conversation
                      generateSessionTitle(completedSessionId, currentMessages);
                    }
                  }, 500);
              } else if (!errorOccurred && activeSessionId) {
                 // Existing session finished, refresh messages to get server IDs and refresh session list
                 console.log("Stream done for existing session. Refreshing session list and messages.");
                 fetchMessagesForSession(activeSessionId);
                 fetchSessions(); 
              }
              
             // Now close EventSource
             es.close(); 
             setCurrentEventSource(null);
        }
      } catch (err) { 
            // Handle JSON parsing error
            console.error("Failed to parse SSE message:", err, "Data:", event.data);
            setMessages((prev) => prev.map((msg) => msg.id === streamingAssistantMessageId ? { ...msg, content: "Error receiving stream data.", isStreaming: false, error: "Stream parsing failed" } : msg));
            errorOccurred = true;
            es.close(); // Close on error
            setCurrentEventSource(null); 
      } 
    };

    es.onerror = (err) => {
        // Handle connection error
        console.error("EventSource failed:", err);
        setMessages((prev) => prev.map((msg) => msg.id === streamingAssistantMessageId ? { ...msg, content: "Connection error with the server.", isStreaming: false, error: "Connection failed" } : msg));
        errorOccurred = true;
        es.close(); // Close on error
        setCurrentEventSource(null);
    };
  }, [messages, purpose, selectedModelId, isLoggedIn, currentEventSource, activeSessionId, fetchSessions, showSnackbar, generateSessionTitle, fetchMessagesForSession]);
  
  const handleRegenerate = useCallback((messageIdToRegenerate: string, isAfterEdit = false) => {
    if (!isLoggedIn || !activeSessionId) {
        showSnackbar("Cannot regenerate without an active chat session.", "warning");
        return;
    }
    
    // Skip regeneration for temporary IDs
    if (messageIdToRegenerate.startsWith('temp-')) {
        showSnackbar('Cannot regenerate messages that have not been saved to the server yet', 'warning');
        return;
    }
    
    const messageIndex = messages.findIndex(msg => msg.id === messageIdToRegenerate);
    if (messageIndex <= 0 || messages[messageIndex].role !== 'assistant' || messages[messageIndex].isStreaming) {
        console.error("Cannot regenerate this message:", messageIdToRegenerate, messages[messageIndex]);
        showSnackbar('Cannot regenerate this message.', 'warning');
        return;
    }

    currentEventSource?.close(); 
    setCurrentEventSource(null);

    // Use edited message content for regeneration
    const historyForBackend = messages.slice(0, messageIndex).map(m => ({ role: m.role, content: m.content }));
    
    if (isAfterEdit) {
      console.log("Regenerating response based on edited message");
    }
    
    // Instead of creating a new message, mark the existing message as streaming
    setMessages(prev => 
      prev.map((msg, idx) => 
        idx === messageIndex 
          ? { ...msg, content: '', isStreaming: true }
          : msg
      )
    );
    
    setLoading(false); 

    const token = getAuthToken();
    if (!token) {
        showSnackbar("Authentication token not found. Please log in.", "error");
        setMessages(prev => 
          prev.map((msg, idx) => 
            idx === messageIndex 
              ? { ...msg, content: "Authentication Error", isStreaming: false, error: "Token not found" }
              : msg
          )
        );
        return;
    }

    const queryParams = new URLSearchParams({
        token: token, 
        history: JSON.stringify(historyForBackend),
        purpose: purpose,
        ...(selectedModelId && { model_id: selectedModelId }),
        session_id: activeSessionId
    });

    const eventSourceUrl = `${API_BASE_URL}/api/chat_stream?${queryParams.toString()}`;
    const es = new EventSource(eventSourceUrl);
    setCurrentEventSource(es);

    let errorOccurred = false;

    es.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.chunk) {
                setMessages(prev => 
                  prev.map((msg, idx) => 
                    idx === messageIndex 
                      ? { ...msg, content: msg.content + parsedData.chunk }
                      : msg
                  )
                );
            } else if (parsedData.error) {
                console.error("Error from regeneration stream:", parsedData.error);
                setMessages(prev => 
                  prev.map((msg, idx) => 
                    idx === messageIndex 
                      ? { ...msg, content: `Error: ${parsedData.error}`, isStreaming: false, error: parsedData.error }
                      : msg
                  )
                );
                es.close(); setCurrentEventSource(null); errorOccurred = true;
            } else if (parsedData.done) {
                // When done, mark the regenerated message with edited_at for visual indicator
                const now = new Date();
                setMessages(prev => 
                  prev.map((msg, idx) => 
                    idx === messageIndex 
                      ? { 
                          ...msg, 
                          isStreaming: false, 
                          edited_at: isAfterEdit ? now : undefined,
                          isRegenerated: isAfterEdit
                        } 
                      : msg
                  )
                );
                es.close(); setCurrentEventSource(null);
                
                // Don't fetch messages after regeneration as it brings back old messages
                if (!errorOccurred && !isAfterEdit) {
                    fetchSessions(); // Just update the sessions list for timestamp
                }
            }
        } catch (err) {
            console.error("Failed to parse SSE message during regeneration:", err, "Data:", event.data);
            setMessages(prev => 
              prev.map((msg, idx) => 
                idx === messageIndex 
                  ? { ...msg, content: "Error receiving stream data.", isStreaming: false, error: "Stream parsing failed" }
                  : msg
              )
            );
            es.close(); setCurrentEventSource(null); errorOccurred = true;
        }
    };

    es.onerror = (err) => {
       console.error("EventSource failed during regeneration:", err);
       setMessages(prev => 
         prev.map((msg, idx) => 
           idx === messageIndex 
             ? { ...msg, content: "Connection error during regeneration.", isStreaming: false, error: "Connection failed" }
             : msg
         )
       );
       es.close(); setCurrentEventSource(null); errorOccurred = true;
    };

  }, [messages, purpose, selectedModelId, isLoggedIn, currentEventSource, activeSessionId, fetchSessions, showSnackbar]);
  
  // Function to copy message content to clipboard
  const handleCopyMessageContent = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => showSnackbar('Message content copied to clipboard', 'success'))
      .catch(() => showSnackbar('Failed to copy content', 'error'));
  }, [showSnackbar]);

  // Function to handle message editing
  const handleEditMessage = useCallback(async (messageId: string, newContent: string, isEnteringEditMode?: boolean) => {
    // Skip editing for temporary IDs
    if (messageId.startsWith('temp-')) {
      showSnackbar('Cannot edit messages that have not been saved to the server yet', 'warning');
      return;
    }

    // If isEnteringEditMode is true, we just want to switch to edit mode without saving
    if (isEnteringEditMode) {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, isEditing: true } : msg
        )
      );
      return;
    }

    // Check if content actually changed (for cancel case we just flip back to non-editing mode)
    const originalMessage = messages.find(msg => msg.id === messageId);
    if (!originalMessage) return;

    // If content didn't change, just exit edit mode
    if (originalMessage.content === newContent) {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, isEditing: false } : msg
        )
      );
      return;
    }

    // Validate content - don't allow completely empty messages
    if (!newContent.trim()) {
      showSnackbar('Message cannot be empty', 'error');
      return;
    }

    // Find the message index and the next assistant message if any
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    let assistantMsgToRegenerate: Message | null = null;
    let assistantMsgIndex = -1;
    
    if (messageIndex >= 0 && messageIndex < messages.length - 1) {
      const nextMsg = messages[messageIndex + 1];
      if (nextMsg.role === 'assistant') {
        assistantMsgToRegenerate = nextMsg;
        assistantMsgIndex = messageIndex + 1;
      }
    }

    // Update optimistically first
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content: newContent, 
              isEditing: false,
              edited_at: new Date() 
            } 
          : msg
      )
    );

    try {
      console.log(`Updating message with ID: ${messageId}`);
      // Make API call to update the message
      const response = await apiClient.patch(`/api/chat_messages/${messageId}`, { content: newContent });
      console.log('Message update response:', response.data);
      showSnackbar('Message updated successfully', 'success');
      
      // If there's an assistant message after this one, regenerate it in place
      if (assistantMsgToRegenerate && assistantMsgIndex >= 0) {
        console.log(`Auto-regenerating AI response at index ${assistantMsgIndex} after user edit`);
        // Mark the AI message as streaming for visual feedback
        setMessages(prevMessages => 
          prevMessages.map((msg, idx) => 
            idx === assistantMsgIndex
              ? { ...msg, content: '', isStreaming: true }
              : msg
          )
        );
        
        // Now regenerate the response with a short delay to show the loading state
        setTimeout(() => {
          handleRegenerate(assistantMsgToRegenerate!.id, true);
        }, 100);
      }
    } catch (error) {
      console.error('Error updating message:', error);
      
      // Extract detailed error message if available
      let errorMessage = 'Failed to update message';
      if (axios.isAxiosError(error) && error.response?.data?.detail) {
        errorMessage = `Failed to update message: ${error.response.data.detail}`;
      }
      
      showSnackbar(errorMessage, 'error');
      
      // Revert to original content on error
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...originalMessage, isEditing: false } : msg
        )
      );
    }
  }, [messages, showSnackbar, handleRegenerate]);

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

  // Find the system prompt for the currently active session
  const activeSessionSystemPrompt = useMemo(() => {
      if (!activeSessionId) return null;
      return sessions.find(s => s.session_id === activeSessionId)?.system_prompt || null;
  }, [activeSessionId, sessions]);

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
    <Box sx={{ display: 'flex', height: '100vh' }}>
       <SessionSidebar 
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          loading={sessionsLoading}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
       />
       
       <Container maxWidth="lg" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 0, flexGrow: 1 }}>
          <AppHeader 
            isLoggedIn={isLoggedIn}
            username={null}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
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
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            activeSessionId={activeSessionId}
            activeSessionSystemPrompt={activeSessionSystemPrompt}
            onUpdateSystemPrompt={handleUpdateSystemPrompt}
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
              isLoading={loading && !currentEventSource}
              messagesEndRef={messagesEndRef}
              onRegenerate={handleRegenerate}
              onCopy={handleCopyMessageContent}
              onEditMessage={handleEditMessage}
            />

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'flex-end', 
              pb: { xs: 1, sm: 2 },
              width: '100%'
            }}>
               <ChatInput onSend={handleSend} loading={!!currentEventSource} /> 
               {currentEventSource && (
                 <Button
                   variant="outlined"
                   color="secondary"
                   size="medium"
                   onClick={() => {
                     currentEventSource.close();
                     setCurrentEventSource(null);
                     setMessages(prev => prev.map(msg => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && msg.id === lastMsg.id && lastMsg.isStreaming) {
                          return { ...msg, isStreaming: false, content: msg.content + ' [Stopped]' };
                        }
                        return msg;
                      }));
                   }}
                   sx={{ 
                     height: { xs: '44px', sm: '50px' },
                     mb: { xs: 2, sm: 3 },
                     mr: { xs: 2, sm: 3, md: 4 },
                     px: 3,
                     borderRadius: '14px',
                     fontWeight: 500
                   }}
                 >
                   Stop
                 </Button>
               )}
            </Box>
          </Paper>
      </Container>
      
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
      
    </Box>
  );
}

export default App; 