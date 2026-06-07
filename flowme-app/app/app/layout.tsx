'use client';

import * as React from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  useMediaQuery, useTheme, Tooltip,
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
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UI, type UiLang, resolveUiLang } from '@/lib/i18n';
import { applyDayjsLocale } from '@/lib/datetime';
import RecordingProvider from '@/components/meetings/RecordingProvider';
import FloatingRecorderPopup from '@/components/meetings/FloatingRecorderPopup';
import BalysIcon from '@/components/brand/BalysIcon';

const drawerWidth = 240;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [uiLang, setUiLang] = React.useState<UiLang>('en');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathname = usePathname();
  const router = useRouter();

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

  const menuItems = [
    { text: nav.today,      icon: <TodayIcon             sx={{ fontSize: 20 }} />, path: '/app/today' },
    { text: nav.goals,      icon: <TrackChangesIcon      sx={{ fontSize: 20 }} />, path: '/app/goals' },
    { text: nav.calendar,   icon: <CalendarMonthIcon     sx={{ fontSize: 20 }} />, path: '/app/calendar' },
    { text: nav.finance,    icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />, path: '/app/finance' },
    { text: nav.notes,      icon: <NoteIcon              sx={{ fontSize: 20 }} />, path: '/app/notes' },
    { text: nav.reviews,    icon: <RateReviewIcon        sx={{ fontSize: 20 }} />, path: '/app/reviews' },
    { text: nav.balysAi,    icon: <BalysIcon             sx={{ fontSize: 20 }} />, path: '/app/ai' },
    { text: nav.connectors, icon: <ElectricalServicesIcon sx={{ fontSize: 20 }} />, path: '/app/connectors' },
    { text: nav.tutorials,  icon: <SchoolIcon             sx={{ fontSize: 20 }} />, path: '/app/tutorials' },
    { text: nav.support,    icon: <SupportAgentIcon       sx={{ fontSize: 20 }} />, path: '/app/support' },
    { text: nav.settings,   icon: <SettingsIcon           sx={{ fontSize: 20 }} />, path: '/app/settings' },
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
      <List sx={{ px: 0.5, flex: 1 }}>
        {menuItems.map((item) => {
          const active = pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={active}
                onClick={(event) => {
                  if (item.path === '/app/ai') {
                    event.preventDefault();
                    openBalysFreshChat();
                  }
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{ py: 1, pl: active ? '13px' : '16px' }}
              >
                <ListItemIcon sx={{ color: active ? 'primary.light' : 'text.secondary', minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : 400,
                    fontSize: 14,
                    color: active ? 'primary.light' : 'text.secondary',
                  }}
                />
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
      <List sx={{ px: 0.5, py: 1 }}>
        <ListItem disablePadding>
          <Tooltip title={nav.logOut} placement="right">
            <ListItemButton onClick={handleLogout} sx={{ borderRadius: '0 8px 8px 0', py: 1 }}>
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
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop permanent drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
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
          overflow: 'hidden',
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
