# 🏦 ArcBank | Enterprise Web3 Stablecoin Management

**ArcBank** is a production-ready, high-performance decentralized application (dApp) engineered natively for the **Arc L1 Network**. Designed to streamline stablecoin operations, it abstracts complex blockchain interactions into a seamless, enterprise-grade banking interface. 

This project is built to demonstrate how robust infrastructure, decentralized identity, and fiat-backed assets can seamlessly merge on the Arc ecosystem.

---

## 🚀 Core Architecture & Features

* **⚡ Native v0.7.2 Hardfork Integration:** Fully optimized for Arc's latest network upgrade. It features advanced **Batch Transactions** with a fail-safe execution loop (preventing a single failure from halting the entire batch) and native **Transaction Memos** implemented via low-level EVM calldata injection.
* **🌐 ARC Name Service (.arc):** A decentralized naming protocol built directly into the dashboard, allowing users to register and secure their permanent on-chain identity via a seamless UI.
* **🪪 Dynamic Cryptographic Identity (Arc Pass):** A client-side rendering protocol that dynamically generates a high-resolution, downloadable holographic digital ID card bound to the user's `.arc` domain and wallet address.
* **🔥 Zero-Value GM Protocol:** An on-chain streak tracking mechanism utilizing zero-value smart contract transactions to foster daily network participation and build immutable user footprints.
* **📡 Real-Time Network Telemetry:** Integrated RPC ping tracking to monitor and display live network latency in milliseconds, ensuring enterprise-tier transparency.
* **🌗 Adaptive Enterprise UI/UX:** Built with Next.js 14, featuring a highly responsive, state-persistent Light/Dark mode architecture with custom glassmorphism components.

---

## 🛠️ Technical Stack

* **Frontend Framework:** Next.js 14 (App Router, React)
* **Web3 Integration:** ethers.js (v6) *(Used for raw contract interaction, payload generation, and calldata manipulation)*
* **Styling & Animation:** Tailwind CSS, Canvas Confetti
* **Client-side Rendering:** dom-to-image *(For Arc Pass generation)*
* **Network Integration:** Arc L1 Testnet (Chain ID: `5042002`)

---

## ⚙️ Smart Contract Addresses & Endpoints

* **Native Gas Asset:** USDC (Core Network Implementation)
* **EURC Token Contract:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
* **Network RPC:** `https://rpc.testnet.arc.network`
* **Block Explorer:** `https://testnet.arcscan.app`

---

## 💻 Local Development Setup

To run this project locally and explore the architecture:

1. Clone the repository:
```bash
git clone [https://github.com/jubayir-hub-69/arcbank-app.git](https://github.com/jubayir-hub-69/arcbank-app.git)
