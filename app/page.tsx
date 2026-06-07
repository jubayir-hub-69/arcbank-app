export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4">
        ArcBank
      </h1>

      <p className="text-gray-400 mb-8">
        Stablecoin Banking on Arc Network
      </p>

      <button className="bg-blue-600 px-6 py-3 rounded-xl hover:bg-blue-700">
        Connect Wallet
      </button>
    </main>
  );
}