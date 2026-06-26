'use client';

import { Box } from '@mui/material';

const ribbonAMask = `url("data:image/svg+xml,%3Csvg viewBox='0 0 1200 360' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'%3E%3Cpath d='M-30 214 C112 110 230 306 380 190 C532 72 650 256 810 146 C958 44 1060 146 1230 96' fill='none' stroke='white' stroke-width='104' stroke-linecap='round'/%3E%3C/svg%3E")`;
const ribbonBMask = `url("data:image/svg+xml,%3Csvg viewBox='0 0 1200 360' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'%3E%3Cpath d='M-40 172 C118 260 230 84 392 178 C548 270 650 106 812 198 C962 284 1074 138 1240 202' fill='none' stroke='white' stroke-width='92' stroke-linecap='round'/%3E%3C/svg%3E")`;

export default function WaveBackground() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        bgcolor: '#03050c',
        zIndex: 0,
        '@keyframes auroraDrift': {
          '0%': { transform: 'translate3d(-8%, -4%, 0) rotate(-8deg) scale(1.08)' },
          '50%': { transform: 'translate3d(6%, 5%, 0) rotate(5deg) scale(1.14)' },
          '100%': { transform: 'translate3d(-8%, -4%, 0) rotate(-8deg) scale(1.08)' },
        },
        '@keyframes waveRibbonA': {
          '0%': { transform: 'translate3d(-12%, 0, 0) skewY(-4deg)', backgroundPosition: '0% 50%' },
          '50%': { transform: 'translate3d(4%, -4%, 0) skewY(2deg)', backgroundPosition: '62% 50%' },
          '100%': { transform: 'translate3d(-12%, 0, 0) skewY(-4deg)', backgroundPosition: '0% 50%' },
        },
        '@keyframes waveRibbonB': {
          '0%': { transform: 'translate3d(8%, 3%, 0) skewY(3deg)', backgroundPosition: '100% 50%' },
          '50%': { transform: 'translate3d(-8%, -2%, 0) skewY(-3deg)', backgroundPosition: '36% 50%' },
          '100%': { transform: 'translate3d(8%, 3%, 0) skewY(3deg)', backgroundPosition: '100% 50%' },
        },
        '@keyframes waveLines': {
          '0%': { transform: 'translate3d(-7%, 0, 0) scaleX(1.08)', backgroundPosition: '0 0' },
          '50%': { transform: 'translate3d(4%, -3%, 0) scaleX(1.14)', backgroundPosition: '340px 0' },
          '100%': { transform: 'translate3d(-7%, 0, 0) scaleX(1.08)', backgroundPosition: '0 0' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& *': {
            animationDuration: '1ms !important',
            animationIterationCount: '1 !important',
          },
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: '-18%',
          background: [
            'linear-gradient(112deg, rgba(44,123,229,0.28), rgba(7,13,28,0) 38%)',
            'linear-gradient(214deg, rgba(154,92,255,0.22), rgba(5,9,20,0) 42%)',
            'linear-gradient(16deg, rgba(36,211,181,0.12), rgba(247,181,56,0.10) 46%, rgba(5,8,17,0) 70%)',
          ].join(','),
          filter: 'blur(26px)',
          opacity: 0.82,
          animation: 'auroraDrift 20s ease-in-out infinite',
          willChange: 'transform',
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(3,5,12,0.18), rgba(3,5,12,0.58) 58%, rgba(3,5,12,0.86))',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: '-24%',
          right: '-24%',
          bottom: '-4%',
          height: { xs: '46vh', md: '40vh' },
          background: 'linear-gradient(92deg, rgba(37,99,235,0), rgba(65,214,191,0.44) 24%, rgba(132,92,255,0.42) 52%, rgba(250,204,21,0.16) 74%, rgba(37,99,235,0))',
          maskImage: ribbonAMask,
          WebkitMaskImage: ribbonAMask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          filter: 'blur(16px)',
          opacity: 0.82,
          mixBlendMode: 'screen',
          animation: 'waveRibbonA 15s ease-in-out infinite',
          willChange: 'transform, background-position',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '-28%',
          right: '-28%',
          bottom: '-12%',
          height: { xs: '48vh', md: '42vh' },
          background: 'linear-gradient(86deg, rgba(13,148,136,0), rgba(32,119,255,0.36) 18%, rgba(176,92,255,0.34) 49%, rgba(244,114,182,0.18) 70%, rgba(13,148,136,0))',
          maskImage: ribbonBMask,
          WebkitMaskImage: ribbonBMask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          filter: 'blur(12px)',
          opacity: 0.74,
          mixBlendMode: 'screen',
          animation: 'waveRibbonB 18s ease-in-out infinite',
          willChange: 'transform, background-position',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '-10%',
          right: '-10%',
          bottom: '2%',
          height: { xs: '34vh', md: '30vh' },
          opacity: 0.42,
          mixBlendMode: 'screen',
          backgroundRepeat: 'repeat-x',
          backgroundSize: '720px 100%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 720 260' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'%3E%3Cpath d='M0 152 C86 102 146 204 236 142 C326 80 396 180 496 118 C592 58 644 122 720 92' fill='none' stroke='%235eead4' stroke-width='2.2' stroke-opacity='.58'/%3E%3Cpath d='M0 190 C94 136 150 224 248 168 C342 114 430 190 532 146 C616 110 660 142 720 128' fill='none' stroke='%23818cf8' stroke-width='1.8' stroke-opacity='.52'/%3E%3Cpath d='M0 116 C84 82 158 158 250 108 C342 58 414 134 516 82 C606 36 662 78 720 58' fill='none' stroke='%23f472b6' stroke-width='1.6' stroke-opacity='.34'/%3E%3C/svg%3E")`,
          maskImage: 'linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)',
          animation: 'waveLines 14s ease-in-out infinite',
          willChange: 'transform, background-position',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.14), transparent 70%)',
          opacity: 0.32,
        }}
      />
    </Box>
  );
}
