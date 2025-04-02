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
  useTheme,
  Stack,
  Pagination
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
  const [currentSection, setCurrentSection] = useState(1);
  const [totalSections, setTotalSections] = useState(5); // A reasonable default max number of sections
  
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

  const fetchCategories = async (path: string[], section = currentSection) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<PurposeCategoryResponse>('/api/purpose-categories', {
        path,
        section
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
    // Reset to section 1 when navigating to a new category
    setCurrentSection(1);
    fetchCategories(newPath, 1);
  };

  const handleClickBreadcrumb = (index: number) => {
    // If clicking "Home", reset to empty path
    if (index === -1) {
      setCurrentPath([]);
      setSelectedPurpose('');
      onChange('');
      // Reset to section 1 when navigating home
      setCurrentSection(1);
      fetchCategories([], 1);
      return;
    }
    
    // Otherwise, navigate to the selected level
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    const newPurpose = newPath.join(' > ');
    setSelectedPurpose(newPurpose);
    onChange(newPurpose);
    // Reset to section 1 when navigating via breadcrumbs
    setCurrentSection(1);
    fetchCategories(newPath, 1);
  };

  const handleFinalSelection = () => {
    if (systemPrompt) {
      onChange(selectedPurpose, systemPrompt);
    }
  };

  const handleNextSection = () => {
    // Go to the next section or loop back to section 1
    const nextSection = currentSection >= totalSections ? 1 : currentSection + 1;
    setCurrentSection(nextSection);
    fetchCategories(currentPath, nextSection);
  };

  const handleSectionChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentSection(value);
    fetchCategories(currentPath, value);
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
      
      {/* Categories grid and section navigation */}
      <Box sx={{ mb: 2, minHeight: '150px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">Options (Section {currentSection} of {totalSections}):</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleNextSection}
            disabled={loading}
          >
            Show Section {currentSection >= totalSections ? 1 : currentSection + 1}
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
        
        {/* Section pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination 
            count={totalSections} 
            page={currentSection}
            onChange={handleSectionChange}
            size="small"
            color="primary"
            disabled={loading}
          />
        </Box>
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