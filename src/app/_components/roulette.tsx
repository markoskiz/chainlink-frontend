"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  usePublicClient,
} from "wagmi";
import { sepolia } from "viem/chains";
import { parseEther, getContract } from "viem";
import type { Log as ViemLog } from "viem";

// --- Dynamic imports
const Wheel = dynamic(() => import("react-custom-roulette").then((m) => m.Wheel), {
  ssr: false,
});

// Alternative confetti implementation
const ConfettiPiece = ({ delay }: { delay: number }) => (
  <div
    className="absolute w-3 h-3 rounded-full animate-bounce"
    style={{
      left: `${Math.random() * 100}%`,
      backgroundColor: ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 5)],
      animationDelay: `${delay}ms`,
      animationDuration: '3s',
      animationIterationCount: 1,
      animationFillMode: 'forwards'
    }}
  />
);

const SimpleConfetti = () => (
  <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
    {Array.from({ length: 50 }, (_, i) => (
      <ConfettiPiece key={i} delay={i * 100} />
    ))}
  </div>
);

// --- Contract constants
const CASINO_ADDRESS = "0xB4BCbE5Fb9117683c58549C4669894B6f38B11F0" as const;
const CASINO_ABI = [
  {
    type: "function",
    name: "play",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "PlayRequested",
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "requestId", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "PlayResult",
    inputs: [
      { indexed: true, name: "player", type: "address" },
      { indexed: false, name: "number", type: "uint8" },
    ],
  },
] as const;

// --- Component
export function RouletteWheel() {
  /* wallet */
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, status: connectStatus, error: connectError } = useConnect();
  const publicClient = usePublicClient();

  const walletConnector =
    connectors.find((c) => c.id === "metaMask" || c.name.toLowerCase().includes("metamask")) ||
    connectors.find((c) => c.id === "injected");

  /* contract write */
  const {
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isTxLoading,
    isSuccess: isTxSuccess,
    error: txError,
    data: receipt,
  } = useWaitForTransactionReceipt({ 
    hash: txHash, 
    confirmations: 3
  });

  /* state */
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [gameStatus, setGameStatus] = useState<
    "idle" | "pending-tx" | "waiting-for-vrf" | "revealing"
  >("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lastWinningNumber, setLastWinningNumber] = useState<number | null>(null);
  const [lastBlockChecked, setLastBlockChecked] = useState<bigint | null>(null);
  const [revealingTimeout, setRevealingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  /* betting state */
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [betInput, setBetInput] = useState("");
  const [isWinner, setIsWinner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null);

  // Window size for confetti
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial dimensions
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reference for fresh status in event listener
  const statusRef = useRef(gameStatus);
  const requestIdRef = useRef(requestId);
  const selectedNumberRef = useRef(selectedNumber);
  
  useEffect(() => {
    statusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    requestIdRef.current = requestId;
  }, [requestId]);

  useEffect(() => {
    selectedNumberRef.current = selectedNumber;
  }, [selectedNumber]);

  /* Handle bet input */
  const handleBetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBetInput(value);
    
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0 && num <= 36) {
      setSelectedNumber(num);
    } else if (value === "") {
      setSelectedNumber(null);
    }
  };

  /* Quick number selection buttons */
  const quickSelectNumbers = [0, 1, 7, 13, 21, 27, 35];

  /* After confirmation → start spinning */
  useEffect(() => {
    if (isTxSuccess && gameStatus === "pending-tx") {
      setGameStatus("waiting-for-vrf");
      setMustSpin(true);
      setPrizeNumber(Math.floor(Math.random() * 37));
      
      if (receipt?.blockNumber) {
        setLastBlockChecked(receipt.blockNumber);
      }
    }
  }, [isTxSuccess, gameStatus, receipt]);

  /* Handle errors */
  useEffect(() => {
    if (txError || writeError) {
      setGameStatus("idle");
      resetWrite();
      console.error("Transaction error:", txError || writeError);
    }
  }, [txError, writeError, resetWrite]);

  /* PlayRequested event listener */
  useWatchContractEvent({
    address: CASINO_ADDRESS,
    abi: CASINO_ABI,
    eventName: "PlayRequested",
    chainId: sepolia.id,
    onLogs: (logs) => {
      logs.forEach(({ args, transactionHash }) => {
        if (!args || transactionHash !== txHash) return;
        const [player, req] = args as readonly [string, bigint];
        if (player.toLowerCase() === address?.toLowerCase()) {
          setRequestId(req.toString());
          console.log("VRF request initiated:", req.toString());
        }
      });
    },
  });

  /* PlayResult event listener */
  useWatchContractEvent({
    address: CASINO_ADDRESS,
    abi: CASINO_ABI,
    eventName: "PlayResult",
    chainId: sepolia.id,
    pollingInterval: 2_000,
    onLogs: (logs) => {
      console.log("PlayResult logs received:", logs);
      logs.forEach(({ args, transactionHash, blockHash, blockNumber }) => {
        console.log("Processing PlayResult log:", { 
          args, 
          transactionHash, 
          blockHash, 
          blockNumber,
          currentStatus: statusRef.current,
          currentRequestId: requestIdRef.current,
          selectedNumber: selectedNumberRef.current
        });
        
        if (!args) {
          console.log("No args in log");
          return;
        }

        const [player, num] = args as readonly [string, number];
        console.log("Event details:", {
          eventPlayer: player,
          eventNumber: num,
          connectedAddress: address,
          statusCheck: statusRef.current === "waiting-for-vrf"
        });
        
        if (player.toLowerCase() !== address?.toLowerCase()) {
          console.log("Player mismatch - Event player:", player, "Connected:", address);
          return;
        }

        if (statusRef.current !== "waiting-for-vrf") {
          console.log("Status mismatch - Current status:", statusRef.current);
          return;
        }

        console.log("✅ VRF result received and processed:", num);
        handleGameResult(num);
      });
    },
  });

  /* Handle game result */
  const handleGameResult = (resultNumber: number) => {
    setPrizeNumber(resultNumber);
    setLastWinningNumber(resultNumber);
    setGameStatus("revealing");
    setMustSpin(false);
    
    // Check if player won
    const won = selectedNumberRef.current === resultNumber;
    setIsWinner(won);
    setGameResult(won ? "win" : "lose");
    
    if (won) {
      console.log("🎉 WINNER! Selected:", selectedNumberRef.current, "Result:", resultNumber);
      setShowConfetti(true);
      // Stop confetti after 5 seconds
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      console.log("❌ LOSE! Selected:", selectedNumberRef.current, "Result:", resultNumber);
    }
    
    // Give the wheel time to stop, then start the final spin
    setTimeout(() => {
      console.log("Starting final spin to number:", resultNumber);
      setMustSpin(true);
      
      // Set a safety timeout to auto-complete revealing after spin duration
      const timeout = setTimeout(() => {
        console.log("Auto-completing reveal after timeout");
        setMustSpin(false);
        setGameStatus("idle");
        setRequestId(null);
      }, 4000);
      
      setRevealingTimeout(timeout);
    }, 500);
  };

  /* Manual check for PlayResult events */
  const checkForPlayResult = async () => {
    if (!publicClient || !address || !lastBlockChecked) return;

    try {
      console.log("Manually checking for PlayResult events from block:", lastBlockChecked);
      
      const events = await publicClient.getLogs({
        address: CASINO_ADDRESS,
        event: {
          type: "event",
          anonymous: false,
          name: "PlayResult",
          inputs: [
            { indexed: true, name: "player", type: "address" },
            { indexed: false, name: "number", type: "uint8" },
          ],
        },
        args: {
          player: address as `0x${string}`,
        },
        fromBlock: lastBlockChecked,
        toBlock: "latest",
      });

      console.log("Found PlayResult events:", events);

      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        console.log("Processing latest event:", latestEvent);
        
        if (latestEvent?.args && statusRef.current === "waiting-for-vrf") {
          const number = latestEvent.args.number;
          if (typeof number === 'number') {
            console.log("Manual check found result:", number);
            handleGameResult(number);
          }
        }
      }
    } catch (error) {
      console.error("Error checking for PlayResult events:", error);
    }
  };

  /* Auto-check for results every 5 seconds when waiting */
  useEffect(() => {
    if (gameStatus === "waiting-for-vrf") {
      const interval = setInterval(checkForPlayResult, 5000);
      return () => clearInterval(interval);
    }
  }, [gameStatus, lastBlockChecked, address]);

  /* Wheel data */
  const wheelData = [
    { option: "0", style: { backgroundColor: "#00aa00", textColor: "white" } },
    ...Array.from({ length: 36 }, (_, i) => ({
      option: `${i + 1}`,
      style: {
        backgroundColor: (i + 1) % 2 === 0 ? "#cc0000" : "#000000",
        textColor: "white",
      },
    })),
  ];

  /* Handle spin button click */
  const handleClick = async () => {
    if (!isConnected || !address) {
      if (walletConnector) {
        try {
          await connect({ connector: walletConnector });
        } catch (error) {
          console.error("Connection failed:", error);
        }
      }
      return;
    }

    if (chainId !== sepolia.id) {
      alert("Please switch to Sepolia testnet");
      return;
    }

    if (gameStatus !== "idle") return;

    if (selectedNumber === null) {
      alert("Please select a number to bet on first!");
      return;
    }

    try {
      setGameStatus("pending-tx");
      resetWrite();
      setRequestId(null);
      setLastWinningNumber(null);
      setLastBlockChecked(null);
      setGameResult(null);
      setIsWinner(false);
      setShowConfetti(false);
      
      await writeContractAsync({
        address: CASINO_ADDRESS,
        abi: CASINO_ABI,
        functionName: "play",
        args: [],
      });
    } catch (error) {
      console.error("Play failed:", error);
      setGameStatus("idle");
    }
  };

  /* Handle reset game state */
  const handleResetGame = () => {
    setGameStatus("idle");
    setMustSpin(false);
    setRequestId(null);
    setLastBlockChecked(null);
    setGameResult(null);
    setIsWinner(false);
    setShowConfetti(false);
    if (revealingTimeout) {
      clearTimeout(revealingTimeout);
      setRevealingTimeout(null);
    }
    resetWrite();
  };

  /* Handle manual check */
  const handleManualCheck = () => {
    checkForPlayResult();
  };

  const handleStopSpinning = () => {
    console.log("Wheel stopped spinning, current status:", gameStatus);
    if (gameStatus === "revealing") {
      console.log("Transition from revealing to idle");
      setMustSpin(false);
      setGameStatus("idle");
      setRequestId(null);
      
      if (revealingTimeout) {
        clearTimeout(revealingTimeout);
        setRevealingTimeout(null);
      }
    }
  };

  /* UI helper functions */
  const getButtonLabel = () => {
    if (!isConnected) return connectStatus === "pending" ? "CONNECTING..." : "CONNECT WALLET";
    if (chainId !== sepolia.id) return "SWITCH TO SEPOLIA";
    if (selectedNumber === null) return "SELECT A NUMBER FIRST";
    
    switch (gameStatus) {
      case "pending-tx":
        return isWritePending ? "SENDING TX..." : isTxLoading ? "CONFIRMING..." : "PROCESSING...";
      case "waiting-for-vrf":
        return "WAITING FOR VRF...";
      case "revealing":
        return "REVEALING RESULT...";
      default:
        return `SPIN FOR ${selectedNumber}!`;
    }
  };

  const isButtonDisabled =
    (!isConnected && connectStatus === "pending") || 
    gameStatus !== "idle" ||
    (isConnected && chainId !== sepolia.id) ||
    selectedNumber === null;

  const getStatusColor = () => {
    switch (gameStatus) {
      case "idle":
        return "text-green-400";
      case "pending-tx":
        return "text-yellow-400";
      case "waiting-for-vrf":
        return "text-blue-400";
      case "revealing":
        return "text-purple-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-gray-900 min-h-screen">
      {/* Confetti */}
      {showConfetti && <SimpleConfetti />}

      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Kazino so Chainlink VRF</h1>
        <p className="text-gray-400">Pogodi go brojot i pobedi! Poddrzano od Chainlink VRF</p>
      </div>

      {/* Number Selection Interface */}
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Izberi broj (0-36)</h3>
        
        {/* Input field */}
        <div className="mb-4">
          <input
            type="number"
            min="0"
            max="36"
            value={betInput}
            onChange={handleBetInputChange}
            placeholder="Vnesi broj od 0 do 36"
            className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white text-center text-xl font-bold border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={gameStatus !== "idle"}
          />
        </div>

        {/* Quick select buttons */}
        <div className="mb-4">
          <p className="text-gray-400 text-sm mb-2">Brz izbor:</p>
          <div className="flex flex-wrap gap-2">
            {quickSelectNumbers.map((num) => (
              <button
                key={num}
                onClick={() => {
                  setBetInput(num.toString());
                  setSelectedNumber(num);
                }}
                disabled={gameStatus !== "idle"}
                className={`px-3 py-2 rounded-md font-bold text-sm transition-colors ${
                  selectedNumber === num
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                } ${gameStatus !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Selected number display */}
        {selectedNumber !== null && (
          <div className="text-center bg-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Tvojot Izbor:</p>
            <p className="text-3xl font-bold text-blue-400">{selectedNumber}</p>
          </div>
        )}
      </div>

      {/* Game Result Display */}
      {gameResult && lastWinningNumber !== null && (
        <div className={`text-center rounded-lg p-6 shadow-lg ${
          gameResult === "win" 
            ? "bg-gradient-to-r from-green-600 to-green-500 animate-pulse" 
            : "bg-gradient-to-r from-red-600 to-red-500"
        }`}>
          <p className="text-2xl font-bold text-white mb-2">
            {gameResult === "win" ? "🎉 POBEDNIK! 🎉" : "❌ OBUVAJ POVTORNO"}
          </p>
          <p className="text-lg text-white mb-2">
            Tvojot izbor: <span className="font-bold">{selectedNumber}</span> | 
            Rezultat: <span className="font-bold">{lastWinningNumber}</span>
          </p>
          {gameResult === "win" && (
            <p className="text-lg text-green-100">Pogodi go brojot!</p>
          )}
        </div>
      )}

      {/* Display the winning number prominently when revealing */}
      {gameStatus === "revealing" && lastWinningNumber !== null && !gameResult && (
        <div className="text-center bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-lg p-6 shadow-lg animate-pulse">
          <p className="text-xl font-bold text-white mb-2">DOBITEN BROJ</p>
          <p className="text-6xl font-bold text-white">{lastWinningNumber}</p>
          <p className="text-lg text-yellow-100 mt-2">Rezultat od Chainlink VRF</p>
        </div>
      )}

      <div className="w-[400px] h-[400px] relative">
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeNumber}
          data={wheelData}
          onStopSpinning={handleStopSpinning}
          outerBorderColor="#333"
          outerBorderWidth={5}
          innerBorderColor="#555"
          radiusLineColor="#666"
          radiusLineWidth={2}
          fontSize={16}
          textDistance={85}
          spinDuration={gameStatus === "waiting-for-vrf" ? 8 : 3}
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleClick}
          disabled={isButtonDisabled}
          className={`px-8 py-3 rounded-full font-bold text-lg transition-all duration-200 ${
            isButtonDisabled
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : selectedNumber !== null
              ? "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
              : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
          }`}
        >
          {getButtonLabel()}
        </button>

        {gameStatus === "waiting-for-vrf" && (
          <>
            <button
              onClick={handleManualCheck}
              className="px-4 py-3 rounded-full font-bold text-sm bg-green-600 hover:bg-green-700 text-white"
            >
              PROVERI SEGA
            </button>
            <button
              onClick={handleResetGame}
              className="px-4 py-3 rounded-full font-bold text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              RESETIRAJ
            </button>
          </>
        )}
        
        {gameStatus === "revealing" && (
          <button
            onClick={handleResetGame}
            className="px-4 py-3 rounded-full font-bold text-sm bg-red-600 hover:bg-red-700 text-white"
          >
            RESETIRAJ
          </button>
        )}
      </div>

      {/* Status and debug info */}
      <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2 w-full max-w-md">
        <div className="flex justify-between">
          <span className="text-gray-400">Status:</span>
          <span className={getStatusColor()}>{gameStatus}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Momentalen Broj:</span>
          <span className="text-white">{prizeNumber}</span>
        </div>
        {isConnected && (
          <div className="flex justify-between">
            <span className="text-gray-400">Parichnik:</span>
            <span className="text-white font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        )}
        {requestId && (
          <div className="flex justify-between">
            <span className="text-gray-400">ID na Baranje:</span>
            <span className="text-white font-mono">{requestId}</span>
          </div>
        )}
        {lastBlockChecked && (
          <div className="flex justify-between">
            <span className="text-gray-400">Blok:</span>
            <span className="text-white font-mono">{lastBlockChecked.toString()}</span>
          </div>
        )}
        {txHash && (
          <div className="flex justify-between">
            <span className="text-gray-400">Transakcija:</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline font-mono"
            >
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </a>
          </div>
        )}
        <div className="text-xs text-gray-500 mt-4">
          <p>• Slushanje na nastani: Aktivno</p>
          <p>• Rachna proverka: Na sekoj 5 sekundi koga se cheka</p>
          <p>• Konzola: Proveri za detalni logovi</p>
        </div>
      </div>

      <div className="text-center text-gray-500 text-xs max-w-md">
        <p>Poddrzano od Chainlink VRF fer random rezultati.</p>
      </div>
    </div>
  );
}