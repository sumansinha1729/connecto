import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BadgeCheck,
  Flag,
  History,
  IndianRupee,
  LogOut,
  Radio,
  ShieldAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { adminApi } from '../api/admin';
import { logout } from '../api/client';
import { useSession } from '../lib/hooks';
import { Avatar, cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function Layout() {
  const session = useSession();
  // Things waiting for an admin, shown as counts in the menu
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: adminApi.stats, refetchInterval: 30_000 });

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Monitoring',
      items: [
        { to: '/', label: 'Live now', icon: Radio },
        { to: '/activity', label: 'Activity', icon: Activity },
        { to: '/money', label: 'Money', icon: IndianRupee },
        { to: '/safety', label: 'Safety', icon: ShieldAlert },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/applications', label: 'Listener applications', icon: BadgeCheck, count: stats?.listeners.pendingApplications },
        { to: '/payouts', label: 'Payouts', icon: Wallet, count: stats?.payouts.pending },
        { to: '/reports', label: 'Reports', icon: Flag, count: stats?.reports.open },
        { to: '/users', label: 'Users', icon: Users },
        { to: '/audit', label: 'Audit log', icon: History },
      ],
    },
  ];

  const link = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cx(
          'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-primary/15 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <item.icon size={17} />
      <span className="flex-1 whitespace-nowrap">{item.label}</span>
      {item.count ? <span className="tabular rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">{item.count}</span> : null}
    </NavLink>
  );

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-bold">C</div>
          <div>
            <div className="text-sm font-semibold">Connecto</div>
            <div className="text-xs text-faint">Admin panel</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
          {groups.map((group) => (
            <div key={group.title} className="flex gap-1 md:mb-4 md:flex-col">
              <div className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-faint uppercase md:block">{group.title}</div>
              {group.items.map(link)}
            </div>
          ))}
        </nav>
        {session && (
          <div className="hidden items-center gap-2.5 border-t border-border px-4 py-3 md:flex">
            <Avatar avatar={session.user.avatar} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{session.user.name || 'Admin'}</div>
              <div className="text-xs text-faint">Admin</div>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title="Log out" aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
