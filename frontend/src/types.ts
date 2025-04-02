export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  error?: string;
}

export interface CustomModel {
  id: string;
  name: string;
  description: string;
  model_type: 'gpt' | 'assistant' | 'fine-tuned';
  instructions: string;
  created_at: string;
  updated_at: string;
}

// Add type for Session Info
export interface SessionInfo {
  session_id: string;
  last_message_timestamp?: string; // ISO date string from backend
  title?: string; // Optional: For display, might be added later to backend
} 