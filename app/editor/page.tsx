'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TreeItem {
  content_type: string;
  content_id: string;
}

interface FolderNode {
  kind: 'folder';
  key: string;
  label: string;
  icon: string;
  children: (FolderNode | FileNode)[];
}

interface FileNode {
  kind: 'file';
  label: string;
  content_id: string;
  content_type: string;
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string; order: number }> = {
  concept:   { label: 'Concepts',   icon: '🧩', order: 0 },
  field:     { label: 'Fields',     icon: '📋', order: 1 },
  condition: { label: 'Conditions', icon: '⚙️', order: 2 },
  pricing:   { label: 'Pricing',    icon: '💲', order: 3 },
  rule:      { label: 'Rules',      icon: '📐', order: 4 },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { label: type.charAt(0).toUpperCase() + type.slice(1), icon: '📁', order: 99 };
}

function buildTree(items: TreeItem[]): FolderNode[] {
  // Group by content_type
  const byType = new Map<string, TreeItem[]>();
  for (const item of items) {
    const bucket = byType.get(item.content_type) ?? [];
    bucket.push(item);
    byType.set(item.content_type, bucket);
  }

  const roots: FolderNode[] = [];

  for (const [type, typeItems] of byType) {
    const meta = getTypeMeta(type);

    // For fields: group by table name (segment after 'field.' prefix or second dot-segment)
    if (type === 'field') {
      const byTable = new Map<string, TreeItem[]>();
      for (const item of typeItems) {
        // content_id format: field.TABLE.COLUMN or TABLE.COLUMN
        const parts = item.content_id.split('.');
        const table = parts.length >= 3 ? parts[1] : parts[0];
        const bucket = byTable.get(table) ?? [];
        bucket.push(item);
        byTable.set(table, bucket);
      }
      const fieldFolder: FolderNode = {
        kind: 'folder', key: type, label: meta.label, icon: meta.icon,
        children: [...byTable.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([table, tItems]) => ({
          kind: 'folder' as const,
          key: `field.${table}`,
          label: table,
          icon: '📄',
          children: tItems.sort((a, b) => a.content_id.localeCompare(b.content_id)).map(i => ({
            kind: 'file' as const,
            label: i.content_id.split('.').at(-1) ?? i.content_id,
            content_id: i.content_id,
            content_type: i.content_type,
          })),
        })),
      };
      roots.push(fieldFolder);
      continue;
    }

    // For pricing: group by second segment
    if (type === 'pricing') {
      const byCategory = new Map<string, TreeItem[]>();
      for (const item of typeItems) {
        const parts = item.content_id.split('.');
        const cat = parts.length >= 2 ? parts[1] : 'other';
        const bucket = byCategory.get(cat) ?? [];
        bucket.push(item);
        byCategory.set(cat, bucket);
      }
      const pricingFolder: FolderNode = {
        kind: 'folder', key: type, label: meta.label, icon: meta.icon,
        children: [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cat, cItems]) => ({
          kind: 'folder' as const,
          key: `pricing.${cat}`,
          label: cat,
          icon: '📄',
          children: cItems.sort((a, b) => a.content_id.localeCompare(b.content_id)).map(i => ({
            kind: 'file' as const,
            label: i.content_id.split('.').at(-1) ?? i.content_id,
            content_id: i.content_id,
            content_type: i.content_type,
          })),
        })),
      };
      roots.push(pricingFolder);
      continue;
    }

    // Flat folder (concepts, conditions, rules)
    const folder: FolderNode = {
      kind: 'folder', key: type, label: meta.label, icon: meta.icon,
      children: typeItems.sort((a, b) => a.content_id.localeCompare(b.content_id)).map(i => ({
        kind: 'file' as const,
        label: i.content_id.includes('.') ? i.content_id.split('.').slice(1).join('.') : i.content_id,
        content_id: i.content_id,
        content_type: i.content_type,
      })),
    };
    roots.push(folder);
  }

  return roots.sort((a, b) => (getTypeMeta(a.key).order - getTypeMeta(b.key).order));
}

// ─── YAML Syntax Highlighter ─────────────────────────────────────────────────

function YamlLine({ line }: { line: string }) {
  const trimmed = line.trimStart();
  const indentLen = line.length - trimmed.length;
  const indent = '\u00a0'.repeat(indentLen * 1);  // non-breaking spaces for indent

  // Comment
  if (trimmed.startsWith('#')) {
    return <div><span style={{ paddingLeft: indentLen * 8 + 'px' }} /><span className="text-gray-400 italic">{trimmed}</span></div>;
  }

  // Document separator
  if (trimmed === '---' || trimmed === '...') {
    return <div><span className="text-gray-400 font-bold">{line}</span></div>;
  }

  // Key: value (or key:)
  const keyMatch = /^([\w\-\./ ]+)(\s*:)(\s*.*)$/.exec(trimmed);
  if (keyMatch) {
    const [, key, colon, rest] = keyMatch;
    return (
      <div>
        <span style={{ display: 'inline-block', width: indentLen * 8 + 'px' }} />
        <span className="text-blue-600 font-semibold">{key}</span>
        <span className="text-gray-400">{colon}</span>
        {rest && <YamlValue value={rest} />}
      </div>
    );
  }

  // List item
  if (trimmed.startsWith('- ')) {
    const rest = trimmed.slice(2);
    return (
      <div>
        <span style={{ display: 'inline-block', width: indentLen * 8 + 'px' }} />
        <span className="text-gray-400">- </span>
        <YamlValue value={rest} />
      </div>
    );
  }

  if (trimmed === '-') {
    return <div><span style={{ display: 'inline-block', width: indentLen * 8 + 'px' }} /><span className="text-gray-400">-</span></div>;
  }

  // Continuation / plain text
  return <div><span style={{ display: 'inline-block', width: indentLen * 8 + 'px' }} /><span className="text-gray-700">{trimmed}</span></div>;
}

function YamlValue({ value }: { value: string }) {
  const v = value.trimStart();
  if (!v) return null;

  // Quoted string
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return <span className="text-emerald-700">{value}</span>;
  }
  // Multi-word string starting with quote
  if (v.startsWith('"') || v.startsWith("'")) {
    return <span className="text-emerald-700">{value}</span>;
  }
  // Boolean / null
  if (/^ *(true|false|null|~)$/.test(v)) {
    return <span className="text-violet-600 font-medium">{value}</span>;
  }
  // Number
  if (/^ *-?\d+(\.\d+)?$/.test(v)) {
    return <span className="text-amber-600">{value}</span>;
  }
  // Block scalar indicators
  if (/^ *[|>][-+]?$/.test(v)) {
    return <span className="text-orange-500 font-bold">{value}</span>;
  }
  return <span className="text-gray-800">{value}</span>;
}

function YamlViewer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <pre className="font-mono text-[12px] leading-[1.6] select-text whitespace-pre-wrap break-words">
      {lines.map((line, i) => <YamlLine key={i} line={line} />)}
    </pre>
  );
}

// ─── Tree Node components ─────────────────────────────────────────────────────

function FileRow({
  node,
  selected,
  onClick,
  depth,
}: {
  node: FileNode;
  selected: boolean;
  onClick: () => void;
  depth: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-[3px] rounded text-[12px] truncate transition-colors ${
        selected
          ? 'bg-blue-600 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      style={{ paddingLeft: depth * 12 + 8 + 'px' }}
      title={node.content_id}
    >
      {node.label}
    </button>
  );
}

function FolderRow({
  node,
  open,
  onToggle,
  depth,
  selected,
  onSelect,
  totalFiles,
}: {
  node: FolderNode;
  open: boolean;
  onToggle: () => void;
  depth: number;
  selected: string | null;
  onSelect: (n: FileNode) => void;
  totalFiles: number;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-1 px-2 py-[3px] rounded text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        style={{ paddingLeft: depth * 12 + 8 + 'px' }}
      >
        <span className="text-[10px] transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span className="mr-1">{node.icon}</span>
        <span className="truncate flex-1">{node.label}</span>
        <span className="text-gray-400 text-[10px] font-normal ml-1">{totalFiles}</span>
      </button>
      {open && node.children.map(child =>
        child.kind === 'folder' ? (
          <FolderRow
            key={child.key}
            node={child}
            open={openByDefault(child)}
            onToggle={() => {}}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            totalFiles={countFiles(child)}
          />
        ) : (
          <FileRow
            key={child.content_id}
            node={child}
            selected={selected === child.content_id}
            onClick={() => onSelect(child)}
            depth={depth + 1}
          />
        )
      )}
    </>
  );
}

function openByDefault(_: FolderNode) { return false; }

function countFiles(node: FolderNode | FileNode): number {
  if (node.kind === 'file') return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

// ─── Main FileTree component ──────────────────────────────────────────────────

function FileTree({
  roots,
  selected,
  onSelect,
}: {
  roots: FolderNode[];
  selected: string | null;
  onSelect: (n: FileNode) => void;
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set(['concept']));

  function toggle(key: string) {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Auto-expand parent when selection changes
  useEffect(() => {
    if (!selected) return;
    setOpenKeys(prev => {
      const next = new Set(prev);
      // Open top-level type folder
      const parts = selected.split('.');
      if (parts.length >= 2) {
        // could be content_type or direct key
      }
      roots.forEach(root => {
        if (hasFile(root, selected)) {
          next.add(root.key);
          root.children.forEach(child => {
            if (child.kind === 'folder' && hasFile(child, selected)) {
              next.add(child.key);
            }
          });
        }
      });
      return next;
    });
  }, [selected, roots]);

  return (
    <div className="py-2">
      {roots.map(root => (
        <FolderRowStateful
          key={root.key}
          node={root}
          depth={0}
          open={openKeys.has(root.key)}
          onToggle={() => toggle(root.key)}
          openKeys={openKeys}
          onToggleKey={toggle}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function hasFile(node: FolderNode | FileNode, id: string): boolean {
  if (node.kind === 'file') return node.content_id === id;
  return node.children.some(c => hasFile(c, id));
}

function FolderRowStateful({
  node, depth, open, onToggle, openKeys, onToggleKey, selected, onSelect,
}: {
  node: FolderNode; depth: number; open: boolean; onToggle: () => void;
  openKeys: Set<string>; onToggleKey: (k: string) => void;
  selected: string | null; onSelect: (n: FileNode) => void;
}) {
  const total = countFiles(node);
  return (
    <>
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-1 px-2 py-[4px] rounded text-[12px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        style={{ paddingLeft: depth * 14 + 8 + 'px' }}
      >
        <span className="text-[9px] text-gray-400 transition-transform inline-block w-3" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span className="mr-1">{node.icon}</span>
        <span className="flex-1 truncate">{node.label}</span>
        <span className="text-gray-400 text-[10px] font-normal bg-gray-100 rounded px-1">{total}</span>
      </button>
      {open && node.children.map(child =>
        child.kind === 'folder' ? (
          <FolderRowStateful
            key={child.key}
            node={child}
            depth={depth + 1}
            open={openKeys.has(child.key)}
            onToggle={() => onToggleKey(child.key)}
            openKeys={openKeys}
            onToggleKey={onToggleKey}
            selected={selected}
            onSelect={onSelect}
          />
        ) : (
          <FileRow
            key={child.content_id}
            node={child}
            selected={selected === child.content_id}
            onClick={() => onSelect(child)}
            depth={depth + 1}
          />
        )
      )}
    </>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────

function SearchResults({
  query,
  items,
  selected,
  onSelect,
}: {
  query: string;
  items: TreeItem[];
  selected: string | null;
  onSelect: (item: TreeItem) => void;
}) {
  const q = query.toLowerCase();
  const matches = items
    .filter(i => i.content_id.toLowerCase().includes(q))
    .slice(0, 50);

  if (!matches.length) return <p className="text-xs text-gray-400 px-3 py-2">No matches</p>;

  return (
    <div className="py-1">
      {matches.map(item => (
        <button
          key={item.content_id}
          onClick={() => onSelect(item)}
          className={`w-full text-left px-3 py-[4px] text-[12px] truncate transition-colors ${
            selected === item.content_id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={item.content_id}
        >
          <span className="text-gray-400 text-[10px] mr-1">{item.content_type}</span>
          {item.content_id}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [roots, setRoots] = useState<FolderNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(true);
  const [search, setSearch] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  // Load tree
  useEffect(() => {
    fetch('/api/editor/tree')
      .then(r => r.json())
      .then(({ items }) => {
        setTreeItems(items ?? []);
        setRoots(buildTree(items ?? []));
      })
      .finally(() => setTreeLoading(false));
  }, []);

  // Load content when selection changes
  const selectFile = useCallback(async (id: string, type: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setSelectedType(type);
    setContent(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/editor/content?id=${encodeURIComponent(id)}`);
      const data = await r.json() as { content_text?: string };
      setContent(data.content_text ?? '# (no content)');
    } catch {
      setContent('# Error loading content');
    } finally {
      setLoading(false);
    }
    // Scroll to top of content panel
    contentRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const handleSelect = useCallback((node: FileNode) => {
    selectFile(node.content_id, node.content_type);
  }, [selectFile]);

  const handleSearchSelect = useCallback((item: TreeItem) => {
    selectFile(item.content_id, item.content_type);
    setSearch('');
  }, [selectFile]);

  const typeMeta = selectedType ? getTypeMeta(selectedType) : null;
  const shortId = selectedId ? selectedId.split('.').at(-1) : null;

  return (
    <div className="-mx-4 -my-8 flex h-[calc(100vh-56px)]">

      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search content IDs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-[12px] px-2.5 py-1.5 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Tree / Search results */}
        <div className="flex-1 overflow-y-auto">
          {treeLoading ? (
            <div className="text-xs text-gray-400 px-4 py-4">Loading…</div>
          ) : search.trim() ? (
            <SearchResults
              query={search}
              items={treeItems}
              selected={selectedId}
              onSelect={handleSearchSelect}
            />
          ) : (
            <FileTree roots={roots} selected={selectedId} onSelect={handleSelect} />
          )}
        </div>

        {/* Footer count */}
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400">
          {treeItems.length} entries
        </div>
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">

        {/* Toolbar */}
        <div className="h-10 px-4 border-b border-gray-200 bg-white flex items-center gap-3 shrink-0">
          {selectedId ? (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {typeMeta?.icon} {typeMeta?.label}
              </span>
              <span className="text-xs text-gray-400 font-mono truncate">{selectedId}</span>
              <button
                onClick={() => {
                  if (content) navigator.clipboard.writeText(content);
                }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy YAML"
              >
                Copy
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400">Select a file from the tree to view its YAML</span>
          )}
        </div>

        {/* YAML content */}
        <div ref={contentRef} className="flex-1 overflow-auto p-5">
          {!selectedId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">📂</div>
              <p className="text-gray-500 font-medium">No file selected</p>
              <p className="text-gray-400 text-sm mt-1">Browse the tree or search to find an ontology entry</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-gray-500 max-w-sm">
                {roots.map(r => (
                  <div key={r.key} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                    <span className="ml-auto text-gray-400">{countFiles(r)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedId && loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="animate-pulse">⏳</span> Loading {shortId}…
            </div>
          )}

          {selectedId && !loading && content && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* File header */}
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <span className="text-xs font-mono text-blue-600 font-semibold">{shortId}.yaml</span>
                <span className="text-gray-300 text-xs">|</span>
                <span className="text-xs text-gray-400 font-mono">{content.split('\n').length} lines</span>
                <span className="text-gray-300 text-xs">|</span>
                <span className="text-xs text-gray-400">{(new Blob([content]).size / 1024).toFixed(1)} KB</span>
              </div>
              {/* Highlighted YAML */}
              <div className="px-5 py-4">
                <YamlViewer content={content} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
