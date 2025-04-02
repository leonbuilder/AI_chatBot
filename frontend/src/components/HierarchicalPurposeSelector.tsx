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
  Pagination,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tooltip
} from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../constants';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import FolderIcon from '@mui/icons-material/Folder';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import CodeIcon from '@mui/icons-material/Code';
import CreateIcon from '@mui/icons-material/Create';
import SchoolIcon from '@mui/icons-material/School';
import BusinessIcon from '@mui/icons-material/Business';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ScienceIcon from '@mui/icons-material/Science';
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import MemoryIcon from '@mui/icons-material/Memory';
import SaveIcon from '@mui/icons-material/Save';
import BookmarkIcon from '@mui/icons-material/Bookmark';

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

// Icon mapping for different category types
const categoryIcons: { [key: string]: React.ReactElement } = {
  'Programmer': <CodeIcon fontSize="small" />,
  'Writer': <CreateIcon fontSize="small" />,
  'Academic': <SchoolIcon fontSize="small" />,
  'Business': <BusinessIcon fontSize="small" />,
  'Creative': <MusicNoteIcon fontSize="small" />,
  'Science': <ScienceIcon fontSize="small" />,
  'Personal': <PersonIcon fontSize="small" />,
  'Education': <SchoolIcon fontSize="small" />,
  'AI': <MemoryIcon fontSize="small" />,
  'Custom': <StarIcon fontSize="small" />
};

// Helper function to get icon for a category
const getCategoryIcon = (category: string): React.ReactElement => {
  // Check for exact matches
  if (categoryIcons[category]) {
    return categoryIcons[category];
  }
  
  // Check for partial matches (e.g. if category contains 'Business')
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (category.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  
  // Default icon
  return <FolderIcon fontSize="small" />;
};

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

interface CustomCategory {
  name: string;
  systemPrompt: string;
}

const HierarchicalPurposeSelector: React.FC<HierarchicalPurposeSelectorProps> = ({
  onChange,
  currentPurpose
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<string>(currentPurpose || '');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isLeaf, setIsLeaf] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);
  const [totalSections, setTotalSections] = useState(5); // A reasonable default max number of sections
  const [searchQuery, setSearchQuery] = useState('');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [openCustomDialog, setOpenCustomDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPrompt, setNewCategoryPrompt] = useState('');
  
  // Load custom categories from localStorage on initial load
  useEffect(() => {
    const savedCategories = localStorage.getItem('customPurposeCategories');
    if (savedCategories) {
      try {
        setCustomCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error('Failed to parse custom categories from localStorage');
      }
    }
  }, []);

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

  // Filter categories based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCategories(categories);
      return;
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = categories.filter(
      category => category.toLowerCase().includes(lowerQuery)
    );
    setFilteredCategories(filtered);
  }, [searchQuery, categories]);

  const fetchCategories = async (path: string[], section = currentSection) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<PurposeCategoryResponse>('/api/purpose-categories', {
        path,
        section
      });

      let allCategories = [...(response.data.categories || [])];
      
      // Add custom categories to top-level only
      if (path.length === 0) {
        // Only add custom categories that aren't already in the list
        const customCats = customCategories.map(cc => cc.name);
        const uniqueCustomCats = customCats.filter(name => !allCategories.includes(name));
        allCategories = [...allCategories, ...uniqueCustomCats];
      }
      
      setCategories(allCategories);
      setFilteredCategories(allCategories);
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
      setFilteredCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (category: string) => {
    // Check if it's a custom category
    const customCategory = customCategories.find(cc => cc.name === category);
    
    if (customCategory) {
      // If it's a custom category, treat it as a leaf node
      const newPath = [customCategory.name];
      setCurrentPath(newPath);
      const newPurpose = newPath.join(' > ');
      setSelectedPurpose(newPurpose);
      onChange(newPurpose);
      setIsLeaf(true);
      setSystemPrompt(customCategory.systemPrompt);
      setCategories([]);
      setFilteredCategories([]);
    } else {
      // Regular category navigation
      const newPath = [...currentPath, category];
      setCurrentPath(newPath);
      const newPurpose = newPath.join(' > ');
      setSelectedPurpose(newPurpose);
      onChange(newPurpose);
      // Reset to section 1 when navigating to a new category
      setCurrentSection(1);
      fetchCategories(newPath, 1);
    }
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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleOpenCustomDialog = () => {
    setOpenCustomDialog(true);
    setNewCategoryName('');
    setNewCategoryPrompt('');
  };

  const handleCloseCustomDialog = () => {
    setOpenCustomDialog(false);
  };

  const handleSaveCustomCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCustomCategory: CustomCategory = {
      name: newCategoryName.trim(),
      systemPrompt: newCategoryPrompt.trim() || `You are an AI assistant specializing in ${newCategoryName.trim()}.`
    };
    
    const updatedCategories = [...customCategories, newCustomCategory];
    setCustomCategories(updatedCategories);
    
    // Save to localStorage
    localStorage.setItem('customPurposeCategories', JSON.stringify(updatedCategories));
    
    // Close dialog
    setOpenCustomDialog(false);
    
    // If we're at the top level, refresh categories to include the new custom category
    if (currentPath.length === 0) {
      fetchCategories([], currentSection);
    }
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
      
      {/* Search and Add Custom Category */}
      <Box sx={{ display: 'flex', mb: 2, gap: 1 }}>
        <TextField
          size="small"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={handleSearchChange}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title="Create custom category">
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenCustomDialog}
          >
            Custom
          </Button>
        </Tooltip>
      </Box>
      
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
            {filteredCategories.map((category, index) => {
              const isCustom = customCategories.some(cc => cc.name === category);
              return (
                <Grid item key={index}>
                  <Chip
                    icon={isCustom ? <BookmarkIcon /> : getCategoryIcon(category)}
                    label={category}
                    clickable
                    onClick={() => handleSelectCategory(category)}
                    color="primary"
                    variant={selectedPurpose.endsWith(category) ? "filled" : "outlined"}
                    sx={{ p: 1, height: 'auto' }}
                  />
                </Grid>
              );
            })}
            {filteredCategories.length === 0 && !loading && (
              <Box sx={{ p: 2, width: '100%', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'No matching categories found.' : 'No categories available.'}
                </Typography>
              </Box>
            )}
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

      {/* Custom Category Dialog */}
      <Dialog open={openCustomDialog} onClose={handleCloseCustomDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create Custom Purpose Category</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Category Name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Legal Assistant, Recipe Creator"
            />
            <TextField
              fullWidth
              label="System Prompt"
              value={newCategoryPrompt}
              onChange={(e) => setNewCategoryPrompt(e.target.value)}
              placeholder="Instructions for the AI in this category..."
              multiline
              rows={4}
              helperText="Define how the AI should behave for this purpose"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCustomDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveCustomCategory} 
            variant="contained" 
            color="primary"
            startIcon={<SaveIcon />}
            disabled={!newCategoryName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HierarchicalPurposeSelector; 