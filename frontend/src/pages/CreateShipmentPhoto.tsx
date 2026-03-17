// src/pages/CreateShipmentPhoto.tsx
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, RefreshCcw, CheckCircle2 } from 'lucide-react';

interface Props {
  onBack: () => void;
  onConfirm: (file: File) => void;
}

export const CreateShipmentPhoto = ({ onBack, onConfirm }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abrir cámara automáticamente al entrar si no hay foto
  useEffect(() => {
    if (!previewUrl && inputRef.current) {
      // Pequeño timeout para asegurar que el input esté renderizado y montado
      setTimeout(() => inputRef.current?.click(), 100);
    }
    
    // Cleanup de la URL al desmontar
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
    // Limpiamos el input para que detecte si se vuelve a sacar la misma foto
    e.target.value = '';
  };

  const handleRetake = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    // Disparamos la cámara de nuevo
    setTimeout(() => inputRef.current?.click(), 100);
  };

  const handleSave = () => {
    if (file) {
      onConfirm(file);
    }
  };

  const handleBack = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onBack();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-black px-4 py-4 flex items-center justify-between sticky top-0 z-20">
        <button onClick={handleBack} className="p-2 -ml-2 text-white hover:text-gray-300 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">Evidencia</h2>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col relative justify-center">
        {/*
          Input oculto nativo:
          capture="environment": Fuerza a abrir la cámara trasera
          accept="image/*":  Acepta imágenes
        */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={inputRef}
          onChange={handleCapture}
          className="hidden"
        />

        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-white h-full relative z-10">
             <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <Camera size={48} className="text-gray-400" />
             </div>
             <p className="text-gray-400 mb-8 max-w-xs">
                Se abrirá la cámara de tu dispositivo para capturar la evidencia.
             </p>
             <button 
               onClick={() => inputRef.current?.click()}
               className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-transform"
             >
               Tomar Foto Manualmente
             </button>
          </div>
        ) : (
          <div className="relative flex-1 bg-black overflow-hidden flex flex-col">
            <div className="flex-1 relative">
              <img
                src={previewUrl}
                alt="Captura"
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            </div>
            
            {/* Controles Inferiores */}
            <div className="bg-black pb-8 pt-6 px-6 z-10 shrink-0">
              <div className="flex gap-4 h-24 items-center">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-4 flex items-center justify-center gap-2 bg-gray-800 text-white rounded-xl font-bold active:scale-95 transition-all"
                >
                  <RefreshCcw size={20} />
                  Rehacer
                </button>

                <button
                  onClick={handleSave}
                  className="flex-[2] py-4 flex items-center justify-center gap-2 bg-emerald-500 text-white rounded-xl font-bold active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 size={20} />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};