'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { getStoredApiKey, saveStoredApiKey } from '@/lib/storage';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setStatus('idle');
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveStoredApiKey(apiKey);
    setStatus('success');
    setStatusMessage('API Key saved successfully.');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setApiKey('');
    saveStoredApiKey('');
    setStatus('idle');
    setStatusMessage('API Key cleared. App will use high-fidelity simulated engine.');
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setStatusMessage('Please enter an API key first.');
      return;
    }

    setStatus('testing');
    setStatusMessage('Validating key with Gemini API...');

    try {
      const res = await fetch('/api/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Ping: check connection' }],
          course: {
            id: 'test',
            title: 'Diagnostic Test',
            description: 'Testing API connectivity',
            enabled: true,
            order: 0,
            instructions: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.responseText) {
        setStatus('success');
        setStatusMessage('Gemini API connected successfully!');
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Validation failed. Check your key.');
      }
    } catch {
      setStatus('error');
      setStatusMessage('Network connection error.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D9] bg-[#F5F2EB]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#1C1917] text-white">
              <Key className="w-4 h-4 text-[#E7C7A8]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                Gemini API Configuration
              </h3>
              <p className="text-xs text-[#78716C]">
                Powering the AI Curriculum Architect
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C827A] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#EAE3D9]/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-[#F0EBE1] border border-[#DFD6C9] rounded-xl text-xs text-[#544F49] leading-relaxed">
            <p className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#9E5A38] shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Configuration Ready:</strong> If you do not have a Gemini API key right now, Personal University automatically operates in high-fidelity simulated mode with deep educational lessons and conversational responses!
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
              Google Gemini API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#DCD5C9] rounded-lg text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 focus:border-[#9E5A38] transition-all font-mono"
            />
          </div>

          {statusMessage && (
            <div
              className={`flex items-center gap-2 text-xs p-2.5 rounded-lg ${
                status === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : status === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#9E5A38] hover:underline font-medium"
            >
              Get a free key at Google AI Studio
              <ExternalLink className="w-3 h-3" />
            </a>
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[#991B1B] hover:underline"
              >
                Clear Key
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EAE3D9] bg-[#F5F2EB]/50">
          <button
            type="button"
            onClick={handleTest}
            disabled={status === 'testing' || !apiKey.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#DCD5C9] bg-white hover:bg-[#FAF8F5] text-[#443E3A] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {status === 'testing' ? 'Testing...' : 'Test Key'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1C1917] hover:bg-[#332E2B] text-white transition-colors cursor-pointer shadow-xs"
          >
            Save &amp; Continue
          </button>
        </div>

      </div>
    </div>
  );
}
