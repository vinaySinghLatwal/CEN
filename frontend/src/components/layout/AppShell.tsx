import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  ShieldAlert,
  UserCog,
  CheckSquare,
  Calendar,
  MessageSquare,
  Megaphone,
  Wallet,
  Sparkles,
  Package,
  AlertCircle,
  Menu,
  LogOut,
  Repeat,
  User as UserIcon,
  X,
  ChevronRight
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Role } from "@/mocks/data";
import { cn, getInitials } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<Role, NavItem[]> = {
  owner: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/owner/applications", label: "Applications", icon: ClipboardList },
    { to: "/app/owner/societies", label: "Societies", icon: Building2 },
    { to: "/app/owner/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/app/profile", label: "Profile Settings", icon: UserIcon },
  ],
  admin: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/admin/onboarding", label: "Member Onboarding", icon: ClipboardList },
    { to: "/app/admin/residents", label: "Residents Directory", icon: Users },
    { to: "/app/admin/coordinators", label: "Coordinators Manager", icon: UserCog },
    { to: "/app/admin/private-complaints", label: "Private Reports", icon: ShieldAlert },
    { to: "/app/admin/performance", label: "Performance Metrics", icon: BarChart3 },
    { to: "/app/notices", label: "Notice Board", icon: Megaphone },
    { to: "/app/profile", label: "Profile Settings", icon: UserIcon },
  ],
  coordinator: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/coord/approvals", label: "Pending Approvals", icon: CheckSquare },
    { to: "/app/coord/complaints", label: "Reported Complaints", icon: AlertCircle },
    { to: "/app/coord/disputes", label: "Dispute Mediation", icon: ShieldAlert },
    { to: "/app/coord/events", label: "Events Coordinator", icon: Calendar },
    { to: "/app/notices", label: "Notice Board", icon: Megaphone },
    { to: "/app/profile", label: "Profile Settings", icon: UserIcon },
  ],
  resident: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/skills", label: "Skill Exchange", icon: Sparkles },
    { to: "/app/resources", label: "Shared Resources", icon: Package },
    { to: "/app/wallet", label: "My Wallet", icon: Wallet },
    { to: "/app/events", label: "Events Directory", icon: Calendar },
    { to: "/app/complaints", label: "My Complaints", icon: AlertCircle },
    { to: "/app/notices", label: "Broadcast Notices", icon: Megaphone },
    { to: "/app/chat", label: "Direct Messages", icon: MessageSquare },
    { to: "/app/profile", label: "Profile Settings", icon: UserIcon },
  ],
};

export function AppShell({ children }: { children?: ReactNode }) {
  const { user, effectiveRole, viewMode, setViewMode, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const nav = NAV[effectiveRole];
  const isCoord = user.isCoordinator;

  const toggleView = () => {
    setViewMode(viewMode === "coordinator" ? "resident" : "coordinator");
    navigate({ to: "/app/dashboard" });
  };


  return (
    <div className="min-h-screen bg-panel/30 flex flex-col font-body">
      {/* Sleek top loading progress bar */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-line-strong overflow-hidden">
          <div className="h-full bg-deep-forest w-full -translate-x-full animate-loading-bar" />
        </div>
      )}
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-white/95 backdrop-blur-md px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden hover:bg-surface-variant transition-colors cursor-pointer"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5 text-ink" /> : <Menu className="h-5 w-5 text-ink" />}
          </Button>
          
          <Link to="/app/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-deep-forest flex items-center justify-center text-white font-bold text-base shadow-sm">
              C
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="font-bold text-ink tracking-tight leading-none text-sm">CEN Network</span>
              <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">Community Hub</span>
            </div>
          </Link>

          <Badge className="hidden xl:inline-flex bg-deep-forest/10 hover:bg-deep-forest/15 text-deep-forest border border-deep-forest/20 text-[10px] uppercase font-bold py-0.5 px-2.5 rounded-full tracking-wider">
            {effectiveRole === "owner" ? "System Manager" : effectiveRole}
          </Badge>
        </div>

        {/* Top bar Actions */}
        <div className="flex items-center gap-3">
          {(effectiveRole === "resident" || effectiveRole === "coordinator") && (
            <Link to="/app/wallet">
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-xs hover:bg-panel transition-all shadow-sm">
                <Wallet className="h-4 w-4 text-deep-forest" />
                <span className="font-bold text-ink">{user.creditBalance}</span>
                <span className="text-on-surface-variant hidden md:inline">Credits</span>
                <span className="text-on-surface-variant inline md:hidden">Crd</span>
              </div>
            </Link>
          )}

          {isCoord && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleView} 
              className="hidden sm:inline-flex text-[11px] font-bold border-line-strong hover:bg-panel rounded-lg cursor-pointer h-[32px] px-3.5"
            >
              <Repeat className="mr-1.5 h-3.5 w-3.5 text-on-surface-variant" />
              <span className="hidden lg:inline">
                {viewMode === "coordinator" ? "Resident Console" : "Coordinator Console"}
              </span>
              <span className="inline lg:hidden">
                {viewMode === "coordinator" ? "Resident" : "Coordinator"}
              </span>
            </Button>
          )}

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2.5 border-l border-line pl-3">
            <Link to="/app/profile">
              <div className="h-9 w-9 rounded-full bg-deep-forest/10 border border-deep-forest/20 flex items-center justify-center text-xs font-bold text-deep-forest hover:bg-deep-forest/15 transition-all shadow-inner">
                {getInitials(user.name)}
              </div>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowLogoutConfirm(true)}
              className="hover:bg-rose-50 hover:text-rose-600 transition-all rounded-lg cursor-pointer h-9 w-9 text-on-surface-variant"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Mobile menu overlay background */}
        {open && (
          <div 
            className="fixed inset-0 top-16 bg-slate-900/20 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <aside
          onMouseEnter={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) {
              setOpen(true);
            }
          }}
          onMouseLeave={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) {
              setOpen(false);
            }
          }}
          className={cn(
            "fixed inset-y-0 top-16 left-0 z-30 shrink-0 border-r border-line bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 group",
            open ? "translate-x-0 shadow-xl lg:shadow-none" : "-translate-x-full lg:translate-x-0"
          )}
          style={{
            width: open ? '256px' : '76px',
            transition: 'width 300ms cubic-bezier(0.4,0,0.2,1), transform 300ms cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
          }}
        >
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              padding: '16px 14px',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                overflowY: 'auto',
                overflowX: 'hidden',
                maxHeight: 'calc(100vh - 12rem)',
              }}
              className="scrollbar-none"
            >
              <div className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 whitespace-nowrap opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300"
                style={{ paddingLeft: '10px' }}
              >
                Navigation
              </div>
              {nav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (item.to !== "/app/dashboard" && pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexShrink: 0,
                      width: '40px',
                      height: '40px',
                      minWidth: open ? '228px' : '40px',
                      borderRadius: '9999px',
                      paddingLeft: '10px',
                      paddingRight: open ? '14px' : '10px',
                      border: 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      backgroundColor: active ? '#2d6a4f' : 'transparent',
                      color: active ? '#ffffff' : '#6b7280',
                      transition: 'min-width 300ms cubic-bezier(0.4,0,0.2,1), background-color 150ms, color 150ms, padding 300ms cubic-bezier(0.4,0,0.2,1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f4f6';
                        (e.currentTarget as HTMLElement).style.color = '#374151';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#6b7280';
                      }
                    }}
                  >
                    <span style={{ display: 'flex', flexShrink: 0, width: 20, height: 20 }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        opacity: open ? 1 : 0,
                        transition: `opacity ${open ? '160ms' : '80ms'} ease`,
                        transitionDelay: open ? '160ms' : '0ms',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Bottom Profile card */}
            <div className="pt-4 border-t border-line/65 flex flex-col gap-3 overflow-hidden">
              <div
                className="flex items-center whitespace-nowrap"
                style={{
                  gap: '10px',
                  paddingLeft: '2px',
                  paddingRight: open ? '14px' : '2px',
                  transition: 'padding 300ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                <div className="h-9 w-9 rounded-xl bg-soft-violet/10 border border-soft-violet/20 flex items-center justify-center text-xs font-bold text-soft-violet flex-shrink-0">
                  {getInitials(user.name)}
                </div>
                <div
                  className="min-w-0"
                  style={{
                    opacity: open ? 1 : 0,
                    transition: `opacity ${open ? '160ms' : '80ms'} ease`,
                    transitionDelay: open ? '160ms' : '0ms',
                  }}
                >
                  <div className="text-xs font-bold text-ink truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-on-surface-variant truncate mt-0.5">{user.email}</div>
                </div>
              </div>
              
              {isCoord && (
                <button 
                  onClick={toggleView}
                  className="w-full sm:hidden flex items-center justify-center gap-2 border border-line-strong hover:bg-panel text-ink text-[10px] font-bold py-2 rounded-xl cursor-pointer transition-all"
                >
                  <Repeat className="h-3.5 w-3.5 flex-shrink-0" /> Toggle Role view
                </button>
              )}
            </div>
          </nav>
        </aside>

        {/* Main Work Area */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 bg-surface-variant/20 overflow-y-auto">
          <div 
            key={pathname} 
            className="max-w-[1600px] mx-auto animate-page-fade"
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-5">
                <div className="relative flex items-center justify-center w-16 h-16">
                  {/* Outer green loop matching ring */}
                  <div className="absolute inset-0 rounded-full border border-dashed border-deep-forest/40 animate-[spin_8s_linear_infinite]" />
                  {/* Mid violet transaction flow arc */}
                  <div className="absolute w-11 h-11 rounded-full border-2 border-t-soft-violet border-r-transparent border-b-soft-violet border-l-transparent animate-[spin_1.5s_linear_infinite_reverse]" />
                  {/* Core pulsing brand gradient sphere with a central 'C' */}
                  <div className="absolute w-7 h-7 rounded-full bg-gradient-to-tr from-deep-forest to-soft-violet flex items-center justify-center shadow-md shadow-deep-forest/20 animate-pulse">
                    <span className="text-[10px] font-extrabold text-white select-none leading-none">C</span>
                  </div>
                  <div className="absolute w-4 h-4 rounded-full bg-white opacity-40 animate-ping" />
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <span className="text-[10px] font-bold text-ink uppercase tracking-[0.3em] animate-pulse">
                    Connecting Loop
                  </span>
                  <span className="text-[9px] text-on-surface-variant font-medium tracking-wide">
                    Resolving community exchange ledger...
                  </span>
                </div>
              </div>
            ) : (
              children ?? <Outlet />
            )}
          </div>
        </main>
      </div>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="bg-white border-line/60 rounded-2xl shadow-xl max-w-sm p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <LogOut className="h-5 w-5 text-rose-600 flex-shrink-0" />
              Confirm Log Out
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to log out? You will be disconnected from your current session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex gap-2">
            <AlertDialogCancel className="h-9 px-4 text-xs font-semibold rounded-lg border-line-strong hover:bg-panel cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="h-9 px-4 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-98 transition-all"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/45 pb-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl font-headline-lg leading-tight">{title}</h1>
        {description && <p className="mt-1 text-xs text-on-surface-variant leading-normal">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
