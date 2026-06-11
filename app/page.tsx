"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4cef52";
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_FAUCET = "https://faucet.circle.com";

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

// ABI তে transfer ফাংশন যুক্ত করা হয়েছে
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

type ActivityItem = {
  id: number;
  label: string;
  amount: string;
  meta: string;
  status: "Completed" | "Pending";
};

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<"overview" | "activity" | "tools">("overview");

  const [usdcBalance, setUsdcBalance] = useState("0.00");
  const [eurcBalance, setEurcBalance] = useState("0.00");
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Send Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAddress, setSendAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<"USDC" | "EURC">("USDC");
  const [isSending, setIsSending] = useState(false);

  const isArcTestnet = chainId === ARC_CHAIN_ID;

  const activityFeed: ActivityItem[] = useMemo(
    () => [
      { id: 1, label: "USDC faucet received", amount: "+20.00 USDC", meta: "Arc Testnet • 2 minutes ago", status: "Completed" },
      { id: 2, label: "Wallet connected", amount: "Connected", meta: "MetaMask / Rabby • today", status: "Completed" },
      { id: 3, label: "EURC balance synced", amount: "—", meta: "Awaiting balance module", status: "Pending" },
      { id: 4, label: "Swap module queued", amount: "USDC ↔ EURC", meta: "Next build step", status: "Pending" },
    ],
    []
  );

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
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
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const eurcContract = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, provider);

        const [usdcRaw, eurcRaw] = await Promise.all([
          usdcContract.balanceOf(address),
          eurcContract.balanceOf(address),
        ]);

        setUsdcBalance(Number(ethers.formatUnits(usdcRaw, 6)).toFixed(2));
        setEurcBalance(Number(ethers.formatUnits(eurcRaw, 6)).toFixed(2));
      } catch {
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

      if (accounts?.length) setWallet(accounts[0]);
      else setWallet("");

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
      else showMessage("Wallet Connected");
      
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
    try {
      if (!wallet) {
        showMessage("Connect wallet first");
        return;
      }
      await navigator.clipboard.writeText(wallet);
      showMessage("Address Copied");
    } catch {
      showMessage("Copy Failed");
    }
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
              nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
            }],
          });
        }
      }
      await syncNetwork();
    } catch {}
  };

  // SEND FUNCTION LOGIC
  const executeSend = async () => {
    if (!wallet || !sendAddress || !sendAmount) {
      showMessage("Please fill all fields");
      return;
    }

    try {
      setIsSending(true);
      const ethereum = getEthereum();
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const tokenAddress = sendAsset === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const parsedAmount = ethers.parseUnits(sendAmount, 6);
      
      showMessage("Please confirm transaction in your wallet...");
      const tx = await contract.transfer(sendAddress, parsedAmount);
      
      showMessage(`Sending ${sendAmount} ${sendAsset}...`);
      await tx.wait();
      
      showMessage(`Successfully sent ${sendAmount} ${sendAsset}!`);
      setShowSendModal(false);
      setSendAddress("");
      setSendAmount("");
      void fetchBalances(wallet);
    } catch (error: any) {
      console.error(error);
      showMessage("Transaction failed or rejected");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {message && (
        <div className="fixed top-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-blue-500 bg-blue-700 px-6 py-3 shadow-lg">
          {message}
        </div>
      )}

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Send Stablecoin</h3>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Recipient Address</label>
                <input 
                  type="text" 
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value)}
                  placeholder="0x..." 
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Select Asset</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setSendAsset("USDC")}
                    className={`rounded-xl py-3 border font-semibold ${sendAsset === "USDC" ? "border-blue-500 bg-blue-600/20 text-blue-400" : "border-zinc-800 bg-black text-gray-400"}`}
                  >
                    USDC
                  </button>
                  <button 
                    onClick={() => setSendAsset("EURC")}
                    className={`rounded-xl py-3 border font-semibold ${sendAsset === "EURC" ? "border-green-500 bg-green-600/20 text-green-400" : "border-zinc-800 bg-black text-gray-400"}`}
                  >
                    EURC
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 flex justify-between">
                  <span>Amount</span>
                  <span>Bal: {sendAsset === "USDC" ? usdcBalance : eurcBalance}</span>
                </label>
                <input 
                  type="number" 
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00" 
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button 
                onClick={executeSend}
                disabled={isSending || !sendAddress || !sendAmount}
                className="w-full rounded-xl bg-blue-600 py-4 font-bold transition hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 mt-4"
              >
                {isSending ? "Processing..." : `Send ${sendAsset}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex items-center justify-between border-b border-gray-800 px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">ArcBank</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isArcTestnet ? "bg-green-500 text-black" : chainId ? "bg-amber-500 text-black" : "bg-zinc-700 text-white"}`}>
            {isArcTestnet ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "Not Checked"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {wallet ? (
            <>
              <div className="rounded-xl bg-green-500 px-4 py-2 font-semibold text-black">
                {wallet.slice(0, 6)}...{wallet.slice(-4)}
              </div>
              <button type="button" onClick={disconnectWallet} className="rounded-xl bg-red-600 px-5 py-2 transition hover:bg-red-700">Disconnect</button>
            </>
          ) : (
            <button type="button" onClick={connectWallet} className="rounded-xl bg-blue-600 px-5 py-2 transition hover:bg-blue-700">Connect Wallet</button>
          )}
        </div>
      </nav>

      <section className="min-h-[85vh] px-4 py-8 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl">ArcBank Dashboard</h1>
            <p className="mt-4 text-base text-gray-400 md:text-xl">Stablecoin Banking on Arc Network</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-300">
              <button type="button" onClick={syncNetwork} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 transition hover:bg-zinc-800">RPC: {ARC_RPC}</button>
              <button type="button" onClick={openExplorer} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 transition hover:bg-zinc-800">Explorer: {ARC_EXPLORER}</button>

              {wallet && !isArcTestnet && (
                <button type="button" onClick={switchToArcTestnet} className="rounded-full border border-emerald-600 bg-emerald-500 px-3 py-1 font-semibold text-black transition hover:bg-emerald-400">
                  Switch to Arc Testnet
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
              <div className="mb-5">
                <div className="text-sm text-gray-400">Mode</div>
                <div className="text-xl font-bold">Banking Console</div>
              </div>

              <div className="space-y-2">
                {["overview", "activity", "tools"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedTab(tab as any)}
                    className={`w-full rounded-xl px-4 py-3 text-left capitalize transition ${selectedTab === tab ? "bg-zinc-800 text-white" : "bg-black text-gray-300 hover:bg-zinc-800"}`}
                  >
                    {tab === "activity" ? "Live Activity" : tab}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-zinc-800 bg-black p-4">
                <div className="text-sm text-gray-400">Network Status</div>
                <div className="mt-1 text-lg font-semibold">{wallet ? (isArcTestnet ? "Arc Testnet" : "Wrong Network") : "No Wallet"}</div>
              </div>
            </aside>

            <div className="space-y-6">
              {selectedTab === "overview" && (
                <>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                      <h2 className="mb-5 text-xl font-bold">Account Overview</h2>
                      <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">Wallet Status</div>
                          <div className="mt-1 text-lg font-semibold">{wallet ? "Connected" : "Not Connected"}</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">Wallet Address</div>
                          <div className="mt-1 break-all text-sm">{wallet || "No wallet connected"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                      <h2 className="mb-5 text-xl font-bold">Stablecoin Balances</h2>
                      <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">USDC Balance</div>
                          <div className="mt-2 text-3xl font-bold">{balancesLoading ? "Loading..." : usdcBalance}</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">EURC Balance</div>
                          <div className="mt-2 text-3xl font-bold">{balancesLoading ? "Loading..." : eurcBalance}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <button type="button" onClick={() => setShowSendModal(true)} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600">
                      <div className="text-sm text-gray-400">Send</div>
                      <div className="mt-1 text-lg font-semibold">USDC / EURC</div>
                    </button>
                    <button type="button" onClick={copyAddress} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600">
                      <div className="text-sm text-gray-400">Receive</div>
                      <div className="mt-1 text-lg font-semibold">Copy Address</div>
                    </button>
                    <button type="button" onClick={() => showMessage("Swap will be added next")} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600">
                      <div className="text-sm text-gray-400">Swap</div>
                      <div className="mt-1 text-lg font-semibold">USDC ↔ EURC</div>
                    </button>
                    <button type="button" onClick={() => setSelectedTab("activity")} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600">
                      <div className="text-sm text-gray-400">History</div>
                      <div className="mt-1 text-lg font-semibold">Transactions</div>
                    </button>
                    <button type="button" onClick={openFaucet} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600">
                      <div className="text-sm text-gray-400">Faucet</div>
                      <div className="mt-1 text-lg font-semibold">Get Tokens</div>
                    </button>
                  </div>
                </>
              )}

              {selectedTab === "activity" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">Live Activity Feed</h2>
                    <button type="button" onClick={openExplorer} className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm transition hover:bg-zinc-800">Open Explorer</button>
                  </div>
                  <div className="mt-6 space-y-3">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="rounded-xl border border-zinc-800 bg-black p-4 flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{item.label}</div>
                          <div className="mt-1 text-sm text-gray-400">{item.meta}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{item.amount}</div>
                          <div className={`mt-1 text-xs ${item.status === "Completed" ? "text-green-400" : "text-amber-400"}`}>{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTab === "tools" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                    <h2 className="text-xl font-bold">Quick Tools</h2>
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button onClick={copyAddress} className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800">
                        <div className="text-sm text-gray-400">Receive</div>
                        <div className="mt-1 text-lg font-semibold">Copy Wallet Address</div>
                      </button>
                      <button onClick={openFaucet} className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800">
                        <div className="text-sm text-gray-400">Faucet</div>
                        <div className="mt-1 text-lg font-semibold">Get Test Tokens</div>
                      </button>
                      <button onClick={() => setShowSendModal(true)} className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800">
                        <div className="text-sm text-gray-400">Send</div>
                        <div className="mt-1 text-lg font-semibold">Transfer Stablecoins</div>
                      </button>
                      <button onClick={() => showMessage("Swap will be added next")} className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800">
                        <div className="text-sm text-gray-400">Swap</div>
                        <div className="mt-1 text-lg font-semibold">USDC ↔ EURC</div>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                    <h2 className="text-xl font-bold">Build Queue</h2>
                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl border border-green-900 bg-green-900/20 p-4">
                        <div className="text-sm text-green-400">Done</div>
                        <div className="mt-1 text-lg font-semibold text-green-500">Balance reader</div>
                      </div>
                      <div className="rounded-xl border border-green-900 bg-green-900/20 p-4">
                        <div className="text-sm text-green-400">Done</div>
                        <div className="mt-1 text-lg font-semibold text-green-500">Send / Receive modal</div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-black p-4">
                        <div className="text-sm text-gray-400">Next Step</div>
                        <div className="mt-1 text-lg font-semibold">Swap flow</div>
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
