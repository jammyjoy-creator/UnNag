"use client";

import { useEffect, useState } from "react";

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isiOS, setIsiOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsiOS(ios);
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 rounded-2xl border border-pine/15 bg-white/80 px-4 py-3 text-sm text-ink/80 shadow-sm">
      <p className="font-medium text-ink">Add to Home Screen for quiet-window alerts</p>
      <p className="mt-1 text-ink/55">
        {isiOS
          ? "Safari → Share → Add to Home Screen. Then open UnNag from the icon to enable push."
          : "Chrome menu → Install app / Add to Home Screen."}
      </p>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-clay"
        onClick={() => setShow(false)}
      >
        Dismiss
      </button>
    </div>
  );
}
