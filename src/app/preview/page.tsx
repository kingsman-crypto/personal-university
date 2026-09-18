'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Header } from '@/components/Header';
import { NewsletterPreview } from '@/components/NewsletterPreview';

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col selection:bg-[#EAE0D5]">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        
        {/* Navigation bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Curriculum Dashboard</span>
          </Link>
        </div>

        {/* Newsletter Reader & Mockup */}
        <NewsletterPreview />

      </main>
    </div>
  );
}
