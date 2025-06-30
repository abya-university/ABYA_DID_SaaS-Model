"use client";

import dynamic from 'next/dynamic';

// Dynamically import components that use browser APIs with ssr disabled
const ClientApp = dynamic(
  () => import('./components/ClientApp'),
  { ssr: false }
);

export default function Home() {
  return <ClientApp />;
}