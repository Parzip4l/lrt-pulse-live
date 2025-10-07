import { Bell, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DashboardHeader = () => {
  return (
    <header className="glass sticky top-0 z-50 w-full border-b">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            REALTIME
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Monitoring Dashboard</span>
            <ChevronRight className="h-4 w-4" />
            <span>Dashboard</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Realtime</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse-slow" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
