import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './workspace-layout.css';
import './auth-theme.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
