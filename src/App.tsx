import { useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { useAuth } from './hooks/useAuth';
import { useAuthActions } from './hooks/useAuthActions';
import { useOfflineReviewSync } from './hooks/useOfflineReviewSync';
import { getSupabaseClient } from './lib/supabase';
import { resolveRuntimeConfig } from './utils/config';
import AboutView from './views/About';
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

function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { isSubmitting, signOut } = useAuthActions();
  const location = useLocation();

  return (
    <div
      className="flex min-h-screen text-neutral-900 transition-colors duration-300 dark:text-neutral-100"
      style={{ backgroundColor: 'rgb(var(--m3-background))' }}
    >
      <Sidebar
        isAuthenticated={isAuthenticated}
        isSubmitting={isSubmitting}
        onSignOut={() => void signOut()}
        userLabel={isAuthenticated ? user?.email ?? user?.id ?? '已登录' : '登录或注册'}
      />

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-28 sm:px-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="route-transition-page" key={`${location.pathname}${location.search}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function ProtectedLayout() {
  const navigate = useNavigate();
  const shouldShowOOBE = resolveRuntimeConfig().shouldShowOOBE;
  const hasClient = !shouldShowOOBE && getSupabaseClient() !== null;

  useEffect(() => {
    if (shouldShowOOBE || !hasClient) {
      navigate('/oobe', { replace: true });
    }
  }, [hasClient, navigate, shouldShowOOBE]);

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
  const shouldShowOOBE = resolveRuntimeConfig().shouldShowOOBE;
  const hasClient = !shouldShowOOBE && getSupabaseClient() !== null;

  useEffect(() => {
    if (shouldShowOOBE || !hasClient) {
      navigate('/oobe', { replace: true });
    }
  }, [hasClient, navigate, shouldShowOOBE]);

  if (!hasClient) {
    return null;
  }

  return (
    <div
      className="min-h-screen text-neutral-900 transition-colors duration-300 dark:text-neutral-100"
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
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
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
            <Route path="/about" element={<AboutView />} />
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
