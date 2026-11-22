import * as ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.css';
import './styles.scss';
import Main from "./components/Main";
import React from "react";
import createCache from "@emotion/cache";
import {CacheProvider} from "@emotion/react";
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";
import {Provider as JotaiProvider} from "jotai";
import onDocumentReady from './utils/onDocumentReady';

onDocumentReady(() => {
  const div = document.querySelector<HTMLDivElement>('#maindiv');
  if (!div) throw new Error('Missing renderer mount point');
  const cache = createCache({
    key: 'mui',
    container: document.head ?? document.body,
  });
  const theme = createTheme({
    palette: {
      mode: 'dark',
      primary: {main: '#ff5c9d'},
      secondary: {main: '#8b7bff'},
      success: {main: '#3ccf7a'},
      warning: {main: '#ffb547'},
      error: {main: '#ff5a5a'},
      background: {default: '#0e0e13', paper: '#16161d'},
      divider: 'rgba(255,255,255,0.08)',
    },
    shape: {borderRadius: 10},
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h6: {fontSize: '1.05rem', fontWeight: 600, letterSpacing: 0.1},
      subtitle2: {fontWeight: 600},
      button: {fontWeight: 600},
    },
    components: {
      MuiPaper: {styleOverrides: {root: {backgroundImage: 'none'}}},
      MuiAccordion: {
        defaultProps: {disableGutters: true, elevation: 0},
        styleOverrides: {
          root: {
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            marginBottom: 8,
            overflow: 'hidden',
            '&:before': {display: 'none'},
            '&.Mui-expanded': {borderColor: 'rgba(255,92,157,0.35)'},
            '& .MuiAccordion-root': {marginBottom: 0, borderRadius: 10},
          },
        },
      },
      MuiButton: {styleOverrides: {root: {borderRadius: 10}}},
      MuiChip: {styleOverrides: {root: {fontWeight: 500}}},
      MuiToggleButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {backgroundColor: 'rgba(255,92,157,0.16)', color: '#ff8fbd'},
            '&.Mui-selected:hover': {backgroundColor: 'rgba(255,92,157,0.24)'},
          },
        },
      },
      MuiSlider: {styleOverrides: {thumb: {boxShadow: 'none'}}},
    },
  });
  const root = ReactDOM.createRoot(div);
  root.render(React.createElement(
      CacheProvider,
      {value: cache},
      React.createElement(JotaiProvider,
          null,
          React.createElement(
              ThemeProvider,
              {theme},
              React.createElement(CssBaseline),
              React.createElement(Main),
          ),
      ),
  ));
});
