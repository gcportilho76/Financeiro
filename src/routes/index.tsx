import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  // Decide the destination from a single auth check instead of bouncing
  // `/` -> `/dashboard` -> `/auth`. The old chain redirected into the pathless
  // `_authenticated` layout, whose own `beforeLoad` then redirected again,
  // which threw the router "Could not find match for matchId /_authenticated/"
  // invariant. Resolving the target here keeps the navigation to a single hop.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    throw redirect({ to: "/dashboard" });
  },
});
