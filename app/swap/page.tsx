'use client';

import { useState } from 'react';
import {
  ConnectButton,
  useWallet,
  useSuiClient,
  useAccountBalance,
  formatSUI,
} from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SuiSignAndExecuteTransactionBlockOutput } from '@mysten/wallet-standard';

const SUI_COIN = '0x2::sui::SUI'; // native coin
const MYCOIN = '0x123456...::my_coin::MYCOIN'; // Ganti dengan coin kamu
const PACKAGE_ID = '0xabc...'; // Ganti dengan package ID kamu
const MODULE = 'cyberpunk_marketplace'; // ganti dengan module kamu
const FUNC = 'swap'; // ganti dengan nama fungsi Move kamu

export default function SwapPage() {
  const wallet = useWallet();
  const suiClient = useSuiClient();
  const { balance } = useAccountBalance();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');

  const exchangeRate = 0.8; // Dummy rate: 1 SUI = 0.8 MYCOIN

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    if (value && !isNaN(Number(value))) {
      setToAmount((Number(value) * exchangeRate).toFixed(2));
    } else {
      setToAmount('');
    }
  };

  const handleSwap = async () => {
    if (!wallet.connected || !wallet.account?.address) {
      setError('Connect wallet dulu bos!');
      return;
    }

    if (!fromAmount || isNaN(Number(fromAmount))) {
      setError('Masukkan jumlah yang valid');
      return;
    }

    setIsSwapping(true);
    setError('');

    try {
      const tx = new Transaction();

      // Misal: fungsi Move kamu adalah
      // public entry fun swap(sender: &signer, from: Coin<SUI>, min_amount_out: u64, to_type: Type)
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${FUNC}`,
        arguments: [
          tx.pure.u64(Number(fromAmount) * 1_000_000_000), // Amount in (SUI)
          tx.pure.u64(Number(fromAmount) * exchangeRate * 1_000_000), // Min amount out
        ],
        typeArguments: [SUI_COIN, MYCOIN], // contoh swap dari SUI ke MYCOIN
      });

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true },
      });

      console.log('✅ Swap success:', result);
      alert('Swap berhasil!');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Swap gagal bos!');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-purple-600">
            Token Swap
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Swap SUI ↔ MYCOIN</p>
        </div>

        <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-600">
          <div className="p-6 space-y-4">
            <ConnectButton />

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between mb-1 text-sm">
                <label className="font-medium text-gray-700 dark:text-gray-300">From</label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Balance: {wallet.connected ? formatSUI(balance ?? 0) : '--'}
                </span>
              </div>
              <div className="flex items-center">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={handleFromAmountChange}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-2xl font-medium text-gray-900 dark:text-white outline-none"
                />
                <div className="ml-2 px-3 py-1 bg-gray-300 dark:bg-gray-600 rounded-lg text-gray-800 dark:text-white font-medium">
                  SUI
                </div>
              </div>
            </div>

            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">↓</div>

            <div className="bg-gray-100/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between mb-1 text-sm">
                <label className="font-medium text-gray-700 dark:text-gray-300">To</label>
              </div>
              <div className="flex items-center">
                <input
                  type="text"
                  readOnly
                  value={toAmount}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-2xl font-medium text-gray-900 dark:text-white outline-none"
                />
                <div className="ml-2 px-3 py-1 bg-purple-300 dark:bg-purple-600 rounded-lg text-gray-800 dark:text-white font-medium">
                  MYCOIN
                </div>
              </div>
            </div>

            <button
              onClick={handleSwap}
              disabled={isSwapping}
              className="w-full inline-flex justify-center items-center px-6 py-3 text-white bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-600 hover:to-purple-700 rounded-xl shadow-lg font-medium transition-all duration-300"
            >
              {isSwapping ? 'Swapping...' : 'Swap Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
