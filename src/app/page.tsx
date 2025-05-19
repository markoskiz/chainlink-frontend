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
            <<div className="bg-gray-900 flex flex-col lg:flex-row w-full gap-8">
            <div className="w-full lg:flex-1">
              <RouletteWheel />
            </div>
            <div className="w-full lg:flex-[2]">
              <EtherscanEventsTab />
            </div>
</div>

            </div>
         
          {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://docs.chain.link/vrf/v2/subscription"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Chainlink VRF →</h3>
              <div className="text-lg">
                Learn about verifiable random functions for blockchain gaming.
              </div>
            </Link>
            
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
              href="https://sepolia.etherscan.io/"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Etherscan →</h3>
              <div className="text-lg">
                View your transactions on the Sepolia testnet.
              </div>
            </Link>
          </div>
          
          <p className="text-center text-2xl">
            {hello ? hello.greeting : "Loading tRPC query..."}
          </p> */}
        </div>
      </main>
    </HydrateClient>
  );
}
