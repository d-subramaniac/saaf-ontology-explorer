'use client';

import ReactMarkdown from 'react-markdown';

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
  dot: string;
  icon: string;
}

function getSectionStyle(heading: string | null): SectionStyle {
  const h = (heading ?? '').toLowerCase();

  if (h.includes('ineligible') || h.includes('blocker') || h.includes('denied'))
    return { border: 'border-red-300', headerBg: 'bg-red-50', headerText: 'text-red-800', dot: 'bg-red-500', icon: '✗' };
  if (h.includes('elig'))
    return { border: 'border-emerald-300', headerBg: 'bg-emerald-50', headerText: 'text-emerald-800', dot: 'bg-emerald-500', icon: '✓' };
  if (h.includes('condit') || h.includes('trigger'))
    return { border: 'border-blue-300', headerBg: 'bg-blue-50', headerText: 'text-blue-800', dot: 'bg-blue-500', icon: '≡' };
  if (h.includes('pric') || h.includes('llpa') || h.includes('adjust'))
    return { border: 'border-amber-300', headerBg: 'bg-amber-50', headerText: 'text-amber-800', dot: 'bg-amber-500', icon: '$' };
  if (h.includes('req') || h.includes('restrict'))
    return { border: 'border-indigo-300', headerBg: 'bg-indigo-50', headerText: 'text-indigo-800', dot: 'bg-indigo-500', icon: '→' };
  if (h.includes('doc'))
    return { border: 'border-gray-300', headerBg: 'bg-gray-100', headerText: 'text-gray-700', dot: 'bg-gray-400', icon: '□' };
  if (h.includes('calc') || h.includes('formula') || h.includes('dscr') || h.includes('noi'))
    return { border: 'border-purple-300', headerBg: 'bg-purple-50', headerText: 'text-purple-800', dot: 'bg-purple-500', icon: '=' };

  return { border: 'border-gray-200', headerBg: 'bg-gray-50', headerText: 'text-gray-700', dot: 'bg-gray-400', icon: '›' };
}

const PROSE =
  'prose prose-sm max-w-none ' +
  'prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1 prose-p:text-sm ' +
  'prose-ul:my-1.5 prose-ul:pl-4 prose-ul:space-y-1 ' +
  'prose-ol:my-1.5 prose-ol:pl-4 prose-ol:space-y-1 ' +
  'prose-li:text-gray-700 prose-li:text-sm prose-li:my-0 ' +
  'prose-strong:text-gray-900 prose-strong:font-semibold ' +
  'prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none ' +
  'prose-headings:text-gray-800 prose-headings:font-semibold prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1 ' +
  'prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:pl-3 prose-blockquote:text-gray-600 prose-blockquote:not-italic';

function SectionCard({ section, isLast }: { section: Section; isLast: boolean }) {
  const style = getSectionStyle(section.heading);

  // No heading = intro/summary block — render without card chrome
  if (section.heading === null) {
    return section.body ? (
      <div className={`text-sm text-gray-700 leading-relaxed ${isLast ? '' : 'pb-4 border-b border-gray-100'}`}>
        <div className={PROSE}>
          <ReactMarkdown>{section.body}</ReactMarkdown>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${style.border}`}>
      {/* Section header */}
      <div className={`flex items-center gap-2 px-3.5 py-2 ${style.headerBg}`}>
        <span className={`text-sm font-bold font-mono w-4 text-center ${style.headerText}`}>
          {style.icon}
        </span>
        <h3 className={`text-sm font-semibold ${style.headerText}`}>{section.heading}</h3>
      </div>
      {/* Section body */}
      {section.body && (
        <div className="px-4 py-3 bg-white">
          <div className={PROSE}>
            <ReactMarkdown>{section.body}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SectionedMarkdown({ content, fallbackLabel = 'Answer' }: { content: string; fallbackLabel?: string }) {
  if (!content) return null;
  const sections = parseSections(content);

  // If AI produced no ## headings at all, fall back to plain prose in a single card
  const hasSections = sections.some(s => s.heading !== null);
  if (!hasSections) {
    return (
      <div className={PROSE}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((s, i) => (
        <SectionCard key={i} section={s} isLast={i === sections.length - 1} />
      ))}
    </div>
  );
}
