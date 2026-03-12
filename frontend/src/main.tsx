import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registramos el Service Worker
registerSW({
  onNeedRefresh() {
    // Acá podrías mostrar un Toast en el futuro que diga "Hay una nueva actualización. Recargar."
    console.log('Hay nuevo contenido disponible, por favor recarga la página.');
  },
  onOfflineReady() {
    // Esto significa que el App Shell ya se descargó y la app sobrevive sin internet
    console.log('La aplicación ya está lista para usarse sin conexión a internet.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);