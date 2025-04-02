import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors';

// Create a theme instance.
const theme = createTheme({
  palette: {
    primary: {
      // Let's use a shade of blue
      main: '#1976d2', // Material UI blue 700
      light: '#42a5f5', // Material UI blue 500
      dark: '#1565c0', // Material UI blue 800
      contrastText: '#fff',
    },
    secondary: {
      // Let's use a shade of purple
      main: '#9c27b0', // Material UI purple 500
      light: '#ba68c8', // Material UI purple 300
      dark: '#7b1fa2', // Material UI purple 700
      contrastText: '#fff',
    },
    error: {
      main: red[500], // Use red from colors
    },
    background: {
      default: '#f4f6f8', // A light grey background
      paper: '#ffffff', // White for paper elements
    },
    // You can customize other colors like info, warning, success as well
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    h5: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    // You can customize other variants (body1, button, caption, etc.)
  },
  // Add global component style overrides
  components: {
    MuiButton: {
      styleOverrides: {
        // Apply to all button variants
        root: {
          textTransform: 'none', // Disable uppercase text
          borderRadius: '8px', // Slightly rounder buttons
        },
        // Specific variant overrides
        containedPrimary: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)', // Subtle shadow
          '&:hover': {
            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)', // Slightly raise on hover
          },
        },
        containedSecondary: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          '&:hover': {
            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
          },
        },
        // Add styles for other variants (outlined, text) if needed
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          // Apply a default, very subtle shadow using theme shadows
          // elevation={1} will map to shadows[1]
        },
      },
      defaultProps: {
        elevation: 1, // Set default elevation for Paper to 1 (subtle shadow)
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #e0e0e0', // Add a divider below dialog titles
          paddingBottom: '12px', 
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: '1px solid #e0e0e0', // Add a divider above dialog actions
          paddingTop: '12px',
        },
      },
    },
    // Example: Override TextField
    // MuiTextField: {
    //   defaultProps: {
    //     variant: 'outlined', // Default to outlined variant
    //     size: 'small',       // Default to small size
    //   },
    // },
  },
});

export default theme; 