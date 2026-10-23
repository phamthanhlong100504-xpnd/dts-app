import { useEffect, useState } from 'react';

// Search/group/page change as one query. Never filter only the downloaded page.
export function useSignFilters() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ group: '', search: '', page: 0 });
  useEffect(() => {
    const timer = setTimeout(() => setFilters((previous) => previous.search === query.trim() ? previous
      : { ...previous, search: query.trim(), page: 0 }), 250);
    return () => clearTimeout(timer);
  }, [query]);
  return { query, setQuery, ...filters,
    chooseGroup: (group: string) => setFilters({ group, search: query.trim(), page: 0 }),
    choosePage: (page: number) => setFilters((previous) => ({ ...previous, page })),
  };
}
