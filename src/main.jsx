// Starts the React app inside <div id="root"> in index.html.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './shared/styles.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
