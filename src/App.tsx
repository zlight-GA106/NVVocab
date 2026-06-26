import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  CircleUserRound,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  PlusCircle,
  Printer,
  Settings as SettingsIcon,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useAuthActions } from './hooks/useAuthActions';
import { useOfflineReviewSync } from './hooks/useOfflineReviewSync';
import { restoreMaterialTheme } from './lib/materialTheme';
import { getSupabaseClient } from './lib/supabase';
import AuthView from './views/Auth';
import DashboardView from './views/Dashboard';
import DictateView from './views/Dictate';
import GoalView from './views/Goal';
import ImportView from './views/Import';
import LexiconView from './views/Lexicon';
import OOBE from './views/OOBE';
import OOBERegisterView from './views/OOBERegister';
import PrintEditorView from './views/PrintEditor';
import SettingsView from './views/Settings';

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { to: '/', label: '仪表盘', icon: LayoutGrid },
  { to: '/lexicon', label: '词库一览', icon: BookOpen },
  { to: '/print', label: '打印编辑', icon: Printer },
  { to: '/import', label: '词库导入', icon: PlusCircle },
  { to: '/dictate', label: '沉浸默写', icon: BrainCircuit },
  { to: '/goal', label: '学习目标', icon: Target },
  { to: '/settings', label: '系统设置', icon: SettingsIcon },
  { to: '/auth', label: '账号', icon: UserRound },
];

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      className={({ isActive }) =>
        [
          'flex items-center gap-4 rounded-full px-4 py-3 text-sm font-medium transition-colors',
          isActive
            ? 'shadow-sm'
            : 'text-[#49454f] hover:bg-[#f3edf7] dark:text-[#cac4d0] dark:hover:bg-[#211f26]',
        ].join(' ')
      }
      style={({ isActive }) =>
        isActive
          ? {
              backgroundColor: 'rgb(var(--m3-primary-container))',
              color: 'rgb(var(--m3-primary))',
            }
          : undefined
      }
      to={item.to}
    >
      <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function BottomNavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      className={({ isActive }) =>
        [
          'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-medium transition-colors',
          isActive
            ? ''
            : 'text-[#49454f] dark:text-[#cac4d0]',
        ].join(' ')
      }
      style={({ isActive }) =>
        isActive
          ? {
              color: 'rgb(var(--m3-primary))',
            }
          : undefined
      }
      to={item.to}
    >
      {({ isActive }) => (
        <>
          <span
            className="flex h-8 min-w-16 items-center justify-center rounded-full px-4"
            style={{
              backgroundColor: isActive ? 'rgb(var(--m3-primary-container))' : 'transparent',
            }}
          >
            <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="max-w-full truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { isSubmitting, signOut } = useAuthActions();
  const location = useLocation();

  return (
    <div
      className="flex min-h-screen text-[#1d1b20] transition-colors duration-300 dark:text-[#e6e0e9]"
      style={{ backgroundColor: 'rgb(var(--m3-background))' }}
    >
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-[#cac4d0] bg-[#fef7ff] p-6 dark:border-[#49454f] dark:bg-[#211f26] md:flex">
        <div className="space-y-8">
          <div className="px-3 py-2">
            <span className="inline-flex items-center gap-2 rounded-[28px] bg-[#e8def8] px-4 py-2 text-base font-medium text-[#1d192b] dark:bg-[#4a4458] dark:text-[#e6e0e9]">
              <BookOpen aria-hidden="true" className="size-5" strokeWidth={2} />
              <span>单词速记</span>
            </span>
          </div>

          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <NavigationLink item={item} key={item.to} />
            ))}
          </nav>
        </div>

        <div className="space-y-3 px-4 text-xs leading-5 text-[#79747e] dark:text-[#938f99]">
          <NavLink
            className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#6750a4] dark:text-[#d0bcff]"
            to="/auth"
          >
            <CircleUserRound aria-hidden="true" className="size-[1em] shrink-0" strokeWidth={2} />
            <span className="min-w-0 truncate">{isAuthenticated ? user?.email ?? user?.id : '登录或注册'}</span>
          </NavLink>
          {isAuthenticated && (
            <button
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[#6750a4] transition-colors hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
              disabled={isSubmitting}
              onClick={() => void signOut()}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>退出登录</span>
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-28 sm:px-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="route-transition-page" key={`${location.pathname}${location.search}`}>
            {children}
          </div>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#cac4d0] bg-[#fef7ff]/95 px-3 py-2 backdrop-blur dark:border-[#49454f] dark:bg-[#211f26]/95 md:hidden">
        <div className="mx-auto flex max-w-lg gap-1">
          {navigationItems.map((item) => (
            <BottomNavigationLink item={item} key={item.to} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function ProtectedLayout() {
  const navigate = useNavigate();
  const hasClient = getSupabaseClient() !== null;

  useEffect(() => {
    if (!hasClient) {
      navigate('/oobe', { replace: true });
    }
  }, [hasClient, navigate]);

  if (!hasClient) {
    return null;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function ConfiguredStandaloneLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasClient = getSupabaseClient() !== null;

  useEffect(() => {
    if (!hasClient) {
      navigate('/oobe', { replace: true });
    }
  }, [hasClient, navigate]);

  if (!hasClient) {
    return null;
  }

  return (
    <div
      className="min-h-screen text-[#1d1b20] transition-colors duration-300 dark:text-[#e6e0e9]"
      style={{ backgroundColor: 'rgb(var(--m3-background))' }}
    >
      <main className="min-h-screen px-4 py-6 sm:px-6 md:p-8">
        <div className="route-transition-page" key={`${location.pathname}${location.search}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AuthGuard() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/oobe/register', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center text-sm text-[#49454f] dark:text-[#cac4d0]">
        <LoaderCircle aria-hidden="true" className="mr-3 size-5 animate-spin" strokeWidth={2} />
        <span>正在检查登录状态</span>
      </div>
    );
  }

  return <Outlet />;
}

export default function App() {
  useOfflineReviewSync();

  useEffect(() => {
    restoreMaterialTheme();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const rippleHost = event.target.closest<HTMLElement>('button, a, [role="button"]');
      if (!rippleHost) {
        return;
      }

      if (rippleHost instanceof HTMLButtonElement && rippleHost.disabled) {
        return;
      }

      const rect = rippleHost.getBoundingClientRect();
      const diameter = Math.max(rect.width, rect.height) * 1.8;
      const ripple = document.createElement('span');
      ripple.className = 'm3-touch-ripple';
      ripple.style.width = `${diameter}px`;
      ripple.style.height = `${diameter}px`;
      ripple.style.left = `${event.clientX - rect.left - diameter / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - diameter / 2}px`;

      rippleHost.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 420);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/oobe" element={<OOBE />} />
        <Route path="/oobe/register" element={<OOBERegisterView />} />
        <Route element={<ConfiguredStandaloneLayout />}>
          <Route path="/auth" element={<AuthView />} />
        </Route>
        <Route element={<ProtectedLayout />}>
          <Route element={<AuthGuard />}>
            <Route path="/" element={<DashboardView />} />
            <Route path="/lexicon" element={<LexiconView />} />
            <Route path="/print" element={<PrintEditorView />} />
            <Route path="/import" element={<ImportView />} />
            <Route path="/dictate" element={<DictateView />} />
            <Route path="/goal" element={<GoalView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
