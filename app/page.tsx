"use client";

import { useState } from "react";

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");

  const showMessage = (text: string) => {
    setMessage(text);

    setTimeout(() => {
      setMessage("");
    }, 2000);
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window as any;

      if (!ethereum) {
        showMessage("Install Rabby or MetaMask");
        return;
      }

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      setWallet(accounts[0]);
      showMessage("Wallet Connected");
    } catch (error: any) {
      showMessage("Connection Rejected");
    }
  };

  const disconnectWallet = () => {
    setWallet("");
    showMessage("Wallet Disconnected");
  };

  return (
    <main className="min-h-screen bg-black text-white">

      {message && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 px-6 py-3 rounded-xl z-50">
          {message}
        </div>
      )}

      <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
        <h1 className="text-2xl font-bold">
          ArcBank
        </h1>

        {wallet ? (
          <div className="flex gap-3 items-center">

            <div className="bg-green-600 px-4 py-2 rounded-xl font-semibold">
              {wallet.slice(0, 6)}...
              {wallet.slice(-4)}
            </div>

            <button
              onClick={disconnectWallet}
              className="bg-red-600 px-4 py-2 rounded-xl hover:bg-red-700"
            >
              Disconnect
            </button>

          </div>
        ) : (
          <button
            onClick={connectWallet}
            className="bg-blue-600 px-5 py-2 rounded-xl hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        )}
      </nav>

      <div className="flex flex-col items-center justify-center h-[80vh]">
        <h1 className="text-7xl font-bold mb-4">
          ArcBank
        </h1>

        <p className="text-gray-400 text-lg">
          Stablecoin Banking on Arc Network
        </p>
      </div>

    </main>
  );
}