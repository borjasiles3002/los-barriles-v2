import { useState, useEffect } from 'react';
import type { ConfigRestaurante } from '../types';
import { getConfigRestaurante, saveConfigRestaurante } from '../services/facturasEmitidas.service';

const DEFAULT: ConfigRestaurante = {
  nombre: 'Los Barriles',
  nif: '', direccion: '', cp: '', ciudad: '',
  telefono: '', email: '', logo: '', iban: '',
};

export function ConfigRestauranteView() {
  const [config,    setConfig]    = useState<ConfigRestaurante>(DEFAULT);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ok,        setOk]        = useState(false);

  useEffect(() => {
    getConfigRestaurante().then(c => {
      if (c) setConfig(c);
      setLoading(false);
    });
  }, []);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setConfig(c => ({ ...c, logo: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    await saveConfigRestaurante(config);
    setOk(true);
    setTimeout(() => setOk(false), 2500);
    setGuardando(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Cargando…</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Configuración del restaurante</h1>

      <div className="bg-slate-800 rounded-2xl p-6 space-y-4">
        {/* Logo */}
        <div>
          <label className="block text-slate-400 text-sm mb-2">Logo (PNG/JPG)</label>
          <div className="flex items-center gap-4">
            {config.logo ? (
              <img src={config.logo} alt="logo" className="h-16 w-16 object-contain bg-white rounded-lg" />
            ) : (
              <div className="h-16 w-16 bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 text-xs">Sin logo</div>
            )}
            <label className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm cursor-pointer hover:bg-slate-600 transition">
              Subir imagen
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
            {config.logo && (
              <button onClick={() => setConfig(c => ({ ...c, logo: '' }))}
                className="text-red-400 text-sm hover:text-red-300">Eliminar</button>
            )}
          </div>
        </div>

        <CInput label="Nombre del restaurante *" value={config.nombre} onChange={v => setConfig(c => ({ ...c, nombre: v }))} />

        <div className="grid grid-cols-2 gap-3">
          <CInput label="NIF / CIF *" value={config.nif} onChange={v => setConfig(c => ({ ...c, nif: v }))} />
          <CInput label="Teléfono" value={config.telefono} onChange={v => setConfig(c => ({ ...c, telefono: v }))} />
        </div>

        <CInput label="Dirección" value={config.direccion} onChange={v => setConfig(c => ({ ...c, direccion: v }))} />

        <div className="grid grid-cols-2 gap-3">
          <CInput label="Código postal" value={config.cp} onChange={v => setConfig(c => ({ ...c, cp: v }))} />
          <CInput label="Ciudad" value={config.ciudad} onChange={v => setConfig(c => ({ ...c, ciudad: v }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CInput label="Email" type="email" value={config.email} onChange={v => setConfig(c => ({ ...c, email: v }))} />
          <CInput label="IBAN (para tickets)" value={config.iban ?? ''} onChange={v => setConfig(c => ({ ...c, iban: v }))} />
        </div>

        <button
          onClick={() => void handleGuardar()}
          disabled={guardando}
          className={`w-full py-3 rounded-xl font-semibold transition ${
            ok ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-400'
          } disabled:opacity-60`}
        >
          {guardando ? 'Guardando…' : ok ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </div>

      {/* Info contadores */}
      <div className="mt-4 bg-slate-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-2 text-sm">Numeración de facturas</h2>
        <p className="text-slate-400 text-sm">
          Las facturas se numeran automáticamente con el formato <span className="font-mono text-amber-400">FAC-{new Date().getFullYear()}-NNNN</span>.
          El contador es incremental y no se puede reiniciar.
        </p>
      </div>
    </div>
  );
}

function CInput({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-slate-400 text-sm mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  );
}
