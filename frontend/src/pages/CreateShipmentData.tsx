import { useState } from 'react';
import { ArrowLeft, Mail, Hash, PackageOpen, AlignLeft, ChevronRight, Minus, Plus } from 'lucide-react';

// Definimos qué datos va a escupir este formulario cuando sea válido
interface ShipmentData {
  email: string;
  lote: string;
  cantidad: number;
  notas: string;
}

interface Props {
  onNext: (data: ShipmentData) => void;
  onBack: () => void;
}

export const CreateShipmentData = ({ onNext, onBack }: Props) => {
  const [email, setEmail] = useState('');
  const [lote, setLote] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    // Validación manual antes de avanzar
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, ingresá un email válido para el destinatario.');
      return;
    }
    if (!lote.trim()) {
      setError('El número de lote es obligatorio.');
      return;
    }
    if (cantidad < 1) {
      setError('La cantidad de bultos debe ser al menos 1.');
      return;
    }

    setError(''); // Limpiamos errores
    onNext({ email, lote, cantidad, notas });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      {/* Header con navegación */}
      <header className="bg-white px-4 py-4 border-b flex items-center justify-between sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Nuevo Envío</h2>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paso 1 de 2: Datos</p>
        </div>
        <div className="w-10" /* Espaciador invisible para centrar el título */ />
      </header>

      {/* Formulario */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        
        {/* Campo: Email */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 ml-1">Email del Destinatario *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Mail size={20} />
            </div>
            <input
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Campo: Lote (Selector / Texto) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 ml-1">Número de Lote *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Hash size={20} />
            </div>
            <input
              type="text"
              placeholder="Ej: LOTE-2026-A"
              value={lote}
              onChange={(e) => setLote(e.target.value.toUpperCase())} // Forzamos mayúsculas
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm uppercase"
            />
          </div>
        </div>

        {/* Campo: Cantidad de Bultos (Stepper para minimizar tipeo) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 ml-1">Cantidad de Bultos *</label>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCantidad(prev => Math.max(1, prev - 1))}
              className="p-4 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-95 transition-all shadow-sm"
            >
              <Minus size={20} />
            </button>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <PackageOpen size={20} />
              </div>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                className="w-full text-center pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={() => setCantidad(prev => prev + 1)}
              className="p-4 bg-gray-900 border border-gray-900 rounded-xl text-white hover:bg-black active:scale-95 transition-all shadow-sm"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Campo: Notas Opcionales */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 ml-1">Notas (Opcional)</label>
          <div className="relative">
            <div className="absolute top-3 left-3 pointer-events-none text-gray-400">
              <AlignLeft size={20} />
            </div>
            <textarea
              rows={3}
              placeholder="Ej: Cuidado, frágil..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm resize-none"
            />
          </div>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-xl animate-pulse">
            {error}
          </div>
        )}

      </main>

      {/* Footer Fijo con el Botón de Avanzar */}
      <footer className="bg-white p-4 border-t sticky bottom-0 z-10">
        <button 
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-4 rounded-xl text-lg font-semibold shadow-lg transition-transform active:scale-[0.98]"
        >
          <span>Siguiente: Subir Evidencia</span>
          <ChevronRight size={20} />
        </button>
      </footer>
    </div>
  );
};