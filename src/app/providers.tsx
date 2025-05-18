"use client";

import type { ReactNode } from "react";
import {
  WagmiProvider as BaseWagmiProvider,
  createConfig,
  http,
} from "wagmi";
import { metaMask, injected } from "@wagmi/connectors";
import { sepolia, mainnet } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (renamed from cacheTime)
    },
  },
});

/* Wagmi configuration */
const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  connectors: [
    injected(),
    metaMask({
      // Ensure MetaMask is properly detected
      preferDesktop: true,
    }),
  ],
  ssr: false, // Important for client-side wallet detection
});

/* Your wrapper component */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <BaseWagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BaseWagmiProvider>
  );
}