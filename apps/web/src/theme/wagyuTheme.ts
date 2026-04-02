'use client';

import { createTheme, alpha } from '@mui/material/styles';

// Zen Brutalist Luxury Color Palette
const zenColors = {
  // Indigo Dye (藍染)
  indigoDeep: '#0A1628',
  indigoRich: '#1A2744',
  indigoMid: '#2D3E5F',
  indigoSoft: '#4A5A7A',

  // Washi Paper (和紙)
  washiCream: '#F7F3EB',
  washiWarm: '#EDE6D6',
  washiMuted: '#D4CFC3',
  washiDark: '#A39E8F',

  // Copper (銅)
  copperBright: '#D4A574',
  copperRich: '#B8956A',
  copperDeep: '#8B7355',

  // Sumi Ink (墨)
  sumiBlack: '#0D0D0D',
  sumiCharcoal: '#1A1A1A',
};

const statusColors = {
  success: '#6EBF8B',
  warning: '#E4A853',
  error: '#D66853',
  info: '#6BA3D6',
  buyer: '#6BA3D6',
  producer: '#6EBF8B',
};

export const wagyuTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: zenColors.copperBright,
      light: zenColors.copperBright,
      dark: zenColors.copperDeep,
      contrastText: zenColors.sumiBlack,
    },
    secondary: {
      main: zenColors.indigoMid,
      light: zenColors.indigoSoft,
      dark: zenColors.indigoRich,
      contrastText: zenColors.washiCream,
    },
    background: {
      default: zenColors.indigoDeep,
      paper: zenColors.indigoRich,
    },
    text: {
      primary: zenColors.washiCream,
      secondary: zenColors.washiMuted,
      disabled: zenColors.indigoSoft,
    },
    success: {
      main: statusColors.success,
      contrastText: zenColors.sumiBlack,
    },
    warning: {
      main: statusColors.warning,
      contrastText: zenColors.sumiBlack,
    },
    error: {
      main: statusColors.error,
      contrastText: '#FFFFFF',
    },
    info: {
      main: statusColors.info,
      contrastText: '#FFFFFF',
    },
    divider: alpha(zenColors.washiCream, 0.08),
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    h1: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.15,
    },
    h3: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 600,
      letterSpacing: '0',
      lineHeight: 1.2,
    },
    h4: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h5: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h6: {
      fontFamily: "'Shippori Mincho', serif",
      fontWeight: 600,
      lineHeight: 1.35,
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: '0.01em',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontWeight: 500,
      letterSpacing: '0.01em',
      lineHeight: 1.5,
    },
    body1: {
      lineHeight: 1.65,
      letterSpacing: '0.01em',
    },
    body2: {
      lineHeight: 1.6,
      letterSpacing: '0.01em',
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    caption: {
      fontSize: '0.75rem',
      letterSpacing: '0.02em',
      lineHeight: 1.5,
    },
    overline: {
      fontWeight: 600,
      letterSpacing: '0.15em',
      fontSize: '0.6875rem',
      color: zenColors.copperBright,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 8px rgba(0, 0, 0, 0.25)',
    '0 4px 12px rgba(0, 0, 0, 0.3)',
    '0 8px 24px rgba(0, 0, 0, 0.35)',
    '0 12px 32px rgba(0, 0, 0, 0.4)',
    '0 16px 48px rgba(0, 0, 0, 0.45)',
    '0 20px 56px rgba(0, 0, 0, 0.5)',
    '0 24px 64px rgba(0, 0, 0, 0.5)',
    '0 28px 72px rgba(0, 0, 0, 0.55)',
    '0 32px 80px rgba(0, 0, 0, 0.55)',
    '0 36px 88px rgba(0, 0, 0, 0.6)',
    '0 40px 96px rgba(0, 0, 0, 0.6)',
    '0 44px 104px rgba(0, 0, 0, 0.65)',
    '0 48px 112px rgba(0, 0, 0, 0.65)',
    '0 52px 120px rgba(0, 0, 0, 0.7)',
    '0 56px 128px rgba(0, 0, 0, 0.7)',
    '0 60px 136px rgba(0, 0, 0, 0.75)',
    '0 64px 144px rgba(0, 0, 0, 0.75)',
    '0 68px 152px rgba(0, 0, 0, 0.8)',
    '0 72px 160px rgba(0, 0, 0, 0.8)',
    '0 76px 168px rgba(0, 0, 0, 0.85)',
    '0 80px 176px rgba(0, 0, 0, 0.85)',
    '0 84px 184px rgba(0, 0, 0, 0.9)',
    '0 88px 192px rgba(0, 0, 0, 0.9)',
    '0 92px 200px rgba(0, 0, 0, 0.95)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${zenColors.indigoMid} ${zenColors.indigoDeep}`,
          '&::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: zenColors.indigoDeep,
          },
          '&::-webkit-scrollbar-thumb': {
            background: zenColors.indigoMid,
            borderRadius: 9999,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: zenColors.copperBright,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 24px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${zenColors.copperBright} 0%, ${zenColors.copperRich} 100%)`,
          color: zenColors.sumiBlack,
          boxShadow: `0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 32px ${alpha(zenColors.copperBright, 0.15)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${zenColors.copperBright} 0%, ${zenColors.copperDeep} 100%)`,
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px rgba(0, 0, 0, 0.35), 0 0 40px ${alpha(zenColors.copperBright, 0.3)}`,
          },
        },
        containedSuccess: {
          background: `linear-gradient(135deg, ${statusColors.success} 0%, #5A9E73 100%)`,
          color: zenColors.sumiBlack,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px rgba(0, 0, 0, 0.35), 0 0 30px ${alpha(statusColors.success, 0.25)}`,
          },
        },
        containedError: {
          background: `linear-gradient(135deg, ${statusColors.error} 0%, #B85545 100%)`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 24px rgba(0, 0, 0, 0.35), 0 0 30px ${alpha(statusColors.error, 0.25)}`,
          },
        },
        outlined: {
          borderColor: alpha(zenColors.washiCream, 0.15),
          color: zenColors.washiMuted,
          '&:hover': {
            borderColor: zenColors.copperBright,
            color: zenColors.copperBright,
            background: alpha(zenColors.copperBright, 0.08),
          },
        },
        text: {
          color: zenColors.washiMuted,
          '&:hover': {
            color: zenColors.copperBright,
            background: alpha(zenColors.copperBright, 0.08),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: zenColors.indigoRich,
          border: `1px solid ${alpha(zenColors.washiCream, 0.08)}`,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${alpha(zenColors.washiCream, 0.02)} 0%, transparent 50%)`,
            pointerEvents: 'none',
          },
          '&:hover': {
            borderColor: alpha(zenColors.washiCream, 0.15),
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
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
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: zenColors.indigoRich,
            borderRadius: 8,
            transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            '& fieldset': {
              borderColor: alpha(zenColors.washiCream, 0.08),
            },
            '&:hover fieldset': {
              borderColor: alpha(zenColors.washiCream, 0.15),
            },
            '&.Mui-focused': {
              background: zenColors.indigoRich,
              '& fieldset': {
                borderColor: zenColors.copperBright,
                boxShadow: `0 0 0 3px ${alpha(zenColors.copperBright, 0.12)}`,
              },
            },
          },
          '& .MuiInputLabel-root': {
            color: zenColors.indigoSoft,
            '&.Mui-focused': {
              color: zenColors.copperBright,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          background: zenColors.indigoRich,
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        },
        filled: {
          border: '1px solid transparent',
        },
        outlined: {
          borderColor: alpha(zenColors.washiCream, 0.15),
        },
        colorPrimary: {
          background: alpha(zenColors.copperBright, 0.12),
          color: zenColors.copperBright,
          borderColor: alpha(zenColors.copperBright, 0.3),
        },
        colorSuccess: {
          background: alpha(statusColors.success, 0.12),
          color: statusColors.success,
          borderColor: alpha(statusColors.success, 0.25),
        },
        colorInfo: {
          background: alpha(statusColors.info, 0.12),
          color: statusColors.info,
          borderColor: alpha(statusColors.info, 0.25),
        },
        colorWarning: {
          background: alpha(statusColors.warning, 0.12),
          color: statusColors.warning,
          borderColor: alpha(statusColors.warning, 0.25),
        },
        colorError: {
          background: alpha(statusColors.error, 0.12),
          color: statusColors.error,
          borderColor: alpha(statusColors.error, 0.25),
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 4,
          borderRadius: 9999,
          background: alpha(zenColors.washiCream, 0.08),
        },
        bar: {
          borderRadius: 9999,
          background: `linear-gradient(90deg, ${zenColors.copperDeep}, ${zenColors.copperBright}, ${zenColors.copperBright})`,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: zenColors.copperBright,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(zenColors.washiCream, 0.05),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: zenColors.indigoMid,
          border: `1px solid ${alpha(zenColors.copperBright, 0.2)}`,
          borderRadius: 6,
          fontSize: '0.75rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        },
        arrow: {
          color: zenColors.indigoMid,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha(zenColors.indigoDeep, 0.85),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(zenColors.washiCream, 0.08)}`,
          boxShadow: 'none',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: zenColors.washiMuted,
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            color: zenColors.copperBright,
            background: alpha(zenColors.copperBright, 0.1),
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid',
        },
        standardSuccess: {
          background: alpha(statusColors.success, 0.12),
          borderColor: alpha(statusColors.success, 0.25),
          color: statusColors.success,
        },
        standardError: {
          background: alpha(statusColors.error, 0.12),
          borderColor: alpha(statusColors.error, 0.25),
          color: statusColors.error,
        },
        standardWarning: {
          background: alpha(statusColors.warning, 0.12),
          borderColor: alpha(statusColors.warning, 0.25),
          color: statusColors.warning,
        },
        standardInfo: {
          background: alpha(statusColors.info, 0.12),
          borderColor: alpha(statusColors.info, 0.25),
          color: statusColors.info,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          border: 'none',
          color: zenColors.washiMuted,
          padding: '8px 16px',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          transition: 'all 200ms ease',
          '&:hover': {
            background: alpha(zenColors.copperBright, 0.08),
            color: zenColors.copperBright,
          },
          '&.Mui-selected': {
            background: alpha(zenColors.copperBright, 0.15),
            color: zenColors.copperBright,
            '&:hover': {
              background: alpha(zenColors.copperBright, 0.2),
            },
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          background: alpha(zenColors.indigoMid, 0.5),
          borderRadius: 8,
          padding: 4,
          gap: 4,
          '& .MuiToggleButtonGroup-grouped': {
            margin: 0,
            border: 'none',
            borderRadius: '6px !important',
          },
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          background: `linear-gradient(90deg, ${zenColors.indigoMid} 25%, ${zenColors.indigoSoft} 50%, ${zenColors.indigoMid} 75%)`,
          backgroundSize: '200% 100%',
        },
      },
    },
  },
});

