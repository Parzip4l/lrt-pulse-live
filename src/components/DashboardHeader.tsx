import { Bell, User, Home, Activity, Shield, FileText, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DashboardHeader = () => {
  const currentDate = new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="relative z-50 w-full bg-gradient-to-r from-primary via-[#FF8C42] to-[#FF6B6B]">
      {/* Top Navigation Bar */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center backdrop-blur-sm">
                <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-3 h-0.5 bg-white rotate-45"></div>
                  <div className="w-3 h-0.5 bg-white -rotate-45 -ml-3"></div>
                </div>
              </div>
              <div className="text-white">
                <h1 className="text-lg font-bold tracking-wide">LRT JAKARTA</h1>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/20 gap-2 px-4"
              >
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
              <Button 
                variant="ghost" 
                className="text-white/80 hover:bg-white/20 hover:text-white gap-2 px-4"
              >
                <Activity className="h-4 w-4" />
                <span>QSHE</span>
              </Button>
              <Button 
                variant="ghost" 
                className="text-white/80 hover:bg-white/20 hover:text-white gap-2 px-4"
              >
                <Shield className="h-4 w-4" />
                <span>Security</span>
              </Button>
              <Button 
                variant="ghost" 
                className="text-white/80 hover:bg-white/20 hover:text-white gap-2 px-4"
              >
                <FileText className="h-4 w-4" />
                <span>Laporan</span>
              </Button>
            </nav>

            {/* User Profile Section */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/20">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-white animate-pulse-slow" />
              </Button>
              
              <Button variant="ghost" className="text-white hover:bg-white/20 gap-2 px-3">
                <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <span className="font-medium">Muhamad Sobirin</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Title Section */}
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-bold text-white">Dashboard</h2>
          <div className="flex items-center gap-2 text-white/90">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">{currentDate}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
