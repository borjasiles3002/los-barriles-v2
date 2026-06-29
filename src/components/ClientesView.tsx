import { useState } from 'react';
import type { Cliente } from '../types';
import { useClientes } from '../hooks/useClientes';
import {
  crearCliente, actualizarCliente, buscarClientes, getFacturasCliente,
} from '../services/clientes.service';

type Modal = 'crear' | 'editar' | 'detalle' | null;

const FORM_EMPTY: Omit<Cliente, 'id' | 'totalVisitas' | 'totalGastado' | 'creadoEn'> = {
  nombre: '', apellidos: '', empresa: '', nif: '', email: '',
  telefono: '', direccion: '', cp: '', ciudad: '', notas: '',
};

export function ClientesView() {
  const { clientes, loading }       = useClientes();
  const [modal,     setModal]       = useState<Modal>(null);
  const [selected,  setSelected]    = useState<Cliente | null>(null);
  const [form,      setForm]        = useState<typeof FORM_EMPTY>(FORM_EMPTY);
  const [busqueda,  setBusqueda]    = useState('');
  const [resultados, setResultados] = useState<Cliente[] | null>(null);
  const [buscando,  setBuscando]    = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [facturas,  setFacturas]    = useState<Record<string, unknown>[]>([]);

  const lista = resultados ?? clientes;

  const handleBuscar = async () => {
    if (!busqueda.trim()) { setResultados(null); return; }
    setBuscando(true);
    const res = await buscarClientes(busqueda);
    setResultados(res);
    setBuscando(false);
  };

  const abrirCrear = () => {
    setForm(FORM_EMPTY);
    setModal('crear');
  };

  const abrirEditar = (c: Cliente) => {
    setSelected(c);
    setForm({
      nombre:    c.nombre,
      apellidos: c.apellidos,
      empresa:   c.empresa ?? '',
      nif:       c.nif ?? '',
      email:     c.email ?? '',
      telefono:  c.telefono ?? '',
      direccion: c.direccion ?? '',
      cp:        c.cp ?? '',
      ciudad:    c.ciudad ?? '',
      notas:     c.notas ?? '',
    });
    setModal('editar');
  };

  const abrirDetalle = async (c: Cliente) => {
    setSelected(c);
    setModal('detalle');
    const facs = await getFacturasCliente(c.id);
    setFacturas(facs);
  };

  const handleGuardar = async () => {
    if (!form.nombre || !form.apellidos) return;
    setGuardando(true);
    try {
      if (modal === 'crear') {
        await crearCliente(form);
      } else if (modal === 'editar' && selected) {
        await actualizarCliente(selected.id, form);
      }
      setModal(null);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Cargando clientes…</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <button
          onClick={abrirCrear}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-400 transition text-sm"
        >
          + Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="flex gap-2 mb-4">
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); if (!e.target.value) setResultados(null); }}
          onKeyDown={e => { if (e.key === 'Enter') void handleBuscar(); }}
          placeholder="Buscar por nombre, empresa o NIF…"
          className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={() => void handleBuscar()}
          disabled={buscando}
          className="px-4 py-2 rounded-lg bg-slate-600 text-white text-sm hover:bg-slate-500 transition"
        >
          {buscando ? '…' : 'Buscar'}
        </button>
        {resultados !== null && (
          <button
            onClick={() => { setBusqueda(''); setResultados(null); }}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-400 text-sm hover:bg-slate-600 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {lista.length === 0 && (
          <p className="text-slate-400 text-center py-12">
            {resultados !== null ? 'Sin resultados' : 'No hay clientes. Crea el primero.'}
          </p>
        )}
        {lista.map(c => (
          <div
            key={c.id}
            className="bg-slate-800 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-750 transition"
            onClick={() => void abrirDetalle(c)}
          >
            <div className="w-11 h-11 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {c.nombre[0]}{c.apellidos[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">{c.nombre} {c.apellidos}</span>
                {c.empresa && <span className="text-slate-400 text-sm">— {c.empresa}</span>}
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {c.nif && <span className="text-slate-500 text-xs">NIF: {c.nif}</span>}
                {c.email && <span className="text-slate-500 text-xs">{c.email}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-amber-400 font-bold">{c.totalGastado.toFixed(2)}€</p>
              <p className="text-slate-500 text-xs">{c.totalVisitas} visitas</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); abrirEditar(c); }}
              className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition flex-shrink-0"
            >
              Editar
            </button>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {modal === 'crear' ? 'Nuevo cliente' : 'Editar cliente'}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <CInput label="Nombre *" value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} />
                <CInput label="Apellidos *" value={form.apellidos} onChange={v => setForm(f => ({ ...f, apellidos: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CInput label="Empresa" value={form.empresa ?? ''} onChange={v => setForm(f => ({ ...f, empresa: v }))} />
                <CInput label="NIF / CIF" value={form.nif ?? ''} onChange={v => setForm(f => ({ ...f, nif: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CInput label="Email" type="email" value={form.email ?? ''} onChange={v => setForm(f => ({ ...f, email: v }))} />
                <CInput label="Teléfono" type="tel" value={form.telefono ?? ''} onChange={v => setForm(f => ({ ...f, telefono: v }))} />
              </div>
              <CInput label="Dirección" value={form.direccion ?? ''} onChange={v => setForm(f => ({ ...f, direccion: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <CInput label="Código postal" value={form.cp ?? ''} onChange={v => setForm(f => ({ ...f, cp: v }))} />
                <CInput label="Ciudad" value={form.ciudad ?? ''} onChange={v => setForm(f => ({ ...f, ciudad: v }))} />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Notas</label>
                <textarea
                  value={form.notas ?? ''}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition">
                Cancelar
              </button>
              <button
                onClick={() => void handleGuardar()}
                disabled={guardando || !form.nombre || !form.apellidos}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 transition disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {modal === 'detalle' && selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.nombre} {selected.apellidos}</h2>
                {selected.empresa && <p className="text-slate-400 text-sm">{selected.empresa}</p>}
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {selected.nif      && <Dato label="NIF"       value={selected.nif} />}
              {selected.email    && <Dato label="Email"     value={selected.email} />}
              {selected.telefono && <Dato label="Teléfono"  value={selected.telefono} />}
              {selected.ciudad   && <Dato label="Ciudad"    value={`${selected.cp ?? ''} ${selected.ciudad}`.trim()} />}
              <Dato label="Visitas"       value={String(selected.totalVisitas)} />
              <Dato label="Total gastado" value={`${selected.totalGastado.toFixed(2)}€`} />
              {selected.ultimaVisita && (
                <Dato label="Última visita"
                  value={new Date(selected.ultimaVisita).toLocaleDateString('es-ES')} />
              )}
            </div>

            {/* Facturas */}
            <div>
              <h3 className="text-white font-semibold mb-3">Facturas emitidas</h3>
              {facturas.length === 0 ? (
                <p className="text-slate-500 text-sm">Sin facturas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {facturas.map(f => {
                    const fac = f as { id: string; numero: string; fecha: string; total: number };
                    return (
                      <div key={fac.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-3 py-2">
                        <span className="text-white text-sm font-mono">{fac.numero}</span>
                        <span className="text-slate-400 text-sm">{fac.fecha}</span>
                        <span className="text-amber-400 font-bold text-sm">{fac.total?.toFixed(2)}€</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => { abrirEditar(selected); }}
              className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 transition"
            >
              Editar datos
            </button>
          </div>
        </div>
      )}
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

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  );
}
