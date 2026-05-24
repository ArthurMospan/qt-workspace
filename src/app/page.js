// src/app/page.js — Root redirect to /workspace
import { redirect } from 'next/navigation';
export default function RootPage() {
  redirect('/workspace');
}
