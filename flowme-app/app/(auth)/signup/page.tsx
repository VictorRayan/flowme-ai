import { redirect } from 'next/navigation';

export default function Signup() {
  // With Google OAuth, there's no separate signup — redirect to login
  redirect('/login');
}
