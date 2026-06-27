'use client';

import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

type Particle = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  row: number;
  col: number;
};

type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

export default function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rows = 0;
    let cols = 0;
    let animationFrame = 0;
    let tick = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particles: Particle[] = [];
    const pointer: PointerState = { x: 0, y: 0, active: false };

    const createParticles = () => {
      particles = [];
      const spacing = Math.max(20, Math.min(30, width / 54));
      cols = Math.ceil(width / spacing) + 5;
      rows = Math.ceil(height / spacing) + 5;
      const offsetX = (width - (cols - 1) * spacing) / 2;
      const offsetY = (height - (rows - 1) * spacing) / 2;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const wave = Math.sin(col * 0.55) * 10 + Math.cos(row * 0.42) * 8;
          const x = offsetX + col * spacing + Math.sin(row * 1.7 + col) * 5;
          const y = offsetY + row * spacing + wave;
          const colorBand = (row / Math.max(rows - 1, 1)) * 56 + (col / Math.max(cols - 1, 1)) * 34;
          particles.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: 0,
            vy: 0,
            size: 0.7 + ((row * 17 + col * 13) % 10) / 12,
            hue: 178 + colorBand,
            row,
            col,
          });
        }
      }
    };

    const resize = () => {
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      pointer.x = width * 0.5;
      pointer.y = height * 0.54;
      createParticles();
    };

    const updatePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const stopPointer = () => {
      pointer.active = false;
    };

    const drawParticle = (particle: Particle) => {
      const glow = pointer.active ? 0.78 : 0.54;
      context.beginPath();
      context.fillStyle = `hsla(${particle.hue}, 88%, 68%, ${glow})`;
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    };

    const drawConnection = (particle: Particle, neighbor: Particle | undefined) => {
      if (!neighbor) return;
      const distanceX = particle.x - neighbor.x;
      const distanceY = particle.y - neighbor.y;
      const distance = Math.hypot(distanceX, distanceY);
      if (distance > 46) return;
      const alpha = Math.max(0, 1 - distance / 46) * 0.2;
      context.beginPath();
      context.strokeStyle = `hsla(${(particle.hue + neighbor.hue) / 2}, 88%, 66%, ${alpha})`;
      context.lineWidth = 0.75;
      context.moveTo(particle.x, particle.y);
      context.lineTo(neighbor.x, neighbor.y);
      context.stroke();
    };

    const drawSingularity = (radius: number) => {
      const x = pointer.x;
      const y = pointer.y;
      const pulse = 1 + Math.sin(tick * 4.4) * 0.035;
      const coreRadius = Math.max(18, Math.min(26, radius * 0.12)) * pulse;
      const diskRadius = Math.max(62, Math.min(92, radius * 0.42)) * pulse;
      const tilt = 0.34;

      const halo = context.createRadialGradient(x, y, coreRadius * 0.2, x, y, diskRadius * 2.15);
      halo.addColorStop(0, 'rgba(2, 6, 23, 0.92)');
      halo.addColorStop(0.18, 'rgba(14, 21, 46, 0.68)');
      halo.addColorStop(0.34, 'rgba(94, 234, 212, 0.14)');
      halo.addColorStop(0.58, 'rgba(129, 140, 248, 0.10)');
      halo.addColorStop(1, 'rgba(3, 5, 12, 0)');
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = halo;
      context.fillRect(x - diskRadius * 2.15, y - diskRadius * 2.15, diskRadius * 4.3, diskRadius * 4.3);

      context.translate(x, y);
      context.rotate(Math.sin(tick * 0.9) * 0.08);

      for (let ring = 0; ring < 4; ring += 1) {
        const ringRadius = diskRadius * (0.72 + ring * 0.13);
        const ringAlpha = 0.34 - ring * 0.055;
        const start = tick * (0.9 + ring * 0.21) + ring * 1.15;
        const end = start + Math.PI * (1.25 + ring * 0.12);
        const gradient = context.createLinearGradient(-ringRadius, 0, ringRadius, 0);
        gradient.addColorStop(0, `rgba(94, 234, 212, ${ringAlpha * 0.45})`);
        gradient.addColorStop(0.46, `rgba(129, 140, 248, ${ringAlpha})`);
        gradient.addColorStop(1, `rgba(244, 114, 182, ${ringAlpha * 0.62})`);
        context.save();
        context.rotate(ring % 2 === 0 ? -0.3 : 0.22);
        context.scale(1, tilt + ring * 0.026);
        context.beginPath();
        context.strokeStyle = gradient;
        context.lineWidth = 1.4 - ring * 0.12;
        context.arc(0, 0, ringRadius, start, end);
        context.stroke();
        context.restore();
      }

      context.save();
      context.rotate(-0.2);
      context.scale(1.18, 0.32);
      const diskGradient = context.createLinearGradient(-diskRadius, 0, diskRadius, 0);
      diskGradient.addColorStop(0, 'rgba(94, 234, 212, 0)');
      diskGradient.addColorStop(0.22, 'rgba(94, 234, 212, 0.42)');
      diskGradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.58)');
      diskGradient.addColorStop(0.76, 'rgba(168, 85, 247, 0.46)');
      diskGradient.addColorStop(1, 'rgba(244, 114, 182, 0)');
      context.beginPath();
      context.strokeStyle = diskGradient;
      context.lineWidth = 3.2;
      context.arc(0, 0, diskRadius * 0.74, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      context.globalCompositeOperation = 'source-over';
      const core = context.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.65);
      core.addColorStop(0, 'rgba(0, 0, 0, 1)');
      core.addColorStop(0.5, 'rgba(1, 5, 16, 0.98)');
      core.addColorStop(0.72, 'rgba(15, 23, 42, 0.72)');
      core.addColorStop(1, 'rgba(94, 234, 212, 0)');
      context.beginPath();
      context.fillStyle = core;
      context.arc(0, 0, coreRadius * 1.65, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.strokeStyle = 'rgba(226, 232, 240, 0.58)';
      context.lineWidth = 0.8;
      context.arc(0, 0, coreRadius * 1.04, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    };

    const render = () => {
      tick += reducedMotion ? 0.002 : 0.008;
      context.clearRect(0, 0, width, height);

      const gradient = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.78);
      gradient.addColorStop(0, 'rgba(18, 24, 46, 0.72)');
      gradient.addColorStop(0.45, 'rgba(7, 10, 22, 0.72)');
      gradient.addColorStop(1, 'rgba(3, 5, 12, 0.98)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      const fieldRadius = Math.min(230, Math.max(150, width * 0.16));
      const fieldRadiusSq = fieldRadius * fieldRadius;

      for (const particle of particles) {
        const ambientX = Math.sin(tick + particle.row * 0.27 + particle.col * 0.1) * 10;
        const ambientY = Math.cos(tick * 0.84 + particle.col * 0.22) * 8;
        let targetX = particle.baseX + ambientX;
        let targetY = particle.baseY + ambientY;

        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < fieldRadiusSq) {
          const distance = Math.max(Math.sqrt(distanceSq), 1);
          const force = (1 - distance / fieldRadius) ** 2;
          const angle = Math.atan2(dy, dx);
          const orbit = angle + Math.PI * 0.5;
          const eventHorizon = Math.max(34, fieldRadius * 0.16);
          const inward = distance < eventHorizon ? -distance * 0.34 : -fieldRadius * 0.46;
          const orbital = 68 + Math.sin(tick * 1.6 + particle.row * 0.22 + particle.col * 0.14) * 10;
          const shear = Math.max(0, 1 - Math.abs(distance - eventHorizon * 1.45) / (fieldRadius * 0.62));
          targetX += Math.cos(angle) * force * inward + Math.cos(orbit) * force * orbital + Math.cos(angle) * shear * 10;
          targetY += Math.sin(angle) * force * inward + Math.sin(orbit) * force * orbital + Math.sin(angle) * shear * 10;
        }

        particle.vx += (targetX - particle.x) * 0.045;
        particle.vy += (targetY - particle.y) * 0.045;
        particle.vx *= reducedMotion ? 0.68 : 0.86;
        particle.vy *= reducedMotion ? 0.68 : 0.86;
        particle.x += particle.vx;
        particle.y += particle.vy;
      }

      context.save();
      context.globalCompositeOperation = 'lighter';

      for (const particle of particles) {
        const index = particle.row * cols + particle.col;
        drawConnection(particle, particles[index + 1]);
        drawConnection(particle, particles[index + cols]);
      }

      for (const particle of particles) {
        drawParticle(particle);
      }

      const pointerGlow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, fieldRadius * 1.1);
      pointerGlow.addColorStop(0, pointer.active ? 'rgba(94, 234, 212, 0.22)' : 'rgba(129, 140, 248, 0.08)');
      pointerGlow.addColorStop(0.48, pointer.active ? 'rgba(129, 140, 248, 0.12)' : 'rgba(129, 140, 248, 0.04)');
      pointerGlow.addColorStop(1, 'rgba(3, 5, 12, 0)');
      context.fillStyle = pointerGlow;
      context.fillRect(pointer.x - fieldRadius * 1.1, pointer.y - fieldRadius * 1.1, fieldRadius * 2.2, fieldRadius * 2.2);
      drawSingularity(fieldRadius);
      context.restore();

      const veil = context.createLinearGradient(0, 0, 0, height);
      veil.addColorStop(0, 'rgba(3, 5, 12, 0.16)');
      veil.addColorStop(0.48, 'rgba(3, 5, 12, 0.34)');
      veil.addColorStop(1, 'rgba(3, 5, 12, 0.78)');
      context.fillStyle = veil;
      context.fillRect(0, 0, width, height);

      animationFrame = window.requestAnimationFrame(render);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };

    resize();
    render();

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerdown', updatePointer, { passive: true });
    window.addEventListener('pointerleave', stopPointer);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerdown', updatePointer);
      window.removeEventListener('pointerleave', stopPointer);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

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
        '&:before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(circle at 26% 24%, rgba(59,130,246,0.16), transparent 32%)',
            'radial-gradient(circle at 76% 18%, rgba(139,92,246,0.14), transparent 34%)',
            'radial-gradient(circle at 54% 72%, rgba(20,184,166,0.13), transparent 38%)',
          ].join(','),
          zIndex: 1,
        },
        '&:after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(3,5,12,0.08), rgba(3,5,12,0.36) 62%, rgba(3,5,12,0.82))',
          zIndex: 2,
        },
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
    </Box>
  );
}
