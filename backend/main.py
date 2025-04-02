from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Literal, Union
from openai import OpenAI  # type: ignore
import os
from dotenv import load_dotenv
import logging
import traceback
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
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
client = OpenAI(api_key=api_key)  # type: ignore
logger.info("OpenAI client initialized successfully")

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    purpose: str

def convert_to_openai_message(message: ChatMessage) -> dict:
    try:
        return {
            "role": message.role,
            "content": message.content
        }
    except Exception as e:
        logger.error(f"Error converting message: {str(e)}")
        raise

@app.get("/")
async def root():
    return JSONResponse({
        "status": "ok",
        "message": "AI Chat API is running",
        "endpoints": {
            "chat": "/api/chat",
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
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
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

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"} 