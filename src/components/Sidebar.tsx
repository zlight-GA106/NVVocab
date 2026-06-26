import { Link, NavLink } from 'react-router-dom';
import {
  BookOpen,
  BrainCircuit,
  CircleUserRound,
  LayoutGrid,
  LogOut,
  PlusCircle,
  Printer,
  Settings as SettingsIcon,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type SidebarProps = {
  isAuthenticated: boolean;
  isSubmitting: boolean;
  onSignOut: () => void;
  userLabel: string;
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
          isActive ? '' : 'text-[#49454f] dark:text-[#cac4d0]',
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

export default function Sidebar({ isAuthenticated, isSubmitting, onSignOut, userLabel }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-[#cac4d0] bg-[#fef7ff] p-6 dark:border-[#49454f] dark:bg-[#211f26] md:flex">
        <div className="space-y-8">
          <div className="px-1 py-2">
            <Link
              className="group inline-flex w-full cursor-pointer select-none items-center gap-3 rounded-[28px] px-4 py-3 shadow-sm transition-all duration-200 hover:bg-[rgb(var(--m3-primary)_/_0.05)] active:scale-[0.98]"
              style={{
                backgroundColor: 'rgb(var(--m3-primary-container))',
                color: 'rgb(var(--m3-primary))',
              }}
              to="/about"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/45 transition-transform duration-200 group-hover:scale-105 dark:bg-black/10">
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-7 rounded-full object-cover"
                  src="/bwolf.png"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold leading-5">NVVocab</span>
                <span className="mt-0.5 block truncate text-xs font-medium leading-4 opacity-80">
                  非易失性词库
                </span>
              </span>
            </Link>
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
            <span className="min-w-0 truncate">{userLabel}</span>
          </NavLink>
          {isAuthenticated && (
            <button
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[#6750a4] transition-colors hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#d0bcff] dark:hover:bg-[#2b2930]"
              disabled={isSubmitting}
              onClick={onSignOut}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
              <span>退出登录</span>
            </button>
          )}
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#cac4d0] bg-[#fef7ff]/95 px-3 py-2 backdrop-blur dark:border-[#49454f] dark:bg-[#211f26]/95 md:hidden">
        <div className="mx-auto flex max-w-lg gap-1">
          {navigationItems.map((item) => (
            <BottomNavigationLink item={item} key={item.to} />
          ))}
        </div>
      </nav>
    </>
  );
}
