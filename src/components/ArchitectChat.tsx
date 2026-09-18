'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  RefreshCw,
  Lightbulb,
  Trash2,
  BookmarkCheck,
} from 'lucide-react';
import { Course, ChatMessage } from '@/lib/types';
import {
  getChatHistory,
  saveChatHistory,
  updateCourse,
  getStoredApiKey,
} from '@/lib/storage';

interface ArchitectChatProps {
  course: Course;
  onCourseUpdated: (course: Course) => void;
}

export function ArchitectChat({ course, onCourseUpdated }: ArchitectChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedBriefId, setAppliedBriefId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompts
  const suggestions = [
    'Learning Chinese: one notable Chinese poem, its original text with pinyin, its author, historical context, and an English translation.',
    'Focus on bite-sized thought experiments with clear real-world relevance.',
    'Include a daily vocabulary spotlight and 2 practical reflection questions.',
    'Calibrate for a fast 3-minute morning commute read.',
  ];

  // Load chat history or initialize with warm greeting
  useEffect(() => {
    const saved = getChatHistory(course.id);
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      const initialGreeting: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Welcome to the curriculum workspace for **${course.title}**. 

I am your **Curriculum Architect**. Tell me what you would like to explore each morning. You can describe any topic, reading depth, and specific elements you want included.

*For instance:*
> *"Learning Chinese: one notable Chinese poem, its original text with pinyin, its author, historical context, and an English translation."*

How would you like to structure this daily course?`,
        timestamp: new Date().toISOString(),
      };
      setMessages([initialGreeting]);
      saveChatHistory(course.id, [initialGreeting]);
    }
  }, [course.id, course.title]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = getStoredApiKey();
      const res = await fetch('/api/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          course,
          apiKey,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get Architect response');
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.responseText,
        timestamp: new Date().toISOString(),
        extractedBrief: data.updatedInstructions,
      };

      const updatedHistory = [...newHistory, assistantMessage];
      setMessages(updatedHistory);
      saveChatHistory(course.id, updatedHistory);

      // Automatically update course instructions if a full blueprint was returned
      if (data.updatedInstructions) {
        const updated = updateCourse(course.id, {
          instructions: data.updatedInstructions,
        });
        if (updated) {
          onCourseUpdated(updated);
        }
      }
    } catch (err) {
      console.error('Architect chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'I apologize, I encountered a temporary connection issue. Please verify your Gemini API key or try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyBrief = (brief: string, msgId: string) => {
    const updated = updateCourse(course.id, { instructions: brief });
    if (updated) {
      onCourseUpdated(updated);
      setAppliedBriefId(msgId);
      setTimeout(() => setAppliedBriefId(null), 3000);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear conversational history for this course?')) {
      const initialGreeting: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Conversation reset. How would you like to refine the daily syllabus for **${course.title}**?`,
        timestamp: new Date().toISOString(),
      };
      setMessages([initialGreeting]);
      saveChatHistory(course.id, [initialGreeting]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border border-[#E7E2DA] rounded-2xl shadow-xs overflow-hidden">
      
      {/* Chat Header */}
      <div className="px-5 py-4 border-b border-[#EAE3D9] bg-[#FAF8F5] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#1C1917] text-[#FAF8F5]">
            <Sparkles className="w-4 h-4 text-[#E7C7A8]" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold text-[#1C1917]">
              Curriculum Architect
            </h3>
            <p className="text-[11px] text-[#78716C]">
              Gemini AI &bull; Refines your daily learning brief
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearHistory}
          className="p-1.5 text-[#A8A29E] hover:text-[#44403C] hover:bg-[#F2ECE4] rounded-md transition-colors cursor-pointer"
          title="Reset chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const hasBrief = Boolean(msg.extractedBrief);
          const isApplied = appliedBriefId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-semibold ${
                  isUser
                    ? 'bg-[#EFE9DF] text-[#1C1917]'
                    : 'bg-[#1C1917] text-[#FAF8F5]'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Content */}
              <div
                className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#1C1917] text-white rounded-tr-none'
                    : 'bg-[#FAF8F5] text-[#292524] border border-[#E8E2D8] rounded-tl-none'
                }`}
              >
                <div className={isUser ? '' : 'prose-editorial max-w-none text-xs sm:text-sm'}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Apply Blueprint button if the Architect proposed instructions */}
                {hasBrief && (
                  <div className="mt-3 pt-3 border-t border-[#EAE3D9] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#78716C] font-medium">
                      Blueprint Synthesized
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyBrief(msg.extractedBrief!, msg.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        isApplied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#78350F] hover:bg-[#5E2B0C] text-white shadow-2xs'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Saved to Blueprint
                        </>
                      ) : (
                        <>
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Apply to Blueprint
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-7 h-7 rounded-full bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-[#78716C] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#9E5A38]" />
              Architecting curriculum and refining learning brief...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts chips */}
      {messages.length < 3 && (
        <div className="px-4 py-2 border-t border-[#F2ECE4] bg-[#FCFAF7] overflow-x-auto flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#A8A29E] shrink-0 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-[#9E5A38]" /> Try:
          </span>
          {suggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(sug)}
              className="shrink-0 px-2.5 py-1 text-[11px] rounded-full bg-white border border-[#E5DFD5] hover:border-[#C8BEB0] text-[#57524C] hover:text-[#1C1917] transition-colors cursor-pointer"
            >
              {sug.slice(0, 48)}...
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className="p-3 sm:p-4 border-t border-[#EAE3D9] bg-[#FAF8F5]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Describe what you want to learn each day..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-white border border-[#DCD5C9] rounded-xl text-xs sm:text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#9E5A38]/30 focus:border-[#9E5A38] transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="inline-flex items-center justify-center p-2.5 rounded-xl bg-[#1C1917] text-white hover:bg-[#332E2B] disabled:opacity-40 transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4 text-[#E7C7A8]" />
          </button>
        </form>
      </div>

    </div>
  );
}
