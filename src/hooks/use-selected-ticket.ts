'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export function useSelectedTicket() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ticketParam = searchParams.get('ticket');
  const selectedTicketId =
    ticketParam !== null ? parseInt(ticketParam, 10) : null;
  const validTicketId =
    selectedTicketId !== null && !isNaN(selectedTicketId)
      ? selectedTicketId
      : null;

  const setSelectedTicketId = useCallback(
    (ticketId: number | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (ticketId === null) {
        params.delete('ticket');
      } else {
        params.set('ticket', String(ticketId));
      }

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { selectedTicketId: validTicketId, setSelectedTicketId };
}
