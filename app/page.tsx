'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const EXAMPLES = [
  'What are the DSCR requirements for a foreign national borrower?',
  'How is DSCR calculated and what inputs does it depend on?',
  'What conditions are triggered when LTV exceeds 75%?',
  'What is the pricing impact of a DSCR below 1.0?',
  'What are the eligibility rules for a 5-10 unit property?',
  'What mortgage history is required for DSCR under 1.0?',
];

function AnswerBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
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
        {content ? (
          <div className="prose prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-gray-900
            prose-h1:text-base prose-h1:mt-4 prose-h1:mb-2
            prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2 prose-h2:pt-3 prose-h2:border-t prose-h2:border-gray-100
            prose-h3:text-sm prose-h3:text-gray-700 prose-h3:mt-3 prose-h3:mb-1
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-sm
            prose-ul:my-2 prose-ul:space-y-1
            prose-li:text-gray-700 prose-li:text-sm prose-li:my-0
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Searching ontology and composing answer...</p>
        )}
      </div>
    </div>
  );
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
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

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          };
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
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Ask the Ontology</h1>
        <p className="text-sm text-gray-500">
          Ask anything about DSCR loan requirements, calculations, conditions, or eligibility rules.
        </p>
      </div>

      {/* Empty state — example questions */}
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
                  content={m.content}
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
            placeholder="Ask about DSCR requirements, conditions, pricing adjustments, calculations..."
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
