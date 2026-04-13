import { redirect } from 'next/navigation';

export default function Home() {
  // Base redirect to the flow dashboard
  redirect('/app/flow');
}
