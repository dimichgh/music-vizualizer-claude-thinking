import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './components/app';

// Import global styles if needed
import './styles.css';

function render() {
  const root = ReactDOM.createRoot(document.getElementById('app') as HTMLElement);
  root.render(<App />);
}

// Initialize renderer
render();