# 🏦 ArcBank: Web3 Stablecoin Management & Identity Protocol

**ArcBank** is an enterprise-grade, decentralized application (DApp) built on the Arc L1 Network. I designed this protocol to simplify Web3 stablecoin transactions by combining seamless USDC/EURC payments with a custom on-chain identity system. It bridges the gap between complex blockchain mechanics and a user-friendly, traditional banking experience.

---

## ✨ Core Features & Functionalities

### 🌐 1. Arc Name Service (ANS) - Web3 Identity
I built and deployed a custom On-Chain Name Registry Smart Contract.
* **Functionality:** Users can register unique, permanent `.arc` domains (e.g., `jubayir.arc`) directly on the Arc blockchain. 
* **Use Case:** It replaces complex, error-prone `0x...` wallet addresses with a personalized, human-readable Web3 identity.

### 💸 2. Smart Domain-Resolved Payments
The transaction engine is fully integrated with the ANS smart contract.
* **Functionality:** When sending funds, the system automatically resolves `.arc` domain names into their corresponding EVM addresses in the backend before broadcasting the transaction.
* **Use Case:** Guarantees 100% error-free transfers. Users can send USDC or EURC to a domain name just like sending an email.

### 📦 3. Batch Transfer Engine
An advanced transaction feature designed for bulk payments and invoicing.
* **Functionality:** Users can input multiple comma-separated addresses or `.arc` domains simultaneously. The engine individually resolves each domain and executes all transfers in a single workflow.
* **Use Case:** Highly useful for businesses, payrolls, or airdropping tokens to multiple community members without repeating the sending process.

### 🔗 4. Automated Payment Links (Invoicing)
A streamlined system to request crypto payments natively.
* **Functionality:** Users can generate a unique, shareable URL containing their specific payment request (Target Address, Asset Type, and Amount). 
* **Use Case:** When the payer clicks the link, the ArcBank app opens and automatically pre-fills the "Send Modal" with the exact invoice details, requiring only one click to confirm the payment.

### 🔥 5. Daily GM Protocol (On-Chain Streak)
A gamified engagement feature leveraging smart contracts.
* **Functionality:** Users sign a zero-value transaction to establish their presence on the Arc Network. The protocol tracks and updates their consecutive daily streak.
* **Use Case:** Builds an immutable, verifiable on-chain activity history and encourages daily network interaction.

### 🪪 6. Arc Pass: Digital Holographic ID
A dynamic visual representation of a user's on-chain data.
* **Functionality:** Generates a downloadable, high-quality Web3 ID card that displays the user's verified `.arc` domain, masked wallet address, and current GM streak in a premium UI.
* **Use Case:** Allows users to easily share and flex their verified Arc Network identity on platforms like X (Twitter) or Discord.

### 📊 7. Real-Time Portfolio & Verifiable History
A comprehensive dashboard for asset management.
* **Functionality:** Fetches live balances of native USDC and smart-contract-based EURC. It also maintains a localized, human-readable transaction history of all actions performed within the app.
* **Use Case:** Gives users complete transparency and instant feedback on their financial status and past activities, complete with direct links to the Arc Block Explorer.

### 🎨 8. Premium UI/UX & Responsive Design
Built with user accessibility in mind.
* **Functionality:** Features a modern, mobile-first architecture with a seamless drawer/sidebar, dark/light mode toggles, and real-time network latency tracking.
* **Use Case:** Ensures the DApp looks and functions flawlessly across all devices (Desktop, Tablet, Mobile) and in-app Web3 browsers (like MetaMask or Rabby).
* 
