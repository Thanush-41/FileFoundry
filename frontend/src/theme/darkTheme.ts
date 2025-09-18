import { createTheme, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    customColors: {
      darkBackground: string;
      lightBackground: string;
      border: string;
      hoverBackground: string;
      textPrimary: string;
      textSecondary: string;
    };
  }
  interface ThemeOptions {
    customColors?: {
      darkBackground?: string;
      lightBackground?: string;
      border?: string;
      hoverBackground?: string;
      textPrimary?: string;
      textSecondary?: string;
    };
  }
}

const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
      contrastText: '#000000',
    },
    secondary: {
      main: '#666666',
      light: '#888888',
      dark: '#444444',
      contrastText: '#ffffff',
    },
    background: {
      default: '#000000',
      paper: '#111111',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
    },
    divider: '#333333',
    error: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
    },
    warning: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
    },
    info: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
    },
    success: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
    },
  },
  customColors: {
    darkBackground: '#000000',
    lightBackground: '#111111',
    border: '#333333',
    hoverBackground: '#1a1a1a',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#ffffff',
    },
    body1: {
      fontSize: '1rem',
      color: '#ffffff',
    },
    body2: {
      fontSize: '0.875rem',
      color: '#cccccc',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#000000',
          color: '#ffffff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          borderBottom: '1px solid #333333',
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
          border: '1px solid #333333',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
          border: '1px solid #333333',
          borderRadius: '8px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          backgroundColor: '#ffffff',
          color: '#000000',
          boxShadow: '0 2px 8px rgba(255, 255, 255, 0.15)',
          '&:hover': {
            backgroundColor: '#e0e0e0',
            boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2)',
          },
        },
        outlined: {
          borderColor: '#333333',
          color: '#ffffff',
          '&:hover': {
            borderColor: '#ffffff',
            backgroundColor: '#1a1a1a',
          },
        },
        text: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#111111',
            '& fieldset': {
              borderColor: '#333333',
            },
            '&:hover fieldset': {
              borderColor: '#666666',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ffffff',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#cccccc',
            '&.Mui-focused': {
              color: '#ffffff',
            },
          },
          '& .MuiInputBase-input': {
            color: '#ffffff',
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
          border: '1px solid #333333',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#333333',
          color: '#ffffff',
        },
        head: {
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontWeight: 600,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
          '&:nth-of-type(odd)': {
            backgroundColor: '#0f0f0f',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          color: '#ffffff',
          border: '1px solid #666666',
        },
        outlined: {
          borderColor: '#666666',
          color: '#ffffff',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '& .MuiTab-root': {
            color: '#cccccc',
            '&.Mui-selected': {
              color: '#ffffff',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#111111',
          border: '1px solid #333333',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          borderBottom: '1px solid #333333',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#111111',
          border: '1px solid #333333',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#000000',
          '&:hover': {
            backgroundColor: '#e0e0e0',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#000000',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
          color: '#ffffff',
          border: '1px solid #333333',
        },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        root: {
          '& .MuiBreadcrumbs-separator': {
            color: '#666666',
          },
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
};

export const darkTheme = createTheme(darkThemeOptions);