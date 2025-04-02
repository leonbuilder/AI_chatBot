import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors';

// Create a theme instance.
const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // More professional blue
      light: '#4b83fb',
      dark: '#1e4ebd',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b', // Slate gray - more neutral
      light: '#94a3b8',
      dark: '#475569',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444', // Simpler red
    },
    background: {
      default: '#f8fafc', // Very light background
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b', // Darker text for better readability
      secondary: '#64748b', // Matching secondary color
    },
    divider: '#e2e8f0', // Lighter divider
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h5: {
      fontWeight: 600,
      fontSize: '1.3rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    body1: {
      fontSize: '0.95rem',
    },
    button: {
      fontWeight: 500,
      textTransform: 'none', // No uppercase text
    }
  },
  shape: {
    borderRadius: 6, // Slightly smaller for cleaner look
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        body {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          background-color: #f8fafc;
        }
      `,
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          transition: 'background-color 0.15s ease-in-out', // Simpler transition
        },
        containedPrimary: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedSecondary: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlinedPrimary: {
          borderColor: '#d1d5db',
          '&:hover': {
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.04)', // Very subtle
          }
        },
        textPrimary: {
           '&:hover': {
             backgroundColor: 'rgba(37, 99, 235, 0.04)', // Very subtle
           }
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
      defaultProps: {
        elevation: 0,
        variant: 'outlined',
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          color: '#1e293b'
        }
      },
      defaultProps: {
        elevation: 0,
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e2e8f0',
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease-in-out', // Simple transition
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease-in-out', // Simple transition
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
          fontSize: '1.1rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: '1px solid #e2e8f0',
          padding: '16px 24px',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      }
    },
  },
});

export default theme; 