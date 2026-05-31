import { SvgIcon, type SvgIconProps } from '@mui/material';

// Official Google Sheets logo (green document with grid).
export default function GoogleSheetsBrandIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 47 65">
      <path d="M29.375 0H3.125C1.425 0 .017 1.408.017 3.135L0 61.865C0 63.593 1.394 65 3.123 65h40.6c1.728 0 3.142-1.407 3.142-3.135V15.643z" fill="#0F9D58" />
      <path d="M46.864 15.643l-13.139.014c-1.731 0-3.139-1.408-3.139-3.139L30.6 0z" fill="#87CEAC" />
      <path d="M12.35 28.6v18.85h22.3V28.6zm9.75 16.575h-7.475V40.3h7.475zm0-7.15h-7.475v-4.875h7.475zm10.275 7.15h-8V40.3h8zm0-7.15h-8v-4.875h8z" fill="#F1F1F1" />
    </SvgIcon>
  );
}
