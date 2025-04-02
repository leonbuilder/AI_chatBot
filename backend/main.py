from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
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

# Import specific OpenAI types for Assistants API
# from openai.types.beta import AssistantToolParam # For tools list type - Removed due to ImportError
# ToolResources types seem hard to import reliably, will use dict + type: ignore

# Constants
CHAT_UPLOAD_DIR = "backend/uploads/chat_files"

# Configure logging
logging.basicConfig(level=logging.INFO)
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
    if not SECRET_KEY:
        logger.error("SECRET_KEY is not configured for token validation.")
        # Use 500 Internal Server Error as this is a configuration issue
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server configuration error") 

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            logger.warning("Token payload missing 'sub' (username).")
            raise credentials_exception
        # If username is not None, it's a str. Type checker should understand this.
        token_data = TokenData(username=username) 
    except JWTError as e:
        logger.warning(f"JWTError decoding token: {e}")
        raise credentials_exception
    
    # username is confirmed string here
    user = get_user(username=username) 
    if user is None:
        logger.warning(f"User '{username}' not found for token.")
        raise credentials_exception
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
    try:
        session_id = request.session_id or str(uuid.uuid4())
        logger.info(f"User {current_user.username} initiated chat request (Session: {session_id}) with purpose: {request.purpose}")
        logger.info(f"Messages: {json.dumps([msg.model_dump() for msg in request.messages], indent=2)}")

        if not request.messages:
            raise ValueError("No messages provided in the request")

        # Assume the last message is the user's current prompt
        last_user_message = request.messages[-1]
        if last_user_message.role != "user":
            raise ValueError("Invalid message sequence: last message must be from user.")

        # Save the user's message, passing attachments if provided
        message_id = save_chat_message(
            user_id=current_user.id,
            session_id=session_id,
            role=last_user_message.role,
            content=last_user_message.content,
            attachments=request.attachments # Pass attachments here
        )
        
        if not message_id:
             # Handle error if message saving failed
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save user message")

        # Check if a custom model is specified
        if request.model_id:
            # Pass session_id to the custom model handler
            assistant_response = await chat_with_custom_model(request, current_user, session_id)
        else:
            # Create system message based on purpose
            system_message = {
                "role": "system",
                "content": f"You are a helpful AI assistant specialized in {request.purpose}. "
                          f"Provide relevant and focused responses within this domain."
            }

            # Convert messages to OpenAI format (including system message)
            openai_messages = [system_message] + [convert_to_openai_message(msg) for msg in request.messages]
            logger.info(f"Converted messages: {json.dumps(openai_messages, indent=2)}")

            logger.info("Calling OpenAI API...")
            try:
                model_to_use = "gpt-4o-mini" # Define model used
                response = client.chat.completions.create(
                    model=model_to_use,
                    messages=openai_messages,  # type: ignore
                    temperature=0.7,
                    max_tokens=500,
                    response_format={"type": "text"}
                )
                logger.info("Received response from OpenAI")

                if not response.choices:
                    raise ValueError("No response choices received from OpenAI")
                
                assistant_content = response.choices[0].message.content
                if not assistant_content:
                     assistant_content = "" # Ensure content is not None

                # Save assistant's response
                save_chat_message(
                    user_id=current_user.id, # Associate with the user for history viewing
                    session_id=session_id,
                    role="assistant",
                    content=assistant_content,
                    model_used=model_to_use
                )
                
                assistant_response = {
                    "message": assistant_content,
                    "role": "assistant"
                }
                
            except Exception as e:
                logger.error(f"Error during OpenAI API call: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error during OpenAI API call: {str(e)}")

        # Return the structured response including session_id
        return ChatResponse(
            message=assistant_response["message"],
            role="assistant",
            session_id=session_id
        )

    except ValueError as e:
        logger.error(f"Validation Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

async def chat_with_custom_model(request: ChatRequest, current_user: User, session_id: str):
    """Use a custom model for chat completion, now saves messages."""
    try:
        # Get custom model from database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (request.model_id,))
            model_data = cursor.fetchone()

            if not model_data:
                raise HTTPException(status_code=404, detail=f"Custom model with id {request.model_id} not found")

            # TODO: Check if the current user owns or has access to this custom model
            # For now, any authenticated user can use any model.

            config = json.loads(model_data["config"])
            model_type = model_data["model_type"]
            model_used = f"custom:{model_type}:{request.model_id}" # Identifier for the model used

            # Get any associated files
            cursor.execute("SELECT * FROM model_files WHERE model_id = ?", (request.model_id,))
            file_data = cursor.fetchall()
            file_ids = [file["file_id"] for file in file_data] if file_data else []

        assistant_content = "Error: Could not generate response."
        role = "assistant" # Default role

        if model_type == "assistant":
            assistant_id = model_data["assistant_id"]
            if not assistant_id:
                 raise HTTPException(status_code=500, detail="Model is assistant type but has no assistant ID.")

            thread = client.beta.threads.create()
            for msg in request.messages:
                if msg.role == "user":
                    client.beta.threads.messages.create(thread_id=thread.id, role="user", content=msg.content)

            run = client.beta.threads.runs.create(thread_id=thread.id, assistant_id=assistant_id)
            while run.status in ["queued", "in_progress"]:
                run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

            if run.status != "completed":
                logger.error(f"Assistant run failed for thread {thread.id} and assistant {assistant_id}. Status: {run.status}. Last error: {run.last_error}")
                raise HTTPException(status_code=500, detail=f"Assistant run failed. Status: {run.status}")

            messages_response = client.beta.threads.messages.list(thread_id=thread.id)
            for msg in reversed(messages_response.data):
                if msg.role == "assistant":
                    assistant_content = safely_extract_assistant_text(msg.content)
                    break # Found the latest assistant message
            else:
                logger.error(f"No assistant message found in thread {thread.id}")
                assistant_content = "No response generated by assistant."

        else:  # gpt or fine-tuned
            system_message = {"role": "system", "content": config.get("instructions", f"You are a helpful AI assistant specialized in {request.purpose}.")}
            if config.get("website_content"):
                system_message["content"] += f"\n\nReference website content: {config.get('website_content')}"

            openai_messages = [system_message] + [convert_to_openai_message(msg) for msg in request.messages]
            model_name = config.get("model", "gpt-4o-mini")
            model_used = f"custom:gpt:{model_name}" # More specific model identifier

            response = client.chat.completions.create(
                model=model_name,
                messages=openai_messages,  # type: ignore
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens", 500),
                response_format={"type": "text"}
            )

            if not response.choices:
                raise ValueError("No response choices received from OpenAI")
            
            assistant_content = response.choices[0].message.content
            if not assistant_content:
                 assistant_content = "" # Ensure content is not None

        # Save assistant's response (regardless of type: assistant or gpt)
        save_chat_message(
            user_id=current_user.id,
            session_id=session_id,
            role=role,
            content=assistant_content,
            model_used=model_used
        )

        # Return the standard response dictionary expected by the main chat endpoint
        return {
            "message": assistant_content,
            "role": role,
        }

    except Exception as e:
        logger.error(f"Error in custom model chat: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Log the error but don't save a message, let the main endpoint handle HTTPException
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
@app.get("/api/chat_sessions", response_model=List[ChatSessionInfo])
async def list_chat_sessions(current_user: User = Depends(get_current_user)):
    """List all chat sessions (conversations) for the current user."""
    sessions = []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Query distinct session IDs and the latest timestamp for each session involving the user
            cursor.execute("""
                SELECT session_id, MAX(timestamp) as last_timestamp
                FROM chat_messages
                WHERE user_id = ?
                GROUP BY session_id
                ORDER BY last_timestamp DESC
            """, (current_user.id,))
            session_rows = cursor.fetchall()
            
            for row in session_rows:
                # Parse the timestamp string into a datetime object if needed
                last_timestamp = None
                if row["last_timestamp"]:
                    try:
                        last_timestamp = datetime.fromisoformat(row["last_timestamp"])
                    except ValueError:
                        logger.warning(f"Could not parse timestamp {row['last_timestamp']} for session {row['session_id']}")
                
                sessions.append(ChatSessionInfo(
                    session_id=row["session_id"],
                    last_message_timestamp=last_timestamp
                ))
        return sessions
    except Exception as e:
        logger.error(f"Error fetching chat sessions for user {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve chat sessions")

@app.get("/api/chat_sessions/{session_id}/messages", response_model=List[ChatMessageHistory])
async def get_chat_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieve all messages for a specific chat session belonging to the current user."""
    messages = []
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Fetch messages first
            cursor.execute("""
                SELECT id, role, content, timestamp, model_used, edited_at
                FROM chat_messages
                WHERE session_id = ? AND user_id = ? AND is_deleted = FALSE
                ORDER BY timestamp ASC
            """, (session_id, current_user.id))
            message_rows = cursor.fetchall()
            
            for row in message_rows:
                message_id = row["id"]
                
                # Fetch attachments for this message
                cursor.execute("""
                    SELECT id, filename, mimetype, filesize
                    FROM chat_attachments
                    WHERE message_id = ? 
                """, (message_id,))
                attachment_rows = cursor.fetchall()
                
                attachments_info = []
                for att_row in attachment_rows:
                    # Construct the download URL dynamically
                    # Ensure this matches the actual download endpoint route
                    download_url = f"/api/chat/attachments/{att_row['id']}" 
                    attachments_info.append(AttachmentInfo(
                        id=att_row["id"],
                        filename=att_row["filename"],
                        mimetype=att_row["mimetype"],
                        filesize=att_row["filesize"],
                        download_url=download_url
                    ))

                # Parse timestamps
                timestamp = datetime.fromisoformat(row["timestamp"])
                edited_at = None
                if row["edited_at"]:
                    try:
                        edited_at = datetime.fromisoformat(row["edited_at"])
                    except ValueError:
                         logger.warning(f"Could not parse edited_at timestamp {row['edited_at']} for message {row['id']}")

                messages.append(ChatMessageHistory(
                    id=message_id,
                    role=row["role"],
                    content=row["content"],
                    timestamp=timestamp,
                    model_used=row["model_used"],
                    edited_at=edited_at,
                    is_deleted=False,
                    attachments=attachments_info # Include fetched attachments
                ))
        return messages
    except Exception as e:
        logger.error(f"Error fetching messages for session {session_id}, user {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve chat messages")

@app.delete("/api/chat_messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a specific chat message. Only the user who sent it can delete it."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # First, verify the message exists and belongs to the user and is not already deleted
            cursor.execute("""
                SELECT user_id, role FROM chat_messages 
                WHERE id = ? AND is_deleted = FALSE
            """, (message_id,))
            message_data = cursor.fetchone()

            if not message_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail="Message not found or already deleted"
                )

            # Check ownership: Only allow deletion if the user sent the message (role='user')
            # Or, if you want users to delete assistant responses in their threads, adjust logic:
            # if message_data["user_id"] != current_user.id:
            if message_data["user_id"] != current_user.id or message_data["role"] != 'user':
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, 
                    detail="You do not have permission to delete this message"
                )
            
            # Perform the soft delete
            cursor.execute("""
                UPDATE chat_messages 
                SET is_deleted = TRUE 
                WHERE id = ?
            """, (message_id,))
            
            conn.commit()
            
            # Check if the update was successful (optional, commit throws error if PK fails)
            if cursor.rowcount == 0:
                # This case might happen in a race condition if deleted between check and update
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, 
                    detail="Message not found (possibly deleted by another request)"
                )
            
            logger.info(f"User {current_user.username} soft deleted message {message_id}")
            # No content is returned on successful DELETE
            return None 

    except HTTPException: # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        conn.rollback() # Ensure rollback on unexpected errors
        logger.error(f"Error deleting message {message_id} for user {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail="Could not delete chat message")

@app.patch("/api/chat_messages/{message_id}", response_model=ChatMessageHistory)
async def edit_chat_message(
    message_id: str,
    update_data: ChatMessageUpdate,
    current_user: User = Depends(get_current_user)
):
    """Edit the content of a specific chat message. Only user messages can be edited by their author."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify the message exists, belongs to the user, is a user message, and not deleted
            cursor.execute("""
                SELECT user_id, role FROM chat_messages 
                WHERE id = ? AND is_deleted = FALSE
            """, (message_id,))
            message_data = cursor.fetchone()

            if not message_data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or has been deleted")

            if message_data["user_id"] != current_user.id or message_data["role"] != 'user':
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit this message")
            
            # Perform the update
            cursor.execute("""
                UPDATE chat_messages 
                SET content = ?, edited_at = ? 
                WHERE id = ?
            """, (update_data.content, now_iso, message_id))
            
            conn.commit()

            if cursor.rowcount == 0:
                # Should not happen if initial check passed, but handle defensively
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found during update")

            # Fetch the updated message to return it
            cursor.execute("""
                SELECT id, role, content, timestamp, model_used, edited_at
                FROM chat_messages
                WHERE id = ?
            """, (message_id,))
            updated_row = cursor.fetchone()

            if not updated_row:
                 # Should definitely not happen
                 logger.error(f"Failed to fetch message {message_id} immediately after update.")
                 raise HTTPException(status_code=500, detail="Failed to retrieve updated message")

            # Parse timestamps for the response model
            timestamp = datetime.fromisoformat(updated_row["timestamp"])
            edited_at = datetime.fromisoformat(updated_row["edited_at"]) if updated_row["edited_at"] else None

            logger.info(f"User {current_user.username} edited message {message_id}")
            return ChatMessageHistory(
                id=updated_row["id"],
                role=updated_row["role"],
                content=updated_row["content"],
                timestamp=timestamp,
                model_used=updated_row["model_used"],
                edited_at=edited_at,
                is_deleted=False # Message is not deleted if we edited it
            )

    except HTTPException: # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        conn.rollback() # Ensure rollback on unexpected errors
        logger.error(f"Error editing message {message_id} for user {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail="Could not edit chat message")

@app.get("/api/chat_messages/search", response_model=List[ChatMessageHistory])
async def search_chat_messages(
    query: str, # Search query parameter
    current_user: User = Depends(get_current_user)
):
    """Search through the current user's non-deleted chat messages."""
    messages = []
    if not query or len(query.strip()) < 1:
        # Return empty list or raise 400 Bad Request if query is empty/too short
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Search query cannot be empty.")
        # Alternatively: return []

    search_term = f"%{query.strip()}%".lower() # Prepare for case-insensitive LIKE search
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Search content using case-insensitive LIKE
            cursor.execute("""
                SELECT id, role, content, timestamp, model_used, edited_at
                FROM chat_messages
                WHERE user_id = ? 
                  AND is_deleted = FALSE 
                  AND lower(content) LIKE ?
                ORDER BY timestamp DESC -- Show most recent results first
            """, (current_user.id, search_term))
            message_rows = cursor.fetchall()
            
            for row in message_rows:
                timestamp = datetime.fromisoformat(row["timestamp"])
                edited_at = datetime.fromisoformat(row["edited_at"]) if row["edited_at"] else None

                messages.append(ChatMessageHistory(
                    id=row["id"],
                    role=row["role"],
                    content=row["content"],
                    timestamp=timestamp,
                    model_used=row["model_used"],
                    edited_at=edited_at,
                    is_deleted=False
                ))
        return messages
    except Exception as e:
        logger.error(f"Error searching messages for user {current_user.username} with query '{query}': {e}")
        raise HTTPException(status_code=500, detail="Could not perform message search")

# --- Helper Functions (General) ---

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
            
            # Insert the main message
            cursor.execute(
                "INSERT INTO chat_messages (id, session_id, user_id, role, content, timestamp, model_used) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (message_id, session_id, user_id, role, content, now_iso, model_used)
            )
            
            # Link attachments if provided (only for user messages typically)
            if attachments and role == 'user':
                for att_data in attachments:
                    # Find the actual file path. We only have the UUID (temp_file_id).
                    # We need to find the file with the correct extension.
                    found_path = None
                    try:
                        for filename in os.listdir(CHAT_UPLOAD_DIR):
                            if filename.startswith(att_data.temp_file_id):
                                found_path = os.path.join(CHAT_UPLOAD_DIR, filename)
                                break
                    except FileNotFoundError:
                        logger.error(f"Upload directory {CHAT_UPLOAD_DIR} not found while linking attachments.")
                        # Should we fail the whole message save?
                        raise Exception(f"Upload directory missing")
                    except Exception as e:
                        logger.error(f"Error listing upload directory {CHAT_UPLOAD_DIR}: {e}")
                        raise

                    if found_path and os.path.exists(found_path):
                        attachment_id = str(uuid.uuid4())
                        cursor.execute(
                            """INSERT INTO chat_attachments 
                               (id, message_id, user_id, filename, filepath, filesize, mimetype, uploaded_at) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                attachment_id, 
                                message_id, 
                                user_id, 
                                att_data.original_filename, 
                                found_path, # Store the actual path to the file
                                att_data.filesize, 
                                att_data.mimetype, 
                                now_iso # Use message timestamp as upload link time
                            )
                        )
                        logger.info(f"Linked attachment {att_data.original_filename} (ID: {att_data.temp_file_id}) to message {message_id}")
                    else:
                        # Attachment file not found - log error, maybe skip?
                        logger.error(f"Could not find uploaded file for temp_id {att_data.temp_file_id} when saving message {message_id}. Skipping attachment link.")
                        # Decide if this should be a critical error - perhaps depends on application logic.
                        # For now, we log and continue.
            
            conn.commit()
            logger.info(f"Saved message {message_id} for user {user_id} in session {session_id}")
            return message_id
            
    except Exception as e:
        # Ensure conn is defined before trying rollback
        if conn:
            conn.rollback()
        logger.error(f"Failed to save chat message or link attachments: {e}")
        # Log traceback for detailed debugging
        logger.error(traceback.format_exc())
        return None

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # Store active connections keyed by user_id
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user {user_id}")
        # Optionally broadcast presence here
        await self.broadcast_presence(user_id, is_online=True)

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user {user_id}")
            # Optionally broadcast presence here
            # Need to run this in an event loop if called outside async context
            # asyncio.create_task(self.broadcast_presence(user_id, is_online=False))
            # For simplicity in disconnect, we might broadcast from endpoint context
        
    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error sending personal message to user {user_id}: {e}")
                # Consider disconnecting if send fails repeatedly

    async def broadcast(self, message: str):
        # Send message to all connected clients
        disconnected_users = []
        for user_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {e}. Marking for disconnect.")
                disconnected_users.append(user_id)
        
        # Clean up disconnected users after broadcast
        for user_id in disconnected_users:
            self.disconnect(user_id)
            # Need to broadcast offline status after cleanup
            await self.broadcast_presence(user_id, is_online=False)
            
    # Example for presence
    async def broadcast_presence(self, user_id: str, is_online: bool):
        presence_message = json.dumps({"type": "presence", "user_id": user_id, "online": is_online})
        await self.broadcast(presence_message)

manager = ConnectionManager()

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """WebSocket endpoint requiring token query parameter for authentication."""
    if not token:
        logger.warning("WebSocket connection attempt without token.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = await get_user_from_token(token)
    
    if not user:
        logger.warning(f"WebSocket connection attempt with invalid token: {token[:10]}...")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    user_id = user.id
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WS message from {user_id} ({user.username}): {data}")

            # Handle incoming WebSocket messages (typing, read receipts, etc.)
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")

                if message_type == "typing":
                    session_id = message_data.get("session_id")
                    is_typing = message_data.get("is_typing", False)
                    if session_id:
                        # TODO: Broadcast typing status only to users in the same session_id
                        typing_message = json.dumps({
                            "type": "typing", 
                            "user_id": user_id, 
                            "username": user.username, # Send username for display
                            "session_id": session_id, 
                            "is_typing": is_typing
                        })
                        # Simplistic broadcast for now:
                        await manager.broadcast(typing_message)
                    else:
                        logger.warning(f"Typing indicator received without session_id from {user_id}")
                
                elif message_type == "read_receipt":
                     session_id = message_data.get("session_id")
                     last_read_message_id = message_data.get("last_read_message_id")
                     if session_id and last_read_message_id:
                         # TODO: Store read status in DB (optional)
                         # TODO: Broadcast read receipt only to relevant users in the session
                         read_receipt_message = json.dumps({
                            "type": "read_receipt",
                            "user_id": user_id,
                            "username": user.username,
                            "session_id": session_id,
                            "last_read_message_id": last_read_message_id
                         })
                         # Simplistic broadcast for now:
                         await manager.broadcast(read_receipt_message)
                     else:
                        logger.warning(f"Read receipt received with missing data from {user_id}")

                # Handle other message types if needed

            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON via WS from {user_id}: {data}")
            except Exception as e:
                logger.error(f"Error processing WS message from {user_id}: {e}")
                # Consider sending an error message back to the user
                # await manager.send_personal_message(json.dumps({"type": "error", "detail": "Processing error"}), user_id)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected handler for user {user_id} ({user.username})")
        # Broadcast offline status before fully disconnecting
        await manager.broadcast_presence(user_id, is_online=False)
        manager.disconnect(user_id)
    except Exception as e:
        # Log unexpected errors and ensure cleanup
        logger.error(f"Unexpected error in WebSocket for user {user_id} ({user.username}): {e}")
        logger.error(traceback.format_exc())
        # Broadcast offline status if possible and disconnect
        await manager.broadcast_presence(user_id, is_online=False)
        manager.disconnect(user_id)
        # Ensure the connection is closed from the server side
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

# Chat Attachment/Upload Endpoints
@app.post("/api/chat/upload", response_model=FileUploadResponse)
async def upload_chat_file(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    """Handles chat file uploads. Stores file temporarily and returns an ID."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided.")

    # Generate a unique filename using UUID (without extension for the ID)
    temp_file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    # Store with extension, but the ID returned is just the UUID part
    safe_filename_with_ext = f"{temp_file_id}{file_ext}" 
    file_path = os.path.join(CHAT_UPLOAD_DIR, safe_filename_with_ext)

    try:
        file_size = 0
        # Save the file asynchronously
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):  # Read in 1MB chunks
                await out_file.write(content)
                file_size += len(content)
        
        mimetype = file.content_type or "application/octet-stream"
        logger.info(f"User {current_user.username} uploaded file '{file.filename}' as {safe_filename_with_ext} ({file_size} bytes), Temp ID: {temp_file_id}")

        return FileUploadResponse(
            temp_file_id=temp_file_id, # Return only the UUID part as the ID
            original_filename=file.filename,
            mimetype=mimetype,
            filesize=file_size
        )

    except Exception as e:
        logger.error(f"Failed to upload file {file.filename} for user {current_user.username}: {e}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as rm_err:
                logger.error(f"Error cleaning up failed upload {file_path}: {rm_err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not save uploaded file.")

@app.get("/api/chat/attachments/{attachment_id}")
async def download_chat_attachment(
    attachment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Allows downloading a specific chat attachment, verifying user access."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Find attachment and the user associated with its message
            cursor.execute("""
                SELECT ca.filepath, ca.filename, ca.mimetype, cm.user_id
                FROM chat_attachments ca
                JOIN chat_messages cm ON ca.message_id = cm.id
                WHERE ca.id = ?
            """, (attachment_id,))
            attachment_data = cursor.fetchone()

            if not attachment_data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

            # Verify the current user is the owner of the message this attachment belongs to
            if attachment_data["user_id"] != current_user.id:
                # Add more sophisticated access control later if needed (e.g., shared sessions)
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to access this attachment")

            file_path = attachment_data["filepath"]
            original_filename = attachment_data["filename"]
            mimetype = attachment_data["mimetype"]

            if not os.path.exists(file_path):
                logger.error(f"Attachment file not found on disk: {file_path} (Attachment ID: {attachment_id})")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found on server")

            # Return the file as a response
            return FileResponse(
                path=file_path, 
                filename=original_filename, 
                media_type=mimetype
            )

    except HTTPException:
        raise # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error downloading attachment {attachment_id} for user {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail="Could not download attachment")

# General Endpoints (Root, Chat)
if __name__ == "__main__":
    import uvicorn
    print("Starting server directly...")
    uvicorn.run(app, host="0.0.0.0", port=8001) 