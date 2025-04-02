from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Literal, Union, Optional, Dict, Any
from openai import OpenAI  # type: ignore
import httpx # Import httpx
import os
from dotenv import load_dotenv
import logging
import traceback
import json
import sqlite3
from sqlite3 import Connection
from contextlib import contextmanager
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from utils.web_utils import extract_website_content as extract_content, extract_website_with_subpages
import shutil # For file operations
import aiofiles # For async file operations
import asyncio # Import asyncio for sleep

# Import specific OpenAI types for Assistants API
# from openai.types.beta import AssistantToolParam # For tools list type - Removed due to ImportError
# ToolResources types seem hard to import reliably, will use dict + type: ignore

# Constants
CHAT_UPLOAD_DIR = "backend/uploads/chat_files"

# Configure logging
logging.basicConfig(level=logging.DEBUG, # <-- Make sure this is DEBUG
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    handlers=[logging.StreamHandler()]) # Or your file handler
logger = logging.getLogger(__name__)

# Ensure upload directory exists
os.makedirs(CHAT_UPLOAD_DIR, exist_ok=True)

# Load environment variables
load_dotenv()

# Security constants
# Generate a secret key using: openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    logger.warning("SECRET_KEY not found in environment variables. Using a default, insecure key. Please generate and set a proper key.")
    SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7" # Default for dev, MUST be replaced
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

app = FastAPI()

# Configure CORS with dynamic origins from env
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not found in environment variables")

# Initialize OpenAI client with the latest method
# Explicitly create an httpx client that ignores environment variables (like proxies)
http_client = httpx.Client(trust_env=False)
client = OpenAI(api_key=api_key, http_client=http_client) # type: ignore
logger.info("OpenAI client initialized successfully")

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./custom_models.db")

# Initialize SQLite database
def init_db():
    db_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create custom_models table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS custom_models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        model_type TEXT NOT NULL,
        assistant_id TEXT,
        vector_store_id TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    ''')
    
    # Create files table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS model_files (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (model_id) REFERENCES custom_models (id)
    )
    ''')
    
    # Create users table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')
    
    # Create chat_sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,          -- Session ID (matches session_id in chat_messages)
        user_id TEXT NOT NULL,        -- User who owns the session
        title TEXT,                   -- Custom title set by user
        created_at TEXT NOT NULL,     -- Timestamp when session was implicitly created (first message)
        last_updated_at TEXT NOT NULL, -- Timestamp of last activity (e.g., new message, rename)
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    # Add index for faster lookup
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_last_updated ON chat_sessions (user_id, last_updated_at)")
    
    # Create chat_messages table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL, -- To group messages within a single chat session
        user_id TEXT NOT NULL,    -- The user who sent/received the message
        role TEXT NOT NULL,       -- 'user' or 'assistant'
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model_used TEXT,          -- Optional: Which model generated the response?
        is_deleted BOOLEAN DEFAULT FALSE, -- Flag for soft deletion
        edited_at TEXT,           -- Timestamp of last edit, NULL if not edited
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    # Create chat_attachments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_attachments (
        id TEXT PRIMARY KEY,         -- Unique ID for the attachment
        message_id TEXT NOT NULL,    -- Link to the chat message
        user_id TEXT NOT NULL,       -- User who uploaded
        filename TEXT NOT NULL,      -- Original filename
        filepath TEXT NOT NULL,      -- Path on server where file is stored
        filesize INTEGER NOT NULL,   -- File size in bytes
        mimetype TEXT NOT NULL,      -- File MIME type (e.g., image/jpeg)
        uploaded_at TEXT NOT NULL,   -- Upload timestamp
        FOREIGN KEY (message_id) REFERENCES chat_messages (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

# Initialize database at startup
init_db()

@contextmanager
def get_db():
    db_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# --- Pydantic Models ---

# User Authentication Models
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True # Updated from orm_mode for Pydantic v2

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Union[str, None] = None

# File Upload / Attachment Models
class FileUploadResponse(BaseModel):
    temp_file_id: str # The unique ID (UUID without ext) assigned to the uploaded file
    original_filename: str
    mimetype: str
    filesize: int
    
class MessageAttachmentData(BaseModel):
    temp_file_id: str
    original_filename: str
    mimetype: str
    filesize: int

# Model for displaying attachment info in chat history
class AttachmentInfo(BaseModel):
    id: str
    filename: str
    mimetype: str
    filesize: int
    download_url: str # URL client can use to download

# Chat Models
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    purpose: str
    model_id: Optional[str] = None
    session_id: Optional[str] = None # Optional session ID from client
    attachments: Optional[List[MessageAttachmentData]] = None # Attachments for the user message

class ChatResponse(BaseModel):
    message: str
    role: Literal["assistant"]
    session_id: str

# Chat History & Sessions Models
class ChatSessionInfo(BaseModel):
    session_id: str
    last_message_timestamp: Optional[datetime] = None
    title: Optional[str] = None # Add title field

class ChatMessageHistory(ChatMessage):
    id: str
    timestamp: datetime
    model_used: Optional[str] = None
    edited_at: Optional[datetime] = None
    is_deleted: bool = False
    attachments: List[AttachmentInfo] = [] # Add list for attachments

class ChatMessageUpdate(BaseModel):
    content: str # Only content can be updated

# Custom AI Model Models
class CustomModelBase(BaseModel):
    name: str
    description: str
    model_type: Literal["gpt", "assistant", "fine-tuned"]
    instructions: str
    
class CustomModelCreate(CustomModelBase):
    website_url: Optional[str] = None
    website_content: Optional[str] = None
    enable_code_interpreter: bool = False
    
class CustomModelResponse(CustomModelBase):
    id: str
    created_at: str
    updated_at: str

# --- Utility Functions for Authentication ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None):
    if not SECRET_KEY:
        # This should ideally not happen due to the startup check, but belt and braces
        logger.error("Attempted to create token without SECRET_KEY") 
        raise ValueError("SECRET_KEY not configured for token generation")
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default expiration if none provided
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES) 
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    logger.debug(f"get_current_user called. Attempting to validate token received: {token[:10] if token else '[No Token Provided]'}...") # Log token presence/start
    
    if not SECRET_KEY:
        logger.error("SECRET_KEY is not configured for token validation.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server configuration error") 

    try:
        # Add logging here:
        logger.debug(f"Attempting to decode token: {token[:10]}...") # Log first few chars
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        logger.debug(f"Token decoded successfully. Username (sub): {username}") # Log payload sub
        if username is None:
            logger.warning("Token payload missing 'sub' (username).")
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError as e:
        # Add specific JWTError logging:
        logger.warning(f"JWTError decoding token: {type(e).__name__} - {e}") 
        raise credentials_exception
    except Exception as e: # Catch other potential errors
        logger.error(f"Unexpected error during token decode: {type(e).__name__} - {e}")
        raise credentials_exception
    
    user = get_user(username=username) 
    if user is None:
        logger.warning(f"User '{username}' not found for token.")
        raise credentials_exception
    logger.debug(f"User '{username}' found and authenticated successfully.") # Log success
    return user

def get_user(username: str) -> Optional[UserInDB]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user_row = cursor.fetchone()
        if user_row:
            return UserInDB(**user_row)
    return None

# --- Utility Functions (Adapted for WS Auth) ---

async def get_user_from_token(token: str) -> Optional[UserInDB]:
    """Validates token and retrieves user, adapted for WebSocket context."""
    if not token:
        return None
    try:
        if not SECRET_KEY:
             logger.error("SECRET_KEY is not configured for token validation.")
             return None # Cannot validate without key
             
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            logger.warning("WS Auth: Token payload missing 'sub' (username).")
            return None
        
        user = get_user(username=username)
        if user is None:
            logger.warning(f"WS Auth: User '{username}' not found for token.")
            return None
        return user
    except JWTError as e:
        logger.warning(f"WS Auth: JWTError decoding token: {e}")
        return None
    except Exception as e:
        logger.error(f"WS Auth: Unexpected error validating token: {e}")
        return None

# --- Helper Functions (General) ---

def convert_to_openai_message(message: ChatMessage) -> dict:
    try:
        return {
            "role": message.role,
            "content": message.content
        }
    except Exception as e:
        logger.error(f"Error converting message: {str(e)}")
        raise

def safely_extract_assistant_text(content_array) -> str:
    """Safely extract text from assistant message content, handling potential type errors"""
    try:
        if not content_array:
            return "No content received from assistant"
        
        content_item = content_array[0]
        # Check if it's a text content type
        if hasattr(content_item, "text") and hasattr(content_item.text, "value"):
            return content_item.text.value
        # Fall back if it's a dictionary-like object with a text field
        elif isinstance(content_item, dict) and "text" in content_item:
            text_obj = content_item["text"]
            if isinstance(text_obj, dict) and "value" in text_obj:
                return text_obj["value"]
            return str(text_obj)
        # Handle other content types as needed
        else:
            return f"Content received (type: {type(content_item).__name__}) but couldn't extract text"
    except Exception as e:
        logger.error(f"Error extracting text from assistant content: {str(e)}")
        return "Error extracting response content"

# --- Helper Function to Save Messages (Restored Here) ---
def save_chat_message(
    user_id: str, 
    session_id: str, 
    role: str, 
    content: str, 
    attachments: Optional[List[MessageAttachmentData]] = None,
    model_used: Optional[str] = None
) -> Optional[str]: # Return message_id or None
    """Saves a chat message and links any provided attachments."""
    message_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = None # Define conn outside try block
    try:
        with get_db() as conn: # conn is now managed by context manager
            cursor = conn.cursor()
            
            # --- Upsert Session Info --- 
            cursor.execute("""
                INSERT INTO chat_sessions (id, user_id, created_at, last_updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    last_updated_at = excluded.last_updated_at;
            """, (session_id, user_id, now_iso, now_iso))
            logger.debug(f"Upserted session {session_id} with last_updated_at {now_iso}")
            # --- End Upsert Session Info --- 

            # Insert the main message
            cursor.execute(
                "INSERT INTO chat_messages (id, session_id, user_id, role, content, timestamp, model_used) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (message_id, session_id, user_id, role, content, now_iso, model_used)
            )
            
            # Link attachments if provided (only for user messages typically)
            if attachments and role == 'user':
                 for att_data in attachments:
                    found_path = None
                    try:
                        for filename in os.listdir(CHAT_UPLOAD_DIR):
                            if filename.startswith(att_data.temp_file_id):
                                found_path = os.path.join(CHAT_UPLOAD_DIR, filename)
                                break
                    except Exception as e:
                        logger.error(f"Error listing upload directory {CHAT_UPLOAD_DIR}: {e}", exc_info=True)
                        continue # Skip this attachment

                    if found_path and os.path.exists(found_path):
                        attachment_id = str(uuid.uuid4())
                        cursor.execute(
                            """INSERT INTO chat_attachments 
                               (id, message_id, user_id, filename, filepath, filesize, mimetype, uploaded_at) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (attachment_id, message_id, user_id, att_data.original_filename, found_path, att_data.filesize, att_data.mimetype, now_iso)
                        )
                        logger.info(f"Linked attachment {att_data.original_filename} to message {message_id}")
                    else:
                        logger.error(f"Could not find file for temp_id {att_data.temp_file_id} for message {message_id}.")
            
            conn.commit()
            logger.info(f"Saved message {message_id} for user {user_id} in session {session_id}")
            return message_id
            
    except Exception as e:
        if conn:
            try: conn.rollback()
            except Exception as rb_err: logger.error(f"Rollback failed: {rb_err}")
        logger.error(f"Failed to save chat message: {e}", exc_info=True)
        return None

@app.get("/")
async def root():
    return JSONResponse({
        "status": "ok",
        "message": "AI Chat API is running",
        "endpoints": {
            "chat": "/api/chat",
            "custom_models": "/api/custom_models",
            "health": "/api/health",
            "register": "/api/users/register",
            "token": "/api/token",
            "current_user": "/api/users/me"
        }
    })

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    logger.info(f"Received chat request for session: {request.session_id} from user: {current_user.username}")
    
    session_id = request.session_id or str(uuid.uuid4())
    logger.debug(f"Using session_id: {session_id}")

    # Validate and get user message content
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")
    user_message = request.messages[-1]
    if user_message.role != 'user':
        raise HTTPException(status_code=400, detail="Last message must be from user.")
    user_content = user_message.content

    # Save user message
    try:
        user_message_id = save_chat_message(
            user_id=current_user.id,
            session_id=session_id,
            role="user",
            content=user_content, # Use validated content
            attachments=request.attachments
        )
        if not user_message_id:
            raise HTTPException(status_code=500, detail="Failed to save user message")
    except Exception as e:
         logger.exception("Error saving user message:")
         raise HTTPException(status_code=500, detail=f"Internal server error saving message: {e}")

    response_content_str = "Error: Could not generate response." # Initialize as string
    model_used = "error"
    
    try:
        if request.model_id:
            logger.info(f"Routing chat to custom model: {request.model_id}")
            # chat_with_custom_model saves internally and returns a dict {"message": ..., "role": ...}
            custom_model_response = await chat_with_custom_model(request, current_user, session_id)
            # Extract the actual message content string, ensuring it's a string
            response_content_str = str(custom_model_response.get("message", "Error: No message content from custom model."))
            model_used = custom_model_response.get("model_used", f"custom:{request.model_id}")

        else:
            logger.info("Routing chat to default OpenAI model")
            openai_messages = [convert_to_openai_message(m) for m in request.messages]
            model_name = "gpt-4o-mini"
            logger.info(f"Using model: {model_name}")
            
            completion = client.chat.completions.create(
                model=model_name,
                messages=openai_messages,
            )
            gpt_response = completion.choices[0].message.content
            # Ensure gpt_response is treated as a string
            response_content_str = gpt_response if isinstance(gpt_response, str) else str(gpt_response or "") 
            model_used = model_name
            logger.debug(f"OpenAI Response: {response_content_str[:100]}...")

        # Ensure response_content is a non-empty string before returning
        if not response_content_str:
            response_content_str = "Sorry, I couldn't generate a response."
        elif not isinstance(response_content_str, str):
             # This check might be redundant now but safe to keep
             logger.warning(f"Assistant response was not a string (type: {type(response_content_str)}), converting.")
             response_content_str = str(response_content_str)
            
        # Assistant message is saved within chat_with_custom_model or needs saving here for default
        if not request.model_id:
             assistant_message_id = save_chat_message(
                 user_id=current_user.id,
                 session_id=session_id,
                 role="assistant",
                 content=response_content_str, 
                 model_used=model_used
             )
             if not assistant_message_id:
                 logger.error(f"Failed to save assistant message for default model {model_name}")

        return ChatResponse(message=response_content_str, role="assistant", session_id=session_id)

    except Exception as e:
        logger.exception("Error during chat processing:")
        error_content = f"An error occurred: {e}"
        # Save error message IF it wasn't already saved by chat_with_custom_model
        save_chat_message(
            user_id=current_user.id,
            session_id=session_id,
            role="assistant",
            content=error_content,
            model_used="error"
        )
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

async def chat_with_custom_model(request: ChatRequest, current_user: User, session_id: str) -> Dict[str, str]:
    """Use a custom model for chat completion, saves messages, returns dict {message, role, model_used}."""
    try:
        # Fetch model_data etc.
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (request.model_id,))
            model_data = cursor.fetchone()
            if not model_data:
                raise HTTPException(status_code=404, detail=f"Custom model with id {request.model_id} not found")
            config = json.loads(model_data["config"])
            model_type = model_data["model_type"]
            cursor.execute("SELECT * FROM model_files WHERE model_id = ?", (request.model_id,))
            file_data = cursor.fetchall()
            file_ids = [file["file_id"] for file in file_data] if file_data else []

        assistant_content = "Error: Could not generate response."
        role = "assistant" 
        model_used = f"custom:{model_type}:{request.model_id}"

        # Assistant logic
        if model_type == "assistant":
            assistant_id = model_data["assistant_id"]
            if not assistant_id:
                 raise HTTPException(status_code=500, detail="Model is assistant type but has no assistant ID.")
            thread = client.beta.threads.create()
            for msg in request.messages:
                if msg.role == "user":
                    # TODO: Handle attachments for assistants
                    client.beta.threads.messages.create(thread_id=thread.id, role="user", content=msg.content)
            run = client.beta.threads.runs.create(thread_id=thread.id, assistant_id=assistant_id)
            while run.status in ["queued", "in_progress"]:
                await asyncio.sleep(0.5)
                run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
            if run.status != "completed":
                logger.error(f"Assistant run failed. Status: {run.status}. Last error: {run.last_error}")
                # Save error message before raising
                save_chat_message(
                    user_id=current_user.id, session_id=session_id, role="assistant",
                    content=f"Assistant run failed. Status: {run.status}", model_used=f"{model_used}-error"
                )
                raise HTTPException(status_code=500, detail=f"Assistant run failed. Status: {run.status}")
            messages_response = client.beta.threads.messages.list(thread_id=thread.id)
            assistant_content = "No response generated by assistant."
            for msg in reversed(messages_response.data):
                if msg.role == "assistant":
                    assistant_content = safely_extract_assistant_text(msg.content)
                    break
        
        # GPT logic
        else:
             system_message = {"role": "system", "content": config.get("instructions", f"You are a helpful AI assistant specialized in {request.purpose}.")}
             if config.get("website_content"):
                system_message["content"] += f"\n\nReference website content: {config.get('website_content')}"
             openai_messages = [system_message] + [convert_to_openai_message(msg) for msg in request.messages]
             model_name = config.get("model", "gpt-4o-mini")
             model_used = f"custom:gpt:{model_name}"
             response = client.chat.completions.create(
                 model=model_name,
                 messages=openai_messages,
                 temperature=config.get("temperature", 0.7),
                 max_tokens=config.get("max_tokens", 500),
                 response_format={"type": "text"}
             )
             if not response.choices:
                 # Save error before raising
                 save_chat_message(
                     user_id=current_user.id, session_id=session_id, role="assistant",
                     content="Error: No response choices received from OpenAI for custom GPT model.", model_used=f"{model_used}-error"
                 )
                 raise ValueError("No response choices received from OpenAI")
             assistant_content = response.choices[0].message.content or ""

        # Ensure assistant_content is a string
        assistant_content_str = assistant_content if isinstance(assistant_content, str) else str(assistant_content or "")
        if not assistant_content_str:
             assistant_content_str = "Sorry, I couldn't generate a response." # Provide default if empty

        # Save successful assistant response
        save_chat_message(
            user_id=current_user.id,
            session_id=session_id,
            role=role,
            content=assistant_content_str,
            model_used=model_used
        )

        return {
            "message": assistant_content_str,
            "role": role,
            "model_used": model_used 
        }

    except Exception as e:
        logger.error(f"Error in custom model chat: {str(e)}", exc_info=True)
        # Save error message before re-raising (will be caught by main endpoint)
        save_chat_message(
            user_id=current_user.id, session_id=session_id, role="assistant",
            content=f"An error occurred processing the custom model request: {e}", model_used=f"custom:{request.model_id}-error"
        )
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom_models", response_model=CustomModelResponse)
async def create_custom_model(model: CustomModelCreate, current_user: User = Depends(get_current_user)):
    """Create a new custom GPT model"""
    try:
        model_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # Create config JSON
        config = {
            "instructions": model.instructions,
            "temperature": 0.7, # Default, maybe allow customization later
            "max_tokens": 500,  # Default, maybe allow customization later
            "model": "gpt-4o-mini", # Default for non-assistant types
            "enable_code_interpreter": model.enable_code_interpreter # Store flag
        }
        
        # Add website info if provided
        if model.website_url:
            config["website_url"] = model.website_url
        if model.website_content:
            config["website_content"] = model.website_content
        
        assistant_id = None
        vector_store_id = None
        openai_assistant_model = os.getenv("OPENAI_ASSISTANT_MODEL", "gpt-4o") # Get model name once
        
        # If model type is "assistant", create an OpenAI Assistant
        if model.model_type == "assistant":
            # Create a vector store for the assistant (always needed for file_search)
            vector_store = client.beta.vector_stores.create(name=f"{model.name} Vector Store")
            vector_store_id = vector_store.id
            logger.info(f"Created vector store {vector_store_id} for assistant {model.name}")
            
            # Define tools based on flags
            # Explicitly type the list elements as AssistantToolParam although they are dicts - Removed type hint
            tools: List[Dict[str, str]] = [{"type": "file_search"}] 
            if model.enable_code_interpreter:
                tools.append({"type": "code_interpreter"})
                logger.info(f"Enabling Code Interpreter for assistant {model.name}")
            
            # Define tool resources, explicitly typing the structure
            # tool_resources = ToolResources(
            #     file_search=ToolResourcesFileSearch(vector_store_ids=[vector_store_id])
            # )
            # Using dict structure which matches API spec, ignoring type checker error
            tool_resources_dict = {"file_search": {"vector_store_ids": [vector_store_id]}} 

            # Create the assistant
            assistant = client.beta.assistants.create(
                name=model.name,
                description=model.description,
                instructions=model.instructions,
                model=openai_assistant_model, # Use a capable model for assistants
                tools=tools, # Pass the typed list
                tool_resources=tool_resources_dict # type: ignore
            )
            assistant_id = assistant.id
            config["openai_model"] = openai_assistant_model # Store actual model used in config
            logger.info(f"Created assistant {assistant_id} with tools: {[t.get('type') for t in tools]}") # Log tool types
        
        # Save model to database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO custom_models (id, name, description, model_type, assistant_id, vector_store_id, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (model_id, model.name, model.description, model.model_type, assistant_id, vector_store_id, json.dumps(config), now, now)
            )
            conn.commit()
        
        # Return the base model info, not internal IDs like assistant_id
        # Also include the code interpreter setting in the response
        response_data = CustomModelResponse(
             id=model_id,
             name=model.name,
             description=model.description,
             model_type=model.model_type,
             instructions=model.instructions,
             created_at=now,
             updated_at=now,
             # Add enable_code_interpreter here if it's part of CustomModelResponse
             # If not, consider adding it or returning a different model
         )
        # Manually add the flag if not part of the model - maybe better to add it to the model?
        response_dict = response_data.model_dump()
        response_dict["enable_code_interpreter"] = model.enable_code_interpreter
        # Return dict for now until response model is updated
        return response_dict 

    except Exception as e:
        logger.error(f"Error creating custom model: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/custom_models", response_model=List[CustomModelResponse])
async def list_custom_models():
    """List all custom models"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models")
            models = cursor.fetchall()
            
        return [
            {
                "id": model["id"],
                "name": model["name"],
                "description": model["description"],
                "model_type": model["model_type"],
                "instructions": json.loads(model["config"]).get("instructions", ""),
                "created_at": model["created_at"],
                "updated_at": model["updated_at"]
            }
            for model in models
        ]
        
    except Exception as e:
        logger.error(f"Error listing custom models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/custom_models/{model_id}", response_model=CustomModelResponse)
async def get_custom_model(model_id: str):
    """Get a specific custom model"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (model_id,))
            model = cursor.fetchone()
            
            if not model:
                raise HTTPException(status_code=404, detail=f"Custom model with id {model_id} not found")
            
            config = json.loads(model["config"])
            
            return {
                "id": model["id"],
                "name": model["name"],
                "description": model["description"],
                "model_type": model["model_type"],
                "instructions": config.get("instructions", ""),
                "created_at": model["created_at"],
                "updated_at": model["updated_at"]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving custom model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom_models/{model_id}/files")
async def add_file_to_model(
    model_id: str,
    file: UploadFile = File(...),
):
    """Add a file to a custom model for retrieval"""
    try:
        # Check if model exists
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (model_id,))
            model = cursor.fetchone()
            
            if not model:
                raise HTTPException(status_code=404, detail=f"Custom model with id {model_id} not found")
            
            assistant_id = model["assistant_id"]
            vector_store_id = model["vector_store_id"]
            
            if model["model_type"] != "assistant":
                raise HTTPException(status_code=400, detail="Files can only be added to assistant-type models")
            
            if not assistant_id or not vector_store_id:
                raise HTTPException(status_code=400, detail="Assistant ID or Vector Store ID not found for this model")
        
        # Upload file to OpenAI
        file_content = await file.read()
        file_object = (file.filename, file_content)

        # Use File Batches API for uploading and polling status
        file_batch = client.beta.vector_stores.file_batches.upload_and_poll(
            vector_store_id=vector_store_id, files=[file_object]
        )

        # Check batch status (optional, but good practice)
        if file_batch.status != 'completed':
            logger.warning(f"File batch processing for vector store {vector_store_id} did not complete successfully. Status: {file_batch.status}")

        # Retrieve the OpenAI file ID from the batch if needed for the database record
        openai_file_id = None
        if file_batch.file_counts.completed == 1:
            logger.info(f"File {file.filename} successfully added to vector store {vector_store_id}")
        else:
            logger.error(f"Failed to add file {file.filename} to vector store {vector_store_id}. Batch status: {file_batch.status}")
            raise HTTPException(status_code=500, detail=f"Failed to process file {file.filename} for assistant.")

        # Save file info to database (using a placeholder or fetched ID for openai_file_id)
        db_file_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO model_files (id, model_id, file_id, filename, created_at) VALUES (?, ?, ?, ?, ?)",
                (db_file_id, model_id, f"batch_{file_batch.id}", file.filename, now)
            )
            conn.commit()
        
        return {"message": f"File {file.filename} added to model successfully"}
        
    except Exception as e:
        logger.error(f"Error adding file to model: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/custom_models/{model_id}")
async def delete_custom_model(model_id: str):
    """Delete a custom model"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if model exists
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (model_id,))
            model = cursor.fetchone()
            
            if not model:
                raise HTTPException(status_code=404, detail=f"Custom model with id {model_id} not found")
            
            assistant_id = model["assistant_id"]
            vector_store_id = model["vector_store_id"]

            # If it's an assistant model, delete the assistant and vector store from OpenAI
            if model["model_type"] == "assistant":
                if assistant_id:
                    try:
                        client.beta.assistants.delete(assistant_id=assistant_id)
                        logger.info(f"Deleted Assistant {assistant_id} from OpenAI.")
                    except Exception as e:
                        # Log error but continue cleanup
                        logger.error(f"Error deleting assistant {assistant_id} from OpenAI: {str(e)}")
                if vector_store_id:
                    try:
                        client.beta.vector_stores.delete(vector_store_id=vector_store_id)
                        logger.info(f"Deleted Vector Store {vector_store_id} from OpenAI.")
                    except Exception as e:
                        # Log error but continue cleanup
                        logger.error(f"Error deleting vector store {vector_store_id} from OpenAI: {str(e)}")

            # Delete any associated files from OpenAI (This might be redundant if vector store is deleted, but kept for safety)
            # Note: The file IDs stored in model_files might be batch IDs now, not individual file IDs.
            # Deleting individual files associated with the vector store might be complex/unnecessary if the store is deleted.
            # Consider removing this loop if vector store deletion handles contained files.
            cursor.execute("SELECT * FROM model_files WHERE model_id = ?", (model_id,))
            files = cursor.fetchall()
            
            for file in files:
                try:
                    client.files.delete(file_id=file["file_id"])
                except Exception as e:
                    logger.error(f"Error deleting file from OpenAI: {str(e)}")
            
            # Delete from database
            cursor.execute("DELETE FROM model_files WHERE model_id = ?", (model_id,))
            cursor.execute("DELETE FROM custom_models WHERE id = ?", (model_id,))
            conn.commit()
        
        return {"message": f"Custom model with id {model_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting custom model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom_models/{model_id}/extract_website_content")
async def extract_website_content(model_id: str, data: Dict[str, str]):
    """Extract content from a website URL and add it to the model's context"""
    try:
        if "url" not in data:
            raise HTTPException(status_code=400, detail="URL is required")
        
        url = data["url"]
        include_subpages = data.get("include_subpages", "false").lower() == "true"
        
        # Extract content from the website
        if include_subpages:
            result = extract_website_with_subpages(url, max_pages=3)
        else:
            result = extract_content(url)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=f"Failed to extract content from {url}: {result['content']}")
        
        website_content = f"Title: {result['title']}\n\n"
        if result["description"]:
            website_content += f"Description: {result['description']}\n\n"
        website_content += result["content"]
        
        # Update model config with website content
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if model exists
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (model_id,))
            model = cursor.fetchone()
            
            if not model:
                raise HTTPException(status_code=404, detail=f"Custom model with id {model_id} not found")
            
            # Update config
            config = json.loads(model["config"])
            config["website_url"] = url
            config["website_content"] = website_content
            
            now = datetime.utcnow().isoformat()
            
            cursor.execute(
                "UPDATE custom_models SET config = ?, updated_at = ? WHERE id = ?",
                (json.dumps(config), now, model_id)
            )
            conn.commit()
        
        content_preview = website_content[:200] + "..." if len(website_content) > 200 else website_content
        
        return {
            "message": "Website content extracted and added to model successfully",
            "content_preview": content_preview,
            "pages_extracted": result.get("pages_extracted", 1) if include_subpages else 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting website content: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Authentication Endpoints
@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(username=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/users/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = get_user(username=user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
        
    hashed_password = get_password_hash(user_data.password)
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (id, username, hashed_password, created_at) VALUES (?, ?, ?, ?)",
                (user_id, user_data.username, hashed_password, now.isoformat())
            )
            conn.commit()
        except sqlite3.IntegrityError: # Catch potential race condition for UNIQUE username
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="Username already registered (conflict)"
            )
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error during user registration: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not register user")
            
    return User(id=user_id, username=user_data.username, created_at=now)

@app.get("/api/users/me", response_model=User)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    # We return User, not UserInDB, to avoid exposing the hashed password
    return User.model_validate(current_user) # Use model_validate for Pydantic v2

# Chat Session Endpoints
class SessionListResponse(BaseModel):
    sessions: List[ChatSessionInfo]

@app.get("/api/chat_sessions", response_model=SessionListResponse)
async def list_chat_sessions(current_user: User = Depends(get_current_user)):
    """List all chat sessions for the current user, ordered by last activity."""
    sessions = []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Query chat_sessions table joined with first user message for title
            cursor.execute("""
                SELECT 
                    cs.id as session_id, 
                    cs.title as custom_title, 
                    cs.last_updated_at as last_message_timestamp,
                    (SELECT content 
                     FROM chat_messages 
                     WHERE session_id = cs.id AND role = 'user' AND is_deleted = FALSE
                     ORDER BY timestamp ASC 
                     LIMIT 1) as first_user_message
                FROM chat_sessions cs
                WHERE cs.user_id = ? 
                -- Add condition here to exclude sessions with only deleted messages?
                -- For now, list all sessions associated with the user.
                ORDER BY cs.last_updated_at DESC
            """, (current_user.id,))
            session_rows = cursor.fetchall()

            for row in session_rows:
                 # Use custom title if set, otherwise generate from first message
                 title = row["custom_title"]
                 if not title:
                     first_message = row["first_user_message"]
                     if first_message and len(first_message) > 50:
                         title = first_message[:47] + "..."
                     elif first_message:
                         title = first_message
                     else:
                         title = f"Chat Session ({row['session_id'][:6]}...)" # Fallback
                      
                 sessions.append(ChatSessionInfo(
                    session_id=row["session_id"],
                    # Ensure timestamp is parsed correctly if needed, else use string from db
                    last_message_timestamp=datetime.fromisoformat(row["last_message_timestamp"]),
                    title=title
                 ))
        logger.info(f"Retrieved {len(sessions)} sessions for user {current_user.username}")
        return SessionListResponse(sessions=sessions)
    except Exception as e:
        logger.error(f"Error listing chat sessions for user {current_user.username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve chat sessions")

class MessageListResponse(BaseModel):
    messages: List[ChatMessageHistory]

@app.get("/api/chat_sessions/{session_id}/messages", response_model=MessageListResponse)
async def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all non-deleted messages for a specific session belonging to the current user."""
    messages = []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Verify the session exists and belongs to the user (optional but good practice)
            cursor.execute("SELECT 1 FROM chat_messages WHERE session_id = ? AND user_id = ? LIMIT 1", (session_id, current_user.id))
            if not cursor.fetchone():
                 logger.warning(f"User {current_user.username} requested messages for session {session_id} they don't own or doesn't exist.")
                 # Return empty list instead of 404/403, as session might be implicitly created
                 return MessageListResponse(messages=[]) 
                 # raise HTTPException(status_code=404, detail="Session not found or access denied")

            # Fetch messages for the session
            cursor.execute("""
                SELECT id, role, content, timestamp, model_used, edited_at, is_deleted
                FROM chat_messages
                WHERE session_id = ? AND user_id = ? AND is_deleted = FALSE
                ORDER BY timestamp ASC
            """, (session_id, current_user.id))
            message_rows = cursor.fetchall()

            # Fetch attachments for all messages in this session efficiently
            message_ids = [row["id"] for row in message_rows]
            attachments_map: Dict[str, List[AttachmentInfo]] = {msg_id: [] for msg_id in message_ids}
            if message_ids:
                 placeholders = ',' .join('?' * len(message_ids))
                 cursor.execute(f"""
                     SELECT id, message_id, filename, filesize, mimetype 
                     FROM chat_attachments 
                     WHERE message_id IN ({placeholders})
                 """, message_ids)
                 attachment_rows = cursor.fetchall()
                 for att_row in attachment_rows:
                     msg_id = att_row["message_id"]
                     if msg_id in attachments_map:
                          attachments_map[msg_id].append(AttachmentInfo(
                              id=att_row["id"],
                              filename=att_row["filename"],
                              mimetype=att_row["mimetype"],
                              filesize=att_row["filesize"],
                              # Construct download URL (relative path)
                              download_url=f"/api/chat/attachments/{att_row['id']}" 
                          ))

            for row in message_rows:
                timestamp = datetime.fromisoformat(row["timestamp"])
                edited_at = datetime.fromisoformat(row["edited_at"]) if row["edited_at"] else None
                message_id = row["id"]

                messages.append(ChatMessageHistory(
                    id=message_id,
                    role=row["role"],
                    content=row["content"],
                    timestamp=timestamp,
                    model_used=row["model_used"],
                    edited_at=edited_at,
                    is_deleted=row["is_deleted"],
                    attachments=attachments_map.get(message_id, []) # Get attachments for this message
                ))
        logger.info(f"Retrieved {len(messages)} messages for session {session_id} for user {current_user.username}")
        return MessageListResponse(messages=messages)
    except Exception as e:
        logger.error(f"Error retrieving messages for session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not retrieve chat messages")

@app.delete("/api/chat_sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a chat session by marking all its messages as deleted."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # First, check if the session exists and belongs to the user to prevent unauthorized deletes
            cursor.execute("SELECT 1 FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, current_user.id))
            if not cursor.fetchone():
                # Session doesn't exist or doesn't belong to user
                # Return 204 anyway to make it idempotent, or 404/403 if preferred
                logger.warning(f"Attempt to delete non-existent or unauthorized session {session_id} by user {current_user.username}")
                return # Return No Content
            
            # Mark associated messages as deleted
            cursor.execute(
                "UPDATE chat_messages SET is_deleted = TRUE WHERE session_id = ? AND user_id = ?",
                (session_id, current_user.id)
            )
            deleted_count = cursor.rowcount
            
            # Optionally: Delete the session metadata itself from chat_sessions, or keep it
            # For now, let's delete it to remove it from the list
            cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, current_user.id))
            session_deleted = cursor.rowcount > 0

            conn.commit()
            logger.info(f"User {current_user.username} deleted session {session_id}. Marked {deleted_count} messages as deleted. Session metadata deleted: {session_deleted}")
            return # FastAPI handles 204 No Content response
            
    except Exception as e:
        if conn: conn.rollback() # Ensure rollback
        logger.error(f"Error deleting session {session_id} for user {current_user.username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not delete chat session")

class SessionUpdateRequest(BaseModel):
    title: str # Allow updating the title

@app.patch("/api/chat_sessions/{session_id}", response_model=ChatSessionInfo)
async def update_chat_session(
    session_id: str,
    update_data: SessionUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update a chat session (e.g., rename by setting title)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    new_title = update_data.title.strip() # Trim whitespace
    if not new_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
        
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Update the title and last_updated_at for the session belonging to the user
            cursor.execute("""
                UPDATE chat_sessions 
                SET title = ?, last_updated_at = ? 
                WHERE id = ? AND user_id = ?
            """, (new_title, now_iso, session_id, current_user.id))
            
            if cursor.rowcount == 0:
                # Session not found or doesn't belong to the user
                raise HTTPException(status_code=404, detail="Session not found or access denied")
            
            conn.commit()
            
            # Fetch the updated session info to return
            cursor.execute("""
                 SELECT cs.id as session_id, cs.title as custom_title, cs.last_updated_at as last_message_timestamp,
                        (SELECT content FROM chat_messages WHERE session_id = cs.id AND role = 'user' AND is_deleted = FALSE ORDER BY timestamp ASC LIMIT 1) as first_user_message
                 FROM chat_sessions cs 
                 WHERE cs.id = ?
            """, (session_id,))
            updated_row = cursor.fetchone()
            
            if not updated_row:
                # Should not happen if update succeeded
                raise HTTPException(status_code=500, detail="Failed to retrieve updated session info")
                
            # Construct response object (similar logic to list endpoint)
            title = updated_row["custom_title"] # Should be the new title now
            if not title:
                 first_message = updated_row["first_user_message"]
                 if first_message and len(first_message) > 50: title = first_message[:47] + "..."
                 elif first_message: title = first_message
                 else: title = f"Chat Session ({updated_row['session_id'][:6]}...)"
                 
            logger.info(f"User {current_user.username} updated title for session {session_id} to '{new_title}'")
            return ChatSessionInfo(
                session_id=updated_row["session_id"],
                last_message_timestamp=datetime.fromisoformat(updated_row["last_message_timestamp"]),
                title=title
            )
            
    except HTTPException: # Re-raise HTTP exceptions
         raise
    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"Error updating session {session_id} for user {current_user.username}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not update chat session")

# --- STREAMING CHAT ENDPOINT and GENERATOR (Restored) ---

async def stream_chat_generator(
    history_json: str, 
    purpose: str, 
    user: User, 
    model_id: Optional[str] = None,
    session_id: Optional[str] = None
):
    current_session_id = session_id or str(uuid.uuid4())
    response_buffer = "" # Used only for successful GPT stream final save
    message_saved = False # Flag to track if a final message (success or error) has been saved
    model_used = "unknown"
    try:
        logger.info(f"Starting chat stream for user {user.username}, session {current_session_id}")
        try:
            history = json.loads(history_json)
            if not isinstance(history, list) or not history:
                raise ValueError("History must be a non-empty list")
            openai_messages = []
            for msg in history:
                 if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                     openai_messages.append(msg)
                 else:
                     logger.warning(f"Skipping invalid message format in history: {msg}")
            if not openai_messages:
                 raise ValueError("History is empty after parsing invalid messages.")
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid history: {e}")
            yield f'data: {{"error": "Invalid history format: {e}"}}\n\n'
            return
            
        # Save user message from history
        if openai_messages[-1]['role'] == 'user':
            try:
                # NOTE: Attachments not handled here yet
                save_chat_message(
                    user_id=user.id,
                    session_id=current_session_id,
                    role="user",
                    content=openai_messages[-1]['content']
                )
                message_saved = True # Consider user message saved successfully
            except Exception as e:
                logger.exception("Stream: Error saving user message")
        else:
             logger.warning("Stream: Last message in history was not from user.")

        # --- Streaming Logic --- 
        if model_id:
            # Simulate streaming for assistants - calls chat_with_custom_model which saves messages
            logger.info(f"Streaming (simulated) for custom model: {model_id}")
            try:
                 chat_request = ChatRequest(
                     messages=[ChatMessage(**msg) for msg in openai_messages],
                     purpose=purpose,
                     model_id=model_id,
                     session_id=current_session_id
                 )
                 custom_model_response = await chat_with_custom_model(chat_request, user, current_session_id)
                 response_content = str(custom_model_response.get("message", "")) # Ensure string
                 model_used = custom_model_response.get("model_used", f"custom:{model_id}")
                 message_saved = True # chat_with_custom_model saved it

                 # Yield the full response as one chunk
                 if response_content: # Only yield if there is content
                      chunk_data = {"chunk": response_content}
                      yield f"data: {json.dumps(chunk_data)}\n\n"
                 
            except Exception as assistant_error:
                logger.exception(f"Error during custom model (assistant) chat stream for {model_id}")
                error_msg = f"Error with custom model: {assistant_error}"
                error_data = {"error": error_msg}
                yield f"data: {json.dumps(error_data)}\n\n"
                # chat_with_custom_model should have saved the error message, so set flag
                message_saved = True 

        else:
            # Actual streaming for default GPT model
            model_name = "gpt-4o-mini"
            logger.info(f"Streaming with default model: {model_name}")
            model_used = model_name
            temp_response_buffer = ""
            try:
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=openai_messages,
                    stream=True
                )
                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content is not None:
                        chunk_data = {"chunk": content}
                        yield f"data: {json.dumps(chunk_data)}\n\n"
                        temp_response_buffer += content 
                        await asyncio.sleep(0.01)
                response_buffer = temp_response_buffer # Keep final response for saving
            except Exception as gpt_error:
                 logger.exception("Error during OpenAI stream")
                 error_msg = f"Error communicating with AI model: {gpt_error}"
                 error_data = {"error": error_msg}
                 yield f"data: {json.dumps(error_data)}\n\n"
                 # Save error message immediately
                 save_chat_message(
                    user_id=user.id, session_id=current_session_id, role="assistant",
                    content=error_msg, model_used=f"{model_name}-error"
                 )
                 message_saved = True

        # --- Stream End --- 
        # Send done signal along with the session_id used
        done_data = {"done": True, "session_id": current_session_id}
        yield f'data: {json.dumps(done_data)}\n\n'
        logger.info(f"Chat stream finished for session {current_session_id}")
        
    except Exception as e:
        # Catch-all for unexpected errors in the generator itself
        logger.exception(f"Unexpected error during stream_chat_generator for session {current_session_id}")
        try:
            error_msg = f"An unexpected server error occurred: {e}"
            error_data = {"error": error_msg}
            yield f"data: {json.dumps(error_data)}\n\n"
            # Save error message if no other message was saved
            if not message_saved:
                save_chat_message(
                    user_id=user.id, session_id=current_session_id, role="assistant",
                    content=error_msg, model_used="generator-error"
                )
                message_saved = True
        except Exception as final_error:
            logger.error(f"CRITICAL: Failed to yield/save final error to stream: {final_error}")
            
    finally:
        # Save the final assistant message ONLY if it was a successful GPT stream 
        # AND hasn't already been saved due to an error.
        if response_buffer and not message_saved: 
            try:
                 save_chat_message(
                    user_id=user.id, 
                    session_id=current_session_id,
                    role="assistant",
                    content=response_buffer, # Content accumulated during successful stream
                    model_used=model_used
                 )
            except Exception as save_error:
                 logger.exception(f"Stream: Failed to save final assistant message for session {current_session_id}")
        elif not message_saved:
             # Log warning if no message (success or error) was saved during the stream
             logger.warning(f"Stream: No final message was saved for session {current_session_id}")

@app.get("/api/chat_stream")
async def chat_stream(
    token: str, # Get token from query param
    history: str, # History as JSON string from query param
    purpose: str, # Purpose from query param
    model_id: Optional[str] = None, # Optional model_id
    session_id: Optional[str] = None # Optional session_id
): 
    """Endpoint for streaming chat responses using SSE."""
    logger.debug(f"Received chat stream request. Token: {token[:10] if token else 'None'}...")
    user = await get_user_from_token(token)
    if not user:
        async def unauthorized_stream():
            yield f'data: {{"error": "Authentication required or invalid token."}}\n\n'
        return StreamingResponse(unauthorized_stream(), media_type="text/event-stream")
    
    logger.info(f"Authenticated stream request for user: {user.username}")
    
    return StreamingResponse(
        stream_chat_generator(history, purpose, user, model_id, session_id),
        media_type="text/event-stream"
    )

# --- Custom Model Endpoints --- 

# General Endpoints (Root, Chat)
if __name__ == "__main__":
    import uvicorn
    print("Starting server directly...")
    uvicorn.run(app, host="0.0.0.0", port=8001) 