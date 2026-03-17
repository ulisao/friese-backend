import { useState, useEffect } from 'react';
import { OperatorHome } from './pages/OperatorHome';
import { CreateShipmentData } from './pages/CreateShipmentData';
import { CreateShipmentPhoto } from './pages/CreateShipmentPhoto'; // Importamos la nueva pantalla
import { ActivationScreen } from './pages/ActivationScreen';
import { db } from './db/db';

// El tipo de datos que viene del paso 1
interface ShipmentData {
  email: string;
  lote: string;
  cantidad: number;
  notas: string;
}

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'new-shipment-data' | 'new-shipment-photo'>('home');
  // Acá guardamos temporalmente los datos del formulario hasta tener la foto
  const [tempShipmentData, setTempShipmentData] = useState<ShipmentData | null>(null);

  // Authenticated state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // 1. Check if token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');

        if (urlToken) {
          // Save to IndexedDB
          await db.auth_session.clear(); // Clear previous sessions
          await db.auth_session.add({
            token: urlToken,
            createdAt: Date.now()
          });

          // Remove token from URL for security
          window.history.replaceState({}, document.title, window.location.pathname);
          
          if (isMounted) {
            setIsAuthenticated(true);
          }
        } else {
          // 2. Check IndexedDB
          const session = await db.auth_session.toCollection().last();
          if (isMounted && session?.token) {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleActivate = async (token: string) => {
    try {
      await db.auth_session.clear();
      await db.auth_session.add({
        token,
        createdAt: Date.now()
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Error saving session:", error);
      alert("Error al guardar la sesión.");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ActivationScreen onActivate={handleActivate} />;
  }

  return (
    <div className="app-container">
      {currentView === 'home' && (
        <OperatorHome onNewShipment={() => setCurrentView('new-shipment-data')} />
      )}

      {currentView === 'new-shipment-data' && (
        <CreateShipmentData
          onBack={() => setCurrentView('home')}
          onNext={(data) => {
            setTempShipmentData(data); // Guardamos los datos
            setCurrentView('new-shipment-photo'); // Pasamos al paso 2
          }}
        />
      )}

      {currentView === 'new-shipment-photo' && (
        <CreateShipmentPhoto
          onBack={() => setCurrentView('new-shipment-data')}
          onConfirm={(file) => {
            // ¡Acá tenemos todo! Los datos del formulario y la foto física.
            console.log('Datos del envío:', tempShipmentData);
            console.log('Archivo de la foto:', file);

            alert('¡Flujo completado! Revisá la consola.');
            setCurrentView('home'); // Volvemos al home por ahora
          }}
        />
      )}
    </div>
  );
}

export default App;