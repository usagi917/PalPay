"use client";

import { useState, useCallback, useEffect } from "react";
import { Box, Container, Button, Chip } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { parseUnits, type Address } from "viem";
import { Header } from "@/components/Header";
import { AgentChat } from "@/components/agent";
import { I18nContext, type Locale, type TranslationKey, translations } from "@/lib/i18n";
import { createClient, createWallet, config, ensureWalletChain, getMetaMaskProvider } from "@/lib/config";
import { FACTORY_ABI, ERC20_ABI, ESCROW_ABI } from "@/lib/abi";

// Simple wallet connect button for agent page
function WalletButton({
  address,
  onConnect,
  onDisconnect,
  isConnecting,
  loginLabel,
  loggingInLabel,
  logoutLabel,
}: {
  address?: Address;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
  loginLabel: string;
  loggingInLabel: string;
  logoutLabel: string;
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
          {logoutLabel}
        </Button>
      </Box>
    );
  }

  return (
    <Button
      variant="contained"
      startIcon={<AccountCircleIcon />}
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
      {isConnecting ? loggingInLabel : loginLabel}
    </Button>
  );
}

function AgentPageContent() {
  const [userAddress, setUserAddress] = useState<Address | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [locale, setLocale] = useState<Locale>("ja");
  const t = useCallback((key: TranslationKey) => translations[locale][key] as string, [locale]);

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
      alert(t("noMetaMask"));
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
  }, [t]);

  const handleDisconnect = useCallback(() => {
    setUserAddress(undefined);
  }, []);

  // Execute transaction based on action type
  const handleExecuteTx = useCallback(
    async (action: string, params?: Record<string, unknown>) => {
      const provider = getMetaMaskProvider();
      if (!provider || !userAddress) {
        throw new Error(t("agentLoginRequired"));
      }
      await ensureWalletChain(provider);
      const wallet = createWallet(provider);
      const client = createClient();
      if (!wallet) {
        throw new Error(t("agentLoginRequired"));
      }

      const [account] = await wallet.getAddresses();

      function requireEscrowAddress(): Address {
        if (!params?.escrowAddress) {
          throw new Error(t("agentMissingEscrowAddress"));
        }
        return params.escrowAddress as Address;
      }

      switch (action) {
        case "createListing": {
          if (!params) throw new Error(t("agentMissingParams"));
          if (typeof params.categoryType !== "number") {
            throw new Error(t("agentMissingCategory"));
          }
          if (typeof params.totalAmount !== "string" || !params.totalAmount.trim()) {
            throw new Error(t("agentMissingAmount"));
          }

          const amountWei = parseUnits(params.totalAmount as string, 18);
          const hash = await wallet.writeContract({
            address: config.factoryAddress,
            abi: FACTORY_ABI,
            functionName: "createListing",
            args: [
              params.categoryType as number,
              params.title as string,
              params.description as string,
              amountWei,
              (params.imageURI as string) || "",
            ],
            account,
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error(t("agentCreateListingFailed"));
          }
          console.log("Create listing tx:", hash);
          return;
        }

        case "lock": {
          const escrowAddress = requireEscrowAddress();
          let amountWei: bigint;

          if (typeof params?.amount === "string" && params.amount.trim()) {
            amountWei = parseUnits(params.amount, 18);
          } else {
            const core = await client.readContract({
              address: escrowAddress,
              abi: ESCROW_ABI,
              functionName: "getCore",
            }) as [Address, Address, Address, Address, bigint, bigint, bigint, number];
            amountWei = core[5];
          }

          const approveHash = await wallet.writeContract({
            address: config.tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [escrowAddress, amountWei],
            account,
          });
          const approveReceipt = await client.waitForTransactionReceipt({ hash: approveHash });
          if (approveReceipt.status !== "success") {
            throw new Error(t("agentApprovePaymentFailed"));
          }
          console.log("Approve tx:", approveHash);

          const lockHash = await wallet.writeContract({
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName: "lock",
            args: [],
            account,
          });
          const lockReceipt = await client.waitForTransactionReceipt({ hash: lockHash });
          if (lockReceipt.status !== "success") {
            throw new Error(t("agentLockFailed"));
          }
          console.log("Lock tx:", lockHash);
          return;
        }

        case "approve": {
          const hash = await wallet.writeContract({
            address: requireEscrowAddress(),
            abi: ESCROW_ABI,
            functionName: "approve",
            args: [],
            account,
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error(t("agentApproveFailed"));
          }
          console.log("Approve tx:", hash);
          return;
        }

        case "cancel": {
          const hash = await wallet.writeContract({
            address: requireEscrowAddress(),
            abi: ESCROW_ABI,
            functionName: "cancel",
            args: [],
            account,
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error(t("agentCancelFailed"));
          }
          console.log("Cancel tx:", hash);
          return;
        }

        case "confirmDelivery": {
          const evidenceHash = (params?.evidenceHash as `0x${string}`) || "0x0000000000000000000000000000000000000000000000000000000000000000";
          const hash = await wallet.writeContract({
            address: requireEscrowAddress(),
            abi: ESCROW_ABI,
            functionName: "confirmDelivery",
            args: [evidenceHash],
            account,
          });
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error(t("agentConfirmDeliveryFailed"));
          }
          console.log("Confirm delivery tx:", hash);
          return;
        }

        default:
          throw new Error(`${t("agentUnknownAction")}: ${action}`);
      }
    },
    [t, userAddress]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
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
              loginLabel={t("connectWallet")}
              loggingInLabel={t("connecting")}
              logoutLabel={t("disconnect")}
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
