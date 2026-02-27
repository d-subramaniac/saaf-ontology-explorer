'use client';

import { useState, useRef, useEffect } from 'react';

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

      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

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
    <div className="max-w-3xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Ask the Ontology</h1>
        <p className="text-gray-400 text-sm">
          Ask anything about DSCR loan requirements, calculations, conditions, or eligibility.
          Answers are synthesized from 799 ontology items using Claude.
        </p>
      </div>

      {isEmpty && (
        <div className="flex-1 flex flex-col justify-center mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Example questions</p>
          <div className="grid gap-2">
            {EXAMPLES.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                className="text-left px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-600 text-sm text-gray-300 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="flex-1 space-y-6 mb-6">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              {m.role === 'user' ? (
                <div className="max-w-xl bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-2xl w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Answer</span>
                    {isLoading && i === messages.length - 1 && (
                      <span className="flex gap-1">
                        {[0, 1, 2].map(j => (
                          <span key={j} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-5 py-4 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap min-h-[3rem]">
                    {m.content || <span className="text-gray-600">Searching ontology and composing answer...</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-14 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
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
        <p className="text-xs text-gray-600 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
