"use client";

import dynamic from 'next/dynamic';

const CameraComponent = dynamic(() => import('@/components/CameraComponent'), { ssr: false });

export default function Home() {
  return (
    <main style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <CameraComponent />
    </main>
  );
}
