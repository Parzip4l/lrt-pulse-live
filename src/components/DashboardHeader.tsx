import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DashboardHeader = () => {
  return (
    <header className="relative z-50 w-full bg-gradient-to-r from-primary via-[#FF8C42] to-[#FF6B6B] h-[200px]">
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* LRT Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white flex items-center justify-center backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-4 h-0.5 bg-white rotate-45"></div>
                <div className="w-4 h-0.5 bg-white -rotate-45 -ml-4"></div>
              </div>
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold tracking-wide">LRT JAKARTA</h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/20">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white animate-pulse-slow" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
