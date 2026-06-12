"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4cef52";
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_FAUCET = "https://faucet.circle.com";

const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

type ActivityItem = {
  id: number;
  label: string;
  amount: string;
  meta: string;
  status: "Completed" | "Pending" | "Failed";
  txHash?: string;
};

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "history" | "learn">("overview");

  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [eurcBalance, setEurcBalance] = useState("0.00");
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Send Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAddress, setSendAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<"USDC" | "EURC">("USDC");
  const [isSending, setIsSending] = useState(false);

  // Daily GM Check-in States
  const [streak, setStreak] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const [txHistory, setTxHistory] = useState<ActivityItem[]>([]);

  const isArcTestnet = chainId === ARC_CHAIN_ID;

  const addHistoryRecord = (label: string, amount: string, meta: string, status: "Completed" | "Pending" | "Failed", txHash?: string) => {
    setTxHistory((prev) => [
      { id: Date.now(), label, amount, meta, status, txHash },
      ...prev
    ]);
  };

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  };

  const getEthereum = () => {
    if (typeof window === "undefined") return null;
    return (window as any).ethereum ?? null;
  };

  const syncNetwork = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return null;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);
      setChainId(currentChainId);
      return currentChainId;
    } catch {
      return null;
    }
  };

  const fetchBalances = useCallback(async (address: string, isSilentRefresh = false) => {
    if (!address) return;
    try {
      if (!isSilentRefresh) setBalancesLoading(true);
      const rpcProvider = new ethers.JsonRpcProvider(ARC_RPC);
      const eurcContract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, rpcProvider);

      const [nativeUsdcRaw, eurcRaw] = await Promise.all([
        rpcProvider.getBalance(address),
        eurcContract.balanceOf(address)
      ]);

      setUsdcBalance(Number(ethers.formatUnits(nativeUsdcRaw, 18)).toFixed(2));
      setEurcBalance(Number(ethers.formatUnits(eurcRaw, 6)).toFixed(2));
    } catch (error) {
      console.error("Fetch Balance Error:", error);
    } finally {
      if (!isSilentRefresh) setBalancesLoading(false);
    }
  }, []);

  const syncConnectedAccount = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts?.length) {
        setWallet(accounts[0]);
      } else {
        setWallet("");
      }
      await syncNetwork();
    } catch {}
  };

  // Daily Check-in Logic & Countdown Timer
  useEffect(() => {
    if (!wallet) return;
    const storedStreak = localStorage.getItem(`arcbank_streak_${wallet}`);
    const storedDate = localStorage.getItem(`arcbank_last_gm_${wallet}`);
    const today = new Date().toLocaleDateString();

    if (storedDate) {
      const lastDate = new Date(storedDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (storedDate === today) {
        setHasCheckedInToday(true);
        setStreak(Number(storedStreak) || 1);
      } else if (diffDays === 1) {
        setHasCheckedInToday(false);
        setStreak(Number(storedStreak) || 0);
      } else {
        setHasCheckedInToday(false);
        setStreak(0);
      }
    } else {
      setHasCheckedInToday(false);
      setStreak(0);
    }
  }, [wallet]);

  useEffect(() => {
    if (!hasCheckedInToday) {
      setTimeLeft("");
      return;
    }
    const timer = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = tomorrow.getTime() - now.getTime();

      if (diff <= 0) {
        setHasCheckedInToday(false);
        setTimeLeft("");
        clearInterval(timer);
        return;
      }

      const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
      const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
      const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [hasCheckedInToday]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleChainChanged = (nextChainIdHex: string) => {
      setChainId(Number.parseInt(nextChainIdHex, 16));
    };
    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts?.length) {
        setWallet("");
        setUsdcBalance("0.00");
        setEurcBalance("0.00");
        setHasCheckedInToday(false);
        setStreak(0);
        showMessage("Wallet Disconnected");
      } else {
        setWallet(accounts[0]);
      }
    };

    syncConnectedAccount();
    ethereum.on?.("chainChanged", handleChainChanged);
    ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      ethereum.removeListener?.("chainChanged", handleChainChanged);
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!wallet || !isArcTestnet) return;
    void fetchBalances(wallet);
    const intervalId = setInterval(() => void fetchBalances(wallet, true), 8000);
    return () => clearInterval(intervalId);
  }, [wallet, isArcTestnet, fetchBalances]);

  // ADVANCED NETWORK SWITCHER
  const switchToArcTestnet = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return false;
    
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
      await syncNetwork();
      return true;
    } catch (switchError: any) {
      // If switch fails (chain not added), try to add it
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_CHAIN_ID_HEX,
            chainName: "Arc Testnet",
            rpcUrls: [ARC_RPC],
            blockExplorerUrls: [ARC_EXPLORER],
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          }],
        });
        await syncNetwork();
        return true;
      } catch (addError) {
        console.error("Failed to add Arc Testnet", addError);
        return false;
      }
    }
  };

  const connectWallet = async () => {
    try {
      const ethereum = getEthereum();
      if (!ethereum) return showMessage("Install Rabby or MetaMask");
      
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts?.length) return;

      const signer = await provider.getSigner();
      await signer.signMessage("Sign in to ArcBank");

      setWallet(accounts[0]);
      const currentChainId = await syncNetwork();
      
      if (currentChainId !== ARC_CHAIN_ID) {
        showMessage("Switching to Arc Testnet...");
        const switched = await switchToArcTestnet();
        if (switched) showMessage("Wallet Connected Successfully");
        else showMessage("Please switch to Arc Testnet manually in your wallet.");
      } else {
        showMessage("Wallet Connected Successfully");
      }
      
      void fetchBalances(accounts[0]);
    } catch {
      showMessage("Connection Rejected");
    }
  };

  const disconnectWallet = () => {
    setWallet("");
    setChainId(null);
    setUsdcBalance("0.00");
    setEurcBalance("0.00");
    showMessage("Wallet Disconnected");
  };

  const copyAddress = async () => {
    if (!wallet) return showMessage("Connect wallet first");
    await navigator.clipboard.writeText(wallet);
    showMessage("Address Copied");
  };

  const openFaucet = () => window.open(ARC_FAUCET, "_blank", "noopener,noreferrer");
  const openExplorer = () => window.open(ARC_EXPLORER, "_blank", "noopener,noreferrer");
  const openArcWebsite = () => window.open("https://www.arc.io/", "_blank", "noopener,noreferrer");

  const handleOpenSendModal = async () => {
    if (!wallet) return showMessage("Please connect wallet first");
    
    if (!isArcTestnet) {
      showMessage("Switching to Arc Testnet...");
      const switched = await switchToArcTestnet();
      if (!switched) {
        return showMessage("Network switch failed. Please switch manually.");
      }
    }
    setShowSendModal(true);
  };

  // REAL BLOCKCHAIN SEND TRANSACTION
  const executeSend = async () => {
    if (!wallet || !sendAddress || !sendAmount) return showMessage("Please fill all fields");
    
    if (!isArcTestnet) {
      showMessage("Switching to Arc Testnet...");
      const switched = await switchToArcTestnet();
      if (!switched) return showMessage("Network switch failed. Please switch manually.");
      await new Promise((res) => setTimeout(res, 1000)); // allow provider to sync
    }

    try {
      setIsSending(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm transaction in your wallet...");
      let tx: any;

      if (sendAsset === "USDC") {
        const parsedAmount = ethers.parseUnits(sendAmount, 18);
        tx = await signer.sendTransaction({ to: sendAddress, value: parsedAmount });
      } else {
        const parsedAmount = ethers.parseUnits(sendAmount, 6);
        const contract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
        tx = await contract.transfer(sendAddress, parsedAmount);
      }
      
      showMessage(`Sending ${sendAsset}... Waiting for block confirmation`);
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash || "";
      
      showMessage(`Successfully sent ${sendAmount} ${sendAsset}!`);
      addHistoryRecord(`Transfer ${sendAsset}`, `-${sendAmount} ${sendAsset}`, `Sent to ${sendAddress.slice(0,6)}...`, "Completed", txHash);
      
      setShowSendModal(false);
      setSendAddress("");
      setSendAmount("");
      void fetchBalances(wallet);
    } catch (error) {
      console.error(error);
      showMessage("Transaction failed or rejected");
      addHistoryRecord(`Transfer ${sendAsset}`, `${sendAmount} ${sendAsset}`, "Transaction Failed", "Failed");
    } finally {
      setIsSending(false);
    }
  };

  // REAL DAILY GM CHECK-IN TRANSACTION
  const executeDailyGM = async () => {
    if (!wallet) return showMessage("Please connect wallet first");
    if (hasCheckedInToday) return showMessage("Already checked in today! Come back tomorrow.");

    setIsCheckingIn(true);

    try {
      // Step 1: Ensure Correct Network
      if (!isArcTestnet) {
        showMessage("Switching to Arc Testnet...");
        const switched = await switchToArcTestnet();
        if (!switched) {
          showMessage("Network switch failed. Please switch manually.");
          setIsCheckingIn(false);
          return;
        }
        await new Promise((res) => setTimeout(res, 1000)); // wait for wallet to settle
      }

      // Step 2: Execute Real Blockchain Transaction
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm Daily GM Check-in (Zero-value tx)");
      
      const tx = await signer.sendTransaction({
        to: wallet,
        value: 0
      });

      showMessage("Broadcasting GM Transaction to Arc Network...");
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash || "";

      // Step 3: Update local states
      const newStreak = streak + 1;
      const today = new Date().toLocaleDateString();
      setStreak(newStreak);
      setHasCheckedInToday(true);
      localStorage.setItem(`arcbank_streak_${wallet}`, newStreak.toString());
      localStorage.setItem(`arcbank_last_gm_${wallet}`, today);

      showMessage(`GM! Daily check-in successful. You are on Day ${newStreak} 🔥`);
      addHistoryRecord("Daily GM Check-in", "0 USDC", `Streak: Day ${newStreak} 🔥`, "Completed", txHash);
      
      void fetchBalances(wallet); 
    } catch (error) {
      console.error(error);
      showMessage("GM Check-in rejected or failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-white relative font-sans flex flex-col selection:bg-blue-500/30">
      
      {/* TOAST NOTIFICATION */}
      {message && (
        <div className="fixed top-8 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-8 py-4 shadow-[0_0_40px_rgba(255,255,255,0.05)] transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          <div className="font-bold text-sm tracking-wide text-white">{message}</div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black tracking-tight text-white">Send Asset</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-500 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-full p-2.5">✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-widest">Recipient Address</label>
                <input type="text" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} placeholder="0x..." className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white focus:border-blue-500 focus:outline-none transition font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-widest">Select Asset</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setSendAsset("USDC")} className={`rounded-2xl py-4 border-2 font-black tracking-wide transition-all ${sendAsset === "USDC" ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "border-white/5 bg-black text-gray-500 hover:border-white/20 hover:text-gray-300"}`}>USDC</button>
                  <button onClick={() => setSendAsset("EURC")} className={`rounded-2xl py-4 border-2 font-black tracking-wide transition-all ${sendAsset === "EURC" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]" : "border-white/5 bg-black text-gray-500 hover:border-white/20 hover:text-gray-300"}`}>EURC</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 flex justify-between uppercase tracking-widest">
                  <span>Amount</span>
                  <span className="font-mono text-gray-400">Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-white focus:border-blue-500 focus:outline-none transition text-2xl font-black" />
              </div>
              <button onClick={executeSend} disabled={isSending || !sendAddress || !sendAmount} className="w-full rounded-2xl bg-white text-black hover:bg-gray-200 py-4 font-black text-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 mt-2 shadow-xl">
                {isSending ? "Processing..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="flex items-center justify-between px-6 py-6 md:px-10 bg-transparent sticky top-0 z-40 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black tracking-tighter text-white drop-shadow-md">ArcBank</h1>
          <span className={`rounded-full px-4 py-1.5 text-xs font-black tracking-widest uppercase border backdrop-blur-md ${isArcTestnet ? "bg-green-500/10 text-green-400 border-green-500/20" : chainId ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-gray-500 border-white/10"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {wallet ? (
            <>
              <div className="hidden sm:block rounded-full bg-white/5 border border-white/10 px-6 py-2.5 font-bold text-white tracking-wider backdrop-blur-md shadow-sm">{wallet.slice(0, 6)}...{wallet.slice(-4)}</div>
              <button type="button" onClick={disconnectWallet} className="rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-2.5 transition-all hover:bg-red-500 hover:text-white font-bold backdrop-blur-md hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-full bg-white text-black px-8 py-2.5 transition-all hover:scale-105 active:scale-95 font-black shadow-[0_0_20px_rgba(255,255,255,0.2)]">Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 py-10 md:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
          
          <div className="text-center space-y-5 mt-4">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-gray-500 pb-2">
              Welcome to ArcBank
            </h1>
            <p className="text-lg md:text-xl font-medium text-gray-400 tracking-wide max-w-2xl mx-auto">
              Enterprise-grade stablecoin management built on the lightning-fast Arc L1 Network.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[280px_1fr]">
            
            {/* SIDEBAR */}
            <aside className="h-fit space-y-4">
              <button onClick={() => setSelectedTab("overview")} className={`w-full rounded-[2rem] px-8 py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "overview" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                Dashboard
              </button>
              <button onClick={() => setSelectedTab("history")} className={`w-full rounded-[2rem] px-8 py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "history" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                History
              </button>
              <button onClick={() => setSelectedTab("learn")} className={`w-full rounded-[2rem] px-8 py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "learn" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                Learn
              </button>
            </aside>

            {/* DASHBOARD TABS */}
            <div className="space-y-8">
              {selectedTab === "overview" && (
                <>
                  {/* BALANCES GRID & GM CHECK-IN */}
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 grid grid-cols-1 gap-8 sm:grid-cols-2">
                      {/* USDC Card */}
                      <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500 hover:-translate-y-1">
                        <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 text-9xl group-hover:scale-110">💵</div>
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">USDC Balance</div>
                        <div className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{balancesLoading ? "..." : usdcBalance}</div>
                        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 border border-blue-500/20">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Arc Native Gas</span>
                        </div>
                      </div>

                      {/* EURC Card */}
                      <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500 hover:-translate-y-1">
                        <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 text-9xl group-hover:scale-110">💶</div>
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">EURC Balance</div>
                        <div className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{balancesLoading ? "..." : eurcBalance}</div>
                        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 border border-emerald-500/20">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Euro Stablecoin</span>
                        </div>
                      </div>
                    </div>

                    {/* DAILY GM CHECK-IN CARD */}
                    <div className="rounded-[2.5rem] border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-black backdrop-blur-2xl p-8 shadow-[0_0_40px_rgba(249,115,22,0.05)] flex flex-col justify-center items-center text-center relative overflow-hidden group">
                      <div className="absolute -top-6 -right-6 p-4 opacity-10 text-8xl group-hover:rotate-12 transition-transform duration-700">☀️</div>
                      
                      <div className="text-5xl mb-6">{hasCheckedInToday ? "🔥" : "⏳"}</div>
                      <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Daily GM</h3>
                      <p className="text-sm font-medium text-gray-400 mb-6 px-4">Execute a real zero-value transaction to build your on-chain streak!</p>
                      
                      <div className="text-xl font-black text-orange-400 mb-6 uppercase tracking-widest bg-orange-500/10 px-6 py-2 rounded-full border border-orange-500/20">
                        {streak > 0 ? `Day ${streak}` : "No Streak"}
                      </div>
                      
                      <button 
                        onClick={executeDailyGM}
                        disabled={isCheckingIn || hasCheckedInToday || !wallet}
                        className={`w-full rounded-2xl py-4 font-black text-lg transition-all duration-300 shadow-xl ${
                          hasCheckedInToday 
                            ? "bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed" 
                            : "bg-white text-black hover:bg-gray-200 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse hover:animate-none"
                        }`}
                      >
                        {isCheckingIn ? "Processing..." : hasCheckedInToday ? `Next: ${timeLeft}` : "Say GM (Check-in)"}
                      </button>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <button onClick={handleOpenSendModal} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-8 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 shadow-lg">
                      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">💸</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-400 mb-2">Transfer</div>
                      <div className="text-2xl font-black text-white">Send Assets</div>
                    </button>
                    <button onClick={copyAddress} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-8 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 shadow-lg">
                      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📥</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-400 mb-2">Copy Address</div>
                      <div className="text-2xl font-black text-white">Receive Funds</div>
                    </button>
                    <button onClick={openFaucet} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-8 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 shadow-lg">
                      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🚰</div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-400 mb-2">Circle Faucet</div>
                      <div className="text-2xl font-black text-white">Get Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {/* HISTORY TAB */}
              {selectedTab === "history" && (
                <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl p-10 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight">Transaction History</h2>
                      <p className="text-sm font-semibold text-gray-400 mt-2">Real verifiable blockchain events</p>
                    </div>
                    <button onClick={openExplorer} className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-black tracking-wide transition-all hover:bg-white hover:text-black shadow-lg hover:scale-105 active:scale-95">
                      Arc Explorer ↗
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {txHistory.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="text-6xl mb-4 opacity-50">📭</div>
                        <div className="text-gray-500 font-bold text-lg">No blockchain activity found.</div>
                      </div>
                    ) : (
                      txHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/5 bg-black/60 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-6 hover:border-white/10 transition-all hover:bg-black/80">
                          <div className="flex items-center gap-6">
                            <div className={`p-4 rounded-full border ${item.status === "Completed" ? "bg-green-500/10 text-green-400 border-green-500/20" : item.status === "Failed" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                              {item.status === "Completed" ? "✓" : item.status === "Failed" ? "✕" : "⏳"}
                            </div>
                            <div>
                              <div className="font-black text-xl text-white tracking-tight">{item.label}</div>
                              {item.txHash ? (
                                <a href={`${ARC_EXPLORER}/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 text-sm font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4 flex items-center gap-1.5 transition-colors">
                                  {item.meta} <span className="text-xs">↗</span>
                                </a>
                              ) : (
                                <div className="mt-1.5 text-sm font-bold text-gray-500">{item.meta}</div>
                              )}
                            </div>
                          </div>
                          <div className="sm:text-right pl-20 sm:pl-0">
                            <div className={`font-black text-2xl tracking-tighter ${item.amount.startsWith("+") ? "text-emerald-400" : item.amount.startsWith("-") ? "text-white" : "text-gray-400"}`}>
                              {item.amount}
                            </div>
                            <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${item.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" : item.status === "Failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                              {item.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* LEARN SECTION TAB */}
              {selectedTab === "learn" && (
                <div className="space-y-8">
                  <div className="rounded-[2.5rem] border border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-black backdrop-blur-3xl p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl">📖</div>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter drop-shadow-md">What is Arc Network?</h2>
                    <p className="text-lg md:text-xl text-gray-300 font-medium leading-relaxed max-w-3xl mb-10">
                      Arc is an enterprise-grade L1 blockchain designed specifically for stablecoin management, rapid payments, and decentralized finance. It brings together fiat-backed assets and powerful infrastructure to make global money movement seamless.
                    </p>
                    <button onClick={openArcWebsite} className="rounded-full bg-white text-black hover:bg-gray-200 px-10 py-4 font-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3">
                      Visit Arc Official Website <span className="text-2xl">↗</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-10 shadow-2xl hover:border-white/20 transition-all hover:-translate-y-1">
                      <div className="text-6xl mb-8">🌐</div>
                      <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Circle Integration</h3>
                      <p className="text-gray-400 font-medium leading-relaxed text-lg">
                        Arc natively supports Circle's major stablecoins like <strong className="text-blue-400">USDC</strong> (US Dollar) and <strong className="text-emerald-400">EURC</strong> (Euro). These assets are directly issued on the network ensuring deep liquidity and 1:1 fiat backing.
                      </p>
                    </div>

                    <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-10 shadow-2xl hover:border-white/20 transition-all hover:-translate-y-1">
                      <div className="text-6xl mb-8">⚡</div>
                      <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Native Gas Asset</h3>
                      <p className="text-gray-400 font-medium leading-relaxed text-lg">
                        Unlike traditional networks that use volatile assets (like ETH or BNB) for transaction fees, Arc uses <strong className="text-blue-400">USDC as its native gas asset</strong>. This guarantees predictable, low-cost operations for businesses.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER & BUILDER SECTION */}
      <footer className="mt-auto border-t border-white/10 bg-black/60 py-12 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
          <div className="text-sm font-bold text-gray-500 tracking-widest uppercase">
            © 2026 ARC Bank · Built on Arc
          </div>
          
          <div className="flex flex-col items-center gap-4 md:items-end">
            <div className="text-xs font-black text-gray-500 uppercase tracking-widest">
              Built by <span className="text-white">JUBAYIR69</span>
            </div>
            <div className="flex gap-4">
              {/* X / Twitter */}
              <a href="https://x.com/jubayirhaider90" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.337H5.051z" /></svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/jubayir-hub-69" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
              {/* LinkedIn */}
              <a href="https://www.linkedin.com/in/jubayir-haider-302aab372" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#0a66c2] transition-all p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.848-3.037-1.85 0-2.132 1.445-2.132 2.939v5.667H9.36V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
