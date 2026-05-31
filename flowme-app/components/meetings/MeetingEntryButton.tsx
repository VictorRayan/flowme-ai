'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StartMeetingDialog from './StartMeetingDialog';

interface MeetingEntryButtonProps {
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

export default function MeetingEntryButton({ label = 'Gravar reunião', variant = 'outlined', size = 'small' }: MeetingEntryButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={<MicIcon />}
        onClick={() => setOpen(true)}
        data-testid="open-meeting-recorder"
      >
        {label}
      </Button>
      <StartMeetingDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
