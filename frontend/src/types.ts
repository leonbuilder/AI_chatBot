export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  error?: string;
  attachments?: AttachmentInfo[];
  edited_at?: Date;  // Timestamp when message was last edited
  isEditing?: boolean; // Flag to indicate if the message is currently being edited
  isRegenerated?: boolean; // Flag to indicate if this is a regenerated response after an edit
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