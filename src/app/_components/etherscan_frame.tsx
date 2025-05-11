"use client";

import { useState } from "react";

const ETHERSCAN_API_KEY = "ZAMEKKMPF93HGSD8Q5PXDNU73CVC6HGQY1"; // Add this to your .env file
const ETHERSCAN_API_URL = "https://api-sepolia.etherscan.io/api";

async function fetchContractInfo(address: string) {
  const url = `${ETHERSCAN_API_URL}?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch contract info");
  const data = await res.json();
  return data.result?.[0];
}

export function EtherscanFrame() {
  const [address, setAddress] = useState("");
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setContractInfo(null);
    try {
      const info = await fetchContractInfo(address);
      setContractInfo(info);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleFetch} className="flex flex-col gap-2 mb-4">
        <input
          type="text"
          placeholder="Smart contract address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-full bg-white/10 px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
          disabled={loading}
        >
          {loading ? "Fetching..." : "Fetch Contract Info"}
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      {contractInfo && (
        <div className="bg-white/10 p-4 rounded">
          <h2 className="font-bold mb-2">Contract Info</h2>
          <div className="mb-2">
            <strong>Contract Name:</strong> {contractInfo.ContractName || "N/A"}
          </div>
          <div className="mb-2">
            <strong>Compiler Version:</strong> {contractInfo.CompilerVersion || "N/A"}
          </div>
          <div className="mb-2">
            <strong>Optimization Used:</strong> {contractInfo.OptimizationUsed === "1" ? "Yes" : "No"}
          </div>
          <div className="mb-2">
            <strong>Source Code:</strong>
            <pre className="text-xs overflow-x-auto bg-black/60 p-2 rounded mt-1 max-h-96">
              {contractInfo.SourceCode || "// No source code available"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}