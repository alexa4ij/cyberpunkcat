'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ConnectButton,
  useWallet,
  useSuiClient,
  useAccountBalance,
  formatSUI,
} from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import type { ChangeEvent } from 'react';
import { normalizeStructTag } from '@mysten/sui/utils';

// Define types
type Token = {
  symbol: string;
  type: string;
  decimals: number;
  icon: string;
  color?: string;
};

type TokenBalances = Record<string, number>;

// Token definitions with corrected type paths
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
    // Corrected wormhole USDT type
    type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    decimals: 6,
    icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    color: 'bg-green-500',
  },
  USDC: {
    symbol: 'USDC',
    // Corrected wormhole USDC type
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
    // Corrected WAL type from DeepBook Indexer data
    type: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
    decimals: 9,
    icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23088.png',
    color: 'bg-red-500',
  },
  DEEP: {
    symbol: 'DEEP',
    type: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
    decimals: 9, // Diperbaiki desimal DEEP menjadi 9
    icon: 'https://cryptologos.cc/logos/deepbook-protocol-deep-logo.png',
    color: 'bg-gradient-to-r from-indigo-500 to-purple-500',
  },
};

// DeepBook pools - Using verified pool IDs
const DEEPBOOK_POOL_IDS: { [key: string]: string } = {
  // Mainnet DeepBook Pool IDs (Based on public indexer data)
  'SUI-USDC': '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407',
  'USDC-SUI': '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407',
  'DEEP-USDC': '0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce',
  'USDC-DEEP': '0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce',
  // You need to find the correct CETUS pool ID
  'SUI-CETUS': '0x...sui_cetus_pool_id', // Placeholder, ganti dengan ID asli
  'CETUS-SUI': '0x...sui_cetus_pool_id', // Placeholder, ganti dengan ID asli
  'DEEP-SUI' : '0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22',
  'SUI-DEEP' : '0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22',
};

// DeepBook Package ID (Sudah dikonfirmasi)
const DEEPBOOK_PACKAGE_ID = '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270';

// Swap functions
const DEEPBOOK_MODULE = 'clob_v2'; // Modul DeepBook sekarang adalah `clob_v2`
const SWAP_EXACT_BASE = 'swap_exact_base_for_quote';
const SWAP_EXACT_QUOTE = 'swap_exact_quote_for_base';

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
  const [toToken, setToToken] = useState<Token>(TOKENS.DEEP); // Mengubah default ToToken ke DEEP
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>({});
  const [showTokenList, setShowTokenList] = useState<'from' | 'to' | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState<number | null>(null);
  const [askPrice, setAskPrice] = useState<number | null>(null);
  const [poolObjectInfo, setPoolObjectInfo] = useState<any>(null); // State untuk menyimpan info objek pool

  // Dapatkan pool ID yang relevan berdasarkan pasangan token yang dipilih
  const poolId = useMemo(() => {
    // Coba temukan poolId untuk kedua arah pasangan token
    return DEEPBOOK_POOL_IDS[`${fromToken.symbol}-${toToken.symbol}`] || DEEPBOOK_POOL_IDS[`${toToken.symbol}-${fromToken.symbol}`] || null;
  }, [fromToken, toToken]);

  // Fungsi untuk mendapatkan harga pasar dari DeepBook
  const fetchLivePrice = useCallback(async () => {
    setError('');
    setLivePrice(null);
    setBidPrice(null);
    setAskPrice(null);
    
    if (!poolId || !suiClient) {
      setError('Pool ID tidak ditemukan untuk pasangan token ini.');
      return;
    }

    try {
      const poolObject = await suiClient.getObject({
        id: poolId,
        options: {
          showContent: true,
          showDisplay: true,
        },
      });

      if (!poolObject.data?.content || poolObject.data.content.dataType !== 'moveObject') {
        setError('Objek pool tidak valid atau tidak ditemukan di jaringan.');
        return;
      }

      const fields = poolObject.data.content.fields as any;
      setPoolObjectInfo(fields); // Simpan informasi pool untuk swap
      
      const asks = fields.asks?.fields?.levels?.fields?.entries;
      const bids = fields.bids?.fields?.levels?.fields?.entries;
      
      let bestAsk = Infinity;
      let bestBid = 0;

      // Ambil best ask price
      if (asks && asks.length > 0) {
        bestAsk = parseFloat(asks[0]?.fields?.key);
      }

      // Ambil best bid price
      if (bids && bids.length > 0) {
        bestBid = parseFloat(bids[0]?.fields?.key);
      }

      // Pastikan decimals token valid
      const baseAssetType = normalizeStructTag(fields.base_asset_type?.name);
      const quoteAssetType = normalizeStructTag(fields.quote_asset_type?.name);
      
      const baseTokenInfo = Object.values(TOKENS).find(t => normalizeStructTag(t.type) === baseAssetType);
      const quoteTokenInfo = Object.values(TOKENS).find(t => normalizeStructTag(t.type) === quoteAssetType);

      if (!baseTokenInfo || !quoteTokenInfo) {
          setError('Informasi desimal token tidak lengkap.');
          return;
      }

      const priceScale = 10 ** (baseTokenInfo.decimals - quoteTokenInfo.decimals);
      const deepbookPriceScale = 10 ** 9; // DeepBook scaling factor
      
      // Konversi harga dari DeepBook
      let finalBidPrice = bestBid > 0 ? (bestBid / deepbookPriceScale) * priceScale : 0;
      let finalAskPrice = bestAsk < Infinity ? (bestAsk / deepbookPriceScale) * priceScale : Infinity;
      
      // Cek apakah swap direction terbalik (fromToken adalah quote_asset)
      const isSwapDirectionReversed = normalizeStructTag(fromToken.type) === quoteAssetType;

      if (isSwapDirectionReversed) {
        // Jika terbalik, harga bid dan ask juga dibalik
        const tempBid = finalBidPrice;
        finalBidPrice = finalAskPrice < Infinity ? 1 / finalAskPrice : 0;
        finalAskPrice = tempBid > 0 ? 1 / tempBid : Infinity;
      }

      if (finalBidPrice === 0 || finalAskPrice === Infinity) {
          setLivePrice(null);
          setBidPrice(null);
          setAskPrice(null);
          setError('Order book kosong atau tidak ada harga yang tersedia.');
      } else {
          setBidPrice(finalBidPrice);
          setAskPrice(finalAskPrice);
          setLivePrice((finalBidPrice + finalAskPrice) / 2); // Harga tengah
          setError('');
      }

    } catch (err) {
      console.error('Gagal mengambil harga live dari DeepBook:', err);
      setLivePrice(null);
      setBidPrice(null);
      setAskPrice(null);
      setError('Gagal mengambil harga live. Pastikan ID pool sudah benar.');
    }
  }, [poolId, suiClient, fromToken, toToken]);

  // Efek untuk mengambil harga live secara berkala
  useEffect(() => {
    // Panggil sekali saat mount dan setiap kali pasangan token berubah
    fetchLivePrice();
    // Atur interval untuk polling harga setiap 10 detik
    const interval = setInterval(fetchLivePrice, 10000); 
    // Bersihkan interval saat komponen unmount atau dependencies berubah
    return () => clearInterval(interval);
  }, [fetchLivePrice]);

  // Efek untuk menghitung jumlah "to" saat jumlah "from" berubah
  useEffect(() => {
    if (fromAmount && !isNaN(Number(fromAmount)) && livePrice) {
      // Gunakan harga ask untuk estimasi pembelian (swap dari quote_asset ke base_asset)
      // Gunakan harga bid untuk estimasi penjualan (swap dari base_asset ke quote_asset)
      const isBaseToQuote = normalizeStructTag(fromToken.type) === normalizeStructTag(poolObjectInfo?.base_asset_type?.name);
      
      const priceForCalculation = isBaseToQuote ? bidPrice : askPrice;
      
      const estimatedAmount = Number(fromAmount) * (priceForCalculation || livePrice);
      setToAmount(estimatedAmount.toFixed(toToken.decimals));
    } else {
      setToAmount('');
    }
  }, [fromAmount, livePrice, bidPrice, askPrice, toToken, fromToken, poolObjectInfo]);
  
  // Efek untuk mendapatkan saldo token
  useEffect(() => {
    const fetchBalances = async () => {
      if (!wallet.connected || !suiClient || !wallet.account?.address) {
        setTokenBalances({});
        return;
      }
      
      const balances: TokenBalances = {};
      
      // Fetch SUI balance
      const suiBalance = parseFloat(formatSUI(balance ?? 0));
      balances.SUI = suiBalance;
      
      // Fetch other coin balances
      const tokenSymbols = Object.keys(TOKENS).filter(s => s !== 'SUI');
      for (const symbol of tokenSymbols) {
        const token = TOKENS[symbol];
        try {
          const coinBalance = await suiClient.getBalance({
            owner: wallet.account.address,
            coinType: normalizeStructTag(token.type),
          });
          balances[symbol] = Number(coinBalance.totalBalance) / (10 ** token.decimals);
        } catch (err) {
          console.error(`Failed to fetch balance for ${symbol}:`, err);
          balances[symbol] = 0;
        }
      }
      setTokenBalances(balances);
    };
    
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000); 
    return () => clearInterval(interval);
  }, [wallet.connected, suiClient, wallet.account?.address, balance]);

  const handleFromAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFromAmount(e.target.value);
  };

  const handleMaxClick = () => {
    const balanceValue = tokenBalances[fromToken.symbol];
    if (balanceValue !== undefined && balanceValue !== null) {
      setFromAmount(balanceValue.toString());
    }
  };

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
  };

  const selectToken = (tokenKey: string) => {
    const token = TOKENS[tokenKey];
    if (!token) return;

    if (showTokenList === 'from') {
      if (token.symbol === toToken.symbol) {
        flipTokens();
      } else {
        setFromToken(token);
      }
    } else if (showTokenList === 'to') {
      if (token.symbol === fromToken.symbol) {
        flipTokens();
      } else {
        setToToken(token);
      }
    }
    setShowTokenList(null);
  };
  
  const handleSwap = async () => {
    if (!wallet.connected) return setError('Connect wallet dulu bos!');
    if (!fromAmount || isNaN(Number(fromAmount))) return setError('Masukkan jumlah yang valid');
    if (!poolId) return setError('Pasangan token tidak didukung oleh DeepBook.');
    if (!poolObjectInfo) return setError('Objek pool belum dimuat. Silakan tunggu sebentar.');

    setIsSwapping(true);
    setError('');

    try {
      const tx = new Transaction();
      
      const amountIn = BigInt(Math.floor(Number(fromAmount) * 10 ** fromToken.decimals));
      
      // Determine swap direction based on pool's base/quote assets
      const baseAssetType = normalizeStructTag(poolObjectInfo.base_asset_type.name);
      const isBaseToQuote = normalizeStructTag(fromToken.type) === baseAssetType;
      
      // Calculate minAmountOut with slippage using the relevant price
      const priceForCalculation = isBaseToQuote ? bidPrice : askPrice;
      if (!priceForCalculation || priceForCalculation <= 0) {
        throw new Error('Harga tidak valid untuk estimasi swap.');
      }
      
      const estimatedAmountOut = Number(fromAmount) * priceForCalculation;
      const minAmountOut = BigInt(Math.floor(estimatedAmountOut * (1 - slippage / 100) * 10 ** toToken.decimals));
      
      // Split the coin to be swapped
      const [coinIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn.toString())]);
      
      // Determine the correct swap function
      const swapFunction = isBaseToQuote ? SWAP_EXACT_BASE : SWAP_EXACT_QUOTE;

      // Swap using DeepBook
      tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::${DEEPBOOK_MODULE}::${swapFunction}`,
        arguments: [
          tx.object(poolId),
          coinIn,
          tx.pure.u64(minAmountOut.toString()),
          tx.object('0x6'), // Clock object
        ],
        typeArguments: [normalizeStructTag(fromToken.type), normalizeStructTag(toToken.type)],
      });

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true },
      });

      console.log('✅ Swap success:', result);
      alert('Swap berhasil!');
      setFromAmount('');
      setToAmount('');

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Swap gagal bos! Coba lagi.');
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
                Balance: {tokenBalances[fromToken.symbol] !== undefined && tokenBalances[fromToken.symbol] !== null
                           ? tokenBalances[fromToken.symbol].toFixed(4)
                           : '0.00'}
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
                Balance: {tokenBalances[toToken.symbol] !== undefined && tokenBalances[toToken.symbol] !== null
                           ? tokenBalances[toToken.symbol].toFixed(4)
                           : '0.00'}
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
            {livePrice ? (
              <>
                1 {fromToken.symbol} = {livePrice.toFixed(6)} {toToken.symbol} (Mid-Price) <br/>
                <span className="text-green-400">Bid: {bidPrice?.toFixed(6)}</span>{' '}
                <span className="text-red-400">Ask: {askPrice?.toFixed(6)}</span>
              </>
            ) : (
              error ? error : 'Fetching live price...'
            )}
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
            disabled={isSwapping || !fromAmount || !toAmount || !wallet.connected}
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
                      Balance: {tokenBalances[token.symbol] !== undefined && tokenBalances[token.symbol] !== null
                                 ? tokenBalances[token.symbol].toFixed(4)
                                 : '0.00'}
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