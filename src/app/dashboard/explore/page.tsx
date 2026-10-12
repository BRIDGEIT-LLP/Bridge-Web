"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ExploreView } from "@/components/dashboard/explore/ExploreView";
import { isUserRole } from "@/lib/roles";

/**
 * Explore — "Shorts Mode" expert discovery. Shows a queue of swipeable profile
 * cards (see `ProfileShortsDeck`). User-roles only: staff hitting this URL directly
 * are bounced back to the dashboard, mirroring the guard on the admin pages.
 */
export default function ExplorePage() {
  const router = useRouter();
  const { role, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && !isUserRole(role)) router.replace("/dashboard");
  }, [isLoaded, role, router]);

  if (!isLoaded || !isUserRole(role)) return null;

  return (
    <div className="h-full">
      <ExploreView />
    </div>
  );
}
