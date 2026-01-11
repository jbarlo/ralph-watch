'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import {
  type TicketStatus,
  isValidTicketStatus,
} from '@/components/TicketFilter';

export function useTicketFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status');
  const status: TicketStatus = isValidTicketStatus(statusParam)
    ? statusParam
    : 'all';

  const setStatus = useCallback(
    (newStatus: TicketStatus) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newStatus === 'all') {
        params.delete('status');
      } else {
        params.set('status', newStatus);
      }

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { status, setStatus };
}
