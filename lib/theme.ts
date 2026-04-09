import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b5cf6',
      light: '#a78bfa',
      dark: '#7c3aed',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0d0f14',
      paper: '#161b27',
    },
    divider: 'rgba(42,49,66,0.8)',
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
      disabled: '#475569',
    },
    error:   { main: '#f87171' },
    warning: { main: '#fbbf24' },
    info:    { main: '#38bdf8' },
    success: { main: '#34d399' },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    h1: { fontWeight: 700, letterSpacing: '-0.5px' },
    h2: { fontWeight: 700, letterSpacing: '-0.5px' },
    h3: { fontWeight: 600, letterSpacing: '-0.4px' },
    h4: { fontWeight: 600, letterSpacing: '-0.3px' },
    h5: { fontWeight: 600, letterSpacing: '-0.2px' },
    h6: { fontWeight: 600, letterSpacing: '-0.1px' },
    body1: { letterSpacing: '0px' },
    body2: { letterSpacing: '0px' },
    caption: { color: '#64748b' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'img, svg, video': { transition: 'none !important' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
          transition: 'background 120ms ease, box-shadow 120ms ease, transform 80ms ease',
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0px)' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(99,102,241,0.5)',
          '&:hover': {
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          backgroundColor: '#161b27',
          border: '1px solid rgba(42,49,66,0.6)',
          transition: 'box-shadow 120ms ease',
        },
        elevation8: {
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(22,27,39,0.88)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        },
        elevation24: {
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(22,27,39,0.92)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderRight: '1px solid rgba(42,49,66,0.6)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13,15,20,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(42,49,66,0.6)',
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '0 8px 8px 0',
          marginRight: 8,
          transition: 'background-color 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(99,102,241,0.08)',
            '& .MuiListItemIcon-root': { transform: 'translateX(2px)', color: '#818cf8' },
          },
          '& .MuiListItemIcon-root': {
            transition: 'transform 120ms ease, color 120ms ease',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(99,102,241,0.14)',
            borderLeft: '3px solid #6366f1',
            paddingLeft: '13px',
            '& .MuiListItemIcon-root': { color: '#818cf8' },
            '& .MuiListItemText-primary': { color: '#818cf8', fontWeight: 600 },
            '&:hover': { backgroundColor: 'rgba(99,102,241,0.18)' },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          transition: 'box-shadow 120ms ease',
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(99,102,241,0.18)',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(42,49,66,0.9)',
            transition: 'border-color 120ms ease',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(99,102,241,0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#6366f1',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          '&.MuiInput-root::after': { borderColor: '#6366f1' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          transition: 'background-color 120ms ease, box-shadow 120ms ease',
          fontWeight: 500,
        },
        filled: { backgroundColor: '#1e2433' },
        outlined: { borderColor: 'rgba(42,49,66,0.9)' },
        colorPrimary: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
          },
        },
        colorSecondary: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(139,92,246,0.15)',
            color: '#a78bfa',
          },
        },
        colorWarning: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(251,191,36,0.12)',
            color: '#fbbf24',
          },
          '&.MuiChip-outlined': {
            borderColor: 'rgba(251,191,36,0.4)',
            color: '#fbbf24',
          },
        },
        colorInfo: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(56,189,248,0.12)',
            color: '#38bdf8',
          },
          '&.MuiChip-outlined': {
            borderColor: 'rgba(56,189,248,0.4)',
            color: '#38bdf8',
          },
        },
        colorSuccess: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(52,211,153,0.12)',
            color: '#34d399',
          },
        },
        colorError: {
          '&.MuiChip-filled': {
            backgroundColor: 'rgba(248,113,113,0.12)',
            color: '#f87171',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(42,49,66,0.8)',
          color: '#94a3b8',
          transition: 'background-color 120ms ease, color 120ms ease',
          '&:hover': { backgroundColor: 'rgba(99,102,241,0.08)', color: '#e2e8f0' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            borderColor: 'rgba(99,102,241,0.4)',
            '&:hover': { backgroundColor: 'rgba(99,102,241,0.22)' },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          '& .MuiToggleButtonGroup-grouped': {
            borderColor: 'rgba(42,49,66,0.8)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(42,49,66,0.6)' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, border: '1px solid' },
        standardError:   { backgroundColor: 'rgba(248,113,113,0.08)',  borderColor: 'rgba(248,113,113,0.25)' },
        standardWarning: { backgroundColor: 'rgba(251,191,36,0.08)',   borderColor: 'rgba(251,191,36,0.25)'  },
        standardSuccess: { backgroundColor: 'rgba(52,211,153,0.08)',   borderColor: 'rgba(52,211,153,0.25)'  },
        standardInfo:    { backgroundColor: 'rgba(56,189,248,0.08)',   borderColor: 'rgba(56,189,248,0.25)'  },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(255,255,255,0.05)' },
        wave: {
          '&::after': {
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e2433',
          border: '1px solid rgba(42,49,66,0.8)',
          fontSize: 12,
          borderRadius: 6,
        },
        arrow: { color: '#1e2433' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#161b27',
          border: '1px solid rgba(42,49,66,0.7)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#1e2433',
          border: '1px solid rgba(42,49,66,0.8)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          borderRadius: 8,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          mx: 0.5,
          transition: 'background-color 100ms ease',
          '&:hover': { backgroundColor: 'rgba(99,102,241,0.1)' },
          '&.Mui-selected': {
            backgroundColor: 'rgba(99,102,241,0.14)',
            '&:hover': { backgroundColor: 'rgba(99,102,241,0.2)' },
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { backgroundColor: '#1e2433' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 100ms ease, color 100ms ease',
          '&:hover': { backgroundColor: 'rgba(99,102,241,0.1)' },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
            boxShadow: '0 6px 28px rgba(99,102,241,0.5)',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#64748b' },
      },
    },
    MuiCircularProgress: {
      defaultProps: { color: 'primary' },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(99,102,241,0.15)' },
        bar: { background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' },
      },
    },
  },
});

export default theme;
