import { Suspense } from "react";
import { VaultApp } from "@/components/VaultApp";

export const metadata = {
  title: "Vault · UnNag",
  description: "Incoming drops, quiet-window queue, and 5-second voice recorder.",
};

export default function VaultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-ink/40">
          Opening vault…
        </div>
      }
    >
      <VaultApp />
    </Suspense>
  );
}
