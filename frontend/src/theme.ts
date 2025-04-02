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
  // You can also customize components globally
  // components: {
  //   MuiButton: {
  //     styleOverrides: {
  //       root: {
  //         textTransform: 'none', // Example: disable uppercase buttons
  //       },
  //     },
  //   },
  // },
});

export default theme; 