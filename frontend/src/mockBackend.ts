import { AxiosResponse } from 'axios';

export interface CustomModel {
  id: string;
  name: string;
  description: string;
  model_type: 'gpt' | 'assistant' | 'fine-tuned';
  instructions: string;
  created_at: string;
  updated_at: string;
}

// Sample mock data
const mockModels: CustomModel[] = [
  // Removed Website Assistant (MOCK)
  // Removed Document Assistant (MOCK)
];

// Mock API endpoints
export const mockApi = {
  // Get list of custom models
  getCustomModels: (): Promise<AxiosResponse> => {
    return Promise.resolve({
      data: mockModels,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  },
  
  // Create custom model
  createCustomModel: (model: any): Promise<AxiosResponse> => {
    const newModel: CustomModel = {
      id: `mock-${Date.now()}`,
      name: model.name,
      description: model.description,
      model_type: model.model_type,
      instructions: model.instructions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockModels.push(newModel);
    
    return Promise.resolve({
      data: newModel,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {} as any
    });
  },
  
  // Delete custom model
  deleteCustomModel: (id: string): Promise<AxiosResponse> => {
    const index = mockModels.findIndex(model => model.id === id);
    if (index !== -1) {
      mockModels.splice(index, 1);
    }
    
    return Promise.resolve({
      data: { message: 'Model deleted successfully' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  },
  
  // Chat with custom model
  chat: (data: any): Promise<AxiosResponse> => {
    // Generate a mock response based on the last user message
    const lastMessage = data.messages[data.messages.length - 1];
    let response = 'I am a mock AI assistant. The real backend is not connected.';
    
    if (data.model_id) {
      const model = mockModels.find(m => m.id === data.model_id);
      if (model) {
        response = `I am a mock version of "${model.name}". ${model.instructions}. The real backend is not connected, so I can't provide a real response.`;
      }
    } else if (data.purpose) {
      response = `I am a mock AI assistant specialized in ${data.purpose}. The real backend is not connected, so I can't provide a real response.`;
    }
    
    return Promise.resolve({
      data: {
        message: response,
        role: 'assistant'
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  },
  
  // Extract website content
  extractWebsiteContent: (): Promise<AxiosResponse> => {
    return Promise.resolve({
      data: {
        message: 'Website content extracted successfully (MOCK)',
        content_preview: 'This is a mock preview of extracted website content...',
        pages_extracted: 1
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  },
  
  // Upload file
  uploadFile: (): Promise<AxiosResponse> => {
    return Promise.resolve({
      data: { message: 'File uploaded successfully (MOCK)' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    });
  }
}; 