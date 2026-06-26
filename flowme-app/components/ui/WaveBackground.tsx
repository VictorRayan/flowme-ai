'use client';

import { Box } from '@mui/material';

export default function WaveBackground() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        bgcolor: '#040711',
        zIndex: 0,
        '@keyframes moveWave1': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        '@keyframes moveWave2': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        '@keyframes moveWave3': {
          '0%': { transform: 'translateX(-25%)' },
          '100%': { transform: 'translateX(-75%)' },
        },
        // Base dark blue/purple glow in the background
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(circle at 20% 30%, rgba(37,99,235,0.15), transparent 40%)',
            'radial-gradient(circle at 75% 65%, rgba(168,85,247,0.12), transparent 45%)',
            'radial-gradient(circle at 50% 100%, rgba(34,211,238,0.10), transparent 50%)',
          ].join(','),
        },
      }}
    >
      {/* Wave 1: Slow, large, back */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '200%',
          height: '40vh',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: '0 bottom',
          backgroundSize: '50% 100%',
          backgroundImage: `url('data:image/svg+xml;utf8,<svg viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,150 C300,300 300,0 600,150 C900,300 900,0 1200,150 L1200,300 L0,300 Z" fill="rgba(37, 99, 235, 0.08)"/></svg>')`,
          animation: 'moveWave1 25s linear infinite',
          transformOrigin: 'bottom',
        }}
      />

      {/* Wave 2: Medium speed, middle */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '200%',
          height: '35vh',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: '0 bottom',
          backgroundSize: '50% 100%',
          backgroundImage: `url('data:image/svg+xml;utf8,<svg viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,200 C300,50 300,300 600,150 C900,0 900,250 1200,100 L1200,300 L0,300 Z" fill="rgba(168, 85, 247, 0.12)"/></svg>')`,
          animation: 'moveWave2 18s linear infinite',
          transformOrigin: 'bottom',
        }}
      />

      {/* Wave 3: Fast, front */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '200%',
          height: '25vh',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: '0 bottom',
          backgroundSize: '50% 100%',
          backgroundImage: `url('data:image/svg+xml;utf8,<svg viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0,100 C300,250 400,0 600,100 C800,200 900,50 1200,150 L1200,300 L0,300 Z" fill="rgba(34, 211, 238, 0.18)"/></svg>')`,
          animation: 'moveWave3 12s linear infinite',
          transformOrigin: 'bottom',
          backdropFilter: 'blur(2px)',
        }}
      />
    </Box>
  );
}
