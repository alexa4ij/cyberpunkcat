'use client';

import Image from "next/image";
import Link from "next/link";
import { dummyListings } from "@/data/datalisting";
import {
  addressEllipsis,
  ConnectButton,
  ErrorCode,
  formatSUI,
  useAccountBalance,
  useSuiClient,
  useWallet,
} from "@suiet/wallet-kit";
import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { SuiTransactionBlockResponse } from "@mysten/sui/client";

// Constants (contract addresses)
const MARKETPLACE_ID = "0xc17515909a45c93e5c38290417d6eef9df3ce17b422e5bb6e3b057249213b7bc";
const PACKAGE_ID = "0xb48eb04ffd49ab3f435f5442727b4c3ce1fac5bc0fd122f2dc07dd386c050d83";
const MODULE_NAME = "marketplace";
const FUNCTION_NAME = "buy_card";


export default function NFTMarketplace() {
  const wallet = useWallet();
  const suiClient = useSuiClient();
  const { balance } = useAccountBalance();
  const [listings] = useState(dummyListings);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionResult, setTransactionResult] = useState<SuiTransactionBlockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuyNFT = async (listing: typeof dummyListings[0]) => {
    if (!wallet.account) {
      setError("Please connect your wallet first");
      return;
    }

    if (typeof balance !== "bigint" || balance < BigInt(listing.price)) {
      setError("Insufficient balance to purchase this NFT");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tx = new Transaction();

      const [coin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(listing.price),
      ]);

      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          tx.object(listing.nftId),
          coin,
          tx.object(MARKETPLACE_ID),
        ],
      });

      const resData = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showInput: true,
        },
      });

      setTransactionResult(resData);
      console.log("Transaction successful:", resData);
      alert("🎉 NFT purchased successfully!");
    } catch (err) {
      console.error("Transaction failed:", err);
      setError(
        err instanceof Error ? err.message : "Transaction failed"
      );
      alert("❌ Purchase failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 flex flex-col items-center p-6">
     <Link 
  href="/swap"
  className="
    relative
    inline-flex
    items-center
    justify-center
    px-100 py-1000
    rounded-full
    bg-gradient-to-r from-blue-500 to-blue-700
    hover:from-blue-600 hover:to-blue-800
    text-white
    font-semibold
    shadow-md
    hover:shadow-xl
    transition-all
    duration-3000
    group
    overflow-hidden
    text-base
  "
>
  <span className="relative z-100">🔁 Swap</span>
  <span className="
    absolute
    inset-0
    bg-gradient-to-r from-blue-800 to-blue-500
    opacity-0
    group-hover:opacity-100
    transition-opacity
    duration-300
  "></span>
  <span className="
    absolute
    -inset-1
    bg-white/20
    rounded-full
    blur-md
    group-hover:blur-lg
    transition-all
    duration-500
  "></span>
</Link>

      <ConnectButton
        className="!bg-teal-600 hover:!bg-teal-700 !text-white !px-6 !py-3 !rounded-xl !font-medium !shadow-md hover:!shadow-lg transition-all"
        onConnectError={(error) => {
          if (error.code === ErrorCode.WALLET__CONNECT_ERROR__USER_REJECTED) {
            setError("User rejected wallet connection");
          } else {
            setError("Failed to connect wallet: " + error.message);
          }
        }}
      />

      <div className="mt-8 w-full max-w-6xl">
        <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600">
          <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-purple-600">
            NFT Marketplace
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing) => (
              <div
                key={`${listing.id}-${listing.nftId}`}
                className="border-2 border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 transition-all duration-300 shadow-md hover:shadow-xl group hover:-translate-y-1"
              >
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden">
                  <img
                    src={listing.imageUrl}
                    alt={listing.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder-nft.png";
                      target.className = "w-full h-full object-contain p-4";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <span className="text-white font-medium">{listing.name}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 text-gray-800 dark:text-white">{listing.name}</h3>
                  <p className="text-teal-600 dark:text-teal-400 font-semibold mb-4">
                    {formatSUI(listing.price)} SUI
                  </p>
                  <button
                    onClick={() => handleBuyNFT(listing)}
                    disabled={isLoading || !wallet.connected}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
                      isLoading
                        ? "bg-gray-400 cursor-not-allowed"
                        : !wallet.connected
                        ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white cursor-not-allowed"
                        : "bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg"
                    }`}
                  >
                    {!wallet.connected ? "Connect Wallet" : isLoading ? "Processing..." : "Buy Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {wallet.connected && (
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600 mt-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Wallet Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-100/50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wallet Provider</p>
                <p className="font-medium text-gray-800 dark:text-white">{wallet.adapter?.name}</p>
              </div>
              <div className="bg-gray-100/50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wallet Address</p>
                <p className="font-mono text-sm text-gray-800 dark:text-white">
                  {addressEllipsis(wallet.account?.address ?? "")}
                </p>
              </div>
              <div className="bg-gray-100/50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Network</p>
                <p className="font-medium text-gray-800 dark:text-white">{wallet.chain?.name}</p>
              </div>
              <div className="bg-gray-100/50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Balance</p>
                <p className="font-medium text-teal-600 dark:text-teal-400">
                  {formatSUI(balance ?? 0)} SUI
                </p>
              </div>
            </div>
          </div>
        )}

        {transactionResult && (
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600 mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transaction Details</h3>
              <button
                onClick={() => setTransactionResult(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded-xl overflow-auto border border-gray-200 dark:border-gray-700">
                {JSON.stringify(transactionResult, null, 2)}
              </pre>
            </div>
            <a
              href={`https://suiexplorer.com/txblock/${transactionResult.digest}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center text-sm bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-4 py-2 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors"
            >
              View on Sui Explorer
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </main>
  );
}