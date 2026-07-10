'use client';

import * as React from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  useMediaQuery, useTheme, Tooltip, Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import NoteIcon from '@mui/icons-material/Note';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import SchoolIcon from '@mui/icons-material/School';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';
import { applyDayjsLocale } from '@/lib/datetime';
import RecordingProvider from '@/components/meetings/RecordingProvider';
import FloatingRecorderPopup from '@/components/meetings/FloatingRecorderPopup';
import BalysIcon from '@/components/brand/BalysIcon';
import { SubscriptionProvider, useSubscription } from '@/components/billing/SubscriptionProvider';
import type { FeatureKey } from '@/lib/billing/entitlements';

const drawerWidth = 240;

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [uiLang, setUiLang] = React.useState<UiLang>('en');
  const [currentUser, setCurrentUser] = React.useState<{ email: string | null; name: string | null; avatar_url: string | null } | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathname = usePathname();
  const router = useRouter();
  const { isAllowed, openUpgrade } = useSubscription();

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ui_language') : null;
    const resolved = resolveUiLang(stored);
    setUiLang(resolved);
    applyDayjsLocale(resolved);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ui_language') {
        const next = resolveUiLang(e.newValue);
        setUiLang(next);
        applyDayjsLocale(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    fetch('/api/me')
      .then((res) => res.ok ? res.json() : null)
      .then((body) => {
        if (body?.ok && body.user) setCurrentUser(body.user);
      })
      .catch(() => { /* keep fallback footer */ });
  }, []);

  // Parallax: update --sidebar-parallax-y on main content scroll
  React.useEffect(() => {
    const handler = () => {
      const scrollable = document.querySelector('[data-main-scroll]') as HTMLElement | null
        ?? document.querySelector('main') as HTMLElement | null;
      const scrollTop = scrollable?.scrollTop ?? window.scrollY;
      const offset = Math.min(0, Math.max(-28, -(scrollTop * 0.14)));
      document.documentElement.style.setProperty('--sidebar-parallax-y', `${offset}px`);
    };

    window.addEventListener('scroll', handler, { passive: true });
    const main = document.querySelector('[data-main-scroll]') ?? document.querySelector('main');
    main?.addEventListener('scroll', handler, { passive: true });

    return () => {
      window.removeEventListener('scroll', handler);
      main?.removeEventListener('scroll', handler);
    };
  }, [pathname]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const nav = UI[uiLang].nav;

  const openBalysFreshChat = React.useCallback(() => {
    if (pathname.startsWith('/app/ai')) {
      window.dispatchEvent(new CustomEvent('balys:new-chat'));
      router.replace(`/app/ai?new=${Date.now()}`, { scroll: false });
      return;
    }
    router.push(`/app/ai?new=${Date.now()}`);
  }, [pathname, router]);

  const menuItems: Array<{ text: string; icon: React.ReactNode; path: string; feature?: FeatureKey; color: string }> = [
    { text: nav.today,      icon: <TodayIcon             sx={{ fontSize: 20 }} />, path: '/app/today', feature: 'today', color: '#38bdf8' },
    { text: nav.goals,      icon: <TrackChangesIcon      sx={{ fontSize: 20 }} />, path: '/app/goals', feature: 'goals', color: '#f97316' },
    { text: nav.calendar,   icon: <CalendarMonthIcon     sx={{ fontSize: 20 }} />, path: '/app/calendar', feature: 'calendar', color: '#60a5fa' },
    { text: nav.finance,    icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />, path: '/app/finance', feature: 'finance', color: '#34d399' },
    { text: nav.checklists, icon: <ChecklistRoundedIcon  sx={{ fontSize: 20 }} />, path: '/app/checklists', color: '#4ade80' },
    { text: nav.notes,      icon: <NoteIcon              sx={{ fontSize: 20 }} />, path: '/app/notes', color: '#facc15' },
    { text: nav.reviews,    icon: <RateReviewIcon        sx={{ fontSize: 20 }} />, path: '/app/reviews', feature: 'reviews', color: '#fb7185' },
    { text: nav.balysAi,    icon: <BalysIcon             sx={{ fontSize: 22 }} />, path: '/app/ai', color: '#a78bfa' },
    { text: nav.connectors, icon: <ElectricalServicesIcon sx={{ fontSize: 20 }} />, path: '/app/connectors', feature: 'connectors', color: '#22d3ee' },
    { text: nav.tutorials,  icon: <SchoolIcon             sx={{ fontSize: 20 }} />, path: '/app/tutorials', color: '#818cf8' },
    { text: nav.support,    icon: <SupportAgentIcon       sx={{ fontSize: 20 }} />, path: '/app/support', color: '#2dd4bf' },
    ...(currentUser?.email?.toLowerCase() === 'victorrayansouzaramos@gmail.com'
      ? [{ text: 'Admin', icon: <QueryStatsRoundedIcon sx={{ fontSize: 20 }} />, path: '/app/admin/marketing', color: '#35dc9b' }]
      : []),
    { text: nav.settings,   icon: <SettingsIcon           sx={{ fontSize: 20 }} />, path: '/app/settings', color: '#cbd5e1' },
  ];

  const drawer = (
    <Box className="sidebar-bg">
      {/* Logo */}
      <Box sx={{ px: 2, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          component="img"
          src="/brand/flowme-icon.png"
          alt="Flow Me"
          sx={{ width: 36, height: 36, flexShrink: 0, objectFit: 'contain' }}
        />
        <Typography
          variant="h6"
          noWrap
          sx={{
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '-0.4px',
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Flow Me
        </Typography>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {/* Nav items */}
      <List sx={{ px: 0.5, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {menuItems.map((item) => {
          const active = pathname.startsWith(item.path);
          const locked = Boolean(item.feature && !isAllowed(item.feature));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={active}
                onClick={(event) => {
                  if (locked && item.feature) {
                    event.preventDefault();
                    openUpgrade({ feature: item.feature });
                  }
                  if (item.path === '/app/ai') {
                    event.preventDefault();
                    openBalysFreshChat();
                  }
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  py: 1,
                  pl: active ? '13px' : locked ? '14px' : '16px',
                  pr: locked ? 1 : 2,
                  borderRadius: '0 10px 10px 0',
                  borderLeft: locked ? '2px solid rgba(251, 146, 60, 0.72)' : '2px solid transparent',
                  background: locked
                    ? 'linear-gradient(90deg, rgba(249, 115, 22, 0.13) 0%, rgba(249, 115, 22, 0.035) 100%)'
                    : undefined,
                  '&:hover': locked ? {
                    background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.22) 0%, rgba(249, 115, 22, 0.07) 100%)',
                    borderLeftColor: '#fb923c',
                  } : undefined,
                  '&.Mui-selected': locked ? {
                    background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.23) 0%, rgba(99, 102, 241, 0.1) 100%)',
                  } : undefined,
                }}
              >
                <ListItemIcon sx={{ color: locked ? '#f6ad55' : item.color, minWidth: 36, opacity: active ? 1 : 0.82, filter: active ? `drop-shadow(0 0 8px ${item.color}55)` : 'none' }}>
                  <Box sx={{ color: 'inherit', display: 'grid', placeItems: 'center' }}>{item.icon}</Box>
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : locked ? 550 : 400,
                    fontSize: 14,
                    color: active ? 'primary.light' : locked ? 'rgba(255, 190, 120, 0.9)' : 'text.secondary',
                  }}
                />
                {locked && (
                  <Tooltip title={uiLang === 'pt' ? 'Disponível no Pro' : 'Available on Pro'} placement="right">
                    <Box
                      aria-label={uiLang === 'pt' ? 'Recurso bloqueado no plano Free' : 'Feature locked on the Free plan'}
                      sx={{
                        width: 26,
                        height: 26,
                        mr: 0.5,
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#ffb35c',
                        bgcolor: 'rgba(249, 115, 22, 0.16)',
                        border: '1px solid rgba(251, 146, 60, 0.5)',
                        boxShadow: '0 0 12px rgba(249, 115, 22, 0.16), inset 0 0 8px rgba(251, 146, 60, 0.08)',
                        flexShrink: 0,
                      }}
                    >
                      <LockRoundedIcon sx={{ fontSize: 15 }} />
                    </Box>
                  </Tooltip>
                )}
                {active && (
                  <Box sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    boxShadow: '0 0 6px rgba(99,102,241,0.8)',
                    mr: 0.5,
                    flexShrink: 0,
                  }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Footer: logout */}
      <Box sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.1, flexShrink: 0 }}>
        <Avatar
          src={currentUser?.avatar_url || undefined}
          alt={currentUser?.name || currentUser?.email || 'User'}
          sx={{ width: 34, height: 34, border: '1px solid rgba(129,140,248,0.28)', bgcolor: 'rgba(99,102,241,0.18)' }}
        >
          {currentUser?.name?.[0] || currentUser?.email?.[0] || 'F'}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 750, color: 'text.primary', maxWidth: 150 }}>{currentUser?.name || 'Flow Me'}</Typography>
          <Typography variant="caption" noWrap sx={{ color: 'text.disabled', display: 'block', maxWidth: 150 }}>{currentUser?.email || (uiLang === 'pt' ? 'Conta conectada' : 'Connected account')}</Typography>
        </Box>
      </Box>
      <List sx={{ px: 0.5, pb: 1, pt: 0, flexShrink: 0 }}>
        <ListItem disablePadding>
          <Tooltip title={nav.logOut} placement="right">
            <ListItemButton onClick={handleLogout} aria-label={nav.logOut} sx={{ borderRadius: '0 8px 8px 0', py: 1, minHeight: 44 }}>
              <ListItemIcon sx={{ color: 'text.disabled', minWidth: 36 }}>
                <LogoutIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={nav.logOut}
                primaryTypographyProps={{ fontSize: 14, color: 'text.disabled' }}
              />
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <RecordingProvider>
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap fontWeight={600} sx={{ letterSpacing: '-0.2px' }}>
            {menuItems.find(i => pathname.startsWith(i.path))?.text || 'Flow Me'}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, height: '100dvh' },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop permanent drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, height: '100dvh' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        data-main-scroll
        sx={{
          flexGrow: 1,
          p: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          height: '100%',
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          pt: { xs: '56px', sm: '64px', md: 0 },
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
      <FloatingRecorderPopup />
    </Box>
    </RecordingProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SubscriptionProvider>
  );
}
