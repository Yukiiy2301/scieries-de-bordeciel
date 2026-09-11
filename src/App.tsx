import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routers } from "./router";
import { StoreProvider } from "./lib/store";
import { SawmillProvider } from "./hooks/use-sawmill";
import { AuthProvider } from "./hooks/use-auth";

const queryClient = new QueryClient();

const App = () => {
  const router = createBrowserRouter(routers);
  return (
    <AuthProvider>
      <StoreProvider>
        <SawmillProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <RouterProvider router={router} />
            </TooltipProvider>
          </QueryClientProvider>
        </SawmillProvider>
      </StoreProvider>
    </AuthProvider>
  );
};

export default App;
