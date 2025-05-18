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

// Event signatures for ChainLinkCasino
const EVENT_SIGNATURES: Record<string, EventSignature> = {
  // PlayRequested event signature
  "0x73f510d31b54bae7d1bbc1a42b23ddc86a4497e0d01cba61cd12978cfb19e194": {
    name: "PlayRequested",
    signature: "PlayRequested(address indexed player, uint256 requestId)",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: false }
    ]
  },
  // PlayResult event signature  
  "0x355703094d447d022aec112b23be648497e0d01cbcae1d9612678fa9ae16c6a2": {
    name: "PlayResult", 
    signature: "PlayResult(address indexed player, uint8 number)",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "number", type: "uint8", indexed: false }
    ]
  },
  // VRF fulfillRandomWords - this is the actual VRF callback
  "0x7dffc5ae5ee4e2e4df1651cf6ad329a73cebdb728f37ea0187b9b17e036756e4": {
    name: "fulfillRandomWords",
    signature: "fulfillRandomWords(uint256 requestId, uint256[] randomWords)",
    inputs: [
      { name: "requestId", type: "uint256", indexed: false },
      { name: "randomWords", type: "uint256[]", indexed: false }
    ]
  }
};

async function fetchContractEvents(address: string): Promise<EtherscanEvent[]> {
  const url = `${ETHERSCAN_API_URL}?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest&apikey=${ETHERSCAN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch events");
  const data = await res.json();
  if (data.status === "0") {
    if (data.message && data.message.includes("No records found")) return [];
    throw new Error(data.message || "Unknown error");
  }
  return (data.result || []).reverse(); // Most recent first
}

function parseEventData(event: EtherscanEvent): ParsedEvent {
  // Safety check for topics array
  if (!event.topics || event.topics.length === 0) {
    return {
      eventName: "Unknown",
      eventSignature: "Unknown Event",
      decodedData: {}
    };
  }

  const eventSig = EVENT_SIGNATURES[event.topics[0] as keyof typeof EVENT_SIGNATURES];
  
  if (!eventSig) {
    return {
      eventName: "Unknown",
      eventSignature: "Unknown Event",
      decodedData: {}
    };
  }

  const decodedData: { [key: string]: any } = {};
  
  // Parse indexed parameters (from topics)
  let topicIndex = 1;
  eventSig.inputs.forEach((input, index) => {
    if (input.indexed) {
      if (topicIndex < event.topics.length && event.topics[topicIndex]) {
        if (input.type === "address") {
          decodedData[input.name] = "0x" + event.topics[topicIndex].slice(26);
        } else {
          decodedData[input.name] = event.topics[topicIndex];
        }
        topicIndex++;
      }
    } else {
      // Parse non-indexed parameters (from data)
      if (event.data && event.data !== "0x") {
        try {
          if (input.type.includes("uint")) {
            const parsed = parseInt(event.data, 16);
            decodedData[input.name] = parsed;
            
            // For PlayResult, also calculate the roulette number
            if (eventSig.name === "PlayResult" && input.name === "number") {
              decodedData.rouletteNumber = parsed;
            }
          } else {
            decodedData[input.name] = event.data;
          }
        } catch (e) {
          decodedData[input.name] = event.data;
        }
      }
    }
  });

  return {
    eventName: eventSig.name,
    eventSignature: eventSig.signature,
    decodedData
  };
}

function formatTimeAgo(timestamp: string): string {
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp);
  const diff = now - eventTime;

  if (diff < 60) return `${diff} secs ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export function EtherscanEventsTab() {
  const [address, setAddress] = useState("0xB4BCbE5Fb9117683c58549C4669894B6f38B11F0");
  const [events, setEvents] = useState<EtherscanEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedEvents = await fetchContractEvents(address);
      setEvents(fetchedEvents);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(handleFetch, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, address]);

  // Initial fetch
  useEffect(() => {
    if (address) {
      handleFetch();
    }
  }, []);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (!autoRefresh) {
      handleFetch(); // Fetch immediately when enabling
    }
  };

  return (
    <div className="w-full max-w-6xl bg-gray-900 text-white">
      {/* Header */}
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
              onClick={toggleAutoRefresh}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                autoRefresh
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {autoRefresh ? "● Auto-refresh ON" : "Auto-refresh OFF"}
            </button>
            <button
              onClick={handleFetch}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-600"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Contract address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            disabled={autoRefresh}
          />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Tip: Logs are used by developers/external UI providers for keeping track of contract actions and for auditing
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-600 p-3 m-4 rounded">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-gray-800">
        {/* Table Header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-400">
          <div>Transaction Hash</div>
          <div>Block</div>
          <div>Age</div>
          <div>Method</div>
          <div>Logs</div>
          <div></div>
        </div>

        {/* Table Body */}
        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              No events found for this contract
            </div>
          )}

          {events.map((event, index) => {
            const parsedEvent = parseEventData(event);
            const blockNum = parseInt(event.blockNumber, 16);
            const timeAgo = formatTimeAgo(event.timeStamp);

            return (
              <div key={`${event.transactionHash}-${event.logIndex}`} className="border-b border-gray-700">
                <div className="grid grid-cols-6 gap-4 p-4 text-sm hover:bg-gray-750">
                  {/* Transaction Hash */}
                  <div className="text-blue-400">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {event.transactionHash.slice(0, 10)}...
                    </a>
                  </div>

                  {/* Block */}
                  <div className="text-blue-400">
                    <a
                      href={`https://sepolia.etherscan.io/block/${blockNum}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {blockNum}
                    </a>
                  </div>

                  {/* Age */}
                  <div className="text-gray-300">{timeAgo}</div>

                  {/* Method */}
                  <div className="text-green-400 flex items-center">
                    <span className="mr-2">***</span>
                    {parsedEvent.eventName === "Unknown" ? "Unknown Method" : parsedEvent.eventName}
                  </div>

                  {/* Logs */}
                  <div className="text-blue-400">
                    <span className="cursor-pointer hover:underline">
                      {parsedEvent.eventName}
                    </span>
                    <span className="text-gray-500">
                      (index_topic_1{" "}
                      <span className="text-teal-400">address</span>{" "}
                      <span className="text-orange-400">player</span>,{" "}
                      {parsedEvent.eventName === "PlayRequested" ? (
                        <>
                          <span className="text-purple-400">uint256</span>{" "}
                          <span className="text-orange-400">requestId</span>
                        </>
                      ) : parsedEvent.eventName === "PlayResult" ? (
                        <>
                          <span className="text-purple-400">uint8</span>{" "}
                          <span className="text-orange-400">number</span>
                        </>
                      ) : (
                        <span className="text-gray-400">unknown</span>
                      )}
                      )
                    </span>
                  </div>

                  {/* Expand/Details */}
                  <div className="text-gray-500">
                    {/* This could be used for expand/collapse functionality */}
                  </div>
                </div>

                {/* Event Details */}
                <div className="px-4 pb-4 bg-gray-850">
                  <div className="text-xs space-y-1">
                    {/* Topics */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-2 text-gray-500">[topic0]</div>
                      <div className="col-span-10 font-mono text-gray-300">
                        {event.topics[0]}
                      </div>
                    </div>
                    
                    {event.topics.slice(1).map((topic, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <div className="col-span-2 text-gray-500">[topic{idx + 1}]</div>
                        <div className="col-span-10 font-mono text-gray-300">{topic}</div>
                      </div>
                    ))}

                    {/* Data */}
                    {event.data && event.data !== "0x" && (
                      <div className="grid grid-cols-12 gap-2 border-t border-gray-700 pt-2">
                        <div className="col-span-2 text-gray-500"></div>
                        <div className="col-span-2 text-gray-500">Data</div>
                        <div className="col-span-6 font-mono text-gray-300 break-all">
                          {event.data}
                        </div>
                        <div className="col-span-2 text-gray-500"></div>
                        <div className="col-span-2 text-right">
                          {parsedEvent.eventName === "PlayResult" ? (
                            <span className="text-red-500 font-bold text-lg">
                              🎲 Roulette Pick: {parsedEvent.decodedData.number}
                            </span>
                          ) : parsedEvent.eventName === "PlayRequested" ? (
                            <span className="text-blue-400">
                              Request ID: {parsedEvent.decodedData.requestId}
                            </span>
                          ) : (
                            <span className="text-green-400">
                              Decoded: {parseInt(event.data, 16)}
                            </span>
                          )}
                        </div>
                        <div className="col-span-6"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {events.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-b-lg border-t border-gray-700 text-xs text-gray-500">
          Latest {events.length} events • 
          {autoRefresh && <span className="ml-1 text-green-400">Auto-refreshing every 10 seconds</span>}
        </div>
      )}
    </div>
  );
}