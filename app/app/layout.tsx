'use client';

import * as React from 'react';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  useMediaQuery, useTheme, Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import NoteIcon from '@mui/icons-material/Note';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ChecklistIcon from '@mui/icons-material/Checklist';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const drawerWidth = 240;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathname = usePathname();
  const router = useRouter();

  // Parallax: update --sidebar-parallax-y on main content scroll
  React.useEffect(() => {
    const handler = () => {
      // Find the scrollable main content — any element with overflow scroll/auto
      const scrollable = document.querySelector('[data-main-scroll]') as HTMLElement | null
        ?? document.querySelector('main') as HTMLElement | null;
      const scrollTop = scrollable?.scrollTop ?? window.scrollY;
      const offset = Math.min(0, Math.max(-28, -(scrollTop * 0.14)));
      document.documentElement.style.setProperty('--sidebar-parallax-y', `${offset}px`);
    };

    // Attach to both window and any scrollable child
    window.addEventListener('scroll', handler, { passive: true });
    const main = document.querySelector('[data-main-scroll]') ?? document.querySelector('main');
    main?.addEventListener('scroll', handler, { passive: true });

    return () => {
      window.removeEventListener('scroll', handler);
      main?.removeEventListener('scroll', handler);
    };
  }, [pathname]); // re-attach on page change

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { text: 'Flow',       icon: <ViewAgendaIcon        sx={{ fontSize: 20 }} />, path: '/app/flow' },
    { text: 'Calendar',   icon: <CalendarMonthIcon     sx={{ fontSize: 20 }} />, path: '/app/calendar' },
    { text: 'Notes',      icon: <NoteIcon              sx={{ fontSize: 20 }} />, path: '/app/notes' },
    { text: 'Cowork',     icon: <ChecklistIcon         sx={{ fontSize: 20 }} />, path: '/app/tasks' },
    { text: 'BalysAI',   icon: <SmartToyIcon           sx={{ fontSize: 20 }} />, path: '/app/ai' },
    { text: 'Connectors', icon: <ElectricalServicesIcon sx={{ fontSize: 20 }} />, path: '/app/connectors' },
    { text: 'Settings',   icon: <SettingsIcon           sx={{ fontSize: 20 }} />, path: '/app/settings' },
  ];

  const drawer = (
    <Box className="sidebar-bg">
      {/* Logo */}
      <Box sx={{ px: 2, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Logo mark */}
        <Box sx={{
          width: 30,
          height: 30,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 14px rgba(99,102,241,0.45)',
          flexShrink: 0,
        }}>
          <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.5px' }}>
            F
          </Typography>
        </Box>
        {/* Gradient wordmark */}
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
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={active}
                onClick={() => isMobile && setMobileOpen(false)}
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
                {/* Active dot indicator */}
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
          <Tooltip title="Log out" placement="right">
            <ListItemButton onClick={handleLogout} sx={{ borderRadius: '0 8px 8px 0', py: 1 }}>
              <ListItemIcon sx={{ color: 'text.disabled', minWidth: 36 }}>
                <LogoutIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary="Log out"
                primaryTypographyProps={{ fontSize: 14, color: 'text.disabled' }}
              />
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  return (
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
    </Box>
  );
}
