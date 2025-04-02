export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  error?: string;
  attachments?: AttachmentInfo[];
}

// Define AttachmentInfo based on backend structure
export interface AttachmentInfo {
    id: string;
    filename: string;
    mimetype: string;
    filesize: number;
    download_url: string;
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
  title?: string; // Optional: For display
  system_prompt?: string | null; // Add system_prompt field (can be null)
} 