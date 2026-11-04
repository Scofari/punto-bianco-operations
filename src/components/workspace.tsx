'use client';
import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Building2,
  CarFront,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
  CircleHelp,
  ShieldCheck,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import type { Role, Staff } from '@/lib/domain';
import { ro } from '@/lib/ro';
import { localDate } from '@/lib/dates';
const icons = {
  overview: LayoutDashboard,
  patients: Users,
  backoffice: ClipboardList,
  accommodation: Building2,
  transfers: CarFront,
  team: ShieldCheck,
};
const access: Record<keyof typeof ro.nav, Role[]> = {
  overview: [
    'admin',
    'coordinator',
    'backoffice',
    'accommodation',
    'driver',
    'accountant',
    'quality',
  ],
  patients: ['admin', 'coordinator', 'backoffice', 'quality'],
  backoffice: ['admin', 'backoffice', 'quality'],
  accommodation: ['admin', 'accommodation', 'accountant', 'quality'],
  transfers: ['admin', 'coordinator', 'driver', 'accountant', 'quality'],
  team: ['admin'],
};
type Notification = { id: string; event_type: string; created_at: string; resource_id: string };
export function Workspace({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [seenId, setSeenId] = useState('');
  useEffect(() => {
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch('/api/v1/notifications');
        if (r.ok) {
          const data = await r.json();
          if (mounted) setNotifications(data.items);
        }
      } catch {
        /* Poll again after a transient outage. */
      }
    };
    void load();
    const channel = client
      .channel(`notifications:${staff.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${staff.id}`,
        },
        () => {
          void load();
          window.dispatchEvent(new Event('punto:refresh'));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load();
      });
    const timer = setInterval(() => {
      void load();
    }, 30000);
    const focus = () => {
      void load();
      window.dispatchEvent(new Event('punto:refresh'));
    };
    window.addEventListener('focus', focus);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      void client.removeChannel(channel);
    };
  }, [staff.id]);
  async function logout() {
    const c = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    await c.auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  const current = (path.split('/')[1] || 'overview') as keyof typeof ro.nav;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Sari la conținut
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Închide meniul"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link href="/overview" className="brand">
          <BrandLogo showContext />
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Închide meniul"
        >
          <X size={20} />
        </button>
        <div className="workspace-label">SPAȚIUL ECHIPEI</div>
        <nav aria-label="Navigare principală">
          {(Object.keys(ro.nav) as (keyof typeof ro.nav)[])
            .filter((key) => access[key].includes(staff.role))
            .map((key) => {
              const Icon = icons[key];
              return (
                <Link
                  key={key}
                  href={`/${key}`}
                  className={`nav-link ${current === key ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={19} />
                  <span>{ro.nav[key]}</span>
                  {current === key && <span className="nav-dot" />}
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <CircleHelp size={20} />
            </span>
            <strong>O echipă. Un singur loc.</strong>
            <p>Fiecare detaliu contează pentru o vizită fără griji.</p>
            <span className="help-link">
              Punto Bianco <ArrowUpRight size={14} />
            </span>
          </div>
          <div className="clinic-info">
            <span className="online-dot" />
            <span>Clinica Chișinău</span>
            <small>Europe/Chisinau</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Deschide meniul"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Spațiul echipei</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{ro.nav[current]}</strong>
          </div>
          <div className="topbar-actions">
            <div className="timezone-tag">
              <span className="online-dot" />
              Chișinău · ora clinicii
            </div>
            <div className="notification-wrap">
              <button
                className={`icon-button bell-button ${bell ? 'selected' : ''}`}
                aria-label="Notificări"
                aria-expanded={bell}
                onClick={() => {
                  setBell(!bell);
                  setSeenId(notifications[0]?.id ?? '');
                }}
              >
                <Bell size={20} />
                {notifications.length > 0 && notifications[0].id !== seenId && (
                  <span className="notification-dot" />
                )}
              </button>
              {bell && (
                <section className="notification-panel">
                  <div className="notification-title">
                    <strong>Notificări</strong>
                    <span className="count-pill">{notifications.length}</span>
                    <button
                      className="icon-button"
                      aria-label="Închide notificările"
                      onClick={() => setBell(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {notifications.length ? (
                    notifications.map((n) => (
                      <div className="notification-item" key={n.id}>
                        <span className="notification-icon">
                          <Check size={16} />
                        </span>
                        <div>
                          <strong>
                            {n.event_type === 'visit_created'
                              ? 'Vizită nouă înregistrată'
                              : n.event_type === 'accommodation_reserved'
                                ? 'Cazare rezervată'
                                : n.event_type === 'backoffice_updated'
                                  ? 'Caz actualizat'
                                  : 'Detaliile vizitei au fost actualizate'}
                          </strong>
                          <small>{localDate(n.created_at)}</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted notification-empty">Nu aveți notificări noi.</p>
                  )}
                </section>
              )}
            </div>
            <div className="topbar-divider" />
            <div className="user-details">
              <span className="avatar">
                {staff.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div>
                <strong>{staff.display_name}</strong>
                <small>{ro.roles[staff.role]}</small>
              </div>
              <ChevronDown size={14} />
            </div>
            <button
              className="icon-button logout"
              aria-label={ro.actions.logout}
              title={ro.actions.logout}
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Punto Bianco</span>
          <span>
            <ShieldCheck size={13} />
            Date demonstrative · Acces securizat
          </span>
        </footer>
      </div>
    </div>
  );
}
