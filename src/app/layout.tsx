import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import "../styles/globals.css";
import Providers from "./providers"; // Your WagmiProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chainlink Casino",
  description: "Roulette game with Chainlink VRF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCReactProvider>
          <Providers>
            {children}
          </Providers>
        </TRPCReactProvider>
      </body>
    </html>
  );
}