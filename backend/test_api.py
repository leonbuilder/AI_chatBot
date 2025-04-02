from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CustomModelBase(BaseModel):
    name: str
    description: str
    model_type: str
    instructions: str
    
class CustomModelCreate(CustomModelBase):
    website_url: Optional[str] = None
    
class CustomModelResponse(CustomModelBase):
    id: str
    created_at: str
    updated_at: str

# Sample data
sample_models = [
    {
        "id": "1",
        "name": "Test Model",
        "description": "A test model",
        "model_type": "gpt",
        "instructions": "This is a test model",
        "created_at": "2023-04-02T12:00:00",
        "updated_at": "2023-04-02T12:00:00"
    }
]

@app.get("/")
async def root():
    return JSONResponse({
        "status": "ok",
        "message": "Test API is running",
        "endpoints": {
            "custom_models": "/api/custom_models",
            "health": "/api/health"
        }
    })

@app.get("/api/custom_models", response_model=List[CustomModelResponse])
async def list_custom_models():
    """List all custom models"""
    return sample_models

@app.post("/api/custom_models", response_model=CustomModelResponse)
async def create_custom_model(model: CustomModelCreate):
    """Create a new custom GPT model"""
    new_model = {
        "id": "2",
        "name": model.name,
        "description": model.description,
        "model_type": model.model_type,
        "instructions": model.instructions,
        "created_at": "2023-04-02T12:00:00",
        "updated_at": "2023-04-02T12:00:00"
    }
    sample_models.append(new_model)
    return new_model

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    print("Starting test server...")
    uvicorn.run(app, host="0.0.0.0", port=8001) 