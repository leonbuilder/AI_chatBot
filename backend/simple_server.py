from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Literal
import uvicorn
import json

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Type definitions
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    purpose: str
    model_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    role: Literal["assistant"]

class CustomModelCreate(BaseModel):
    name: str
    description: str
    model_type: Literal["gpt", "assistant", "fine-tuned"]
    instructions: str
    website_url: Optional[str] = None
    website_content: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Backend server is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/custom_models")
async def list_custom_models():
    # Return mock data
    return [
        {
            "id": "mock-1",
            "name": "Test Model",
            "description": "This is a test model",
            "model_type": "gpt",
            "instructions": "This is a test instruction",
            "created_at": "2023-04-02T12:00:00",
            "updated_at": "2023-04-02T12:00:00"
        }
    ]

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # Format mock response the same way as expected by frontend
    response_text = f"This is a mock response to: {request.messages[-1].content if request.messages else 'No message'}\nUsing purpose: {request.purpose}\nModel ID: {request.model_id or 'None'}"
    
    return ChatResponse(
        message=response_text,
        role="assistant"
    )

@app.post("/api/custom_models")
async def create_custom_model(model: CustomModelCreate):
    # Return mock model creation response
    return {
        "id": "mock-new-model",
        "name": model.name,
        "description": model.description,
        "model_type": model.model_type,
        "instructions": model.instructions,
        "created_at": "2023-04-02T12:00:00",
        "updated_at": "2023-04-02T12:00:00"
    }

@app.delete("/api/custom_models/{model_id}")
async def delete_custom_model(model_id: str):
    return {"message": f"Model {model_id} deleted successfully (Mock)"}

@app.post("/api/custom_models/{model_id}/extract_website_content")
async def extract_website_content(model_id: str, data: Dict[str, Any]):
    return {
        "message": "Website content extracted successfully (Mock)",
        "content_preview": f"Mock content extracted from {data.get('url', 'unknown URL')}",
        "pages_extracted": 1
    }

@app.post("/api/custom_models/{model_id}/files")
async def add_file_to_model(model_id: str):
    return {"message": "File added to model successfully (Mock)"}

if __name__ == "__main__":
    print("Starting simple server on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001) 