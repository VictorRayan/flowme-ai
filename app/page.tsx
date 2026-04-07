import { redirect } from 'next/navigation';

export default function Home() {
  // Base redirect to the calendar app
  redirect('/app/calendar');
}
