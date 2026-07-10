'use client';

import * as React from 'react';
import { Autocomplete, CircularProgress, TextField, Typography } from '@mui/material';
import type { CityPrediction } from '@/lib/location/cities';

export interface CityTimezoneSelection {
  city: string;
  timezone: string;
}

interface CityTimezoneSelectProps {
  lang: 'pt' | 'en';
  value: CityTimezoneSelection | null;
  onChange: (selection: CityTimezoneSelection | null) => void;
}

const labels = {
  pt: {
    label: 'Cidade, estado — país',
    placeholder: 'Pesquise: São Paulo, SP',
    helper: 'Selecione uma cidade da lista para confirmar sua localização e seu horário local.',
    loading: 'Buscando cidades…',
    noOptions: 'Digite pelo menos 2 letras para pesquisar',
    error: 'Não consegui confirmar essa cidade. Tente selecionar outra opção.',
    timezone: 'Horário local',
  },
  en: {
    label: 'City, state — country',
    placeholder: 'Search: New York, NY',
    helper: 'Select a city from the list to confirm your location and local time.',
    loading: 'Searching cities…',
    noOptions: 'Type at least 2 letters to search',
    error: 'I could not confirm this city. Try selecting another option.',
    timezone: 'Local time zone',
  },
};

export default function CityTimezoneSelect({ lang, value, onChange }: CityTimezoneSelectProps) {
  const copy = labels[lang];
  const [inputValue, setInputValue] = React.useState(value?.city || '');
  const [selectedOption, setSelectedOption] = React.useState<CityPrediction | null>(
    value ? { label: value.city, description: value.city, place_id: value.city } : null,
  );
  const [options, setOptions] = React.useState<CityPrediction[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (inputValue.trim().length < 2 || inputValue === selectedOption?.label) {
      setOptions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: inputValue.trim(), language: lang === 'pt' ? 'pt-BR' : 'en-US' });
        const response = await fetch(`/api/places/autocomplete?${params}`, { signal: controller.signal });
        const data = await response.json();
        setOptions(response.ok && Array.isArray(data?.predictions) ? data.predictions : []);
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [inputValue, lang, selectedOption?.label]);

  const selectCity = async (option: CityPrediction | null) => {
    setSelectedOption(option);
    setError(false);
    onChange(null);
    if (!option) return;
    setInputValue(option.label);
    setResolving(true);
    try {
      const params = new URLSearchParams();
      if (option.latitude !== undefined && option.longitude !== undefined) {
        params.set('latitude', String(option.latitude));
        params.set('longitude', String(option.longitude));
      } else {
        params.set('place_id', option.place_id);
      }
      const response = await fetch(`/api/places/timezone?${params}`);
      const data = await response.json();
      if (!response.ok || typeof data?.timezone !== 'string') throw new Error('timezone lookup failed');
      onChange({ city: option.label, timezone: data.timezone });
    } catch {
      setError(true);
    } finally {
      setResolving(false);
    }
  };

  return (
    <>
      <Autocomplete
        fullWidth
        value={selectedOption}
        inputValue={inputValue}
        options={options}
        loading={searching || resolving}
        loadingText={copy.loading}
        noOptionsText={copy.noOptions}
        filterOptions={(items) => items}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, selected) => option.place_id === selected.place_id}
        onChange={(_, option) => void selectCity(option)}
        onInputChange={(_, nextValue, reason) => {
          setInputValue(nextValue);
          if (reason === 'input' && nextValue !== selectedOption?.label) {
            setSelectedOption(null);
            setError(false);
            onChange(null);
          }
        }}
        componentsProps={{
          paper: { sx: { bgcolor: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' } },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={copy.label}
            placeholder={copy.placeholder}
            error={error}
            helperText={error ? copy.error : copy.helper}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {(searching || resolving) && <CircularProgress color="inherit" size={20} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.08)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
              },
              '& .MuiInputLabel-root, & .MuiFormHelperText-root': { color: 'rgba(226,232,240,0.78)' },
            }}
          />
        )}
      />
      {value && (
        <Typography sx={{ mt: 1.5, color: '#5eead4', fontSize: 13, fontWeight: 700 }}>
          {copy.timezone}: {value.timezone}
        </Typography>
      )}
    </>
  );
}
