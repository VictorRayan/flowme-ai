import { SvgIcon, type SvgIconProps } from '@mui/material';

// Official Gmail logo (4-color envelope with M).
export default function GmailBrandIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M1.636 21h3.273v-7.91L0 9.45v9.913C0 20.27.732 21 1.636 21z" fill="#4285F4" />
      <path d="M19.091 21h3.273c.904 0 1.636-.732 1.636-1.636V9.45l-4.909 3.64z" fill="#34A853" />
      <path d="M19.091 4.636v8.454L24 9.45V5.455c0-3.665-4.184-5.755-7.118-3.555l-2.064 1.547z" fill="#FBBC04" />
      <path d="M4.909 13.09V4.637L12 9.954l7.091-5.317v8.454L12 18.408z" fill="#EA4335" />
      <path d="M0 5.455V9.45l4.909 3.64V4.637L2.845 3.09C-.089.89 0 1.79 0 5.455z" fill="#C5221F" />
    </SvgIcon>
  );
}
