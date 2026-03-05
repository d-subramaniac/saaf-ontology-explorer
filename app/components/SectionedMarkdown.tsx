'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface Section {
  heading: string | null;
  body: string;
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let heading: string | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (buf.join('').trim() || heading !== null) {
        sections.push({ heading, body: buf.join('\n').trim() });
      }
      heading = line.replace(/^##\s+/, '').trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.join('').trim() || heading !== null) {
    sections.push({ heading, body: buf.join('\n').trim() });
  }

  return sections.filter(s => s.heading !== null || s.body.trim());
}

interface SectionStyle {
  border: string;
  headerBg: string;
  headerText: string;
  icon: string;
}

function getSectionStyle(heading: string | null): SectionStyle {
  const h = (heading ?? '').toLowerCase();
  if (h.includes('ineligible') || h.includes('blocker'))
    return { border: 'border-red-200', headerBg: 'bg-red-50', headerText: 'text-red-800', icon: '✗' };
  if (h.includes('elig'))
    return { border: 'border-emerald-200', headerBg: 'bg-emerald-50', headerText: 'text-emerald-800', icon: '✓' };
  if (h.includes('max ltv') || h.includes('ltv'))
    return { border: 'border-teal-200', headerBg: 'bg-teal-50', headerText: 'text-teal-800', icon: '%' };
  if (h.includes('condit') || h.includes('trigger'))
    return { border: 'border-blue-200', headerBg: 'bg-blue-50', headerText: 'text-blue-800', icon: '≡' };
  if (h.includes('pric') || h.includes('llpa') || h.includes('adjust'))
    return { border: 'border-amber-200', headerBg: 'bg-amber-50', headerText: 'text-amber-800', icon: '$' };
  if (h.includes('req') || h.includes('restrict'))
    return { border: 'border-indigo-200', headerBg: 'bg-indigo-50', headerText: 'text-indigo-800', icon: '→' };
  if (h.includes('doc'))
    return { border: 'border-gray-200', headerBg: 'bg-gray-100', headerText: 'text-gray-700', icon: '□' };
  if (h.includes('calc') || h.includes('formula') || h.includes('how'))
    return { border: 'border-purple-200', headerBg: 'bg-purple-50', headerText: 'text-purple-800', icon: '=' };
  if (h.includes('rate') || h.includes('par'))
    return { border: 'border-violet-200', headerBg: 'bg-violet-50', headerText: 'text-violet-800', icon: '≈' };
  if (h.includes('threshold') || h.includes('key'))
    return { border: 'border-sky-200', headerBg: 'bg-sky-50', headerText: 'text-sky-800', icon: '⊕' };
  return { border: 'border-gray-200', headerBg: 'bg-gray-50', headerText: 'text-gray-700', icon: '›' };
}

// Custom components — bypass prose plugin for clean, predictable bullet rendering
const MD_COMPONENTS: Components = {
  ul: ({ children }) => (
    <ul className="mt-1.5 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-1.5 space-y-1 list-decimal pl-5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm text-gray-700 leading-snug">
      <span className="mt-[3px] shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400" />
      <span className="flex-1 min-w-0">{children}</span>
    </li>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 leading-relaxed mb-1.5">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-600">{children}</em>
  ),
  code: ({ children }) => (
    <code className="text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 text-sm">{children}</blockquote>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-2 mb-1">{children}</h3>
  ),
};

function SectionBody({ body }: { body: string }) {
  return (
    <div className="px-4 py-3 bg-white">
      <ReactMarkdown components={MD_COMPONENTS}>{body}</ReactMarkdown>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const style = getSectionStyle(section.heading);

  if (section.heading === null) {
    return section.body ? (
      <div className="mb-1">
        <ReactMarkdown components={MD_COMPONENTS}>{section.body}</ReactMarkdown>
      </div>
    ) : null;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${style.border}`}>
      <div className={`flex items-center gap-2 px-3.5 py-2 ${style.headerBg}`}>
        <span className={`text-xs font-bold font-mono w-4 text-center shrink-0 ${style.headerText}`}>
          {style.icon}
        </span>
        <h3 className={`text-sm font-semibold ${style.headerText}`}>{section.heading}</h3>
      </div>
      {section.body && <SectionBody body={section.body} />}
    </div>
  );
}

export default function SectionedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const sections = parseSections(content);
  const hasSections = sections.some(s => s.heading !== null);

  if (!hasSections) {
    return (
      <div>
        <ReactMarkdown components={MD_COMPONENTS}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((s, i) => <SectionCard key={i} section={s} />)}
    </div>
  );
}
