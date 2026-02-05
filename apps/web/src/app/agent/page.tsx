"use client";

import { useState, useCallback, useEffect } from "react";
import { Box, Container, Button, Chip } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import LogoutIcon from "@mui/icons-material/Logout";
import { parseUnits, type Address } from "viem";
import { Header } from "@/components/Header";
import { AgentChat } from "@/components/agent";
import { I18nContext, type Locale, translations } from "@/lib/i18n";
import { createWallet, config, getMetaMaskProvider } from "@/lib/config";
import { FACTORY_ABI, ERC20_ABI } from "@/lib/abi";

// Simple wallet connect button for agent page
function WalletButton({
  address,
  onConnect,
  onDisconnect,
  isConnecting,
}: {
  address?: Address;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
}) {
  if (address) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Chip
          label={`${address.slice(0, 6)}...${address.slice(-4)}`}
          sx={{
            fontFamily: "monospace",
            fontSize: "0.8rem",
            background: "rgba(34, 197, 94, 0.1)",
            color: "#22c55e",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        />
        <Button
          size="small"
          startIcon={<LogoutIcon />}
          onClick={onDisconnect}
          sx={{
            color: "var(--color-text-secondary)",
            fontSize: "0.75rem",
            "&:hover": {
              color: "#ef4444",
              background: "rgba(239, 68, 68, 0.1)",
            },
          }}
        >
          切断
        </Button>
      </Box>
    );
  }

  return (
    <Button
      variant="contained"
      startIcon={<AccountBalanceWalletIcon />}
      onClick={onConnect}
      disabled={isConnecting}
      sx={{
        background: "linear-gradient(135deg, var(--color-primary) 0%, #c49660 100%)",
        color: "#fff",
        fontWeight: 600,
        "&:hover": {
          background: "linear-gradient(135deg, #c49660 0%, var(--color-primary) 100%)",
        },
      }}
    >
      {isConnecting ? "接続中..." : "ウォレット接続"}
    </Button>
  );
}

function AgentPageContent() {
  const [userAddress, setUserAddress] = useState<Address | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [locale, setLocale] = useState<Locale>("ja");

  // Check if already connected
  useEffect(() => {
    const checkConnection = async () => {
      const provider = getMetaMaskProvider();
      if (provider) {
        try {
          const accounts = await provider.request({ method: "eth_accounts" }) as string[];
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0] as Address);
          }
        } catch (e) {
          console.error("Failed to check connection:", e);
        }
      }
    };
    checkConnection();
  }, []);

  const handleConnect = useCallback(async () => {
    const provider = getMetaMaskProvider();
    if (!provider) {
      alert("MetaMaskをインストールしてください");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts && accounts.length > 0) {
        setUserAddress(accounts[0] as Address);
      }
    } catch (e) {
      console.error("Failed to connect:", e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setUserAddress(undefined);
  }, []);

  // Execute transaction based on action type
  const handleExecuteTx = useCallback(
    async (action: string, params?: Record<string, unknown>) => {
      const wallet = createWallet();
      if (!wallet || !userAddress) {
        throw new Error("ウォレットが接続されていません");
      }

      const [account] = await wallet.getAddresses();

      switch (action) {
        case "createListing": {
          if (!params) throw new Error("パラメータが不足しています");

          const categoryType = params.categoryType as number;
          const title = params.title as string;
          const description = params.description as string;
          const totalAmount = params.totalAmount as string;
          const imageURI = (params.imageURI as string) || "";

          // Parse amount to wei
          const amountWei = parseUnits(totalAmount, 18);

          // Call createListing on factory
          const hash = await wallet.writeContract({
            address: config.factoryAddress,
            abi: FACTORY_ABI,
            functionName: "createListing",
            args: [categoryType, title, description, amountWei, imageURI],
            account,
          });

          console.log("Create listing tx:", hash);
          return;
        }

        case "lock": {
          if (!params?.escrowAddress) throw new Error("エスクローアドレスが不足しています");

          const escrowAddress = params.escrowAddress as Address;
          const amount = params.amount as string;
          const amountWei = parseUnits(amount, 18);

          // First approve JPYC
          const approveHash = await wallet.writeContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [escrowAddress, amountWei],
            account,
          });
          console.log("Approve tx:", approveHash);

          // Then lock
          const lockHash = await wallet.writeContract({
            address: escrowAddress,
            abi: [
              {
                type: "function",
                name: "lock",
                inputs: [],
                outputs: [],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "lock",
            args: [],
            account,
          });
          console.log("Lock tx:", lockHash);
          return;
        }

        case "approve": {
          if (!params?.escrowAddress) throw new Error("エスクローアドレスが不足しています");

          const escrowAddress = params.escrowAddress as Address;

          const hash = await wallet.writeContract({
            address: escrowAddress,
            abi: [
              {
                type: "function",
                name: "approve",
                inputs: [],
                outputs: [],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "approve",
            args: [],
            account,
          });
          console.log("Approve tx:", hash);
          return;
        }

        case "cancel": {
          if (!params?.escrowAddress) throw new Error("エスクローアドレスが不足しています");

          const escrowAddress = params.escrowAddress as Address;

          const hash = await wallet.writeContract({
            address: escrowAddress,
            abi: [
              {
                type: "function",
                name: "cancel",
                inputs: [],
                outputs: [],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "cancel",
            args: [],
            account,
          });
          console.log("Cancel tx:", hash);
          return;
        }

        case "confirmDelivery": {
          if (!params?.escrowAddress) throw new Error("エスクローアドレスが不足しています");

          const escrowAddress = params.escrowAddress as Address;
          const evidenceHash = (params.evidenceHash as `0x${string}`) || "0x0000000000000000000000000000000000000000000000000000000000000000";

          const hash = await wallet.writeContract({
            address: escrowAddress,
            abi: [
              {
                type: "function",
                name: "confirmDelivery",
                inputs: [{ name: "evidenceHash", type: "bytes32" }],
                outputs: [],
                stateMutability: "nonpayable",
              },
            ],
            functionName: "confirmDelivery",
            args: [evidenceHash],
            account,
          });
          console.log("Confirm delivery tx:", hash);
          return;
        }

        default:
          throw new Error(`不明なアクション: ${action}`);
      }
    },
    [userAddress]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: (key) => translations[locale][key] || key,
      }}
    >
      <Box
        sx={{
          minHeight: "100vh",
          background: "var(--color-background)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Header onLocaleChange={setLocale} />

        <Container
          maxWidth="xl"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            py: 3,
            px: { xs: 2, md: 3 },
          }}
        >
          {/* Wallet connection */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              mb: 2,
            }}
          >
            <WalletButton
              address={userAddress}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              isConnecting={isConnecting}
            />
          </Box>

          {/* Agent Chat */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              height: "calc(100vh - 200px)",
            }}
          >
            <AgentChat
              userAddress={userAddress}
              walletConnected={!!userAddress}
              onExecuteTx={handleExecuteTx}
            />
          </Box>
        </Container>
      </Box>
    </I18nContext.Provider>
  );
}

export default function AgentPage() {
  return <AgentPageContent />;
}
