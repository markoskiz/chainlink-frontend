"use client";

import { useState, useEffect } from "react";

const ETHERSCAN_API_KEY = "ZAMEKKMPF93HGSD8Q5PXDNU73CVC6HGQY1";
const ETHERSCAN_API_URL = "https://api-sepolia.etherscan.io/api";

interface EtherscanEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  transactionHash: string;
  transactionIndex: string;
}

interface ParsedEvent {
  eventName: string;
  eventSignature: string;
  decodedData: { [key: string]: any };
}

interface EventSignature {
  name: string;
  signature: string;
  inputs: Array<{
    name: string;
    type: string;
    indexed: boolean;
  }>;
}

/* ─────────────────────────────────────────────────────────
   Event signatures for ChainLinkCasino
───────────────────────────────────────────────────────── */
const EVENT_SIGNATURES: Record<string, EventSignature> = {
  /* PlayRequested(address indexed player, uint256 requestId) */
  "0x73f510d31b54bae7d1bbc1a42b23ddc86a4497e0d01cba61cd12978cfb19e194": {
    name: "PlayRequested",
    signature: "PlayRequested(address indexed player, uint256 requestId)",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: false }
    ]
  },
  /* PlayResult(address indexed player, uint8 number) */
  "0x355703094d447d022aec112b23be648497e0d01cbcae1d9612678fa9ae16c6a2": {
    name: "PlayResult",
    signature: "PlayResult(address indexed player, uint8 number)",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "number", type: "uint8", indexed: false }
    ]
  },
  /* fulfillRandomWords(uint256 requestId, uint256[] randomWords) */
  "0x7dffc5ae5ee4e2e4df1651cf6ad329a73cebdb728f37ea0187b9b17e036756e4": {
    name: "fulfillRandomWords",
    signature: "fulfillRandomWords(uint256 requestId, uint256[] randomWords)",
    inputs: [
      { name: "requestId", type: "uint256", indexed: false },
      { name: "randomWords", type: "uint256[]", indexed: false }
    ]
  }
};

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
async function fetchContractEvents(address: string): Promise<EtherscanEvent[]> {
  const url =
    `${ETHERSCAN_API_URL}?module=logs&action=getLogs&address=${address}` +
    `&fromBlock=0&toBlock=latest&apikey=${ETHERSCAN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch events");
  const data = await res.json();
  if (data.status === "0") {
    if (data.message?.includes("No records found")) return [];
    throw new Error(data.message || "Unknown error");
  }
  return (data.result || []).reverse(); // newest first
}

function parseEventData(event: EtherscanEvent): ParsedEvent {
  /* topics[0] = keccak256(signature) */
  const sigHash = event.topics?.[0];
  const eventSig = sigHash ? EVENT_SIGNATURES[sigHash] : undefined;

  if (!eventSig) {
    return { eventName: "Unknown", eventSignature: "Unknown", decodedData: {} };
  }

  const decodedData: Record<string, any> = {};
  /* topic index starts at 1 for indexed params */
  let topicPtr = 1;

  for (const input of eventSig.inputs) {
    if (input.indexed) {
      const topic = event.topics?.[topicPtr];
      if (topic) {
        decodedData[input.name] =
          input.type === "address" ? `0x${topic.slice(26)}` : topic;
      }
      topicPtr++;
    } else if (event.data && event.data !== "0x") {
      /* naive parse: full data blob represents the first non-indexed arg */
      try {
        if (input.type.startsWith("uint")) {
          const val = BigInt(event.data);
          decodedData[input.name] = val.toString();
          if (eventSig.name === "PlayResult" && input.name === "number") {
            decodedData.rouletteNumber = Number(val);
          }
        } else {
          decodedData[input.name] = event.data;
        }
      } catch {
        decodedData[input.name] = event.data;
      }
    }
  }

  return {
    eventName: eventSig.name,
    eventSignature: eventSig.signature,
    decodedData
  };
}

function formatTimeAgo(timestamp: string): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────── */
export function EtherscanEventsTab() {
  const [address, setAddress] = useState(
    "0xB4BCbE5Fb9117683c58549C4669894B6f38B11F0"
  );
  const [events, setEvents] = useState<EtherscanEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchContractEvents(address);
      setEvents(fetched);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* auto-refresh */
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(handleFetch, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, address]);

  /* initial load */
  useEffect(() => {
    if (address) handleFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-6xl bg-gray-900 text-white">
      {/* header */}
      <div className="bg-gray-800 p-4 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <span className="text-green-400">●</span>
            <h2 className="text-xl font-semibold">Latest Contract Events</h2>
            {events.length > 0 && (
              <span className="text-gray-400">({events.length})</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setAutoRefresh((v) => !v);
                if (!autoRefresh) handleFetch();
              }}
              className={`px-3 py-1 rounded text-sm font-medium ${
                autoRefresh
                  ? "bg-green-600"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              {autoRefresh ? "● Auto-refresh ON" : "Auto-refresh OFF"}
            </button>
            <button
              onClick={handleFetch}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:bg-gray-600"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
        {/* address input */}
        <input
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          placeholder="Contract address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={autoRefresh}
        />
        <p className="text-xs text-gray-500 mt-2">
          Tip: Logs keep track of contract actions for auditing.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-600 p-3 m-4 rounded">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* table */}
      <div className="bg-gray-800">
        {/* header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-400">
          <div>Tx Hash</div>
          <div>Block</div>
          <div>Age</div>
          <div>Method</div>
          <div>Logs</div>
          <div />
        </div>

        {/* body */}
        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              No events found for this contract
            </div>
          )}

          {events.map((ev) => {
            const parsed = parseEventData(ev);
            const block = parseInt(ev.blockNumber, 16);

            return (
              <div
                key={`${ev.transactionHash}-${ev.logIndex}`}
                className="border-b border-gray-700"
              >
                <div className="grid grid-cols-6 gap-4 p-4 text-sm hover:bg-gray-750">
                  {/* tx */}
                  <div className="text-blue-400">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${ev.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {ev.transactionHash.slice(0, 10)}…
                    </a>
                  </div>
                  {/* block */}
                  <div className="text-blue-400">
                    <a
                      href={`https://sepolia.etherscan.io/block/${block}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {block}
                    </a>
                  </div>
                  {/* age */}
                  <div className="text-gray-300">
                    {formatTimeAgo(ev.timeStamp)}
                  </div>
                  {/* method */}
                  <div className="text-green-400 flex items-center">
                    <span className="mr-2">***</span>
                    {parsed.eventName === "Unknown"
                      ? "Unknown"
                      : parsed.eventName}
                  </div>
                  {/* logs (brief) */}
                  <div className="text-blue-400 truncate">
                    {parsed.eventName}
                  </div>
                  <div />
                </div>

                {/* expanded topics + data */}
                <div className="px-4 pb-4 bg-gray-850 text-xs space-y-1">
                  {/* topics */}
                  {ev.topics.map((topic, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 break-all"
                    >
                      <div className="col-span-2 text-gray-500">
                        [topic{i}]
                      </div>
                      <div className="col-span-10 font-mono text-gray-300">
                        {topic}
                      </div>
                    </div>
                  ))}

                  {/* data */}
                  {ev.data && ev.data !== "0x" && (
                    <div className="grid grid-cols-12 gap-2 border-t border-gray-700 pt-2 break-all">
                      <div className="col-span-2" />
                      <div className="col-span-2 text-gray-500">Data</div>
                      <div className="col-span-6 font-mono text-gray-300">
                        {ev.data}
                      </div>
                      <div className="col-span-2 text-right">
                        {parsed.eventName === "PlayResult" ? (
                          <span className="text-red-500 font-bold">
                            🎲 Pick: {parsed.decodedData.number}
                          </span>
                        ) : parsed.eventName === "PlayRequested" ? (
                          <span className="text-blue-400">
                            ReqID: {parsed.decodedData.requestId}
                          </span>
                        ) : (
                          <span className="text-green-400">
                            Decoded: {parseInt(ev.data, 16)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* footer */}
      {events.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-b-lg border-t border-gray-700 text-xs text-gray-500">
          Latest {events.length} events •{" "}
          {autoRefresh && (
            <span className="ml-1 text-green-400">
              Auto-refresh every 10 s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
