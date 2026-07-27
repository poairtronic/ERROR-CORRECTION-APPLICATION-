import { useState, useRef, useEffect, useMemo, memo } from 'react';

export const Table = memo(function Table({ columns, data = [], emptyMessage = 'No data available', loading = false }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerHeight(entries[0].contentRect.height || 400);
      }
    });

    el.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const rowHeight = 48; // standard table row height

  const { visibleData, startOffset, padBottom } = useMemo(() => {
    if (data.length === 0) {
      return { visibleData: [], startOffset: 0, padBottom: 0 };
    }
    const totalCount = data.length;
    const totalHeight = totalCount * rowHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
    const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / rowHeight) + 3);

    const visibleData = data.slice(startIndex, endIndex).map((row, idx) => ({
      row,
      index: startIndex + idx,
    }));

    const startOffset = startIndex * rowHeight;
    const padBottom = Math.max(0, totalHeight - (endIndex * rowHeight));

    return { visibleData, startOffset, padBottom };
  }, [data, scrollTop, containerHeight]);

  if (loading) {
    return (
      <div className="table-wrap" ref={containerRef} style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map((col, i) => <th key={i}>{col.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(row => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i}><div className="skeleton-line" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrap" ref={containerRef} style={{ maxHeight: '500px', overflowY: 'auto', position: 'relative' }}>
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                <div className="empty-state"><p>{emptyMessage}</p></div>
              </td>
            </tr>
          ) : (
            <>
              {startOffset > 0 && (
                <tr style={{ height: `${startOffset}px` }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 0, height: `${startOffset}px` }} />
                </tr>
              )}
              {visibleData.map(({ row, index }) => (
                <tr key={row.id || index} style={{ height: `${rowHeight}px` }}>
                  {columns.map((col, j) => (
                    <td key={j}>
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))}
              {padBottom > 0 && (
                <tr style={{ height: `${padBottom}px` }}>
                  <td colSpan={columns.length} style={{ padding: 0, border: 0, height: `${padBottom}px` }} />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});
