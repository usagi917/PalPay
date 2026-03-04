"use client";

import { useEffect } from "react";
import { Box, Typography, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Agent] Page error:", error);
  }, [error]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: 2,
        p: 4,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 64, color: "var(--status-error)" }} />
      <Typography variant="h5" sx={{ fontWeight: 600, color: "var(--color-text)" }}>
        Something went wrong
      </Typography>
      <Typography sx={{ color: "var(--color-text-secondary)", textAlign: "center", maxWidth: 400 }}>
        The agent encountered an unexpected error. Please try again.
      </Typography>
      <Button
        variant="contained"
        onClick={reset}
        sx={{
          mt: 2,
          background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-rich) 100%)",
          color: "var(--sumi-black)",
          fontWeight: 600,
          borderRadius: 2,
          "&:hover": {
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--copper-deep) 100%)",
          },
        }}
      >
        Try Again
      </Button>
    </Box>
  );
}
