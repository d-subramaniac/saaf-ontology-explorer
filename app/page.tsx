'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SourceResult {
  content_type: string;
  content_id: string;
  content_text: string;
  similarity: number;
}

interface MessageWithSources extends Message {
  sources?: SourceResult[];
}

const EXAMPLES = [
  'What are the DSCR requirements for a foreign national borrower?',
  'How is DSCR calculated and what inputs does it depend on?',
  'What conditions are triggered when LTV exceeds 75%?',
  'What is the pricing impact of a DSCR below 1.0?',
  'What are the eligibility rules for a 5-10 unit property?',
  'What mortgage history is required for DSCR under 1.0?',
];

const SOURCE_TYPE_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  field:     { badge: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500',    label: 'Field' },
  condition: { badge: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-400',     label: 'Condition' },
  concept:   { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', label: 'Concept' },
  rule:      { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500',   label: 'Rule' },
};

function SourcesPanel({ sources }: { sources: SourceResult[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources.length) return null;

  const counts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.content_type] = (acc[s.content_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-xs font-semibold text-gray-600">
            Retrieved {sources.length} ontology items
          </span>
          <div className="flex gap-1.5">
            {Object.entries(counts).map(([type, count]) => {
              const s = SOURCE_TYPE_STYLES[type] ?? SOURCE_TYPE_STYLES.field;
              return (
                <span key={type} className={`text-xs px-1.5 py-0.5 rounded border ${s.badge}`}>
                  {count} {s.label.toLowerCase()}{count > 1 ? 's' : ''}
                </span>
              );
            })}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {sources.map((s, i) => {
            const style = SOURCE_TYPE_STYLES[s.content_type] ?? SOURCE_TYPE_STYLES.field;
            const similarity = Math.round(s.similarity * 100);
            return (
              <div key={i} className="px-3.5 py-2.5 flex items-start gap-3 bg-white">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-gray-700 font-medium">{s.content_id}</span>
                    <span className={`text-xs px-1 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-snug">{s.content_text}</p>
                </div>
                {/* Similarity bar */}
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">{similarity}%</p>
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-1">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${similarity}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerBlock({ msg, isStreaming }: { msg: MessageWithSources; isStreaming: boolean }) {
  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Answer</span>
          {isStreaming && (
            <span className="flex gap-1 ml-1">
              {[0, 1, 2].map(j => (
                <span key={j} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
              ))}
            </span>
          )}
        </div>
        <div className="px-5 py-4">
          {msg.content ? (
            <div className="prose prose-sm max-w-none
              prose-headings:font-semibold prose-headings:text-gray-900
              prose-h1:text-base prose-h1:mt-4 prose-h1:mb-2
              prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2 prose-h2:pt-3 prose-h2:border-t prose-h2:border-gray-100
              prose-h3:text-sm prose-h3:text-gray-700 prose-h3:mt-3 prose-h3:mb-1
              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-sm
              prose-ul:my-2 prose-ul:space-y-1
              prose-li:text-gray-700 prose-li:text-sm prose-li:my-0
              prose-strong:text-gray-900 prose-strong:font-semibold
              prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Searching ontology and composing answer...</p>
          )}
        </div>
      </div>

      {/* Sources — shown once answer starts streaming */}
      {msg.sources && msg.sources.length > 0 && (
        <SourcesPanel sources={msg.sources} />
      )}
    </div>
  );
}

const STATS = [
  { label: 'Concepts', value: '23', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Fields', value: '675', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { label: 'Conditions', value: '94', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  { label: 'Calculations', value: '8', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
];

export default function AskPage() {
  const [messages, setMessages] = useState<MessageWithSources[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMsg: MessageWithSources = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Placeholder for assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: undefined }]);

    // Fetch sources in parallel
    fetch('/api/ask-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: content }),
    })
      .then(r => r.json())
      .then(({ results }) => {
        if (results?.length) {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, sources: results };
            return updated;
          });
        }
      })
      .catch(() => {/* sources are optional — ignore errors */});

    // Stream the answer
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error((await res.text()) || `Request failed: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }
    } catch (e) {
      setError(String(e));
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Stats strip */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Ask the Ontology</h1>
        <p className="text-sm text-gray-500 mb-4">
          Precise answers drawn from the DSCR loan knowledge graph — fields, rules, conditions, and calculations.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {STATS.map(s => (
            <div key={s.label} className={`border rounded-lg px-3 py-2 text-center ${s.bg}`}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex-1 flex flex-col justify-center mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Example questions</p>
          <div className="space-y-2">
            {EXAMPLES.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-800 transition-colors shadow-xs"
              >
                <span className="text-blue-500 mr-2">›</span>{q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      {!isEmpty && (
        <div className="flex-1 space-y-5 mb-6">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-lg bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                    {m.content}
                  </div>
                </div>
              ) : (
                <AnswerBlock
                  msg={m}
                  isStreaming={isLoading && i === messages.length - 1}
                />
              )}
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-4 mt-auto">
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Ask about DSCR requirements, conditions, pricing, or calculations..."
            rows={2}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 pr-14 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none text-sm shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-3 bottom-3 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
