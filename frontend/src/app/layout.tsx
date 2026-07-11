import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'SmartLink — Premium URL Shortener & Analytics Dashboard',
  description: 'Shorten links, generate customized aliases, download smart QR codes, and monitor high-fidelity real-time visitor analytics.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="flex flex-col min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white">
        {/* Glow Blobs for Glassmorphism Background Accent */}
        <div className="glow-blob-1" />
        <div className="glow-blob-2" />
        
        {/* Navbar */}
        <Navbar />
        
        {/* Content Body */}
        <main className="flex-grow flex flex-col justify-start">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="w-full border-t border-white/5 bg-[#090a0f]/20 py-6 text-center text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4">
            <p>© {new Date().getFullYear()} SmartLink. Built with FastAPI, Next.js, and Supabase. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
