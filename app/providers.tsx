"use client";

import { FC } from "react";
import {
  AllDefaultWallets,
  defineSlushWallet,
  WalletProvider,
} from "@suiet/wallet-kit";

/**
 * Custom provider component for integrating with third-party providers.
 * https://nextjs.org/docs/getting-started/react-essentials#rendering-third-party-context-providers-in-server-components
 * @param props
 * @constructor
 */
const Providers: FC<any> = ({ children }) => {
  return (
    <WalletProvider
      defaultWallets={[
        ...AllDefaultWallets,
        defineSlushWallet({
          appName: "nago ",
        }),
      ]}
    >
      {children}
    </WalletProvider>
  );
};

export default Providers;
