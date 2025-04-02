import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Breadcrumbs,
  Link,
  useTheme
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import RefreshIcon from '@mui/icons-material/Refresh';

// Create an axios instance with auth header
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add the auth token header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface HierarchicalPurposeSelectorProps {
  onChange: (purpose: string, systemPrompt?: string) => void;
  currentPurpose: string;
}

interface PurposeCategoryResponse {
  categories: string[];
  is_leaf?: boolean;
  system_prompt?: string;
  error?: string;
}

const HierarchicalPurposeSelector: React.FC<HierarchicalPurposeSelectorProps> = ({
  onChange,
  currentPurpose
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<string>(currentPurpose || '');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isLeaf, setIsLeaf] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);
  
  // Fetch top-level categories on initial load
  useEffect(() => {
    fetchCategories([]);
  }, []);

  // Split the current purpose to pre-select categories if it matches a path
  useEffect(() => {
    if (currentPurpose && currentPath.length === 0) {
      const parts = currentPurpose.split(' > ');
      if (parts.length > 0 && categories.includes(parts[0])) {
        handleSelectCategory(parts[0]);
      }
    }
  }, [currentPurpose, categories]);

  const fetchCategories = async (path: string[], regenerate = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<PurposeCategoryResponse>('/api/purpose-categories', {
        path,
        regenerate
      });

      setCategories(response.data.categories || []);
      setIsLeaf(response.data.is_leaf || false);
      
      if (response.data.is_leaf && response.data.system_prompt) {
        setSystemPrompt(response.data.system_prompt);
      } else {
        setSystemPrompt('');
      }
      
    } catch (error) {
      console.error('Error fetching purpose categories:', error);
      setError('Failed to load categories. Please try again.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (category: string) => {
    const newPath = [...currentPath, category];
    setCurrentPath(newPath);
    const newPurpose = newPath.join(' > ');
    setSelectedPurpose(newPurpose);
    onChange(newPurpose);
    fetchCategories(newPath);
  };

  const handleClickBreadcrumb = (index: number) => {
    // If clicking "Home", reset to empty path
    if (index === -1) {
      setCurrentPath([]);
      setSelectedPurpose('');
      onChange('');
      fetchCategories([]);
      return;
    }
    
    // Otherwise, navigate to the selected level
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    const newPurpose = newPath.join(' > ');
    setSelectedPurpose(newPurpose);
    onChange(newPurpose);
    fetchCategories(newPath);
  };

  const handleFinalSelection = () => {
    if (systemPrompt) {
      onChange(selectedPurpose, systemPrompt);
    }
  };

  const handleRegenerateOptions = () => {
    setRegenerateCount(prev => prev + 1);
    fetchCategories(currentPath, true);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      {/* Breadcrumb navigation */}
      <Paper
        variant="outlined"
        sx={{ 
          p: 1.5, 
          mb: 2, 
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          borderRadius: 1
        }}
      >
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          aria-label="purpose navigation"
        >
          <Link
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              color: theme.palette.primary.main
            }}
            onClick={() => handleClickBreadcrumb(-1)}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Home
          </Link>
          
          {currentPath.map((item, index) => (
            <Link
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: index < currentPath.length - 1 ? 'pointer' : 'default',
                color: index < currentPath.length - 1 ? theme.palette.primary.main : 'inherit',
                fontWeight: index === currentPath.length - 1 ? 'bold' : 'normal'
              }}
              onClick={() => index < currentPath.length - 1 && handleClickBreadcrumb(index)}
            >
              {index < currentPath.length - 1 && <FolderIcon sx={{ mr: 0.5 }} fontSize="inherit" />}
              {item}
            </Link>
          ))}
        </Breadcrumbs>
      </Paper>
      
      {/* Current selection */}
      {selectedPurpose && (
        <Typography variant="subtitle1" gutterBottom color="primary">
          Selected: {selectedPurpose}
        </Typography>
      )}
      
      {/* Error message */}
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      
      {/* Categories grid and regenerate button */}
      <Box sx={{ mb: 2, minHeight: '150px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">Available options:</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRegenerateOptions}
            disabled={loading}
          >
            Show different options
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={1.5}>
            {categories.map((category, index) => (
              <Grid item key={index}>
                <Chip
                  label={category}
                  clickable
                  onClick={() => handleSelectCategory(category)}
                  color="primary"
                  variant={selectedPurpose.endsWith(category) ? "filled" : "outlined"}
                  sx={{ p: 1, height: 'auto' }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      
      {/* System prompt preview for leaf nodes */}
      {isLeaf && systemPrompt && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            This will set the following system prompt:
          </Typography>
          <Paper 
            variant="outlined"
            sx={{ 
              p: 1.5, 
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
              borderRadius: 1,
              maxHeight: '150px',
              overflow: 'auto',
              fontSize: '0.85rem'
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {systemPrompt}
            </Typography>
          </Paper>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleFinalSelection}
            >
              Confirm Selection
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default HierarchicalPurposeSelector; 