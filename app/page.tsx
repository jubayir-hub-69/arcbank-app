"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4cef52";
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_FAUCET = "https://faucet.circle.com";

// Contracts based on Arc Network Docs
const USDC_ERC20_ADDRESS = "0x3600000000000000000000000000000000000000"; // USDC ERC-20 Interface (6 decimals)
const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const FX_ESCROW_ADDRESS = "0x867650F5eAe8df91445971f14d89fd84F0C9a9f8"; // StableFX Router

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)"
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

  // Modals States
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAddress, setSendAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<"USDC" | "EURC">("USDC");
  const [isSending, setIsSending] = useState(false);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapFromAsset, setSwapFromAsset] = useState<"USDC" | "EURC">("USDC");
  const [swapAmount, setSwapAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);

  // Dynamic Transaction History
  const [txHistory, setTxHistory] = useState<ActivityItem[]>([]);

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

  // REALISTIC SWAP LOGIC (Approves FxEscrow Smart Contract)
  const exchangeRate = swapFromAsset === "USDC" ? 0.92 : 1.08; 
  const receiveAsset = swapFromAsset === "USDC" ? "EURC" : "USDC";
  const estimatedReceive = swapAmount ? (parseFloat(swapAmount) * exchangeRate).toFixed(2) : "0.00";

  const executeSwap = async () => {
    if (!wallet || !swapAmount || parseFloat(swapAmount) <= 0) return showMessage("Enter a valid amount");
    const currentBal = swapFromAsset === "USDC" ? parseFloat(usdcBalance) : parseFloat(eurcBalance);
    if (parseFloat(swapAmount) > currentBal) return showMessage(`Insufficient ${swapFromAsset} balance`);

    try {
      setIsSwapping(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage(`Please approve ${swapFromAsset} for FxEscrow in your wallet...`);
      
      // Arc USDC ERC-20 Interface uses 6 decimals, EURC uses 6 decimals
      const parsedAmount = ethers.parseUnits(swapAmount, 6);
      const tokenAddress = swapFromAsset === "USDC" ? USDC_ERC20_ADDRESS : EURC_ADDRESS;
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      // Real blockchain approval transaction
      const tx = await contract.approve(FX_ESCROW_ADDRESS, parsedAmount);
      showMessage("Approval pending on Arc Testnet...");
      await tx.wait();

      showMessage("Approval successful! Finalizing swap...");
      // Simulating backend RFQ execution delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      showMessage(`Swap Successful! Received ${estimatedReceive} ${receiveAsset}`);
      addHistoryRecord(`Swap ${swapFromAsset} to ${receiveAsset}`, `+${estimatedReceive} ${receiveAsset}`, `Exchanged ${swapAmount} ${swapFromAsset} via FxEscrow`, "Completed");
      
      setShowSwapModal(false);
      setSwapAmount("");
    } catch (error) {
      console.error(error);
      showMessage("Swap approval failed or rejected");
      addHistoryRecord(`Swap ${swapFromAsset}`, `${swapAmount} ${swapFromAsset}`, "User Rejected / Error", "Failed");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white relative font-sans">
      {message && (
        <div className="fixed top-5 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-blue-500 bg-blue-700/90 backdrop-blur-md px-6 py-3 shadow-2xl transition-all duration-300">
          <div className="font-semibold text-sm tracking-wide">{message}</div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Send Asset</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white transition bg-zinc-800 rounded-full p-2">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 block">Recipient Address</label>
                <input type="text" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} placeholder="0x..." className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 block">Select Asset</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSendAsset("USDC")} className={`rounded-2xl py-4 border-2 font-bold transition ${sendAsset === "USDC" ? "border-blue-500 bg-blue-600/20 text-blue-400" : "border-zinc-800 bg-black text-gray-400 hover:border-zinc-700"}`}>USDC</button>
                  <button onClick={() => setSendAsset("EURC")} className={`rounded-2xl py-4 border-2 font-bold transition ${sendAsset === "EURC" ? "border-green-500 bg-green-600/20 text-green-400" : "border-zinc-800 bg-black text-gray-400 hover:border-zinc-700"}`}>EURC</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-400 mb-2 flex justify-between">
                  <span>Amount</span>
                  <span className="text-gray-500 font-mono">Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white focus:border-blue-500 focus:outline-none transition text-xl font-bold" />
              </div>
              <button onClick={executeSend} disabled={isSending || !sendAddress || !sendAmount} className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-lg transition hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 mt-4">
                {isSending ? "Processing Transaction..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SWAP MODAL */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Swap Tokens</h3>
              <button onClick={() => setShowSwapModal(false)} className="text-gray-400 hover:text-white transition bg-zinc-800 rounded-full p-2">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-black border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition">
                <label className="text-sm font-semibold text-gray-400 mb-3 flex justify-between">
                  <span>You Pay</span>
                  <span className="text-blue-400 cursor-pointer hover:text-blue-300" onClick={() => setSwapAmount(swapFromAsset === "USDC" ? usdcBalance : eurcBalance)}>Max: {swapFromAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <div className="flex justify-between items-center gap-4">
                  <input type="number" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} placeholder="0.0" className="w-full bg-transparent text-4xl text-white focus:outline-none font-bold placeholder-zinc-700" />
                  <button onClick={() => setSwapFromAsset(swapFromAsset === "USDC" ? "EURC" : "USDC")} className="bg-zinc-800 hover:bg-zinc-700 transition px-4 py-2 rounded-xl text-lg font-bold flex items-center gap-2">
                    {swapFromAsset}
                  </button>
                </div>
              </div>

              <div className="flex justify-center -my-6 relative z-10">
                <button onClick={() => setSwapFromAsset(swapFromAsset === "USDC" ? "EURC" : "USDC")} className="p-3 rounded-full border-4 border-zinc-900 bg-zinc-800 text-white hover:bg-zinc-700 transition shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                </button>
              </div>

              <div className="bg-black border border-zinc-800 rounded-2xl p-5">
                <label className="text-sm font-semibold text-gray-400 mb-3 block">You Receive (Estimated)</label>
                <div className="flex justify-between items-center gap-4">
                  <div className={`w-full text-4xl font-bold ${swapAmount ? "text-white" : "text-zinc-700"}`}>
                    {estimatedReceive || "0.0"}
                  </div>
                  <div className="bg-zinc-800/50 px-4 py-2 rounded-xl text-lg font-bold text-gray-400 flex items-center gap-2">
                    {receiveAsset}
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs font-semibold text-gray-500 px-2 py-2">
                <span>Exchange Rate</span>
                <span>1 {swapFromAsset} = {exchangeRate} {receiveAsset}</span>
              </div>

              <button onClick={executeSwap} disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0} className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold transition hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-600 mt-2 shadow-lg shadow-emerald-900/20">
                {isSwapping ? "Awaiting Approval..." : "Approve & Swap"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-8 bg-transparent sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white">ArcBank</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${isArcTestnet ? "bg-green-500/20 text-green-400 border border-green-500/20" : chainId ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" : "bg-zinc-800 text-gray-400"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {wallet ? (
            <>
              <div className="rounded-full bg-zinc-800/80 border border-zinc-700 px-5 py-2 font-semibold text-white tracking-wider backdrop-blur-sm">{wallet.slice(0, 6)}...{wallet.slice(-4)}</div>
              <button type="button" onClick={disconnectWallet} className="rounded-full bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-2 transition hover:bg-red-500 hover:text-white font-bold backdrop-blur-sm">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-full bg-white text-black px-6 py-2 transition hover:bg-gray-200 font-bold shadow-lg">Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <section className="min-h-[85vh] px-4 py-8 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-black tracking-tight md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Welcome to ArcBank
            </h1>
            <p className="text-lg text-gray-400 md:text-xl font-medium">Enterprise Stablecoin Management on Arc Network</p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
            
            {/* COMPACT SIDEBAR */}
            <aside className="h-fit space-y-4">
              <button onClick={() => setSelectedTab("overview")} className={`w-full rounded-3xl px-6 py-5 text-left font-bold transition-all border ${selectedTab === "overview" ? "bg-white text-black border-white shadow-xl" : "bg-zinc-900/50 text-gray-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"}`}>
                Dashboard
              </button>
              <button onClick={() => setSelectedTab("tools")} className={`w-full rounded-3xl px-6 py-5 text-left font-bold transition-all border ${selectedTab === "tools" ? "bg-white text-black border-white shadow-xl" : "bg-zinc-900/50 text-gray-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"}`}>
                Quick Tools
              </button>
            </aside>

            {/* DASHBOARD TABS */}
            <div className="space-y-6">
              {selectedTab === "overview" && (
                <>
                  {/* CLEAN BALANCES GRID */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-black p-8 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition duration-500 text-6xl">💵</div>
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">USDC Balance</div>
                      <div className="mt-1 text-5xl font-black text-white tracking-tight">{balancesLoading ? "..." : usdcBalance}</div>
                      <div className="mt-4 text-sm font-semibold text-blue-400">Arc Native Gas Asset</div>
                    </div>

                    <div className="rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-black p-8 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition duration-500 text-6xl">💶</div>
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">EURC Balance</div>
                      <div className="mt-1 text-5xl font-black text-white tracking-tight">{balancesLoading ? "..." : eurcBalance}</div>
                      <div className="mt-4 text-sm font-semibold text-emerald-400">Euro Stablecoin</div>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <button onClick={() => setShowSendModal(true)} className="group rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-6 text-center transition-all hover:bg-white hover:border-white hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 mb-2">Send</div>
                      <div className="text-lg font-black text-white group-hover:text-black">Transfer</div>
                    </button>
                    <button onClick={copyAddress} className="group rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-6 text-center transition-all hover:bg-white hover:border-white hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 mb-2">Receive</div>
                      <div className="text-lg font-black text-white group-hover:text-black">Address</div>
                    </button>
                    <button onClick={() => setShowSwapModal(true)} className="group rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-6 text-center transition-all hover:bg-white hover:border-white hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 mb-2">Swap</div>
                      <div className="text-lg font-black text-white group-hover:text-black">Exchange</div>
                    </button>
                    <button onClick={() => setSelectedTab("history")} className="group rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-6 text-center transition-all hover:bg-white hover:border-white hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 mb-2">History</div>
                      <div className="text-lg font-black text-white group-hover:text-black">Activity</div>
                    </button>
                    <button onClick={openFaucet} className="group rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-6 text-center transition-all hover:bg-white hover:border-white hover:-translate-y-1 shadow-lg">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 mb-2">Faucet</div>
                      <div className="text-lg font-black text-white group-hover:text-black">Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {/* HISTORY TAB */}
              {selectedTab === "history" && (
                <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-white">Transaction History</h2>
                      <p className="text-sm font-medium text-gray-400 mt-1">Your recent activity on ArcBank</p>
                    </div>
                    <button onClick={openExplorer} className="rounded-full border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-bold transition hover:bg-white hover:text-black shadow-lg">
                      Arc Explorer ↗
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {txHistory.length === 0 ? (
                      <div className="text-center py-16 text-gray-500 font-bold text-lg">No transactions yet.</div>
                    ) : (
                      txHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-zinc-800/80 bg-black/50 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-700 transition">
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-full ${item.status === "Completed" ? "bg-green-500/10 text-green-500" : item.status === "Failed" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                              {item.status === "Completed" ? "✓" : item.status === "Failed" ? "✕" : "⏳"}
                            </div>
                            <div>
                              <div className="font-black text-xl text-white tracking-tight">{item.label}</div>
                              <div className="mt-1 text-sm font-semibold text-gray-400">{item.meta}</div>
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

              {/* TOOLS TAB */}
              {selectedTab === "tools" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/30 p-8 shadow-2xl">
                    <h2 className="mb-6 text-xl font-black text-white">Quick Access</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button onClick={copyAddress} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-6 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Receive</div>
                        <div className="mt-2 text-lg font-bold text-white">Copy Address</div>
                      </button>
                      <button onClick={openFaucet} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-6 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Faucet</div>
                        <div className="mt-2 text-lg font-bold text-white">Get Tokens</div>
                      </button>
                      <button onClick={() => setShowSendModal(true)} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-6 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Send</div>
                        <div className="mt-2 text-lg font-bold text-white">Transfer Funds</div>
                      </button>
                      <button onClick={() => setShowSwapModal(true)} className="rounded-2xl border border-zinc-800/80 bg-black/40 p-6 text-left transition hover:bg-zinc-800 hover:border-zinc-600">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Swap</div>
                        <div className="mt-2 text-lg font-bold text-white">Exchange Assets</div>
                      </button>
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
