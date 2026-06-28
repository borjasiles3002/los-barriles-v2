import { useEffect, useState } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { isSeeded, seedInitialData } from './services/seed.service';
import { LoginView } from './components/LoginView';
import { TPVView } from './components/TPVView';
import { KitchenView } from './components/KitchenView';
import { SalaView } from './components/SalaView';
import { CajaView } from './components/CajaView';
import { CartaView } from './components/CartaView';
import { FullScreenLoader } from './components/ui/LoadingSpinner';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import type { Role } from './types';

type View = 'tpv' | 'kitchen' | 'sala' | 'caja' | 'carta';

const VIEW_LABELS: Record<View, string> = {
  tpv:     '🍺 TPV',
  kitchen: '🍳 Cocina',
  sala:    '🪑 Sala',
  caja:    '💰 Caja',
  carta:   '📋 Carta',
};

const ROLE_VIEWS: Record<Role, View[]> = {
  admin:    ['tpv', 'kitchen', 'sala', 'caja', 'carta'],
  manager:  ['tpv', 'kitchen', 'sala', 'caja', 'carta'],
  camarero: ['tpv', 'sala'],
  cocinero: ['kitchen'],
};

const ROLE_DEFAULT: Record<Role, View> = {
  admin:    'tpv',
  manager:  'tpv',
  camarero: 'tpv',
  cocinero: 'kitchen',
};

function NavBar({
  currentView,
  allowedViews,
  onNavigate,
  userName,
  onLogout,
}: {
  currentView: View;
  allowedViews: View[];
  onNavigate: (v: View) => void;
  userName: string;
  onLogout: () => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 flex items-center">
      <div className="flex-1 flex justify-around">
        {allowedViews.map(v => (
          <button
            key={v}
            onClick={() => onNavigate(v)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              currentView === v ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-base leading-none">{VIEW_LABELS[v].split(' ')[0]}</span>
            <span>{VIEW_LABELS[v].split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </div>
      <div className="border-l border-slate-700 px-3 py-2 flex flex-col items-center gap-1 min-w-[64px]">
        <span className="text-slate-400 text-[9px] uppercase font-bold max-w-[60px] truncate">{userName}</span>
        <button
          onClick={onLogout}
          className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase"
        >
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
  const showNav = allowedViews.length > 1;

  return (
    <div className={showNav ? 'pb-16' : ''}>
      {safeView === 'tpv'     && <TPVView />}
      {safeView === 'kitchen' && <KitchenView />}
      {safeView === 'sala'    && <SalaView />}
      {safeView === 'caja'    && <CajaView />}
      {safeView === 'carta'   && <CartaView />}

      {showNav && (
        <NavBar
          currentView={safeView}
          allowedViews={allowedViews}
          onNavigate={setCurrentView}
          userName={user.nombre}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
