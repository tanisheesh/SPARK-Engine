'use client';

import React, { useMemo, useState } from 'react';
import type { Row } from '../../lib/spark/types';
import { classifyColumns, formatCell, humanizeColumn, toNumber } from '../../lib/spark/format';
import { cx, IconButton } from '../ui/Primitives';
import { IconArrowDown, IconArrowUp, IconSearch } from '../ui/Icons';

const PAGE = 50;

export function DataTable({
  rows,
  totalRows,
  maxHeight = 340,
  searchable = true,
}: {
  rows: Row[];
  totalRows?: number;
  maxHeight?: number;
  searchable?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const cols = useMemo(() => classifyColumns(rows), [rows]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = cols.find((c) => c.name === sort.key);
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (col?.kind === 'numeric') return ((toNumber(av) ?? 0) - (toNumber(bv) ?? 0)) * mult;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
    });
  }, [filtered, sort, cols]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const view = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }
    );

  if (!rows.length) {
    return <div className="px-4 py-6 text-center text-sm text-faint">This query returned no rows.</div>;
  }

  return (
    <div>
      {searchable && rows.length > 8 && (
        <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-1.5">
          <IconSearch size={13} className="text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Filter rows"
            aria-label="Filter rows"
            className="h-6 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <span className="tnum text-xs text-faint">
            {sorted.length.toLocaleString()} of {rows.length.toLocaleString()}
          </span>
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {cols.map((c) => {
                const numeric = c.kind === 'numeric';
                const isSorted = sort?.key === c.name;
                return (
                  <th
                    key={c.name}
                    scope="col"
                    aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="border-b border-line-subtle bg-surface2 p-0 font-normal"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.name)}
                      className={cx(
                        'flex w-full items-center gap-1 px-3 py-1.5 text-2xs font-medium',
                        'transition-colors duration-1 hover:text-ink',
                        numeric ? 'justify-end' : 'justify-start',
                        isSorted ? 'text-ink' : 'text-faint'
                      )}
                    >
                      {humanizeColumn(c.name)}
                      {isSorted &&
                        (sort!.dir === 'asc' ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i} className="group transition-colors duration-1 hover:bg-surface2">
                {cols.map((c) => (
                  <td
                    key={c.name}
                    className={cx(
                      'border-b border-line-subtle px-3 py-[5px] text-sm',
                      c.kind === 'numeric' ? 'tnum text-right text-ink' : 'text-muted',
                      c.kind === 'temporal' && 'whitespace-nowrap'
                    )}
                  >
                    {formatCell(r[c.name], c.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(pageCount > 1 || (totalRows && totalRows > rows.length)) && (
        <div className="flex items-center justify-between gap-3 border-t border-line-subtle px-3 py-1.5">
          <span className="tnum text-xs text-faint">
            {totalRows && totalRows > rows.length
              ? `Showing first ${rows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows`
              : `${sorted.length.toLocaleString()} rows`}
          </span>
          {pageCount > 1 && (
            <span className="flex items-center gap-1">
              <IconButton
                label="Previous page"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <IconArrowUp size={12} className="-rotate-90" />
              </IconButton>
              <span className="tnum px-1 text-xs text-muted">
                {page + 1} / {pageCount}
              </span>
              <IconButton
                label="Next page"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <IconArrowUp size={12} className="rotate-90" />
              </IconButton>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
