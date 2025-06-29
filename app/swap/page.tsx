'use client';

import { useState, useEffect } from 'react';
import {
  ConnectButton,
  useWallet,
  useSuiClient,
  useAccountBalance,
  formatSUI,
} from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';

// Define types
type Token = {
  symbol: string;
  type: string;
  decimals: number;
  icon: string;
  color?: string;
};

type ExchangeRates = Record<string, number>;
type TokenBalances = Record<string, number>;

// Token definitions
const TOKENS: Record<string, Token> = {
  SUI: {
    symbol: 'SUI',
    type: '0x2::sui::SUI',
    decimals: 9,
    icon: 'https://cryptologos.cc/logos/sui-sui-logo.png',
    color: 'bg-gradient-to-r from-purple-500 to-blue-500',
  },
  USDT: {
    symbol: 'USDT',
    type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    decimals: 6,
    icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    color: 'bg-green-500',
  },
  USDC: {
    symbol: 'USDC',
    type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    decimals: 6,
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    color: 'bg-blue-500',
  },
  CETUS: {
    symbol: 'CETUS',
    type: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    decimals: 9,
    icon: 'https://cetus.zone/favicon.ico',
    color: 'bg-yellow-500',
  },
  WAL: {
    symbol: 'WAL',
    type: '0x1656f3e0a81d8e6b818f9f797e5a9f7a4c9d6d0b5b5e5e5e5e5e5e5e5e5e5::wal::WAL',
    decimals: 9,
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23088.png',
    color: 'bg-red-500',
  },
  MYCOIN: {
    symbol: 'MYCOIN',
    type: '0x123456...::my_coin::MYCOIN',
    decimals: 6,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    color: 'bg-gradient-to-r from-pink-500 to-violet-500',
  },
};

const PACKAGE_ID = '0xabc...';
const MODULE = 'cyberpunk_marketplace';
const FUNC = 'swap';

export default function TurboSwap() {
  const wallet = useWallet();
  const suiClient = useSuiClient();
  const { balance } = useAccountBalance();
  
  // State management
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [fromToken, setFromToken] = useState<Token>(TOKENS.SUI);
  const [toToken, setToToken] = useState<Token>(TOKENS.MYCOIN);
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>({});
  const [showTokenList, setShowTokenList] = useState<'from'|'to'|null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    'SUI-USDT': 1.2, 'SUI-USDC': 1.19, 'SUI-CETUS': 150, 'SUI-WAL': 80, 'SUI-MYCOIN': 0.8,
    'USDT-USDC': 0.99, 'USDT-CETUS': 125, 'USDT-WAL': 66.67, 'USDT-MYCOIN': 0.67,
  });

  // Calculate exchange rate
  const getExchangeRate = (): number => {
    const pair = `${fromToken.symbol}-${toToken.symbol}`;
    const reversePair = `${toToken.symbol}-${fromToken.symbol}`;
    return exchangeRates[pair] || (exchangeRates[reversePair] ? 1/exchangeRates[reversePair] : 0.8);
  };

  // Effects
  useEffect(() => {
    if (fromAmount && !isNaN(Number(fromAmount))) {
      setToAmount((Number(fromAmount) * getExchangeRate()).toFixed(toToken.decimals > 6 ? 6 : toToken.decimals));
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken, exchangeRates]);

  useEffect(() => {
    if (wallet.connected) {
      setTokenBalances({
        SUI: parseFloat(formatSUI(balance ?? 0)),
        USDT: 1250.42, USDC: 850.75, CETUS: 15000, WAL: 8000, MYCOIN: 5000
      });
    } else {
      setTokenBalances({});
    }
  }, [wallet.connected, balance]);

  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRates(prev => {
        const newRates = {...prev};
        Object.keys(newRates).forEach(pair => {
          newRates[pair] = newRates[pair] * (0.999 + Math.random() * 0.002);
        });
        return newRates;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handler functions
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromAmount(e.target.value);
  };

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
  };

  const handleMaxClick = () => {
    if (tokenBalances[fromToken.symbol]) {
      setFromAmount(tokenBalances[fromToken.symbol].toString());
    }
  };

  const selectToken = (tokenKey: string) => {
    const token = TOKENS[tokenKey];
    if (!token) return;
    
    if (showTokenList === 'from') {
      setFromToken(token);
    } else if (showTokenList === 'to') {
      setToToken(token);
    }
    setShowTokenList(null);
  };

  const handleSwap = async () => {
    if (!wallet.connected) return setError('Connect wallet dulu bos!');
    if (!fromAmount || isNaN(Number(fromAmount))) return setError('Masukkan jumlah yang valid');

    setIsSwapping(true);
    setError('');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${FUNC}`,
        arguments: [
          tx.pure.u64(Number(fromAmount) * 10**fromToken.decimals),
          tx.pure.u64(Number(fromAmount) * getExchangeRate() * (1 - slippage/100) * 10**toToken.decimals),
        ],
        typeArguments: [fromToken.type, toToken.type],
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

  // Current exchange rate
  const currentRate = getExchangeRate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Turbo Swap
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Tukar token dengan mudah di Sui Network
            </p>
          </div>

          {/* Swap Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all duration-300">
            {/* Gradient top bar */}
            <div className={`h-1 ${fromToken.color || 'bg-gradient-to-r from-blue-500 to-purple-500'}`}></div>
            
            <div className="p-6">
              {/* Wallet Connection */}
              <div className="flex justify-end mb-6">
                <ConnectButton className="!bg-gray-100 !text-gray-800 dark:!bg-gray-700 dark:!text-white !px-4 !py-2 !rounded-lg hover:!bg-gray-200 dark:hover:!bg-gray-600 transition-colors" />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* From Token */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Dari</span>
                  <button 
                    onClick={handleMaxClick}
                    className="text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-2 py-1 rounded-md transition-colors"
                  >
                    Max
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={handleFromAmountChange}
                    placeholder="0.0"
                    className="w-full bg-transparent text-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button 
                    onClick={() => setShowTokenList('from')}
                    className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg px-3 py-2 ml-2 transition-colors"
                  >
                    <img src={fromToken.icon} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-medium">{fromToken.symbol}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="text-right mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Saldo: {wallet.connected ? (tokenBalances[fromToken.symbol]?.toFixed(4) || '0.00') : '--'}

                </div>
              </div>

              {/* Flip Button */}
              <div className="flex justify-center my-1">
                <button 
                  onClick={flipTokens}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 p-2 rounded-full border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              {/* To Token */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Ke</span>
                </div>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    readOnly
                    value={toAmount}
                    placeholder="0.0"
                    className="w-full bg-transparent text-2xl outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button 
                    onClick={() => setShowTokenList('to')}
                    className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg px-3 py-2 ml-2 transition-colors"
                  >
                    <img src={toToken.icon} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                    <span className="font-medium">{toToken.symbol}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="text-right mt-1 text-xs text-gray-500 dark:text-gray-400">
               Saldo: {wallet.connected ? (Number(tokenBalances[toToken.symbol] ?? 0).toFixed(4)) : '--'}
                </div>
              </div>

              {/* Swap Info */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 mb-6 text-sm border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Rate</span>
                  <span>1 {fromToken.symbol} = {currentRate.toFixed(6)} {toToken.symbol}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Slippage</span>
                  <div className="flex items-center space-x-2">
                    {[0.1, 0.5, 1].map(value => (
                      <button 
                        key={value}
                        onClick={() => setSlippage(value)}
                        className={`px-2 py-1 rounded text-xs ${slippage === value ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Estimasi Harga</span>
                  <span>~ {toAmount || '0.00'} {toToken.symbol}</span>
                </div>
              </div>

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={isSwapping || !fromAmount}
                className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                  isSwapping 
                    ? 'bg-blue-400 dark:bg-blue-600 text-white' 
                    : !fromAmount 
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md'
                }`}
              >
                {isSwapping ? 'Processing...' : 'Swap Sekarang'}
              </button>
            </div>
          </div>

          {/* Token Selection Modal */}
          {showTokenList && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
                  <h3 className="font-bold">Pilih Token</h3>
                  <button 
                    onClick={() => setShowTokenList(null)} 
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Cari token..."
                      className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 pl-10 text-gray-900 dark:text-white"
                    />
                    <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(TOKENS).map(([key, token]) => (
                      <button
                        key={key}
                        onClick={() => selectToken(key)}
                        className={`flex items-center w-full p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          (showTokenList === 'from' && fromToken.symbol === token.symbol) ||
                          (showTokenList === 'to' && toToken.symbol === token.symbol)
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : ''
                        }`}
                      >
                        <img src={token.icon} alt={token.symbol} className="w-8 h-8 mr-3 rounded-full" />
                        <div className="text-left">
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Saldo: {wallet.connected ? (tokenBalances[token.symbol]?.toFixed(4) || '0.00') : '--'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            © 2023 Cyberpunk Marketplace. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}