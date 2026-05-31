import { SvgIcon, type SvgIconProps } from '@mui/material';

// Official Google Docs logo (blue document with folded corner).
export default function GoogleDocsBrandIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 47 65">
      <path d="M29.375 0H3.125C1.425 0 .017 1.408.017 3.135L0 61.865C0 63.593 1.394 65 3.123 65h40.6c1.728 0 3.142-1.407 3.142-3.135V15.643z" fill="#4285F4" />
      <path d="M46.864 15.643l-13.139.014c-1.731 0-3.139-1.408-3.139-3.139L30.6 0z" fill="#A1C2FA" />
      <path d="M10.4 31.2v3.825h26V31.2zm0 7.65v3.825h20.475V38.85zm0 7.65v3.825h26V46.5z" fill="#F1F1F1" />
    </SvgIcon>
  );
}
