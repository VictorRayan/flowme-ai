'use client';

import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';

export default function BalysIcon(props: SvgIconProps) {
  const gradientId = 'balys-icon-gradient';

  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="0.48" stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.4c2.8 0 4.9 2.1 4.9 4.8 2.5.6 4 2.5 3.5 5-.5 2.8-3.2 4.2-5.7 3.2-1.2 2.6-4.2 3.7-6.5 2.1-2.1-1.4-2.5-4.2-.9-6.1-2.1-1.7-2.2-4.7-.2-6.5 1.4-1.3 3.3-1.5 4.9-.6Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.1 12.4c.7-2.5 2.1-4 4.2-4.5m3.6 3.7c-.7 2.5-2.1 4-4.2 4.5m.3-10.7c1.8 1.8 2.6 3.8 2.2 6m-2.2 7.2c-1.8-1.8-2.6-3.8-2.2-6"
        opacity="0.82"
      />
      <path fill="currentColor" d="M12 10.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" />
    </SvgIcon>
  );
}
