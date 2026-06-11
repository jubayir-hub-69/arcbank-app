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
};

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "history" | "tools">("overview");

  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [eurcBalance, setEurcBalance] = useState("0.00");
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Send Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAddress, setSendAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<"USDC" | "EURC">("USDC");
  const [isSending, setIsSending] = useState(false);

  // Swap Modal States
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapFromAsset, setSwapFromAsset] = useState<"USDC" | "EURC">("USDC");
  const [swapAmount, setSwapAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);

  // Dynamic Transaction History
  const [txHistory, setTxHistory] = useState<ActivityItem[]>([
    { id: 1, label: "Wallet Setup Ready", amount: "System", meta: "Arc Testnet", status: "Completed" }
  ]);

  const isArcTestnet = chainId === ARC_CHAIN_ID;

  const addHistoryRecord = (label: string, amount: string, meta: string, status: "Completed" | "Pending" | "Failed") => {
    setTxHistory((prev) => [
      { id: Date.now(), label, amount, meta, status },
      ...prev
    ]);
  };

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
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

  const fetchBalances = useCallback(
    async (address: string, isSilentRefresh = false) => {
      const ethereum = getEthereum();
      if (!ethereum || !address || chainId !== ARC_CHAIN_ID) {
        setUsdcBalance("0.00");
        setEurcBalance("0.00");
        if (!isSilentRefresh) setBalancesLoading(false);
        return;
      }
      try {
        if (!isSilentRefresh) setBalancesLoading(true);
        const provider = new ethers.BrowserProvider(ethereum);
        const eurcContract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, provider);

        const [nativeUsdcRaw, eurcRaw] = await Promise.all([
          provider.getBalance(address),
          eurcContract.balanceOf(address)
        ]);

        setUsdcBalance(Number(ethers.formatUnits(nativeUsdcRaw, 18)).toFixed(2));
        setEurcBalance(Number(ethers.formatUnits(eurcRaw, 6)).toFixed(2));
      } catch (error) {
        setUsdcBalance("0.00");
        setEurcBalance("0.00");
      } finally {
        if (!isSilentRefresh) setBalancesLoading(false);
      }
    },
    [chainId]
  );

  const syncConnectedAccount = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send("eth_accounts", []);
      if (accounts?.length) {
        setWallet(accounts[0]);
        addHistoryRecord("Wallet Connected", "Access Granted", `Address: ${accounts[0].slice(0,6)}...`, "Completed");
      } else {
        setWallet("");
      }
      await syncNetwork();
    } catch {}
  };

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
    if (!wallet || !isArcTestnet) {
      setUsdcBalance("0.00");
      setEurcBalance("0.00");
      setBalancesLoading(false);
      return;
    }
    void fetchBalances(wallet);
    const intervalId = setInterval(() => void fetchBalances(wallet, true), 10000);
    return () => clearInterval(intervalId);
  }, [wallet, isArcTestnet, fetchBalances]);

  const connectWallet = async () => {
    try {
      const ethereum = getEthereum();
      if (!ethereum) {
        showMessage("Install Rabby or MetaMask");
        return;
      }
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
      addHistoryRecord("Wallet Connected", "Auth Success", `Address: ${accounts[0].slice(0,6)}...`, "Completed");
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
    addHistoryRecord("Wallet Disconnected", "Session Ended", "User action", "Completed");
  };

  const copyAddress = async () => {
    if (!wallet) return showMessage("Connect wallet first");
    await navigator.clipboard.writeText(wallet);
    showMessage("Address Copied");
  };

  const openFaucet = () => window.open(ARC_FAUCET, "_blank", "noopener,noreferrer");
  const openExplorer = () => window.open(ARC_EXPLORER, "_blank", "noopener,noreferrer");

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

  // SEND LOGIC
  const executeSend = async () => {
    if (!wallet || !sendAddress || !sendAmount) return showMessage("Please fill all fields");
    try {
      setIsSending(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm transaction in your wallet...");

      if (sendAsset === "USDC") {
        const parsedAmount = ethers.parseUnits(sendAmount, 18);
        const tx = await signer.sendTransaction({ to: sendAddress, value: parsedAmount });
        showMessage(`Sending ${sendAmount} USDC...`);
        await tx.wait();
      } else {
        const parsedAmount = ethers.parseUnits(sendAmount, 6);
        const contract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
        const tx = await contract.transfer(sendAddress, parsedAmount);
        showMessage(`Sending ${sendAmount} EURC...`);
        await tx.wait();
      }
      
      showMessage(`Successfully sent ${sendAmount} ${sendAsset}!`);
      addHistoryRecord(`Transfer ${sendAsset}`, `-${sendAmount} ${sendAsset}`, `To: ${sendAddress.slice(0,6)}...${sendAddress.slice(-4)}`, "Completed");
      
      setShowSendModal(false);
      setSendAddress("");
      setSendAmount("");
      void fetchBalances(wallet);
    } catch {
      showMessage("Transaction failed or rejected");
      addHistoryRecord(`Transfer ${sendAsset}`, `${sendAmount} ${sendAsset}`, "Transaction Failed", "Failed");
    } finally {
      setIsSending(false);
    }
  };

  // SWAP LOGIC & EXCHANGE RATE SIMULATION
  const exchangeRate = swapFromAsset === "USDC" ? 0.92 : 1.08; 
  const receiveAsset = swapFromAsset === "USDC" ? "EURC" : "USDC";
  const estimatedReceive = swapAmount ? (parseFloat(swapAmount) * exchangeRate).toFixed(2) : "0.00";

  const executeSwap = async () => {
    if (!wallet || !swapAmount || parseFloat(swapAmount) <= 0) return showMessage("Enter a valid amount");
    
    const currentBal = swapFromAsset === "USDC" ? parseFloat(usdcBalance) : parseFloat(eurcBalance);
    if (parseFloat(swapAmount) > currentBal) return showMessage(`Insufficient ${swapFromAsset} balance`);

    try {
      setIsSwapping(true);
      showMessage("Confirming swap via router...");
      
      // Simulating realistic blockchain confirmation delay
      await new Promise((resolve) => setTimeout(resolve, 3500));
      
      showMessage(`Swap Successful! Received ${estimatedReceive} ${receiveAsset}`);
      addHistoryRecord(`Swap ${swapFromAsset} to ${receiveAsset}`, `+${estimatedReceive} ${receiveAsset}`, `Exchanged ${swapAmount} ${swapFromAsset}`, "Completed");
      
      setShowSwapModal(false);
      setSwapAmount("");
    } catch {
      showMessage("Swap failed");
      addHistoryRecord(`Swap ${swapFromAsset}`, `${swapAmount} ${swapFromAsset}`, "Router Error", "Failed");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white relative font-sans">
      {/* TOAST NOTIFICATION */}
      {message && (
        <div className="fixed top-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-blue-500 bg-blue-700/90 backdrop-blur-md px-6 py-3 shadow-2xl transition-all duration-300">
          <div className="font-semibold">{message}</div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Send Stablecoin</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white transition">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Recipient Address</label>
                <input type="text" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} placeholder="0x..." className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Select Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSendAsset("USDC")} className={`rounded-xl py-3 border font-semibold transition ${sendAsset === "USDC" ? "border-blue-500 bg-blue-600/20 text-blue-400" : "border-zinc-800 bg-black text-gray-400 hover:bg-zinc-800"}`}>USDC</button>
                  <button onClick={() => setSendAsset("EURC")} className={`rounded-xl py-3 border font-semibold transition ${sendAsset === "EURC" ? "border-green-500 bg-green-600/20 text-green-400" : "border-zinc-800 bg-black text-gray-400 hover:bg-zinc-800"}`}>EURC</button>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 flex justify-between">
                  <span>Amount</span>
                  <span className="text-gray-500">Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition" />
              </div>
              <button onClick={executeSend} disabled={isSending || !sendAddress || !sendAmount} className="w-full rounded-xl bg-blue-600 py-4 font-bold transition hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 mt-2">
                {isSending ? "Processing Transaction..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SWAP MODAL */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Swap Tokens</h3>
              <button onClick={() => setShowSwapModal(false)} className="text-gray-400 hover:text-white transition">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-black border border-zinc-800 rounded-2xl p-4">
                <label className="text-sm text-gray-400 mb-2 flex justify-between">
                  <span>Pay with</span>
                  <span className="text-blue-400 cursor-pointer" onClick={() => setSwapAmount(swapFromAsset === "USDC" ? usdcBalance : eurcBalance)}>Max: {swapFromAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <div className="flex justify-between items-center gap-4">
                  <input type="number" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} placeholder="0.0" className="w-full bg-transparent text-3xl text-white focus:outline-none font-semibold" />
                  <button onClick={() => setSwapFromAsset(swapFromAsset === "USDC" ? "EURC" : "USDC")} className="bg-zinc-800 hover:bg-zinc-700 transition px-4 py-2 rounded-xl text-md font-bold flex items-center gap-2">
                    {swapFromAsset} ▾
                  </button>
                </div>
              </div>

              <div className="flex justify-center -my-6 relative z-10">
                <button onClick={() => setSwapFromAsset(swapFromAsset === "USDC" ? "EURC" : "USDC")} className="p-2 rounded-xl border-4 border-zinc-900 bg-zinc-800 text-white hover:bg-zinc-700 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                </button>
              </div>

              <div className="bg-black border border-zinc-800 rounded-2xl p-4">
                <label className="text-sm text-gray-400 mb-2 block">Receive (Estimated)</label>
                <div className="flex justify-between items-center gap-4">
                  <div className={`w-full text-3xl font-semibold ${swapAmount ? "text-white" : "text-gray-600"}`}>
                    {estimatedReceive}
                  </div>
                  <div className="bg-zinc-800/50 px-4 py-2 rounded-xl text-md font-bold text-gray-400 flex items-center gap-2">
                    {receiveAsset}
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-500 px-2">
                <span>Exchange Rate</span>
                <span>1 {swapFromAsset} = {exchangeRate} {receiveAsset}</span>
              </div>

              <button onClick={executeSwap} disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0} className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold transition hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 mt-2">
                {isSwapping ? "Confirming Swap..." : "Swap"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="flex items-center justify-between border-b border-gray-800 px-6 py-5 md:px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-white">ArcBank</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isArcTestnet ? "bg-green-500/20 text-green-400 border border-green-500/20" : chainId ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" : "bg-zinc-800 text-gray-400"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Not Connected"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {wallet ? (
            <>
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 font-semibold text-white tracking-wider">{wallet.slice(0, 6)}...{wallet.slice(-4)}</div>
              <button type="button" onClick={disconnectWallet} className="rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 px-5 py-2 transition hover:bg-red-500 hover:text-white font-semibold">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-xl bg-blue-600 px-6 py-2 transition hover:bg-blue-700 font-bold shadow-lg shadow-blue-600/20">Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <section className="min-h-[85vh] px-4 py-10 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          
          {/* HEADER AREA */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              ArcBank Dashboard
            </h1>
            <p className="text-lg text-gray-400 md:text-xl font-medium">Stablecoin Banking on Arc Network</p>
            
            {wallet && !isArcTestnet && (
              <div className="flex justify-center mt-4">
                <button type="button" onClick={switchToArcTestnet} className="rounded-full border border-emerald-500 bg-emerald-500/10 px-6 py-2 font-bold text-emerald-400 transition hover:bg-emerald-500 hover:text-black">
                  Switch to Arc Testnet
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
            
            {/* SIDEBAR */}
            <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl h-fit">
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mode</div>
                <div className="text-xl font-bold text-white">Banking Console</div>
              </div>
              <div className="space-y-2">
                <button onClick={() => setSelectedTab("overview")} className={`w-full rounded-2xl px-5 py-3.5 text-left font-semibold transition-all ${selectedTab === "overview" ? "bg-white text-black shadow-lg" : "bg-transparent text-gray-400 hover:bg-zinc-800 hover:text-white"}`}>
                  Overview
                </button>
                <button onClick={() => setSelectedTab("tools")} className={`w-full rounded-2xl px-5 py-3.5 text-left font-semibold transition-all ${selectedTab === "tools" ? "bg-white text-black shadow-lg" : "bg-transparent text-gray-400 hover:bg-zinc-800 hover:text-white"}`}>
                  Quick Tools
                </button>
              </div>
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-black/50 p-5">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Network Status</div>
                <div className="mt-2 text-lg font-bold flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isArcTestnet ? "bg-green-500" : "bg-red-500"}`}></div>
                  {wallet ? (isArcTestnet ? "Arc Testnet" : "Wrong Network") : "Offline"}
                </div>
              </div>
            </aside>

            {/* DASHBOARD TABS */}
            <div className="space-y-6">
              {selectedTab === "overview" && (
                <>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
                      <h2 className="mb-6 text-xl font-extrabold text-white">Account Overview</h2>
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 transition hover:border-zinc-700">
                          <div className="text-sm font-medium text-gray-400">Wallet Status</div>
                          <div className="mt-1 text-xl font-bold text-white">{wallet ? "Connected" : "Not Connected"}</div>
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 transition hover:border-zinc-700">
                          <div className="text-sm font-medium text-gray-400">Wallet Address</div>
                          <div className="mt-1 break-all text-md font-mono text-gray-300">{wallet || "No wallet connected"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
                      <h2 className="mb-6 text-xl font-extrabold text-white">Stablecoin Balances</h2>
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 flex justify-between items-center transition hover:border-zinc-700">
                          <div>
                            <div className="text-sm font-medium text-gray-400">USDC Balance</div>
                            <div className="mt-1 text-4xl font-extrabold text-blue-400">{balancesLoading ? "..." : usdcBalance}</div>
                          </div>
                          <div className="bg-blue-500/10 p-3 rounded-full border border-blue-500/20"><span className="text-xl">💵</span></div>
                        </div>
                        <div className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 flex justify-between items-center transition hover:border-zinc-700">
                          <div>
                            <div className="text-sm font-medium text-gray-400">EURC Balance</div>
                            <div className="mt-1 text-4xl font-extrabold text-emerald-400">{balancesLoading ? "..." : eurcBalance}</div>
                          </div>
                          <div className="bg-emerald-500/10 p-3 rounded-full border border-emerald-500/20"><span className="text-xl">💶</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <button onClick={() => setShowSendModal(true)} className="group rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center transition-all hover:bg-white hover:border-white">
                      <div className="text-sm font-medium text-gray-400 group-hover:text-gray-500">Send</div>
                      <div className="mt-1 text-lg font-bold text-white group-hover:text-black">USDC / EURC</div>
                    </button>
                    <button onClick={copyAddress} className="group rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center transition-all hover:bg-white hover:border-white">
                      <div className="text-sm font-medium text-gray-400 group-hover:text-gray-500">Receive</div>
                      <div className="mt-1 text-lg font-bold text-white group-hover:text-black">Copy Address</div>
                    </button>
                    <button onClick={() => setShowSwapModal(true)} className="group rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center transition-all hover:bg-white hover:border-white">
                      <div className="text-sm font-medium text-gray-400 group-hover:text-gray-500">Swap</div>
                      <div className="mt-1 text-lg font-bold text-white group-hover:text-black">USDC ↔ EURC</div>
                    </button>
                    <button onClick={() => setSelectedTab("history")} className="group rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center transition-all hover:bg-white hover:border-white">
                      <div className="text-sm font-medium text-gray-400 group-hover:text-gray-500">History</div>
                      <div className="mt-1 text-lg font-bold text-white group-hover:text-black">Transactions</div>
                    </button>
                    <button onClick={openFaucet} className="group rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center transition-all hover:bg-white hover:border-white">
                      <div className="text-sm font-medium text-gray-400 group-hover:text-gray-500">Faucet</div>
                      <div className="mt-1 text-lg font-bold text-white group-hover:text-black">Get Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {/* HISTORY TAB */}
              {selectedTab === "history" && (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-extrabold text-white">Transaction History</h2>
                      <p className="text-sm text-gray-400 mt-1">Your recent activity on ArcBank</p>
                    </div>
                    <button onClick={openExplorer} className="rounded-xl border border-zinc-700 bg-black px-5 py-2.5 text-sm font-bold transition hover:bg-zinc-800 hover:text-white text-gray-300 shadow-lg">
                      Open Arc Explorer ↗
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {txHistory.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">No transactions yet.</div>
                    ) : (
                      txHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-700 transition">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${item.status === "Completed" ? "bg-green-500/10 text-green-500" : item.status === "Failed" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {item.status === "Completed" ? "✓" : item.status === "Failed" ? "✕" : "⏳"}
                            </div>
                            <div>
                              <div className="font-bold text-lg text-white">{item.label}</div>
                              <div className="mt-0.5 text-sm text-gray-400">{item.meta}</div>
                            </div>
                          </div>
                          <div className="sm:text-right pl-14 sm:pl-0">
                            <div className={`font-extrabold text-lg ${item.amount.startsWith("+") ? "text-green-400" : item.amount.startsWith("-") ? "text-red-400" : "text-white"}`}>
                              {item.amount}
                            </div>
                            <div className={`mt-0.5 text-xs font-bold uppercase tracking-wider ${item.status === "Completed" ? "text-green-500" : item.status === "Failed" ? "text-red-500" : "text-amber-500"}`}>
                              {item.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TOOLS TAB */}
              {selectedTab === "tools" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
                    <h2 className="mb-6 text-xl font-extrabold text-white">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button onClick={copyAddress} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-sm font-medium text-gray-400">Receive</div>
                        <div className="mt-1 text-lg font-bold text-white">Copy Wallet Address</div>
                      </button>
                      <button onClick={openFaucet} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-sm font-medium text-gray-400">Faucet</div>
                        <div className="mt-1 text-lg font-bold text-white">Get Test Tokens</div>
                      </button>
                      <button onClick={() => setShowSendModal(true)} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-sm font-medium text-gray-400">Send</div>
                        <div className="mt-1 text-lg font-bold text-white">Transfer Stablecoins</div>
                      </button>
                      <button onClick={() => setShowSwapModal(true)} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-5 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-sm font-medium text-gray-400">Swap</div>
                        <div className="mt-1 text-lg font-bold text-white">USDC ↔ EURC</div>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
                    <h2 className="mb-6 text-xl font-extrabold text-white">Project Milestones</h2>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-green-900/50 bg-green-900/10 p-5 flex items-center gap-4">
                        <div className="bg-green-500/20 p-2 rounded-full text-green-500">✓</div>
                        <div>
                          <div className="text-sm font-bold text-green-500 uppercase tracking-wider">Completed</div>
                          <div className="text-lg font-bold text-white">Wallet Setup & Network</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-green-900/50 bg-green-900/10 p-5 flex items-center gap-4">
                        <div className="bg-green-500/20 p-2 rounded-full text-green-500">✓</div>
                        <div>
                          <div className="text-sm font-bold text-green-500 uppercase tracking-wider">Completed</div>
                          <div className="text-lg font-bold text-white">Live Balance Reader</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-green-900/50 bg-green-900/10 p-5 flex items-center gap-4">
                        <div className="bg-green-500/20 p-2 rounded-full text-green-500">✓</div>
                        <div>
                          <div className="text-sm font-bold text-green-500 uppercase tracking-wider">Completed</div>
                          <div className="text-lg font-bold text-white">Send & Swap UI Ready</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
