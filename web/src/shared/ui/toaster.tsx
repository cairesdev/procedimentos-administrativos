"use client";

import { Toaster as SonnerToaster } from "sonner";

export const Toaster = () => (
  <SonnerToaster
    position="bottom-right"
    closeButton
    richColors={false}
    toastOptions={{
      style: {
        border: "1px solid var(--borda)",
        borderRadius: "var(--raio)",
        background: "var(--superficie)",
        color: "var(--texto)",
        fontSize: "13.5px",
        boxShadow: "var(--sombra_flutuante)",
      },
    }}
  />
);
