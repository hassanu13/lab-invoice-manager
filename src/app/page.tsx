import { redirect } from 'next/navigation';

export default function Home() {
  // Authenticated users land on the dashboard; unauthenticated bounce to /login.
  // Real auth check runs in middleware once auth is wired up.
  redirect('/login');
}
