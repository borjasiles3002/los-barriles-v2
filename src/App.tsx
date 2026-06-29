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
import { FullScreenLoader } from './components/ui/LoadingSpinner';
import { Badge } from './components/ui/Badge';
import { useAlertas } from './hooks/useAlertas';
import { useTotalNoLeidos } from './hooks/useMensajes';
import { useTareasPendientesCount } from './hooks/useTareas';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import type { AppUser, Role } from './types';

// ─── Routing ──────────────────────────────────────────────────────────────────

function detectRoute(): 'cocina' | 'sala' | 'barra' | 'fichaje' | null {
  const path = window.location.pathname.toLowerCase();
  if (path === '/cocina')   return 'cocina';
  if (path === '/sala')     return 'sala';
  if (path === '/tpv')      return 'barra';
  if (path === '/fichaje')  return 'fichaje';
  return null;
}

// ─── View types ───────────────────────────────────────────────────────────────

type View =
  | 'tpv' | 'kitchen' | 'sala' | 'carta'
  | 'dashboard' | 'informes' | 'gastos' | 'cierre'
  | 'facturas' | 'stock' | 'escandallos' | 'rentabilidad' | 'alertas'
  | 'personal' | 'horas' | 'mensajes' | 'tareas' | 'perfil';

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
};

const VIEWS_GERENTE: View[] = [
  'tpv', 'sala', 'carta', 'personal', 'horas', 'tareas', 'mensajes',
  'dashboard', 'informes', 'gastos', 'cierre', 'facturas', 'stock',
  'escandallos', 'rentabilidad', 'alertas', 'perfil',
];

const ROLE_VIEWS: Record<Role, View[]> = {
  gerente:  VIEWS_GERENTE,
  admin:    VIEWS_GERENTE,
  manager:  ['tpv', 'sala', 'carta', 'personal', 'horas', 'tareas', 'mensajes', 'dashboard', 'informes', 'gastos', 'cierre', 'perfil'],
  camarero: ['tpv', 'sala', 'tareas', 'mensajes', 'perfil'],
  barman:   ['tpv', 'tareas', 'mensajes', 'perfil'],
  cocinero: ['kitchen', 'stock', 'tareas', 'mensajes', 'perfil'],
};

const ROLE_DEFAULT: Record<Role, View> = {
  gerente:  'tpv',
  admin:    'tpv',
  manager:  'tpv',
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

// ─── Monitor / Fichaje views (fullscreen, requieren auth) ─────────────────────

function MonitorView({ route }: { route: 'cocina' | 'sala' | 'barra' | 'fichaje' }) {
  const { user, loading: authLoading } = useAuthContext();
  if (authLoading) return <FullScreenLoader />;
  if (!user)       return <LoginView />;
  if (route === 'cocina')   return <KitchenView />;
  if (route === 'sala')     return <SalaView />;
  if (route === 'fichaje')  return <FichajeScreen />;
  return <BarraTPVView />;
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const route = detectRoute();
  if (route) return <MonitorView route={route} />;
  return <MainApp />;
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function MainApp() {
  const { user, loading: authLoading } = useAuthContext();
  const [seeding,     setSeeding]     = useState(false);
  const [seedDone,    setSeedDone]    = useState(false);
  const [currentView, setCurrentView] = useState<View | null>(null);
  const [localUser,   setLocalUser]   = useState<AppUser | null>(null);

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

  const handleLogout = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
    setCurrentView(null);
    setSeedDone(false);
  };

  if (authLoading || seeding) {
    return <FullScreenLoader message={seeding ? 'Iniciando datos...' : undefined} />;
  }
  if (!user)        return <LoginView />;
  if (!currentView) return <FullScreenLoader />;

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
