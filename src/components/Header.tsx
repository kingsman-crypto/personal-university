'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Key, Mail, BookOpen, Compass, Settings } from 'lucide-react';
import { getStoredApiKey, getCourses } from '@/lib/storage';
import { ApiKeyModal } from './ApiKeyModal';

export function Header() {
  const pathname = usePathname();
  const [hasKey, setHasKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      const key = getStoredApiKey();
      setHasKey(Boolean(key && key.trim().length > 5));
      const courses = getCourses();
      setActiveCount(courses.filter((c) => c.enabled).length);
    };

    updateStats();
    window.addEventListener('pu_storage_updated', updateStats);
    return () => window.removeEventListener('pu_storage_updated', updateStats);
  }, []);

  const navLinks = [
    { href: '/', label: 'Curriculum', icon: Compass },
    { href: '/preview', label: "Today's Dispatch", icon: BookOpen },
    { href: '/settings', label: 'Newsletter Schedule', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D8] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center font-serif text-xl font-bold shadow-sm group-hover:scale-105 transition-transform">
              U
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-semibold tracking-tight text-[#1C1917]">
                  Personal University
                </span>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#EFE9DF] text-[#785E4F]">
                  Est. Daily
                </span>
              </div>
              <p className="text-xs text-[#8C827A] hidden sm:block">
                Bespoke morning educational dispatches
              </p>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#EFE9DF] text-[#1C1917] shadow-xs'
                      : 'text-[#5C564F] hover:text-[#1C1917] hover:bg-[#F3EFE8]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}

            <div className="h-4 w-[1px] bg-[#E2DACF] mx-1 sm:mx-2" />

            {/* API Key Modal Trigger */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E2DACF] bg-[#FFFFFF] hover:bg-[#F9F7F2] text-[#5C564F] hover:text-[#1C1917] transition-all cursor-pointer"
              title="Configure Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-[#9E5A38]" />
              <span className="hidden lg:inline">Gemini API</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  hasKey ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                title={hasKey ? 'Gemini API Connected' : 'Simulated / Demo Mode'}
              />
            </button>

            {/* Active count badge */}
            <Link
              href="/preview"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1C1917] text-[#FAF8F5] hover:bg-[#332E2B] transition-colors shadow-xs"
            >
              <Mail className="w-3.5 h-3.5 text-[#E7C7A8]" />
              <span className="hidden sm:inline">Dispatch</span>
              <span className="bg-[#443E3A] px-1.5 py-0.2 rounded-full text-[10px]">
                {activeCount}
              </span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Gemini API Key Dialog */}
      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </>
  );
}
