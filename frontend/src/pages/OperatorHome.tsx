import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PackagePlus, Wifi, WifiOff, CheckCircle2, CloudUpload } from 'lucide-react';

interface Props {
  onNewShipment: () => void;
}

export const OperatorHome = ({ onNewShipment }: Props) => {
  const pendingShipmentsCount = useLiveQuery(() => db.pending_shipments.count()) || 0;
  const pendingEvidenceCount = useLiveQuery(() => db.pending_evidence.count()) || 0;
  
  const totalPending = pendingShipmentsCount + pendingEvidenceCount;
  const isOfflineMode = totalPending > 0;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col p-6">
      
      {/* Header */}
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          Friese <span className="text-gray-400 font-medium text-xl ml-1">Planta</span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Panel de control operativo</p>
      </header>

      {/* Main Action - Botón gigante fácil de tocar */}
      <button 
        onClick={onNewShipment}
        className="group relative w-full flex flex-col items-center justify-center gap-3 bg-gray-900 hover:bg-black text-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
      >
        <div className="bg-white/10 p-4 rounded-full group-hover:scale-110 transition-transform">
          <PackagePlus size={32} strokeWidth={1.5} />
        </div>
        <span className="text-xl font-semibold tracking-wide">Nuevo Envío</span>
      </button>

      {/* Status Card - Jerarquía secundaria */}
      <div className="mt-8">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          Estado del Sistema
        </h2>
        
        <div className={`relative overflow-hidden rounded-2xl border p-5 transition-colors ${
          isOfflineMode 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-emerald-50 border-emerald-100'
        }`}>
          
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className={`p-2 rounded-full mt-1 ${
                isOfflineMode ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {isOfflineMode ? <WifiOff size={20} /> : <Wifi size={20} />}
              </div>
              
              <div>
                <h3 className={`font-semibold ${
                  isOfflineMode ? 'text-amber-900' : 'text-emerald-900'
                }`}>
                  {isOfflineMode ? 'Sincronización Pendiente' : 'Conexión Estable'}
                </h3>
                <p className={`text-sm mt-1 leading-relaxed ${
                  isOfflineMode ? 'text-amber-700/80' : 'text-emerald-700/80'
                }`}>
                  {isOfflineMode 
                    ? 'Los datos se guardaron localmente. Se subirán automáticamente al recuperar la señal.' 
                    : 'Todo tu trabajo está respaldado en la nube de Friese.'}
                </p>
              </div>
            </div>

            {/* Badge numérico */}
            {isOfflineMode ? (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-full font-bold shadow-sm">
                <CloudUpload size={16} strokeWidth={2.5} />
                <span>{totalPending}</span>
              </div>
            ) : (
              <CheckCircle2 className="text-emerald-500" size={28} />
            )}
          </div>
        </div>
      </div>

    </div>
  );
};