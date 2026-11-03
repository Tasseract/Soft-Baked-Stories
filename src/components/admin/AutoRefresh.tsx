"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the dashboard periodically so new orders show up without a manual reload
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
