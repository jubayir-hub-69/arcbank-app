"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_ID_HEX = "0x4cef52";
const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_FAUCET = "https://faucet.circle.com";

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
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "activity" | "tools"
  >("overview");

  const isArcTestnet = chainId === ARC_CHAIN_ID;

  const activityFeed: ActivityItem[] = useMemo(
    () => [
      {
        id: 1,
        label: "USDC faucet received",
        amount: "+20.00 USDC",
        meta: "Arc Testnet • 2 minutes ago",
        status: "Completed",
      },
      {
        id: 2,
        label: "Wallet connected",
        amount: "Connected",
        meta: "MetaMask / Rabby • today",
        status: "Completed",
      },
      {
        id: 3,
        label: "EURC balance synced",
        amount: "—",
        meta: "Awaiting balance module",
        status: "Pending",
      },
      {
        id: 4,
        label: "Swap module queued",
        amount: "USDC ↔ EURC",
        meta: "Next build step",
        status: "Pending",
      },
    ],
    []
  );

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2400);
  };

  const getEthereum = () => {
    if (typeof window === "undefined") return null;
    return (window as any).ethereum ?? null;
  };

  const syncNetwork = async () => {
    const ethereum = getEthereum();
    if (!ethereum) return null;

    const provider = new ethers.BrowserProvider(ethereum);
    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);

    setChainId(currentChainId);
    return currentChainId;
  };

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
    } catch {
      // silent init
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleChainChanged = (nextChainIdHex: string) => {
      const nextChainId = Number.parseInt(nextChainIdHex, 16);
      setChainId(nextChainId);
    };

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts?.length) {
        setWallet("");
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

  const connectWallet = async () => {
    try {
      const ethereum = getEthereum();

      if (!ethereum) {
        showMessage("Install Rabby or MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (!accounts?.length) {
        showMessage("Connection Rejected");
        return;
      }

      const signer = await provider.getSigner();
      await signer.signMessage("Sign in to ArcBank");

      setWallet(accounts[0]);

      const currentChainId = await syncNetwork();
      if (currentChainId !== ARC_CHAIN_ID) {
        showMessage("Wallet Connected. Switch to Arc Testnet");
      } else {
        showMessage("Wallet Connected");
      }
    } catch {
      showMessage("Connection Rejected");
    }
  };

  const disconnectWallet = () => {
    setWallet("");
    setChainId(null);
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

  const openFaucet = () => {
    window.open(ARC_FAUCET, "_blank", "noopener,noreferrer");
  };

  const openExplorer = () => {
    window.open(ARC_EXPLORER, "_blank", "noopener,noreferrer");
  };

  const switchToArcTestnet = async () => {
    try {
      const ethereum = getEthereum();

      if (!ethereum) {
        showMessage("Install Rabby or MetaMask");
        return;
      }

      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ARC_CHAIN_ID_HEX,
                chainName: "Arc Testnet",
                rpcUrls: [ARC_RPC],
                blockExplorerUrls: [ARC_EXPLORER],
                nativeCurrency: {
                  name: "USDC",
                  symbol: "USDC",
                  decimals: 6,
                },
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const current = await syncNetwork();
      if (current === ARC_CHAIN_ID) {
        showMessage("Arc Testnet Ready");
      }
    } catch {
      showMessage("Network switch cancelled");
    }
  };

  const actionToast = (label: string) => {
    showMessage(`${label} will be added next step`);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {message && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-blue-500 bg-blue-700 px-6 py-3 shadow-lg">
          {message}
        </div>
      )}

      <nav className="flex items-center justify-between border-b border-gray-800 px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            ArcBank
          </h1>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isArcTestnet
                ? "bg-green-500 text-black"
                : chainId
                ? "bg-amber-500 text-black"
                : "bg-zinc-700 text-white"
            }`}
          >
            {isArcTestnet
              ? "Arc Testnet"
              : chainId
              ? `Chain ${chainId}`
              : "Not Checked"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {wallet ? (
            <>
              <div className="rounded-xl bg-green-500 px-4 py-2 font-semibold text-black">
                {wallet.slice(0, 6)}...{wallet.slice(-4)}
              </div>

              <button
                type="button"
                onClick={disconnectWallet}
                className="rounded-xl bg-red-600 px-5 py-2 transition hover:bg-red-700"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="rounded-xl bg-blue-600 px-5 py-2 transition hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <section className="min-h-[85vh] px-4 py-8 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
              ArcBank Dashboard
            </h1>
            <p className="mt-4 text-base text-gray-400 md:text-xl">
              Stablecoin Banking on Arc Network
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-300">
              <button
                type="button"
                onClick={syncNetwork}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 transition hover:bg-zinc-800"
              >
                RPC: {ARC_RPC}
              </button>

              <button
                type="button"
                onClick={openExplorer}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 transition hover:bg-zinc-800"
              >
                Explorer: {ARC_EXPLORER}
              </button>

              {wallet && !isArcTestnet && (
                <button
                  type="button"
                  onClick={switchToArcTestnet}
                  className="rounded-full border border-emerald-600 bg-emerald-500 px-3 py-1 font-semibold text-black transition hover:bg-emerald-400"
                >
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
                <button
                  type="button"
                  onClick={() => setSelectedTab("overview")}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    selectedTab === "overview"
                      ? "bg-zinc-800 text-white"
                      : "bg-black text-gray-300 hover:bg-zinc-800"
                  }`}
                >
                  Overview
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTab("activity")}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    selectedTab === "activity"
                      ? "bg-zinc-800 text-white"
                      : "bg-black text-gray-300 hover:bg-zinc-800"
                  }`}
                >
                  Live Activity
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTab("tools")}
                  className={`w-full rounded-xl px-4 py-3 text-left transition ${
                    selectedTab === "tools"
                      ? "bg-zinc-800 text-white"
                      : "bg-black text-gray-300 hover:bg-zinc-800"
                  }`}
                >
                  Tools
                </button>
              </div>

              <div className="mt-6 rounded-xl border border-zinc-800 bg-black p-4">
                <div className="text-sm text-gray-400">Network Status</div>
                <div className="mt-1 text-lg font-semibold">
                  {wallet
                    ? isArcTestnet
                      ? "Arc Testnet"
                      : "Wrong Network"
                    : "No Wallet"}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4">
                <div className="text-sm text-gray-400">Security</div>
                <div className="mt-1 text-lg font-semibold">Signature Login</div>
                <div className="mt-1 text-xs text-gray-500">
                  Wallet approval required
                </div>
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
                          <div className="mt-1 text-lg font-semibold">
                            {wallet ? "Connected" : "Not Connected"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">Wallet Address</div>
                          <div className="mt-1 break-all text-sm">
                            {wallet || "No wallet connected"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">Network Status</div>
                          <div className="mt-1 text-lg font-semibold">
                            {wallet
                              ? isArcTestnet
                                ? "Arc Testnet"
                                : "Wrong Network"
                              : "No Network"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                      <h2 className="mb-5 text-xl font-bold">
                        Stablecoin Balances
                      </h2>

                      <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">USDC Balance</div>
                          <div className="mt-2 text-3xl font-bold">—</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Balance reading will be added in the next step
                          </div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm text-gray-400">EURC Balance</div>
                          <div className="mt-2 text-3xl font-bold">—</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Balance reading will be added in the next step
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <button
                      type="button"
                      onClick={() => actionToast("Send")}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      <div className="text-sm text-gray-400">Send</div>
                      <div className="mt-1 text-lg font-semibold">USDC / EURC</div>
                    </button>

                    <button
                      type="button"
                      onClick={copyAddress}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      <div className="text-sm text-gray-400">Receive</div>
                      <div className="mt-1 text-lg font-semibold">Copy Address</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => actionToast("Swap")}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      <div className="text-sm text-gray-400">Swap</div>
                      <div className="mt-1 text-lg font-semibold">USDC ↔ EURC</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTab("activity")}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      <div className="text-sm text-gray-400">History</div>
                      <div className="mt-1 text-lg font-semibold">Transactions</div>
                    </button>

                    <button
                      type="button"
                      onClick={openFaucet}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
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
                    <button
                      type="button"
                      onClick={openExplorer}
                      className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-sm transition hover:bg-zinc-800"
                    >
                      Open Explorer
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    {activityFeed.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-800 bg-black p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <div className="mt-1 text-sm text-gray-400">
                              {item.meta}
                            </div>
                          </div>

                          <div className="text-left md:text-right">
                            <div className="font-semibold">{item.amount}</div>
                            <div
                              className={`mt-1 text-xs ${
                                item.status === "Completed"
                                  ? "text-green-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {item.status}
                            </div>
                          </div>
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
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800"
                      >
                        <div className="text-sm text-gray-400">Receive</div>
                        <div className="mt-1 text-lg font-semibold">
                          Copy Wallet Address
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={openFaucet}
                        className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800"
                      >
                        <div className="text-sm text-gray-400">Faucet</div>
                        <div className="mt-1 text-lg font-semibold">
                          Get Test Tokens
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => actionToast("Send")}
                        className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800"
                      >
                        <div className="text-sm text-gray-400">Send</div>
                        <div className="mt-1 text-lg font-semibold">
                          Transfer Stablecoins
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => actionToast("Swap")}
                        className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:bg-zinc-800"
                      >
                        <div className="text-sm text-gray-400">Swap</div>
                        <div className="mt-1 text-lg font-semibold">
                          USDC ↔ EURC
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                    <h2 className="text-xl font-bold">Build Queue</h2>
                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl border border-zinc-800 bg-black p-4">
                        <div className="text-sm text-gray-400">Next Step</div>
                        <div className="mt-1 text-lg font-semibold">
                          Balance reader
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-black p-4">
                        <div className="text-sm text-gray-400">Next Step</div>
                        <div className="mt-1 text-lg font-semibold">
                          Send / Receive modal
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-black p-4">
                        <div className="text-sm text-gray-400">Next Step</div>
                        <div className="mt-1 text-lg font-semibold">
                          Swap flow
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-black p-4">
                        <div className="text-sm text-gray-400">Next Step</div>
                        <div className="mt-1 text-lg font-semibold">
                          History page
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-400">
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              Arc Testnet
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              USDC Native Gas
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              EURC Supported
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              Wallet Ready
            </span>
            <span className="rounded-full border border-zinc-700 px-3 py-1">
              Banking UI
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}