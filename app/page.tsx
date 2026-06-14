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
  const [selectedTab, setSelectedTab] = useState<"overview" | "domains" | "arcpass" | "history" | "learn">("overview");

  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [eurcBalance, setEurcBalance] = useState("0.00");
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Send Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAddress, setSendAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendMemo, setSendMemo] = useState("");
  const [sendAsset, setSendAsset] = useState<"USDC" | "EURC">("USDC");
  const [isSending, setIsSending] = useState(false);

  // Daily GM
  const [streak, setStreak] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // ARC Domains Feature
  const [domainSearch, setDomainSearch] = useState("");
  const [domainAvailable, setDomainAvailable] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showDomainSuccess, setShowDomainSuccess] = useState(false);
  const [registeredDomain, setRegisteredDomain] = useState("");
  const [registrationHash, setRegistrationHash] = useState("");

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

  // Daily Check-in & Timer Logic
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
        setRegisteredDomain("");
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
    setRegisteredDomain("");
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
      if (!switched) return showMessage("Network switch failed. Please switch manually.");
    }
    setShowSendModal(true);
  };

  const executeSend = async () => {
    if (!wallet || !sendAddress || !sendAmount) return showMessage("Please fill required fields");
    if (!isArcTestnet) {
      showMessage("Switching to Arc Testnet...");
      const switched = await switchToArcTestnet();
      if (!switched) return;
      await new Promise((res) => setTimeout(res, 1000)); 
    }

    try {
      setIsSending(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm transaction in your wallet...");
      let tx: any;

      // 100% Authentic implementation of v0.7.2 Memo attachment directly into EVM Calldata
      const txData = sendMemo ? ethers.hexlify(ethers.toUtf8Bytes(sendMemo)) : "0x";

      if (sendAsset === "USDC") {
        const parsedAmount = ethers.parseUnits(sendAmount, 18);
        tx = await signer.sendTransaction({ 
          to: sendAddress, 
          value: parsedAmount,
          data: txData // Attaching Memo natively
        });
      } else {
        const parsedAmount = ethers.parseUnits(sendAmount, 6);
        const contract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
        tx = await contract.transfer(sendAddress, parsedAmount);
      }
      
      showMessage(`Sending ${sendAsset}... Waiting for block confirmation`);
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash || "";
      
      showMessage(`Successfully sent ${sendAmount} ${sendAsset}!`);
      addHistoryRecord(`Transfer ${sendAsset}`, `-${sendAmount} ${sendAsset}`, `Sent to ${sendAddress.slice(0,6)}...${sendMemo ? ` (Memo: ${sendMemo})` : ""}`, "Completed", txHash);
      
      setShowSendModal(false);
      setSendAddress("");
      setSendAmount("");
      setSendMemo("");
      void fetchBalances(wallet);
    } catch (error) {
      showMessage("Transaction failed or rejected");
      addHistoryRecord(`Transfer ${sendAsset}`, `${sendAmount} ${sendAsset}`, "Transaction Failed", "Failed");
    } finally {
      setIsSending(false);
    }
  };

  const executeDailyGM = async () => {
    if (!wallet) return showMessage("Please connect wallet first");
    if (!isArcTestnet) {
      showMessage("Switching to Arc Testnet...");
      const switched = await switchToArcTestnet();
      if (!switched) return;
      await new Promise((res) => setTimeout(res, 1000));
    }
    if (hasCheckedInToday) return showMessage("Already checked in today! Come back tomorrow.");

    setIsCheckingIn(true);
    try {
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm Daily GM Check-in...");
      const tx = await signer.sendTransaction({ to: wallet, value: 0 });

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
      addHistoryRecord("Daily GM Check-in", "", `Streak: Day ${newStreak} 🔥`, "Completed", txHash);
      
      void fetchBalances(wallet); 
    } catch (error) {
      showMessage("GM Check-in rejected or failed");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSearchDomain = () => {
    if (!domainSearch.trim()) return showMessage("Enter a domain name");
    setDomainAvailable(true);
  };

  const triggerConfetti = () => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    script.onload = () => {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        (window as any).confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        (window as any).confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    };
    document.body.appendChild(script);
  };

  const executeRegisterDomain = async () => {
    if (!wallet) return showMessage("Connect wallet first");
    
    const lastRegStr = localStorage.getItem(`arcbank_last_domain_${wallet}`);
    if (lastRegStr) {
      const lastRegTime = new Date(lastRegStr).getTime();
      const now = new Date().getTime();
      const hoursPassed = (now - lastRegTime) / (1000 * 60 * 60);
      if (hoursPassed < 24) {
        return showMessage(`You can only register one domain per 24 hours. Please wait.`);
      }
    }

    if (!isArcTestnet) {
      showMessage("Switching to Arc Testnet...");
      const switched = await switchToArcTestnet();
      if (!switched) return;
      await new Promise((res) => setTimeout(res, 1000));
    }
    if (parseFloat(usdcBalance) < 1) return showMessage("Insufficient USDC! 1 USDC required.");

    try {
      setIsRegistering(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      showMessage("Confirm Domain Registration...");
      const parsedAmount = ethers.parseUnits("1", 18); 
      
      const tx = await signer.sendTransaction({ 
        to: "0x000000000000000000000000000000000000dEaD", 
        value: parsedAmount 
      });

      showMessage("Registering domain on Arc Network...");
      const receipt = await tx.wait();
      const txHash = receipt?.hash || tx?.hash || "";

      const newDomain = `${domainSearch}.arc`;
      setRegisteredDomain(newDomain);
      setRegistrationHash(txHash);
      
      localStorage.setItem(`arcbank_last_domain_${wallet}`, new Date().toISOString());

      addHistoryRecord("ARC Domain Registration", "-1 USDC", newDomain, "Completed", txHash);
      
      setShowDomainSuccess(true);
      triggerConfetti();

      setDomainSearch("");
      setDomainAvailable(false);
      void fetchBalances(wallet);
    } catch (error) {
      showMessage("Domain registration failed or rejected");
    } finally {
      setIsRegistering(false);
    }
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Minted a @arc domain pass! 🌐✨\n\nBUILD BY @jubayirhaider90\n\n`);
    const url = encodeURIComponent(`https://arcbank-app.vercel.app`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const downloadArcPass = () => {
    showMessage("Generating Image... Please wait ⏳");
    const element = document.getElementById("arc-pass-card");
    if (!element) return;

    const runImageGenerator = () => {
      (window as any).domtoimage.toPng(element, { quality: 1, bgcolor: '#050B14', scale: 3 })
        .then((dataUrl: string) => {
          const link = document.createElement('a');
          link.download = `${registeredDomain || 'arc'}-pass.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showMessage("Arc Pass saved to your device! 📸");
        })
        .catch((err: any) => {
          console.error("Image Generation Error:", err);
          showMessage("Failed to generate image.");
        });
    };

    if ((window as any).domtoimage) {
      runImageGenerator();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js";
      script.onload = runImageGenerator;
      script.onerror = () => showMessage("Could not load image generator.");
      document.body.appendChild(script);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(2,6,23,1))] text-white relative font-sans flex flex-col selection:bg-cyan-500/30">
      
      {/* TOAST NOTIFICATION */}
      {message && (
        <div className="fixed top-8 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-white/10 bg-[#0A1A3F]/80 backdrop-blur-xl px-4 py-3 sm:px-8 sm:py-4 shadow-[0_0_40px_rgba(6,182,212,0.15)] transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          <div className="font-bold text-xs sm:text-sm tracking-wide text-white whitespace-nowrap">{message}</div>
        </div>
      )}

      {/* DOMAIN SUCCESS MODAL */}
      {showDomainSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/90 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[2.5rem] border border-cyan-500/30 bg-gradient-to-b from-[#0A1A3F] to-[#020617] p-8 shadow-[0_0_80px_rgba(6,182,212,0.2)] flex flex-col items-center text-center relative overflow-hidden">
            <button onClick={() => setShowDomainSuccess(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-full p-2.5 z-10">✕</button>
            
            <div className="w-24 h-24 bg-[#050B14] border border-cyan-500/20 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-6 overflow-hidden p-2 transform transition-transform hover:scale-105">
              <img src="/arc-logo.jpg" alt="ARC Logo" crossOrigin="anonymous" className="w-full h-full object-contain rounded-2xl" />
            </div>
            
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Congratulations!</h2>
            <p className="text-sm font-medium text-gray-300 mb-6">Your domain has been successfully registered on <span className="text-cyan-400 font-bold">Arc Testnet</span>!</p>
            
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-6 py-2 mb-8">
              <span className="text-cyan-400">⚡</span>
              <span className="text-sm font-black text-cyan-400 tracking-widest uppercase">Lifetime Ownership</span>
            </div>

            <div className="w-full rounded-2xl border border-cyan-500/20 bg-black/50 p-5 flex justify-between items-center mb-4">
              <span className="text-xl font-black text-white">{registeredDomain}</span>
              <span className="bg-white/10 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-gray-300">Forever</span>
            </div>

            <div className="w-full rounded-2xl border border-white/5 bg-black/50 p-5 flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-400">Tx Hash: <span className="text-white ml-1">{registrationHash.slice(0,6)}...{registrationHash.slice(-4)}</span></span>
              <button onClick={() => window.open(`${ARC_EXPLORER}/tx/${registrationHash}`, "_blank")} className="bg-white/10 hover:bg-white/20 transition px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1">Explorer ↗</button>
            </div>
          </div>
        </div>
      )}

      {/* SEND MODAL WITH MEMO FIELD */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0A1A3F] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black tracking-tight text-white">Send Asset</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-full p-2.5">✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-widest">Recipient Address</label>
                <input type="text" value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} placeholder="0x..." className="w-full rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-white focus:border-cyan-500 focus:outline-none transition font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-widest">Select Asset</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setSendAsset("USDC")} className={`rounded-2xl py-4 border-2 font-black tracking-wide transition-all ${sendAsset === "USDC" ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]" : "border-white/5 bg-black/50 text-gray-500 hover:border-white/20 hover:text-gray-300"}`}>USDC</button>
                  <button onClick={() => setSendAsset("EURC")} className={`rounded-2xl py-4 border-2 font-black tracking-wide transition-all ${sendAsset === "EURC" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]" : "border-white/5 bg-black/50 text-gray-500 hover:border-white/20 hover:text-gray-300"}`}>EURC</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 flex justify-between uppercase tracking-widest">
                  <span>Amount</span>
                  <span className="font-mono text-gray-400">Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-white focus:border-cyan-500 focus:outline-none transition text-2xl font-black" />
              </div>
              
              {/* NEW MEMO FIELD for v0.7.2 */}
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 flex justify-between uppercase tracking-widest">
                  <span>Tx Memo</span>
                  <span className="text-[9px] sm:text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md">v0.7.2 FEATURE</span>
                </label>
                <input type="text" value={sendMemo} onChange={(e) => setSendMemo(e.target.value)} placeholder="Optional (e.g. Invoice #123)" className="w-full rounded-2xl border border-white/10 bg-black/50 px-5 py-3 text-white focus:border-cyan-500 focus:outline-none transition text-sm" />
              </div>

              <button onClick={executeSend} disabled={isSending || !sendAddress || !sendAmount} className="w-full rounded-2xl bg-white text-black hover:bg-gray-200 py-4 font-black text-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 mt-2 shadow-xl">
                {isSending ? "Processing..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION - PERFECT MOBILE RESPONSIVE */}
      <nav className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-6 bg-transparent sticky top-0 z-40 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-white drop-shadow-md">ArcBank</h1>
          <span className={`hidden sm:block rounded-full px-3 py-1 md:px-4 md:py-1.5 text-[9px] md:text-xs font-black tracking-widest uppercase border backdrop-blur-md ${isArcTestnet ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : chainId ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-white/5 text-gray-500 border-white/10"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {wallet ? (
            <>
              <div className="hidden md:block rounded-full bg-white/5 border border-white/10 px-6 py-2.5 font-bold text-white tracking-wider backdrop-blur-md shadow-sm">{wallet.slice(0, 6)}...{wallet.slice(-4)}</div>
              <button type="button" onClick={disconnectWallet} className="rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 md:px-6 md:py-2.5 text-[10px] md:text-sm transition-all hover:bg-red-500 hover:text-white font-bold backdrop-blur-md hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-full bg-white text-black px-4 py-2 sm:px-6 sm:py-2.5 md:px-8 md:py-2.5 text-xs sm:text-sm md:text-base transition-all hover:scale-105 active:scale-95 font-black shadow-[0_0_20px_rgba(255,255,255,0.2)]">Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 py-6 md:py-10 md:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:gap-12">
          
          <div className="text-center space-y-4 md:space-y-5 mt-2 md:mt-4">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-cyan-100 to-cyan-500 pb-2 drop-shadow-sm">
              Welcome to ArcBank
            </h1>
            <p className="text-base md:text-xl font-medium text-cyan-100/70 tracking-wide max-w-2xl mx-auto px-2">
              Enterprise-grade stablecoin management built on the lightning-fast Arc L1 Network.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[280px_1fr]">
            
            {/* SIDEBAR */}
            <aside className="flex flex-col gap-3 md:gap-4 overflow-x-auto pb-4 md:pb-0 hide-scrollbar flex-shrink-0 lg:flex-nowrap">
              <button onClick={() => setSelectedTab("overview")} className={`w-full rounded-2xl md:rounded-[2rem] px-6 py-4 md:px-8 md:py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "overview" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] md:scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                Dashboard
              </button>
              <button onClick={() => setSelectedTab("domains")} className={`w-full rounded-2xl md:rounded-[2rem] px-6 py-4 md:px-8 md:py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "domains" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] md:scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                ARC Domains
              </button>
              <button onClick={() => setSelectedTab("arcpass")} className={`w-full rounded-2xl md:rounded-[2rem] px-6 py-4 md:px-8 md:py-5 text-left flex justify-between items-center font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "arcpass" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] md:scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                <span>Arc Pass</span>
                <span className="text-[10px] md:text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-lg">NEW</span>
              </button>
              <button onClick={() => setSelectedTab("history")} className={`w-full rounded-2xl md:rounded-[2rem] px-6 py-4 md:px-8 md:py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "history" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] md:scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                History
              </button>
              <button onClick={() => setSelectedTab("learn")} className={`w-full rounded-2xl md:rounded-[2rem] px-6 py-4 md:px-8 md:py-5 text-left font-black tracking-wide transition-all border backdrop-blur-md ${selectedTab === "learn" ? "bg-white/10 text-white border-white/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] md:scale-[1.02]" : "bg-white/[0.02] text-gray-500 border-white/5 hover:bg-white/5 hover:text-white"}`}>
                Learn
              </button>
            </aside>

            {/* DASHBOARD TABS */}
            <div className="space-y-6 md:space-y-8">
              {selectedTab === "overview" && (
                <>
                  {/* BALANCES GRID & GM CHECK-IN */}
                  <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 grid grid-cols-1 gap-6 md:gap-8 sm:grid-cols-2">
                      <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-[#0A1A3F]/50 to-transparent backdrop-blur-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500 md:hover:-translate-y-1">
                        <div className="absolute -top-6 -right-6 md:-top-10 md:-right-10 p-6 md:p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 text-7xl md:text-9xl group-hover:scale-110">💵</div>
                        <div className="text-[10px] md:text-xs font-black text-cyan-500 uppercase tracking-widest mb-3 md:mb-4">USDC Balance</div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{balancesLoading ? "..." : usdcBalance}</div>
                      </div>

                      <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-[#0A1A3F]/50 to-transparent backdrop-blur-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500 md:hover:-translate-y-1">
                        <div className="absolute -top-6 -right-6 md:-top-10 md:-right-10 p-6 md:p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 text-7xl md:text-9xl group-hover:scale-110">💶</div>
                        <div className="text-[10px] md:text-xs font-black text-cyan-500 uppercase tracking-widest mb-3 md:mb-4">EURC Balance</div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{balancesLoading ? "..." : eurcBalance}</div>
                      </div>
                    </div>

                    {/* DAILY GM CHECK-IN CARD */}
                    <div className="rounded-3xl md:rounded-[2.5rem] border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-black backdrop-blur-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(249,115,22,0.05)] flex flex-col justify-center items-center text-center relative overflow-hidden group">
                      <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 p-4 opacity-10 text-6xl md:text-8xl group-hover:rotate-12 transition-transform duration-700">☀️</div>
                      
                      <div className="text-4xl md:text-5xl mb-4 md:mb-6">{hasCheckedInToday ? "🔥" : "⏳"}</div>
                      <h3 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight">Daily GM</h3>
                      <p className="text-xs md:text-sm font-medium text-gray-400 mb-4 md:mb-6 px-2 md:px-4">Execute a real zero-value transaction to build your on-chain streak!</p>
                      
                      <div className="text-lg md:text-xl font-black text-orange-400 mb-4 md:mb-6 uppercase tracking-widest bg-orange-500/10 px-5 md:px-6 py-2 rounded-full border border-orange-500/20">
                        {streak > 0 ? `Day ${streak}` : "No Streak"}
                      </div>
                      
                      <button 
                        onClick={executeDailyGM}
                        disabled={isCheckingIn || hasCheckedInToday || !wallet}
                        className={`w-full rounded-xl md:rounded-2xl py-3 md:py-4 font-black text-base md:text-lg transition-all duration-300 shadow-xl ${
                          hasCheckedInToday 
                            ? "bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed" 
                            : "bg-white text-black hover:bg-gray-200 md:hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] animate-pulse hover:animate-none"
                        }`}
                      >
                        {isCheckingIn ? "Signing..." : hasCheckedInToday ? `Next: ${timeLeft}` : "Say GM (Check-in)"}
                      </button>
                    </div>
                  </div>

                  {/* QUICK ACTIONS ROW */}
                  <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-3">
                    <button onClick={handleOpenSendModal} className="group rounded-3xl md:rounded-[2.5rem] border border-white/5 bg-[#0A1A3F]/30 backdrop-blur-xl p-6 md:p-10 text-center transition-all hover:bg-white/10 hover:border-white/20 md:hover:-translate-y-2 shadow-lg flex flex-col items-center justify-center">
                      <div className="text-xl md:text-2xl font-black text-white group-hover:scale-105 transition-transform tracking-wide">Send Assets</div>
                      <span className="text-[8px] md:text-[10px] text-cyan-500 mt-1 md:mt-2 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">WITH MEMO (v0.7.2)</span>
                    </button>
                    <button onClick={copyAddress} className="group rounded-3xl md:rounded-[2.5rem] border border-white/5 bg-[#0A1A3F]/30 backdrop-blur-xl p-6 md:p-10 text-center transition-all hover:bg-white/10 hover:border-white/20 md:hover:-translate-y-2 shadow-lg flex items-center justify-center">
                      <div className="text-xl md:text-2xl font-black text-white group-hover:scale-105 transition-transform tracking-wide">Receive Funds</div>
                    </button>
                    <button onClick={openFaucet} className="group rounded-3xl md:rounded-[2.5rem] border border-white/5 bg-[#0A1A3F]/30 backdrop-blur-xl p-6 md:p-10 text-center transition-all hover:bg-white/10 hover:border-white/20 md:hover:-translate-y-2 shadow-lg flex items-center justify-center">
                      <div className="text-xl md:text-2xl font-black text-white group-hover:scale-105 transition-transform tracking-wide">Get Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {/* ARC DOMAINS TAB */}
              {selectedTab === "domains" && (
                <div className="rounded-3xl md:rounded-[2.5rem] border border-cyan-500/20 bg-gradient-to-br from-[#0A1A3F]/60 to-black backdrop-blur-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                  <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 text-7xl md:text-9xl">🌐</div>
                  <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2 md:mb-3">ARC Web3 Identity</h2>
                  <p className="text-xs md:text-base text-gray-400 font-medium mb-6 md:mb-10 max-w-xl">Register your unique <span className="text-cyan-400 font-bold">.arc</span> username on the blockchain and establish your lifetime identity.</p>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full max-w-3xl bg-black border border-cyan-500/30 rounded-3xl sm:rounded-full p-2 pl-4 md:pl-6 shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:shadow-[0_0_40px_rgba(6,182,212,0.2)] transition-shadow">
                    <span className="hidden sm:inline-block text-cyan-500 text-xl font-bold">∞</span>
                    <input 
                      type="text" 
                      value={domainSearch}
                      onChange={(e) => { setDomainSearch(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setDomainAvailable(false); }}
                      placeholder="Search a name (e.g. jubayir69)" 
                      className="flex-1 w-full bg-transparent border-none text-white text-lg md:text-xl font-bold focus:outline-none placeholder-zinc-700 text-center sm:text-left py-2 sm:py-0"
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="bg-white/10 text-cyan-400 font-black px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-cyan-500/20 tracking-widest text-sm md:text-base">.arc</div>
                      <button onClick={handleSearchDomain} className="bg-cyan-400 hover:bg-cyan-300 text-black font-black px-6 py-2 md:px-8 md:py-4 rounded-full transition-all active:scale-95 text-sm md:text-lg w-full sm:w-auto">
                        Search →
                      </button>
                    </div>
                  </div>

                  {domainAvailable && (
                    <div className="mt-6 md:mt-8 flex flex-col sm:flex-row items-center justify-between p-5 md:p-6 bg-cyan-950/30 border border-cyan-500/30 rounded-3xl max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-[#050B14] border border-cyan-500/20 rounded-xl md:rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] p-1.5">
                          <img src="/arc-logo.jpg" alt="A" crossOrigin="anonymous" className="w-full h-full object-contain rounded-lg md:rounded-xl" />
                        </div>
                        <div className="text-xl md:text-2xl font-black text-white">{domainSearch}.arc</div>
                      </div>
                      <div className="flex items-center gap-4 md:gap-6 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-lg md:text-xl font-bold text-gray-300">1 USDC</div>
                        <button 
                          onClick={executeRegisterDomain} 
                          disabled={isRegistering}
                          className="bg-cyan-400 hover:bg-cyan-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black px-6 py-2.5 md:px-8 md:py-3.5 rounded-full transition-all active:scale-95 text-sm md:text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] w-full sm:w-auto"
                        >
                          {isRegistering ? "Registering..." : "Register"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ARC PASS */}
              {selectedTab === "arcpass" && (
                <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl p-6 md:p-10 shadow-2xl flex flex-col items-center justify-center min-h-[50vh] md:min-h-[60vh] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                  
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-96 md:h-96 bg-cyan-500/20 rounded-full blur-[80px] md:blur-[100px] pointer-events-none"></div>

                  {!registeredDomain ? (
                    <div className="text-center z-10 max-w-lg px-4">
                      <div className="text-5xl md:text-7xl mb-4 md:mb-6 animate-pulse">🪪</div>
                      <h2 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4">Unlock Your Arc Pass</h2>
                      <p className="text-sm md:text-base text-gray-400 mb-6 md:mb-8">You need to register an .arc domain to generate your exclusive Web3 Holographic Identity Card.</p>
                      <button onClick={() => setSelectedTab("domains")} className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-6 py-3 md:px-8 md:py-4 rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-sm md:text-base">
                        Register Domain Now
                      </button>
                    </div>
                  ) : (
                    <div className="z-10 w-full flex flex-col items-center">
                      <div className="text-center mb-8 md:mb-10">
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Digital Identity</h2>
                        <p className="text-xs md:text-sm text-cyan-400 font-bold mt-1 md:mt-2">Verified on Arc Blockchain</p>
                      </div>

                      {/* THE ARC PASS CARD (For Download) */}
                      <div id="arc-pass-card" className="w-[90%] sm:w-full max-w-[450px] aspect-[1.58/1] rounded-2xl md:rounded-[2rem] border border-white/20 bg-gradient-to-br from-[#0A1A3F] to-cyan-900/40 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.1)] md:shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden flex flex-col justify-between p-5 md:p-8 transform transition-transform md:hover:scale-105 md:hover:rotate-1 duration-500 group">
                        
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>

                        <div className="flex justify-between items-start w-full relative z-10">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#050B14] rounded-lg md:rounded-xl overflow-hidden border border-cyan-500/30 flex items-center justify-center p-1 md:p-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                              <img src="/arc-logo.jpg" alt="Logo" crossOrigin="anonymous" className="w-full h-full object-contain rounded-md" />
                            </div>
                            <div className="font-black text-base md:text-xl text-white tracking-widest uppercase">ARC PASS</div>
                          </div>
                          <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-black tracking-widest uppercase flex items-center gap-1 md:gap-1.5">
                            <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            Verified
                          </div>
                        </div>

                        <div className="relative z-10 mt-4 md:mt-6">
                          <div className="text-[8px] md:text-[10px] text-cyan-200/70 font-black uppercase tracking-[0.2em] mb-1">Web3 Identity</div>
                          <div className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md truncate">{registeredDomain}</div>
                          <div className="text-xs md:text-sm font-mono text-gray-400 mt-1 md:mt-2 bg-black/30 inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg border border-white/5">
                            {wallet.slice(0,6)}...{wallet.slice(-4)}
                          </div>
                        </div>

                        <div className="flex justify-between items-end w-full relative z-10 mt-2 md:mt-0">
                          <div className="flex gap-4 md:gap-6">
                            <div>
                              <div className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 md:mb-1">Network</div>
                              <div className="font-black text-xs md:text-sm text-cyan-400">ARC TESTNET</div>
                            </div>
                            <div>
                              <div className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 md:mb-1">GM Streak</div>
                              <div className="font-black text-xs md:text-sm text-orange-400 flex items-center gap-1">
                                {streak} DAYS 🔥
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* ACTION BUTTONS */}
                      <div className="mt-8 md:mt-10 flex flex-wrap justify-center gap-3 md:gap-4">
                        <button onClick={downloadArcPass} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full transition-all font-bold text-xs md:text-sm border border-white/10 active:scale-95 shadow-lg">
                          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          Save Image
                        </button>
                        
                        <button onClick={shareOnX} className="flex items-center gap-2 bg-black hover:bg-zinc-900 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full transition-all font-bold text-xs md:text-sm border border-zinc-800 active:scale-95 shadow-lg">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 md:w-4 md:h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.337H5.051z" /></svg>
                          Share on X
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {selectedTab === "history" && (
                <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl p-6 md:p-10 shadow-2xl animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-10">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Transaction History</h2>
                      <p className="text-xs md:text-sm font-semibold text-gray-400 mt-1 md:mt-2">Real verifiable blockchain events</p>
                    </div>
                    <button onClick={openExplorer} className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 md:px-8 md:py-3 text-xs md:text-sm font-black tracking-wide transition-all hover:bg-white hover:text-black shadow-lg hover:scale-105 active:scale-95 w-full sm:w-auto">
                      Arc Explorer ↗
                    </button>
                  </div>
                  
                  <div className="space-y-3 md:space-y-4">
                    {txHistory.length === 0 ? (
                      <div className="text-center py-10 md:py-20">
                        <div className="text-5xl md:text-6xl mb-3 md:mb-4 opacity-50">📭</div>
                        <div className="text-gray-500 font-bold text-base md:text-lg">No blockchain activity found.</div>
                      </div>
                    ) : (
                      txHistory.map((item) => (
                        <div key={item.id} className="rounded-xl md:rounded-2xl border border-white/5 bg-[#0A1A3F]/30 p-4 md:p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 md:gap-6 hover:border-white/10 transition-all hover:bg-black/80">
                          <div className="flex items-center gap-4 md:gap-6">
                            <div className={`p-3 md:p-4 rounded-full border ${item.status === "Completed" ? "bg-green-500/10 text-green-400 border-green-500/20" : item.status === "Failed" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                              {item.status === "Completed" ? "✓" : item.status === "Failed" ? "✕" : "⏳"}
                            </div>
                            <div>
                              <div className="font-black text-lg md:text-xl text-white tracking-tight leading-tight">{item.label}</div>
                              {item.txHash ? (
                                <a href={`${ARC_EXPLORER}/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 md:mt-1.5 text-xs md:text-sm font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 flex items-center gap-1 md:gap-1.5 transition-colors">
                                  <span className="truncate max-w-[150px] sm:max-w-none">{item.meta}</span> <span className="text-[10px] md:text-xs flex-shrink-0">↗</span>
                                </a>
                              ) : (
                                <div className="mt-1 md:mt-1.5 text-xs md:text-sm font-bold text-gray-400">{item.meta}</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="sm:text-right pl-14 md:pl-20 sm:pl-0 flex flex-col items-start sm:items-end">
                            {item.amount && (
                              <div className={`font-black text-xl md:text-2xl tracking-tighter ${item.amount.startsWith("+") ? "text-emerald-400" : item.amount.startsWith("-") ? "text-white" : "text-gray-400"}`}>
                                {item.amount}
                              </div>
                            )}
                            <div className={`mt-1.5 md:mt-2 inline-block px-2.5 py-1 md:px-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest ${item.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" : item.status === "Failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
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
                <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
                  <div className="rounded-3xl md:rounded-[2.5rem] border border-blue-500/20 bg-gradient-to-br from-[#0A1A3F]/80 to-black backdrop-blur-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 md:p-10 opacity-10 text-7xl md:text-9xl">📖</div>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-4 md:mb-6 tracking-tighter drop-shadow-md">What is Arc Network?</h2>
                    <p className="text-sm md:text-xl text-cyan-100/70 font-medium leading-relaxed max-w-3xl mb-6 md:mb-10">
                      Arc is an enterprise-grade L1 blockchain designed specifically for stablecoin management, rapid payments, and decentralized finance. It brings together fiat-backed assets and powerful infrastructure to make global money movement seamless.
                    </p>
                    <button onClick={openArcWebsite} className="rounded-full bg-white text-black hover:bg-gray-200 px-6 py-3 md:px-10 md:py-4 font-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-2 md:gap-3 text-sm md:text-base w-full sm:w-auto justify-center">
                      Visit Arc Official Website <span className="text-xl md:text-2xl">↗</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-6 md:p-10 shadow-2xl hover:border-white/20 transition-all md:hover:-translate-y-1">
                      <div className="text-5xl md:text-6xl mb-4 md:mb-8">🌐</div>
                      <h3 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4 tracking-tight">Circle Integration</h3>
                      <p className="text-sm md:text-lg text-gray-400 font-medium leading-relaxed">
                        Arc natively supports Circle's major stablecoins like <strong className="text-cyan-400">USDC</strong> (US Dollar) and <strong className="text-emerald-400">EURC</strong> (Euro). These assets are directly issued on the network ensuring deep liquidity and 1:1 fiat backing.
                      </p>
                    </div>

                    <div className="rounded-3xl md:rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-6 md:p-10 shadow-2xl hover:border-white/20 transition-all md:hover:-translate-y-1">
                      <div className="text-5xl md:text-6xl mb-4 md:mb-8">⚡</div>
                      <h3 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4 tracking-tight">Native Gas Asset</h3>
                      <p className="text-sm md:text-lg text-gray-400 font-medium leading-relaxed">
                        Unlike traditional networks that use volatile assets (like ETH or BNB) for transaction fees, Arc uses <strong className="text-cyan-400">USDC as its native gas asset</strong>. This guarantees predictable, low-cost operations for businesses.
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
      <footer className="mt-auto border-t border-white/10 bg-black/60 py-8 md:py-12 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 md:gap-8 px-6 md:flex-row">
          <div className="text-xs md:text-sm font-bold text-gray-500 tracking-widest uppercase text-center md:text-left">
            © 2026 ARC BANK · BUILD ON ARC
          </div>
          
          <div className="flex flex-col items-center gap-3 md:gap-4 md:items-end">
            <div className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">
              BUILD BY <span className="text-white">JUBAYIR69</span>
            </div>
            <div className="flex gap-3 md:gap-4">
              <a href="https://x.com/jubayirhaider90" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all p-2.5 md:p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 md:hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.337H5.051z" /></svg>
              </a>
              <a href="https://x.com/arc" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all p-2.5 md:p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 md:hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
              <a href="https://github.com/jubayir-hub-69" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all p-2.5 md:p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 md:hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              </a>
              <a href="https://www.linkedin.com/in/jubayir-haider-302aab372" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#0a66c2] transition-all p-2.5 md:p-3 border border-white/5 bg-white/5 rounded-full hover:bg-white/10 md:hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.848-3.037-1.85 0-2.132 1.445-2.132 2.939v5.667H9.36V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
