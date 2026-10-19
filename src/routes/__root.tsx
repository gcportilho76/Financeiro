import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  ssr: false,
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event === "SIGNED_OUT") {
          queryClient.clear();
        } else {
          queryClient.invalidateQueries();
        }
      });
      (window as any).__authSub = sub;
    });
    return () => {
      mounted = false;
      try {
        if (typeof window !== "undefined") {
          (window as any).__authSub?.subscription?.unsubscribe?.();
        }
      } catch {}
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <Outlet />
      <Scripts />
    </QueryClientProvider>
  );
}