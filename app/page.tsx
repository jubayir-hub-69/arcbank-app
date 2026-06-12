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

  // Daily Check-in Logic Setup
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
      if (currentChainId !== ARC_CHAIN_ID) showMessage("Wallet Connected. Switch to Arc Testnet");
      else showMessage("Wallet Connected Successfully");
      
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

  const switchToArcTestnet = async () => {
    try {
      const ethereum = getEthereum();
      if (!ethereum) return;
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
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
        }
      }
      await syncNetwork();
    } catch {}
  };

  // REAL BLOCKCHAIN SEND TRANSACTION (Fixed TypeScript Null Receipt Error)
  const executeSend = async () => {
    if (!wallet || !sendAddress || !sendAmount) return showMessage("Please fill all fields");
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

  // REAL DAILY GM CHECK-IN TRANSACTION (Fixed TypeScript Null Receipt Error)
  const executeDailyGM = async () => {
    if (!wallet) return showMessage("Please connect wallet first");
    if (hasCheckedInToday) return showMessage("Already checked in today! Come back tomorrow.");

    try {
      setIsCheckingIn(true);
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
    <div className="min-h-screen bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black text-white relative font-sans flex flex-col selection:bg-blue-500/30">
      {/* TOAST NOTIFICATION */}
      {message && (
        <div className="fixed top-5 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-blue-500/50 bg-blue-900/80 backdrop-blur-md px-6 py-3 shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300">
          <div className="font-semibold text-sm tracking-wide text-blue-100">{message}</div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Send Asset</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-full p-2">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 block uppercase tracking-wider">Recipient Address</label>
                <input type="text" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} placeholder="0x..." className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-white focus:border-blue-500 focus:outline-none transition font-mono" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 block uppercase tracking-wider">Select Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSendAsset("USDC")} className={`rounded-2xl py-4 border-2 font-bold transition ${sendAsset === "USDC" ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "border-white/5 bg-black/50 text-gray-400 hover:border-white/20"}`}>USDC</button>
                  <button onClick={() => setSendAsset("EURC")} className={`rounded-2xl py-4 border-2 font-bold transition ${sendAsset === "EURC" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-white/5 bg-black/50 text-gray-400 hover:border-white/20"}`}>EURC</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 flex justify-between uppercase tracking-wider">
                  <span>Amount</span>
                  <span className="text-gray-500 font-mono">Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-white focus:border-blue-500 focus:outline-none transition text-xl font-bold" />
              </div>
              <button onClick={executeSend} disabled={isSending || !sendAddress || !sendAmount} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-4 font-bold text-lg transition disabled:bg-zinc-800 disabled:text-zinc-500 mt-4 shadow-lg">
                {isSending ? "Processing Transaction..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-8 bg-transparent sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white">ArcBank</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold border backdrop-blur-md ${isArcTestnet ? "bg-green-500/10 text-green-400 border-green-500/20" : chainId ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-gray-400 border-white/10"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {wallet ? (
            <>
              <div className="hidden sm:block rounded-full bg-white/5 border border-white/10 px-5 py-2 font-semibold text-white tracking-wider backdrop-blur-md">{wallet.slice(0, 6)}...{wallet.slice(-4)}</div>
              <button type="button" onClick={disconnectWallet} className="rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-2 transition hover:bg-red-500 hover:text-white font-bold backdrop-blur-md">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-full bg-white text-black px-6 py-2 transition hover:bg-gray-200 font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)]">Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-black tracking-tight md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 pb-2">
              Welcome to ArcBank
            </h1>
            <p className="text-lg text-gray-400 md:text-xl font-medium">Enterprise Stablecoin Management on Arc Network</p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
            
            {/* SIDEBAR */}
            <aside className="h-fit space-y-4">
              <button onClick={() => setSelectedTab("overview")} className={`w-full rounded-3xl px-6 py-5 text-left font-bold transition-all border backdrop-blur-md ${selectedTab === "overview" ? "bg-white/10 text-white border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white"}`}>
                Dashboard
              </button>
              <button onClick={() => setSelectedTab("history")} className={`w-full rounded-3xl px-6 py-5 text-left font-bold transition-all border backdrop-blur-md ${selectedTab === "history" ? "bg-white/10 text-white border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white"}`}>
                Transaction History
              </button>
              <button onClick={() => setSelectedTab("learn")} className={`w-full rounded-3xl px-6 py-5 text-left font-bold transition-all border backdrop-blur-md ${selectedTab === "learn" ? "bg-white/10 text-white border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white"}`}>
                Learn Arc & Circle
              </button>
            </aside>

            {/* DASHBOARD TABS */}
            <div className="space-y-6">
              {selectedTab === "overview" && (
                <>
                  {/* CLEAN BALANCES GRID & GM CHECK-IN */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors duration-500">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition duration-500 text-7xl">💵</div>
                        <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">USDC Balance</div>
                        <div className="mt-1 text-5xl font-black text-white tracking-tight drop-shadow-md">{balancesLoading ? "..." : usdcBalance}</div>
                        <div className="mt-4 text-sm font-semibold text-blue-400">Arc Native Gas Asset</div>
                      </div>

                      <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors duration-500">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition duration-500 text-7xl">💶</div>
                        <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">EURC Balance</div>
                        <div className="mt-1 text-5xl font-black text-white tracking-tight drop-shadow-md">{balancesLoading ? "..." : eurcBalance}</div>
                        <div className="mt-4 text-sm font-semibold text-emerald-400">Euro Stablecoin</div>
                      </div>
                    </div>

                    {/* DAILY GM CHECK-IN CARD */}
                    <div className="rounded-[2rem] border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-transparent backdrop-blur-2xl p-8 shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">☀️</div>
                      <h3 className="text-xl font-black text-white mb-2">Daily GM Check-in</h3>
                      <p className="text-sm font-semibold text-gray-400 mb-6">Execute a real transaction everyday to build your streak!</p>
                      
                      <div className="text-4xl mb-4">{hasCheckedInToday ? "🔥" : "⏳"}</div>
                      <div className="text-xl font-bold text-orange-400 mb-6 uppercase tracking-wider">
                        {streak > 0 ? `Streak: Day ${streak}` : "No Active Streak"}
                      </div>
                      
                      <button 
                        onClick={executeDailyGM}
                        disabled={isCheckingIn || hasCheckedInToday || !wallet}
                        className={`w-full rounded-2xl py-4 font-black text-lg transition shadow-lg ${
                          hasCheckedInToday 
                            ? "bg-zinc-800 text-zinc-500 border border-white/5" 
                            : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                        }`}
                      >
                        {isCheckingIn ? "Processing..." : hasCheckedInToday ? "Checked In ✅" : "Say GM (Check-in)"}
                      </button>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <button onClick={() => setShowSendModal(true)} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 mb-2">Send</div>
                      <div className="text-xl font-black text-white">Transfer</div>
                    </button>
                    <button onClick={copyAddress} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 mb-2">Receive</div>
                      <div className="text-xl font-black text-white">Address</div>
                    </button>
                    <button onClick={() => setSelectedTab("history")} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 mb-2">History</div>
                      <div className="text-xl font-black text-white">Activity</div>
                    </button>
                    <button onClick={openFaucet} className="group rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 text-center transition-all hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 mb-2">Faucet</div>
                      <div className="text-xl font-black text-white">Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {/* HISTORY TAB */}
              {selectedTab === "history" && (
                <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-2xl p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-white">Transaction History</h2>
                      <p className="text-sm font-medium text-gray-400 mt-1">Real verifiable blockchain events</p>
                    </div>
                    <button onClick={openExplorer} className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold transition hover:bg-white hover:text-black shadow-lg">
                      Arc Explorer ↗
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {txHistory.length === 0 ? (
                      <div className="text-center py-16 text-gray-500 font-bold text-lg">No blockchain activity found.</div>
                    ) : (
                      txHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/5 bg-black/40 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-white/10 transition">
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-full ${item.status === "Completed" ? "bg-green-500/10 text-green-500" : item.status === "Failed" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {item.status === "Completed" ? "✓" : item.status === "Failed" ? "✕" : "⏳"}
                            </div>
                            <div>
                              <div className="font-black text-xl text-white tracking-tight">{item.label}</div>
                              {item.txHash ? (
                                <a href={`${ARC_EXPLORER}/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1">
                                  {item.meta} ↗
                                </a>
                              ) : (
                                <div className="mt-1 text-sm font-semibold text-gray-400">{item.meta}</div>
                              )}
                            </div>
                          </div>
                          <div className="sm:text-right pl-16 sm:pl-0">
                            <div className={`font-black text-xl tracking-tight ${item.amount.startsWith("+") ? "text-emerald-400" : item.amount.startsWith("-") ? "text-white" : "text-gray-300"}`}>
                              {item.amount}
                            </div>
                            <div className={`mt-1 text-xs font-black uppercase tracking-widest ${item.status === "Completed" ? "text-emerald-500" : item.status === "Failed" ? "text-red-500" : "text-amber-500"}`}>
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
                <div className="space-y-6">
                  <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-b from-blue-900/10 to-transparent backdrop-blur-2xl p-10 shadow-2xl">
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">What is Arc Network?</h2>
                    <p className="text-lg text-gray-300 leading-relaxed max-w-3xl mb-8">
                      Arc is an enterprise-grade L1 blockchain designed specifically for stablecoin management, rapid payments, and decentralized finance. It brings together fiat-backed assets and powerful infrastructure to make global money movement seamless.
                    </p>
                    <button onClick={openArcWebsite} className="rounded-full bg-blue-600 hover:bg-blue-500 px-8 py-4 font-bold text-white transition shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center gap-2">
                      Visit Arc Official Website <span className="text-xl">↗</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-2xl p-8 shadow-2xl hover:border-white/10 transition">
                      <div className="text-5xl mb-6">🌐</div>
                      <h3 className="text-2xl font-black text-white mb-3">Circle Integration</h3>
                      <p className="text-gray-400 font-medium leading-relaxed">
                        Arc natively supports Circle&apos;s major stablecoins like <strong className="text-blue-400">USDC</strong> (US Dollar) and <strong className="text-emerald-400">EURC</strong> (Euro). These assets are directly issued on the network ensuring deep liquidity and 1:1 fiat backing.
                      </p>
                    </div>

                    <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-2xl p-8 shadow-2xl hover:border-white/10 transition">
                      <div className="text-5xl mb-6">⚡</div>
                      <h3 className="text-2xl font-black text-white mb-3">Native Gas Asset</h3>
                      <p className="text-gray-400 font-medium leading-relaxed">
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
      <footer className="mt-auto border-t border-white/5 bg-black/40 py-10 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="text-sm font-bold text-gray-500 tracking-wider">
            © 2026 ARC Bank · Built on Arc
          </div>
          
          <div className="flex flex-col items-center gap-3 md:items-end">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Built by <span className="text-white">JUBAYIR69</span>
            </div>
            <div className="flex gap-5">
              {/* X / Twitter */}
              <a href="https://x.com/jubayirhaider90" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.337H5.051z" /></svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com/jubayir-hub-69" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
              {/* LinkedIn */}
              <a href="https://www.linkedin.com/in/jubayir-haider-302aab372" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#0a66c2] transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.848-3.037-1.85 0-2.132 1.445-2.132 2.939v5.667H9.36V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
