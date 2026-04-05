import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-brand-soft overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
