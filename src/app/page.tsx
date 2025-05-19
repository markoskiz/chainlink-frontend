import Link from "next/link";
import { EtherscanEventsTab } from "~/app/_components/etherscan_frame";
import { RouletteWheel } from "~/app/_components/roulette";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  void api.post.getLatest.prefetch();
  
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Digitalni Valuti | Chainlink <span className="text-[hsl(280,100%,70%)]">Casino</span>
          </h1>
          
          {/* Fixed mobile layout - removed conflicting inline styles */}
          <div className="bg-gray-900 flex flex-col lg:flex-row w-full gap-8">
            <div className="w-full lg:flex-1">
              <RouletteWheel />
            </div>
            <div className="w-full lg:flex-[2]">
              <EtherscanEventsTab />
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
