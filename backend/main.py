from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Literal, Union, Optional, Dict, Any
from openai import OpenAI  # type: ignore
import os
from dotenv import load_dotenv
import logging
import traceback
import json
import sqlite3
from sqlite3 import Connection
from contextlib import contextmanager
import uuid
from datetime import datetime
from utils.web_utils import extract_website_content as extract_content, extract_website_with_subpages

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

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
try:
    if api_key.startswith("sk-dummy"):
        # Mock mode for testing without real API calls
        logger.warning("Using dummy API key. API calls will fail, but server will start for testing.")
        client = OpenAI(api_key=api_key)  # type: ignore
    else:
        client = OpenAI(api_key=api_key)  # type: ignore
        logger.info("OpenAI client initialized successfully")
except TypeError as e:
    # Handle the 'proxies' keyword argument error
    if "unexpected keyword argument 'proxies'" in str(e):
        logger.warning("Detected OpenAI client compatibility issue. Using alternative initialization.")
        # Try with minimal parameters
        client = OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized successfully with alternative method")
    else:
        # Re-raise if it's a different TypeError
        raise

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

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    purpose: str
    model_id: Optional[str] = None

class CustomModelBase(BaseModel):
    name: str
    description: str
    model_type: Literal["gpt", "assistant", "fine-tuned"]
    instructions: str
    
class CustomModelCreate(CustomModelBase):
    website_url: Optional[str] = None
    website_content: Optional[str] = None
    
class CustomModelResponse(CustomModelBase):
    id: str
    created_at: str
    updated_at: str

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
            "health": "/api/health"
        }
    })

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request with purpose: {request.purpose}")
        logger.info(f"Messages: {json.dumps([msg.model_dump() for msg in request.messages], indent=2)}")
        
        if not request.messages:
            raise ValueError("No messages provided in the request")
        
        # Check if a custom model is specified
        if request.model_id:
            return await chat_with_custom_model(request)
        
        # Create system message based on purpose
        system_message = {
            "role": "system",
            "content": f"You are a helpful AI assistant specialized in {request.purpose}. "
                      f"Provide relevant and focused responses within this domain."
        }
        
        # Convert messages to OpenAI format
        messages = [system_message] + [convert_to_openai_message(msg) for msg in request.messages]
        logger.info(f"Converted messages: {json.dumps(messages, indent=2)}")
        
        logger.info("Calling OpenAI API...")
        try:
            # Use the new client.chat.completions.create method
            # Type annotations are suppressed for messages parameter due to OpenAI API typing issues
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,  # type: ignore
                temperature=0.7,
                max_tokens=500,
                response_format={"type": "text"}
            )
            logger.info("Received response from OpenAI")
            
            if not response.choices:
                raise ValueError("No response choices received from OpenAI")
                
            return {
                "message": response.choices[0].message.content,
                "role": "assistant"
            }
        except Exception as e:
            logger.error(f"Error during OpenAI API call: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error during OpenAI API call: {str(e)}")
    
    except ValueError as e:
        logger.error(f"Validation Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

async def chat_with_custom_model(request: ChatRequest):
    """Use a custom model for chat completion"""
    try:
        # Get custom model from database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM custom_models WHERE id = ?", (request.model_id,))
            model_data = cursor.fetchone()
            
            if not model_data:
                raise HTTPException(status_code=404, detail=f"Custom model with id {request.model_id} not found")
            
            # Parse model config
            config = json.loads(model_data["config"])
            model_type = model_data["model_type"]
            
            # Get any associated files
            cursor.execute("SELECT * FROM model_files WHERE model_id = ?", (request.model_id,))
            file_data = cursor.fetchall()
            file_ids = [file["file_id"] for file in file_data] if file_data else []
        
        if model_type == "assistant":
            # Use OpenAI Assistant API
            assistant_id = model_data["assistant_id"]
            
            # Create a thread
            thread = client.beta.threads.create()
            
            # Add user messages to thread
            for msg in request.messages:
                if msg.role == "user":
                    client.beta.threads.messages.create(
                        thread_id=thread.id,
                        role="user",
                        content=msg.content
                    )
            
            # Run assistant on thread
            run = client.beta.threads.runs.create(
                thread_id=thread.id,
                assistant_id=assistant_id
            )
            
            # Wait for completion
            while run.status in ["queued", "in_progress"]:
                run = client.beta.threads.runs.retrieve(
                    thread_id=thread.id,
                    run_id=run.id
                )
            
            if run.status != "completed":
                raise HTTPException(status_code=500, detail="Assistant run failed")
            
            # Get messages
            messages = client.beta.threads.messages.list(thread_id=thread.id)
            
            # Return the last assistant message
            for msg in reversed(messages.data):
                if msg.role == "assistant":
                    return {
                        "message": safely_extract_assistant_text(msg.content),
                        "role": "assistant"
                    }
            
            raise HTTPException(status_code=500, detail="No assistant response found")
            
        else:  # gpt or fine-tuned
            # Create system message from model instructions
            system_message = {
                "role": "system",
                "content": config.get("instructions", f"You are a helpful AI assistant specialized in {request.purpose}.")
            }
            
            # Add website context if available
            if config.get("website_content"):
                system_message["content"] += f"\n\nReference website content: {config.get('website_content')}"
            
            # Convert messages to OpenAI format
            messages = [system_message] + [convert_to_openai_message(msg) for msg in request.messages]
            
            # Get model to use (default to gpt-4o if not specified)
            model_name = config.get("model", "gpt-4o-mini")
            
            # Call OpenAI API
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,  # type: ignore
                temperature=config.get("temperature", 0.7),
                max_tokens=config.get("max_tokens", 500),
                response_format={"type": "text"}
            )
            
            if not response.choices:
                raise ValueError("No response choices received from OpenAI")
                
            return {
                "message": response.choices[0].message.content,
                "role": "assistant"
            }
    
    except Exception as e:
        logger.error(f"Error in custom model chat: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom_models", response_model=CustomModelResponse)
async def create_custom_model(model: CustomModelCreate):
    """Create a new custom GPT model"""
    try:
        model_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        # Create config JSON
        config = {
            "instructions": model.instructions,
            "temperature": 0.7,
            "max_tokens": 500,
            "model": "gpt-4o-mini"
        }
        
        # Add website info if provided
        if model.website_url:
            config["website_url"] = model.website_url
        if model.website_content:
            config["website_content"] = model.website_content
        
        assistant_id = None
        vector_store_id = None
        
        # If model type is "assistant", create an OpenAI Assistant
        if model.model_type == "assistant":
            # Create a vector store for the assistant
            vector_store = client.vector_stores.create(name=f"{model.name} Vector Store")
            vector_store_id = vector_store.id

            assistant = client.beta.assistants.create(
                name=model.name,
                description=model.description,
                instructions=model.instructions,
                model=os.getenv("OPENAI_ASSISTANT_MODEL", "gpt-4o"),
                tools=[{"type": "file_search"}],
                tool_resources={"file_search": {"vector_store_ids": [vector_store_id]}}
            )
            assistant_id = assistant.id
        
        # Save model to database
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO custom_models (id, name, description, model_type, assistant_id, vector_store_id, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (model_id, model.name, model.description, model.model_type, assistant_id, vector_store_id, json.dumps(config), now, now)
            )
            conn.commit()
        
        return {
            "id": model_id,
            "name": model.name,
            "description": model.description,
            "model_type": model.model_type,
            "instructions": model.instructions,
            "created_at": now,
            "updated_at": now
        }
        
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
        file_batch = client.vector_stores.file_batches.upload_and_poll(
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
                        client.vector_stores.delete(vector_store_id=vector_store_id)
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

# Add this code at the end of the file
if __name__ == "__main__":
    import uvicorn
    print("Starting server directly...")
    uvicorn.run(app, host="0.0.0.0", port=8001) 