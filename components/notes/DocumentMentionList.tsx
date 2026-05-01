'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Paper, List, ListItemButton, ListItemText, Typography, ListItemIcon } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NoteAltIcon from '@mui/icons-material/NoteAlt';

export interface DocItem {
  id: string;
  name: string;
  type: 'note' | 'document';
}

interface DocumentMentionListProps {
  items: DocItem[];
  command: (item: { id: string; label: string }) => void;
}

const DocumentMentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, DocumentMentionListProps>(
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
      <Paper elevation={4} sx={{ minWidth: 250, maxHeight: 240, overflow: 'auto', zIndex: 9999 }}>
        <List dense disablePadding>
          {items.map((item, index) => (
            <ListItemButton
              key={item.id}
              selected={index === selectedIndex}
              onClick={() => selectItem(index)}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {item.type === 'document' ? <InsertDriveFileIcon fontSize="small" sx={{ color: 'info.main' }} /> : <NoteAltIcon fontSize="small" sx={{ color: 'warning.main' }} />}
              </ListItemIcon>
              <ListItemText
                primary={item.name}
                primaryTypographyProps={{ sx: { fontSize: '0.85rem' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    );
  }
);

DocumentMentionList.displayName = 'DocumentMentionList';
export default DocumentMentionList;
