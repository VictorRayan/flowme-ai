'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Paper, List, ListItemButton, ListItemText, Typography } from '@mui/material';

interface Person {
  id: string;
  name: string;
  email?: string;
}

interface MentionListProps {
  items: Person[];
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.name });
    };

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: { event: KeyboardEvent }) {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(i => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex(i => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) return null;

    return (
      <Paper elevation={4} sx={{ minWidth: 200, maxHeight: 240, overflow: 'auto', zIndex: 9999 }}>
        <List dense disablePadding>
          {items.map((item, index) => (
            <ListItemButton
              key={item.id}
              selected={index === selectedIndex}
              onClick={() => selectItem(index)}
            >
              <ListItemText
                primary={item.name}
                secondary={item.email ? <Typography variant="caption" color="text.secondary">{item.email}</Typography> : undefined}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    );
  }
);

MentionList.displayName = 'MentionList';
export default MentionList;
