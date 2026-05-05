'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress, Typography } from '@mui/material';

const DynamicGraphViewer = dynamic(() => import('@/components/notes/NotesGraphViewer'), { 
  ssr: false,
  loading: () => (
    <Box sx={{ display: 'flex', height: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a', flexDirection: 'column', gap: 2 }}>
      <CircularProgress sx={{ color: '#00e5ff' }} />
      <Typography sx={{ color: '#00e5ff', animation: 'pulse 1.5s infinite' }}>Initializing Neuromorphic Map Engine...</Typography>
    </Box>
  )
});

export default function NotesGraphPage() {
  return (
    <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
        <DynamicGraphViewer />
    </Box>
  );
}
