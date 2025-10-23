import { useEffect, useState } from "react";
import { Bell, User, Home, ChevronRight, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DashboardHeader = () => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const currentDate = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setCurrentTime(time);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="relative z-50 w-full bg-gradient-to-r from-primary via-[#FF8C42] to-[#FF6B6B]"
      style={{ height: "350px" }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h4 className="text-2xl font-bold text-white">Monitoring Dashboard</h4>
          <div className="flex items-center gap-3 text-white/90">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{currentDate}</span>
              <span className="text-xs">{currentTime}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
