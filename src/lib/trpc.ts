import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

/**
 * tRPC React hooks for client components
 */
export const trpc = createTRPCReact<AppRouter>();
