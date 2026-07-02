import { useEffect, useState } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { isSeeded, seedInitialData } from './services/seed.service';
import { LoginView } from './components/LoginView';
import { TPVView } from './components/TPVView';
import { KitchenView } from './components/KitchenView';
import { SalaView } from './components/SalaView';
import { BarraTPVView } from './components/BarraTPVView';
import { CartaView } from './components/CartaView';
import { FacturasView } from './components/FacturasView';
import { StockView } from './components/StockView';
import { EscandallosView } from './components/EscandallosView';
import { AlertasView } from './components/AlertasView';
import { DashboardView } from './components/DashboardView';
import { GastosView } from './components/GastosView';
import { InformesView } from './components/InformesView';
import { RentabilidadView } from './components/RentabilidadView';
import { CierreView } from './components/CierreView';
import { ChatIA } from './components/ChatIA';
import { FichajeScreen } from './components/FichajeScreen';
import { PersonalView } from './components/PersonalView';
import { HorasView } from './components/HorasView';
import { MensajesView } from './components/MensajesView';
import { TareasView } from './components/TareasView';
import { PerfilView } from './components/PerfilView';
import { AperturaView } from './components/AperturaView';
import { ClientesView } from './components/ClientesView';
import { ConfigRestauranteView } from './components/ConfigRestauranteView';
import { FullScreenLoader } from './components/ui/LoadingSpinner';
import { Badge } from './components/ui/Badge';
import { useAlertas } from './hooks/useAlertas';
import { useTotalNoLeidos } from './hooks/useMensajes';
import { useTareasPendientesCount } from './hooks/useTareas';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getTurnoAbierto, registrarEntrada } from './services/fichaje.service';
import type { AppUser, Role } from './types';

// ─── Routing ──────────────────────────────────────────────────────────────────

function detectRoute(): 'cocina' | 'sala' | 'barra' | 'fichaje' | null {
  const path = window.location.pathname.toLowerCase();
  if (path === '/cocina')                        return 'cocina';
  if (path === '/sala')                          return 'sala';
  if (path === '/tpv')                           return 'barra';
  if (path === '/fichaje' || path === '/fichar') return 'fichaje';
  return null;
}

// ─── View types ───────────────────────────────────────────────────────────────

type View =
  | 'tpv' | 'kitchen' | 'sala' | 'carta'
  | 'dashboard' | 'informes' | 'gastos' | 'cierre'
  | 'facturas' | 'stock' | 'escandallos' | 'rentabilidad' | 'alertas'
  | 'personal' | 'horas' | 'mensajes' | 'tareas' | 'perfil'
  | 'apertura' | 'clientes' | 'config';

const VIEW_LABELS: Record<View, string> = {
  tpv:          '🍺 TPV',
  kitchen:      '🍳 Cocina',
  sala:         '🪑 Sala',
  carta:        '📋 Carta',
  dashboard:    '📊 Dashboard',
  informes:     '📈 Informes',
  gastos:       '💸 Gastos',
  cierre:       '💰 Cierre',
  facturas:     '🧾 Facturas',
  stock:        '📦 Stock',
  escandallos:  '📐 Costes',
  rentabilidad: '🏆 Rentab.',
  alertas:      '🔔 Alertas',
  personal:     '👥 Personal',
  horas:        '⏱ Horas',
  mensajes:     '💬 Mensajes',
  tareas:       '✅ Tareas',
  perfil:       '👤 Perfil',
  apertura:     '🌅 Apertura',
  clientes:     '🏷 Clientes',
  config:       '⚙ Config',
};

const VIEWS_GERENTE: View[] = [
  'tpv', 'sala', 'carta', 'apertura', 'clientes', 'personal', 'horas', 'tareas', 'mensajes',
  'dashboard', 'informes', 'gastos', 'cierre', 'facturas', 'stock',
  'escandallos', 'rentabilidad', 'alertas', 'config', 'perfil',
];

const ROLE_VIEWS: Record<Role, View[]> = {
  gerente:  VIEWS_GERENTE,
  admin:    VIEWS_GERENTE,
  manager:  ['tpv', 'sala', 'carta', 'apertura', 'clientes', 'personal', 'horas', 'tareas', 'mensajes', 'dashboard', 'informes', 'gastos', 'cierre', 'perfil'],
  camarero: ['tpv', 'sala', 'tareas', 'mensajes', 'perfil'],
  barman:   ['tpv', 'tareas', 'mensajes', 'perfil'],
  cocinero: ['kitchen', 'stock', 'tareas', 'mensajes', 'perfil'],
};

const ROLE_DEFAULT: Record<Role, View> = {
  gerente:  'dashboard',
  admin:    'dashboard',
  manager:  'dashboard',
  camarero: 'tpv',
  barman:   'tpv',
  cocinero: 'kitchen',
};

const IA_ROLES: Role[] = ['gerente', 'admin', 'manager'];

// ─── Nav bar ──────────────────────────────────────────────────────────────────

function NavBar({
  currentView, allowedViews, onNavigate, userName, onLogout,
  alertasBadge, mensajesBadge, tareasBadge,
}: {
  currentView:   View;
  allowedViews:  View[];
  onNavigate:    (v: View) => void;
  userName:      string;
  onLogout:      () => void;
  alertasBadge:  number;
  mensajesBadge: number;
  tareasBadge:   number;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 flex items-center">
      <div className="flex-1 flex overflow-x-auto scrollbar-hide">
        {allowedViews.map(v => (
          <button key={v} onClick={() => onNavigate(v)}
            className={`relative shrink-0 flex-1 min-w-[52px] py-3 flex flex-col items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              currentView === v ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <span className="text-base leading-none">{VIEW_LABELS[v].split(' ')[0]}</span>
            <span className="whitespace-nowrap">{VIEW_LABELS[v].split(' ').slice(1).join(' ')}</span>
            {v === 'alertas'   && alertasBadge   > 0 && <Badge count={alertasBadge} />}
            {v === 'mensajes'  && mensajesBadge  > 0 && <Badge count={mensajesBadge} />}
            {v === 'tareas'    && tareasBadge    > 0 && <Badge count={tareasBadge} />}
          </button>
        ))}
      </div>
      <div className="border-l border-slate-700 px-2 py-2 flex flex-col items-center gap-1 shrink-0 min-w-[52px]">
        <span className="text-slate-400 text-[8px] uppercase font-bold max-w-[48px] truncate text-center">{userName}</span>
        <button onClick={onLogout} className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase">
          Salir
        </button>
      </div>
    </nav>
  );
}

// ─── Fichaje gate (post-login, solo trabajadores sin turno abierto) ───────────

const WORKER_ROLES: Role[] = ['camarero', 'cocinero', 'barman'];

function FichajeGate({ user, onDone }: { user: AppUser; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [hora,    setHora]    = useState('');

  useEffect(() => {
    const tick = () => setHora(
      new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const handleFichar = async () => {
    setLoading(true);
    try {
      await registrarEntrada(user.uid, user.nombre);
      setDone(true);
      setTimeout(onDone, 2500);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error al registrar entrada.');
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="text-7xl">✅</div>
      <p className="text-white text-2xl font-black">¡Bienvenido, {user.nombre}!</p>
      <p className="text-emerald-400 text-lg">Entrada registrada a las {hora}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-3">
          <span className="text-3xl">🍺</span>
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-widest">Los Barriles</h1>
        <p className="text-slate-400 mt-1 text-xl font-mono font-bold">{hora}</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm text-center border border-slate-700 shadow-2xl">
        <p className="text-slate-400 text-sm mb-1">Hola, <span className="text-white font-bold">{user.nombre}</span></p>
        <p className="text-slate-500 text-sm mb-8">Aún no has fichado hoy</p>
        <button
          onClick={() => void handleFichar()}
          disabled={loading}
          className="w-full py-8 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-60 text-white text-2xl font-black rounded-2xl transition-all uppercase tracking-wide shadow-lg"
        >
          {loading ? '…' : '⏰ Fichar entrada'}
        </button>
        <button
          onClick={onDone}
          className="mt-4 text-slate-600 hover:text-slate-400 text-sm font-bold transition-colors w-full py-2"
        >
          Continuar sin fichar →
        </button>
      </div>
    </div>
  );
}

// ─── Monitor views (fullscreen, requieren auth excepto fichaje) ───────────────

function MonitorView({ route }: { route: 'cocina' | 'sala' | 'barra' }) {
  const { user, loading: authLoading } = useAuthContext();
  if (authLoading) return <FullScreenLoader />;
  if (!user)       return <LoginView />;
  if (route === 'cocina') return <KitchenView />;
  if (route === 'sala')   return <SalaView />;
  return <BarraTPVView />;
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const route = detectRoute();
  if (route === 'fichaje') return <FichajeScreen />;  // sin auth — tablet pública
  if (route) return <MonitorView route={route} />;
  return <MainApp />;
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function MainApp() {
  const { user, loading: authLoading } = useAuthContext();
  const [seeding,            setSeeding]            = useState(false);
  const [seedDone,           setSeedDone]           = useState(false);
  const [currentView,        setCurrentView]        = useState<View | null>(null);
  const [localUser,          setLocalUser]          = useState<AppUser | null>(null);
  const [fichajeGateChecked, setFichajeGateChecked] = useState(false);
  const [showFichajeGate,    setShowFichajeGate]    = useState(false);

  const { alertas }     = useAlertas(true);
  const alertasBadge    = alertas.length;
  const mensajesBadge   = useTotalNoLeidos(user?.uid ?? '');
  const tareasBadge     = useTareasPendientesCount(user?.uid ?? '');

  useEffect(() => {
    if (user) setLocalUser(user);
  }, [user]);

  useEffect(() => {
    if (!user || seedDone) return;
    const runSeed = async () => {
      setSeeding(true);
      try {
        const alreadySeeded = await isSeeded();
        if (!alreadySeeded) await seedInitialData();
        setSeedDone(true);
      } catch (e) {
        console.error('Seed error:', e);
        setSeedDone(true);
      } finally {
        setSeeding(false);
      }
    };
    void runSeed();
  }, [user, seedDone]);

  useEffect(() => {
    if (user && !currentView) setCurrentView(ROLE_DEFAULT[user.role]);
  }, [user, currentView]);

  // Mostrar gate de fichaje al hacer login si el trabajador no tiene turno abierto
  useEffect(() => {
    if (!user || fichajeGateChecked) return;
    if (!WORKER_ROLES.includes(user.role)) {
      setFichajeGateChecked(true);
      return;
    }
    getTurnoAbierto(user.uid)
      .then(turno => {
        setShowFichajeGate(turno === null);
        setFichajeGateChecked(true);
      })
      .catch(() => setFichajeGateChecked(true));
  }, [user, fichajeGateChecked]);

  const handleLogout = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
    setCurrentView(null);
    setSeedDone(false);
    setFichajeGateChecked(false);
    setShowFichajeGate(false);
  };

  if (authLoading || seeding) {
    return <FullScreenLoader message={seeding ? 'Iniciando datos...' : undefined} />;
  }
  if (!user)        return <LoginView />;
  if (!currentView) return <FullScreenLoader />;

  // Gate de fichaje para trabajadores sin turno abierto
  if (showFichajeGate && fichajeGateChecked) {
    return <FichajeGate user={user} onDone={() => setShowFichajeGate(false)} />;
  }

  const allowedViews = ROLE_VIEWS[user.role] ?? ROLE_VIEWS['camarero'];
  const safeView: View = allowedViews.includes(currentView) ? currentView : allowedViews[0];
  const showNav  = allowedViews.length > 1;
  const showChat = IA_ROLES.includes(user.role);
  const activeUser = localUser ?? user;

  return (
    <div className={showNav ? 'pb-16' : ''}>
      {safeView === 'tpv'          && <TPVView />}
      {safeView === 'kitchen'      && <KitchenView />}
      {safeView === 'sala'         && <SalaView />}
      {safeView === 'carta'        && <CartaView />}
      {safeView === 'dashboard'    && <DashboardView />}
      {safeView === 'informes'     && <InformesView />}
      {safeView === 'gastos'       && <GastosView />}
      {safeView === 'cierre'       && <CierreView />}
      {safeView === 'facturas'     && <FacturasView />}
      {safeView === 'stock'        && <StockView />}
      {safeView === 'escandallos'  && <EscandallosView />}
      {safeView === 'rentabilidad' && <RentabilidadView />}
      {safeView === 'alertas'      && <AlertasView />}
      {safeView === 'personal'     && <PersonalView />}
      {safeView === 'horas'        && <HorasView />}
      {safeView === 'mensajes'     && <MensajesView user={activeUser} />}
      {safeView === 'tareas'       && <TareasView user={activeUser} />}
      {safeView === 'perfil'       && (
        <PerfilView
          user={activeUser}
          onUpdate={updated => setLocalUser(updated)}
        />
      )}
      {safeView === 'apertura'     && <AperturaView />}
      {safeView === 'clientes'     && <ClientesView />}
      {safeView === 'config'       && <ConfigRestauranteView />}

      {showNav && (
        <NavBar
          currentView={safeView}
          allowedViews={allowedViews}
          onNavigate={setCurrentView}
          userName={activeUser.nombre}
          onLogout={() => void handleLogout()}
          alertasBadge={alertasBadge}
          mensajesBadge={mensajesBadge}
          tareasBadge={tareasBadge}
        />
      )}

      {showChat && <ChatIA />}
    </div>
  );
}
