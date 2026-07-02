import { useState, useEffect } from 'react';
import type { ConfigRestaurante, ConfigImpresoras } from '../types';
import { getConfigRestaurante, saveConfigRestaurante } from '../services/facturasEmitidas.service';
import {
  getConfigImpresoras, saveConfigImpresoras,
  conectarQZ, obtenerImpresoras, imprimirPrueba, qzConectado,
} from '../services/impresion.service';

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

  // ── Impresoras ──
  const [cfgImp,       setCfgImp]       = useState<ConfigImpresoras>({ impresoraCocina: '', impresoraBarra: '' });
  const [impresoras,   setImpresoras]   = useState<string[]>([]);
  const [qzStatus,     setQzStatus]     = useState<'desconocido' | 'conectado' | 'error'>('desconocido');
  const [loadingQZ,    setLoadingQZ]    = useState(false);
  const [guardandoImp, setGuardandoImp] = useState(false);
  const [okImp,        setOkImp]        = useState(false);
  const [pruebaMsg,    setPruebaMsg]    = useState('');

  useEffect(() => {
    getConfigRestaurante().then(c => { if (c) setConfig(c); setLoading(false); });
    getConfigImpresoras().then(c => setCfgImp(c));
    qzConectado().then(ok => setQzStatus(ok ? 'conectado' : 'desconocido'));
  }, []);

  const handleConectarQZ = async () => {
    setLoadingQZ(true);
    try {
      await conectarQZ();
      const lista = await obtenerImpresoras();
      setImpresoras(lista);
      setQzStatus('conectado');
    } catch (e) {
      setQzStatus('error');
      alert('No se pudo conectar a QZ Tray.\n¿Está instalado y ejecutándose?\nhttps://qz.io/download/');
    } finally { setLoadingQZ(false); }
  };

  const handleGuardarImpresoras = async () => {
    setGuardandoImp(true);
    await saveConfigImpresoras(cfgImp);
    setOkImp(true);
    setTimeout(() => setOkImp(false), 2500);
    setGuardandoImp(false);
  };

  const handlePrueba = async (impresora: string) => {
    if (!impresora) { setPruebaMsg('Selecciona una impresora primero'); setTimeout(() => setPruebaMsg(''), 3000); return; }
    try {
      await imprimirPrueba(impresora);
      setPruebaMsg(`✓ Prueba enviada a "${impresora}"`);
    } catch (e) {
      setPruebaMsg(`Error: ${e instanceof Error ? e.message : 'Fallo al imprimir'}`);
    }
    setTimeout(() => setPruebaMsg(''), 4000);
  };

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

      {/* ── Impresoras ── */}
      <div className="mt-6 bg-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🖨 Impresoras térmicas (QZ Tray)</h2>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            qzStatus === 'conectado' ? 'bg-emerald-700 text-emerald-200'
            : qzStatus === 'error'   ? 'bg-red-700 text-red-200'
            : 'bg-slate-700 text-slate-400'
          }`}>
            {qzStatus === 'conectado' ? '● Conectado' : qzStatus === 'error' ? '● Error' : '○ No conectado'}
          </span>
        </div>

        <p className="text-slate-400 text-xs">
          Requiere <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer"
            className="text-amber-400 underline">QZ Tray</a> instalado y ejecutándose en el TPV.
          Activar "Allow unsigned" en Settings → Advanced.
        </p>

        <button
          onClick={() => void handleConectarQZ()}
          disabled={loadingQZ}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition disabled:opacity-60"
        >
          {loadingQZ ? 'Conectando…' : qzStatus === 'conectado' ? '↻ Recargar impresoras' : '⚡ Conectar QZ Tray'}
        </button>

        {/* Selector impresora cocina */}
        <div>
          <label className="block text-slate-400 text-sm mb-1">Impresora de COCINA</label>
          <div className="flex gap-2">
            {impresoras.length > 0 ? (
              <select
                value={cfgImp.impresoraCocina}
                onChange={e => setCfgImp(c => ({ ...c, impresoraCocina: e.target.value }))}
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— Seleccionar —</option>
                {impresoras.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input
                value={cfgImp.impresoraCocina}
                onChange={e => setCfgImp(c => ({ ...c, impresoraCocina: e.target.value }))}
                placeholder="Nombre exacto de la impresora"
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            )}
            <button
              onClick={() => void handlePrueba(cfgImp.impresoraCocina)}
              className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition"
            >
              Prueba
            </button>
          </div>
        </div>

        {/* Selector impresora barra */}
        <div>
          <label className="block text-slate-400 text-sm mb-1">Impresora de BARRA</label>
          <div className="flex gap-2">
            {impresoras.length > 0 ? (
              <select
                value={cfgImp.impresoraBarra}
                onChange={e => setCfgImp(c => ({ ...c, impresoraBarra: e.target.value }))}
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— Seleccionar —</option>
                {impresoras.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input
                value={cfgImp.impresoraBarra}
                onChange={e => setCfgImp(c => ({ ...c, impresoraBarra: e.target.value }))}
                placeholder="Nombre exacto de la impresora"
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            )}
            <button
              onClick={() => void handlePrueba(cfgImp.impresoraBarra)}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
            >
              Prueba
            </button>
          </div>
        </div>

        {pruebaMsg && (
          <p className={`text-xs font-semibold ${pruebaMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
            {pruebaMsg}
          </p>
        )}

        <button
          onClick={() => void handleGuardarImpresoras()}
          disabled={guardandoImp}
          className={`w-full py-3 rounded-xl font-semibold transition ${
            okImp ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-400'
          } disabled:opacity-60`}
        >
          {guardandoImp ? 'Guardando…' : okImp ? '✓ Guardado' : 'Guardar impresoras'}
        </button>
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
