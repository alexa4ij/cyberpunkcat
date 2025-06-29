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
import type { ChangeEvent } from 'react';

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

  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [fromToken, setFromToken] = useState<Token>(TOKENS.SUI);
  const [toToken, setToToken] = useState<Token>(TOKENS.MYCOIN);
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>({});
  const [showTokenList, setShowTokenList] = useState<'from' | 'to' | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    'SUI-USDT': 1.2, 'SUI-USDC': 1.19, 'SUI-CETUS': 150, 'SUI-WAL': 80, 'SUI-MYCOIN': 0.8,
    'USDT-USDC': 0.99, 'USDT-CETUS': 125, 'USDT-WAL': 66.67, 'USDT-MYCOIN': 0.67,
  });

  const getExchangeRate = (): number => {
    const pair = `${fromToken.symbol}-${toToken.symbol}`;
    const reversePair = `${toToken.symbol}-${fromToken.symbol}`;
    return exchangeRates[pair] || (exchangeRates[reversePair] ? 1 / exchangeRates[reversePair] : 0.8);
  };

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
        const newRates = { ...prev };
        Object.keys(newRates).forEach(pair => {
          newRates[pair] = newRates[pair] * (0.999 + Math.random() * 0.002);
        });
        return newRates;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFromAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFromAmount(e.target.value);
  };

  const handleMaxClick = () => {
    if (tokenBalances[fromToken.symbol]) {
      setFromAmount(tokenBalances[fromToken.symbol].toString());
    }
  };

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
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
          tx.pure.u64(Number(fromAmount) * 10 ** fromToken.decimals),
          tx.pure.u64(Number(fromAmount) * getExchangeRate() * (1 - slippage / 100) * 10 ** toToken.decimals),
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            TurboSwap
          </h1>
          <ConnectButton className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg" />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          {/* From Token */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400">From</label>
              <div className="text-sm text-gray-400">
                Balance: {tokenBalances[fromToken.symbol]?.toFixed(4) || '0.00'}
                <button 
                  onClick={handleMaxClick}
                  className="ml-2 text-purple-400 hover:text-purple-300"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="flex items-center bg-gray-700 rounded-lg p-3">
              <input
                type="number"
                value={fromAmount}
                onChange={handleFromAmountChange}
                placeholder="0.0"
                className="bg-transparent w-full text-xl outline-none"
              />
              <button
                onClick={() => setShowTokenList('from')}
                className="flex items-center bg-gray-600 hover:bg-gray-500 rounded-full px-3 py-1"
              >
                <img src={fromToken.icon} alt={fromToken.symbol} className="w-6 h-6 mr-2" />
                <span>{fromToken.symbol}</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center my-2">
            <button
              onClick={flipTokens}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400">To</label>
              <div className="text-sm text-gray-400">
                Balance: {tokenBalances[toToken.symbol]?.toFixed(4) || '0.00'}
              </div>
            </div>
            <div className="flex items-center bg-gray-700 rounded-lg p-3">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="bg-transparent w-full text-xl outline-none"
              />
              <button
                onClick={() => setShowTokenList('to')}
                className="flex items-center bg-gray-600 hover:bg-gray-500 rounded-full px-3 py-1"
              >
                <img src={toToken.icon} alt={toToken.symbol} className="w-6 h-6 mr-2" />
                <span>{toToken.symbol}</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Rate Info */}
          <div className="mb-6 text-center text-sm text-gray-400">
            1 {fromToken.symbol} = {getExchangeRate().toFixed(6)} {toToken.symbol}
          </div>

          {/* Slippage Settings */}
          <div className="mb-6">
            <label className="block text-gray-400 mb-2">Slippage Tolerance</label>
            <div className="flex space-x-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded-lg ${slippage === value ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {value}%
                </button>
              ))}
              <div className="relative flex-1">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full bg-gray-700 rounded-lg px-3 py-1 text-right pr-7"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2">%</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={isSwapping || !fromAmount || !toAmount}
            className={`w-full py-3 rounded-xl font-bold ${!wallet.connected ? 'bg-gray-600' : isSwapping ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-500'} transition-colors`}
          >
            {!wallet.connected ? 'Connect Wallet' : isSwapping ? 'Swapping...' : 'Swap'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Token Selection Modal */}
      {showTokenList && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden mx-4">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium">Select Token</h3>
              <button onClick={() => setShowTokenList(null)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {Object.entries(TOKENS).map(([key, token]) => (
                <button
                  key={key}
                  onClick={() => selectToken(key)}
                  className="flex items-center w-full p-4 hover:bg-gray-700 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full ${token.color || 'bg-gray-600'} flex items-center justify-center mr-3`}>
                    <img src={token.icon} alt={token.symbol} className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-sm text-gray-400">
                      Balance: {tokenBalances[token.symbol]?.toFixed(4) || '0.00'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}