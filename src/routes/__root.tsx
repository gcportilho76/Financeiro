import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createRootRoute({
  ssr: false,
  component: RootComponent,
});

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div id="app" className="min-h-screen bg-background text-foreground">
          <Outlet />
          <Toaster />
          <Sonner />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}