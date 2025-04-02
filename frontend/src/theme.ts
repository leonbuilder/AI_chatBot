import { createTheme, ThemeOptions, Theme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Create theme configuration for both light and dark modes
const getThemeOptions = (mode: PaletteMode): ThemeOptions => {
  const baseThemeOptions: ThemeOptions = {
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
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: '16px 24px',
            fontSize: '1.1rem',
            fontWeight: 600,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
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
  };

  // Mode-specific configurations
  if (mode === 'light') {
    return {
      ...baseThemeOptions,
      palette: {
        mode: 'light',
        primary: {
          main: '#2563eb', // Professional blue
          light: '#4b83fb',
          dark: '#1e4ebd',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#64748b', // Slate gray
          light: '#94a3b8',
          dark: '#475569',
          contrastText: '#ffffff',
        },
        error: {
          main: '#ef4444', // Simple red
        },
        background: {
          default: '#f8fafc', // Very light background
          paper: '#ffffff',
        },
        text: {
          primary: '#1e293b', // Darker text
          secondary: '#64748b', // Matching secondary
        },
        divider: '#e2e8f0', // Light divider
      },
      components: {
        ...baseThemeOptions.components,
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
      }
    };
  } else {
    return {
      ...baseThemeOptions,
      palette: {
        mode: 'dark',
        primary: {
          main: '#3b82f6', // Slightly brighter blue for dark mode
          light: '#60a5fa',
          dark: '#2563eb',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#94a3b8', // Lighter slate for dark mode
          light: '#cbd5e1',
          dark: '#64748b',
          contrastText: '#121212',
        },
        error: {
          main: '#f87171', // Brighter red for dark mode
        },
        background: {
          default: '#0f172a', // Dark blue-gray
          paper: '#1e293b', // Slightly lighter
        },
        text: {
          primary: '#f1f5f9', // Light text
          secondary: '#cbd5e1', // Slightly darker
        },
        divider: '#334155', // Darker divider
      },
      components: {
        ...baseThemeOptions.components,
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: '#1e293b',
              borderBottom: '1px solid #334155',
              color: '#f1f5f9'
            }
          },
          defaultProps: {
            elevation: 0,
          }
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              borderRight: '1px solid #334155',
              backgroundColor: '#1e293b',
            }
          }
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: {
              borderBottom: '1px solid #334155',
              padding: '16px 24px',
              fontSize: '1.1rem',
              fontWeight: 600,
            },
          },
        },
        MuiDialogActions: {
          styleOverrides: {
            root: {
              borderTop: '1px solid #334155',
              padding: '16px 24px',
            },
          },
        },
        MuiCssBaseline: {
          styleOverrides: `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  
            body {
              font-family: 'Inter', sans-serif;
              font-size: 15px;
              background-color: #0f172a;
            }
          `,
        },
      }
    };
  }
};

// Function to get the theme based on the mode
export const getTheme = (mode: PaletteMode): Theme => {
  return createTheme(getThemeOptions(mode));
};

// Default export for backwards compatibility
const defaultTheme = createTheme(getThemeOptions('light'));
export default defaultTheme; 