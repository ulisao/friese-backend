import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Camera, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ActivationScreenProps {
  onActivate: (token: string) => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivate }) => {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (text: string) => {
    try {
      let tokenToSave = text;
      
      // Si escaneó una URL, intentamos extraer el token (asumiendo formato ?token=...)
      if (text.startsWith('http')) {
        const url = new URL(text);
        const urlToken = url.searchParams.get('token');
        if (urlToken) {
          tokenToSave = urlToken;
        } else {
          throw new Error('QR inválido: No se encontró el token de activación.');
        }
      }

      // Si es un JWT válido o similar
      if (tokenToSave) {
        onActivate(tokenToSave);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el QR.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center text-center">
        
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Camera className="w-8 h-8 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Activar Dispositivo
        </h1>
        <p className="text-gray-600 mb-8 line-clamp-3">
          Por favor, escaneá el código QR provisto por tu administrador para vincular este dispositivo a tu cuenta de operario.
        </p>

        <div className="w-full aspect-square rounded-xl overflow-hidden bg-black relative mb-6">
          <Scanner
            onScan={(result) => {
              if (result && result.length > 0) {
                handleScan(result[0].rawValue);
              }
            }}
            onError={(err) => {
              console.error(err);
              setError('No se pudo acceder a la cámara o el QR es inválido.');
            }}
          />
        </div>

        {error ? (
          <div className="flex items-start gap-3 bg-red-50 text-red-700 p-4 rounded-lg w-full text-left">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Listo para escanear</span>
          </div>
        )}

      </div>
    </div>
  );
};
