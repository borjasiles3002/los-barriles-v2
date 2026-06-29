import { useEffect, useState } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { isSeeded, seedInitialData } from './services/seed.service';
import { LoginView } from './components/LoginView';
import { TPVView } from './components/TPVView';
import { KitchenView } from './components/KitchenView';
import { SalaView } from './components/SalaView';
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
import { FullScreenLoader } from './components/ui/LoadingSpinner';
import { Badge } from './components/ui/Badge';
import { useAlertas } from './hooks/useAlertas';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import type { Role } from './types';

type View =
  | 'tpv' | 'kitchen' | 'sala' | 'carta'
  | 'dashboard' | 'informes' | 'gastos' | 'cierre'
  | 'facturas' | 'stock' | 'escandallos' | 'rentabilidad' | 'alertas';

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
};

const ROLE_VIEWS: Record<Role, View[]> = {
  admin:    ['tpv', 'kitchen', 'sala', 'carta', 'dashboard', 'informes', 'gastos', 'cierre', 'facturas', 'stock', 'escandallos', 'rentabilidad', 'alertas'],
  manager:  ['tpv', 'kitchen', 'sala', 'carta', 'dashboard', 'informes', 'gastos', 'cierre', 'facturas', 'stock', 'escandallos', 'rentabilidad', 'alertas'],
  camarero: ['tpv', 'sala'],
  cocinero: ['kitchen', 'stock'],
};

const ROLE_DEFAULT: Record<Role, View> = {
  admin:    'tpv',
  manager:  'tpv',
  camarero: 'tpv',
  cocinero: 'kitchen',
};

const IA_ROLES: Role[] = ['admin', 'manager'];

function NavBar({
  currentView,
  allowedViews,
  onNavigate,
  userName,
  onLogout,
  alertasBadge,
}: {
  currentView: View;
  allowedViews: View[];
  onNavigate: (v: View) => void;
  userName: string;
  onLogout: () => void;
  alertasBadge: number;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 flex items-center">
      <div className="flex-1 flex overflow-x-auto scrollbar-hide">
        {allowedViews.map(v => (
          <button
            key={v}
            onClick={() => onNavigate(v)}
            className={`relative shrink-0 flex-1 min-w-[52px] py-3 flex flex-col items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              currentView === v ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-base leading-none">{VIEW_LABELS[v].split(' ')[0]}</span>
            <span className="whitespace-nowrap">{VIEW_LABELS[v].split(' ').slice(1).join(' ')}</span>
            {v === 'alertas' && alertasBadge > 0 && (
              <Badge count={alertasBadge} />
            )}
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

export default function App() {
  const { user, loading: authLoading } = useAuthContext();
  const [seeding, setSeeding]           = useState(false);
  const [seedDone, setSeedDone]         = useState(false);
  const [currentView, setCurrentView]   = useState<View | null>(null);
  const { alertas }                     = useAlertas(true);
  const alertasBadge                    = alertas.length;

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
    runSeed();
  }, [user, seedDone]);

  useEffect(() => {
    if (user && !currentView) {
      setCurrentView(ROLE_DEFAULT[user.role]);
    }
  }, [user, currentView]);

  const handleLogout = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
    setCurrentView(null);
    setSeedDone(false);
  };

  if (authLoading || seeding) {
    return <FullScreenLoader message={seeding ? 'Iniciando datos...' : undefined} />;
  }
  if (!user) return <LoginView />;
  if (!currentView) return <FullScreenLoader />;

  const allowedViews = ROLE_VIEWS[user.role];
  const safeView: View = allowedViews.includes(currentView) ? currentView : allowedViews[0];
  const showNav  = allowedViews.length > 1;
  const showChat = IA_ROLES.includes(user.role);

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

      {showNav && (
        <NavBar
          currentView={safeView}
          allowedViews={allowedViews}
          onNavigate={setCurrentView}
          userName={user.nombre}
          onLogout={handleLogout}
          alertasBadge={alertasBadge}
        />
      )}

      {showChat && <ChatIA />}
    </div>
  );
}
