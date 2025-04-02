# AI Purpose-Specific Chatbot

A modern web application that provides a purpose-specific AI chatbot interface. The chatbot can be specialized for different purposes such as technical support, writing assistance, language learning, and more.

## Features

- Purpose-specific AI responses
- Modern, responsive UI
- Real-time chat interface
- Multiple specialization options
- Error handling and loading states

## Prerequisites

- Python 3.8+
- Node.js 14+
- OpenAI API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-chatbot
```

2. Set up the backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_openai_api_key_here
```

4. Set up the frontend:
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3002`

## Usage

1. Select a purpose from the dropdown menu at the top of the chat interface
2. Type your message in the input field
3. Press Enter or click the send button to send your message
4. The AI will respond based on the selected purpose

## Technologies Used

- Backend:
  - FastAPI
  - OpenAI API
  - Python-dotenv

- Frontend:
  - React
  - TypeScript
  - Material-UI
  - Axios

## License

MIT 