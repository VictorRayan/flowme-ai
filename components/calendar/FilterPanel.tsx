import React from 'react';
import { Box, Typography, Checkbox, FormControlLabel, FormGroup, Divider, Button, Drawer, useMediaQuery, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export interface FilterState {
  accountIds: string[];
  accountTypes: string[];
}

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  linkedAccounts: any[];
  onAddAccount: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function FilterPanel({ 
  filters, 
  setFilters, 
  linkedAccounts, 
  onAddAccount, 
  mobileOpen = false, 
  onMobileClose 
}: FilterPanelProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleToggleAccount = (id: string) => {
    setFilters(prev => ({
      ...prev,
      accountIds: prev.accountIds.includes(id) 
        ? prev.accountIds.filter(a => a !== id)
        : [...prev.accountIds, id]
    }));
  };

  const handleToggleType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      accountTypes: prev.accountTypes.includes(type)
        ? prev.accountTypes.filter(t => t !== type)
        : [...prev.accountTypes, type]
    }));
  };

  const content = (
    <Box sx={{ width: 260, p: 3, height: '100%', overflowY: 'auto', bgcolor: 'background.paper', borderRight: isDesktop ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">Filters</Typography>
      </Box>
      
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
          Linked Calendars
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddAccount} sx={{ textTransform: 'none' }}>
          Add
        </Button>
      </Box>
      
      {linkedAccounts.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
          No accounts linked.
        </Typography>
      ) : (
        <FormGroup sx={{ mb: 2 }}>
          {linkedAccounts.map(acc => (
            <FormControlLabel 
              key={acc.id}
              control={
                <Checkbox 
                  checked={filters.accountIds.includes(acc.id)} 
                  onChange={() => handleToggleAccount(acc.id)} 
                  size="small"
                />
              } 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: acc.type === 'work' ? 'secondary.main' : 'primary.main' }} />
                  <Typography variant="body2">{acc.name}</Typography>
                </Box>
              } 
            />
          ))}
        </FormGroup>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ mb: 1, textTransform: 'uppercase' }}>
        Account Type
      </Typography>
      <FormGroup>
        <FormControlLabel 
          control={<Checkbox checked={filters.accountTypes.includes('work')} onChange={() => handleToggleType('work')} size="small" />} 
          label={<Typography variant="body2">Work</Typography>} 
        />
        <FormControlLabel 
          control={<Checkbox checked={filters.accountTypes.includes('personal')} onChange={() => handleToggleType('personal')} size="small" />} 
          label={<Typography variant="body2">Personal</Typography>} 
        />
      </FormGroup>
    </Box>
  );

  if (isDesktop) {
    return content;
  }

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={mobileOpen}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
    >
      {content}
    </Drawer>
  );
}
