# AI Chatbot with Custom GPT Models

A full-stack application that allows you to create and interact with custom GPT models tailored to your specific needs, including website integration capabilities.

## Features

- **Regular Chat Interface**: Chat with GPT-4o-mini for various predefined purposes
- **Custom GPT Models**: Create your own models with specific instructions
- **Website Integration**: Extract content from websites and integrate it with your custom models
- **Document Upload**: Upload files to be used as knowledge sources (with Assistant models)
- **Modern UI**: Clean and responsive Material UI interface

## Types of Custom Models

1. **GPT Models**: Basic text generation models with custom instructions
2. **Assistant Models**: Advanced models with file search and retrieval capabilities

## Project Structure

```
.
├── backend/                 # FastAPI server
│   ├── utils/               # Utility functions
│   │   └── web_utils.py     # Website scraping utilities
│   ├── main.py              # Main API endpoints
│   └── requirements.txt     # Python dependencies
└── frontend/                # React.js client
    ├── src/                 # Frontend source code
    │   ├── App.tsx          # Main application component
    │   └── index.tsx        # Entry point
    └── package.json         # Frontend dependencies
```

## Setup and Installation

### Prerequisites

- Node.js and npm/yarn
- Python 3.8+
- An OpenAI API key

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file:
   ```
   cp .env.example .env
   ```

5. Edit the `.env` file with your OpenAI API key and other settings

6. Start the backend server:
   ```
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the frontend development server:
   ```
   npm start
   ```

4. Open a browser and go to http://localhost:3000

## Using the Application

### General Chat

1. Select the "General Chat" tab
2. Choose a purpose from the dropdown menu
3. Type your message and press Enter or click the send button

### Creating and Using Custom Models

1. Select the "Custom Models" tab
2. Click "Create" to create a new model
3. Fill in the details:
   - Name: A descriptive name for your model
   - Description: What the model does
   - Model Type: GPT (text generation) or Assistant (file search & retrieval)
   - Instructions: Detailed instructions for how the model should behave
   - Website URL (optional): URL to extract content from
4. Once created, select your model from the dropdown
5. For Assistant-type models, you can upload files for the model to use
6. For any model, you can add website content by clicking "Add Website"
7. Start chatting with your custom model!

## Website Integration

When you add a website URL to your custom model, the application:

1. Extracts content from the specified URL
2. Processes the text to remove unnecessary elements
3. Adds the content to your model's knowledge base
4. Makes this content available for the model to reference during conversations

This is particularly useful for:
- Creating models that can answer questions about your website
- Building customer support bots that understand your product documentation
- Developing specialized assistants that leverage your web content

## API Endpoints

- `GET /api/health`: Health check
- `POST /api/chat`: Send a message to chat with GPT
- `GET /api/custom_models`: List all custom models
- `POST /api/custom_models`: Create a new custom model
- `GET /api/custom_models/{model_id}`: Get a specific custom model
- `DELETE /api/custom_models/{model_id}`: Delete a custom model
- `POST /api/custom_models/{model_id}/files`: Add a file to an assistant model
- `POST /api/custom_models/{model_id}/extract_website_content`: Extract and add website content

## License

MIT 