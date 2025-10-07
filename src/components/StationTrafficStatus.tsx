import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface TrafficData {
  station_code_var: string;
  terminal_in: string;
  terminal_out: string;
  gate_out_on_dtm: string;
  card_type_var: string;
  status_var: string;
}

export const StationTrafficStatus = () => {
  const [traffic, setTraffic] = useState<TrafficData[]>([]);

  useEffect(() => {
    const fetchTraffic = async () => {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setTraffic([
          {
            station_code_var: "BVS",
            terminal_in: "PGVEL01",
            terminal_out: "PGBVS18",
            gate_out_on_dtm: new Date().toISOString(),
            card_type_var: "MANDIRI",
            status_var: "S",
          },
          {
            station_code_var: "VEL",
            terminal_in: "PGVEL01",
            terminal_out: "PGBVS17",
            gate_out_on_dtm: new Date(Date.now() - 60000).toISOString(),
            card_type_var: "BCA",
            status_var: "S",
          },
        ]);
      }, 300);
    };

    fetchTraffic();
    const interval = setInterval(fetchTraffic, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="glass hover-lift p-6 border-0">
      <h3 className="text-lg font-semibold mb-4">Real-time Station Traffic</h3>
      
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {traffic.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors animate-slide-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{item.station_code_var}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </div>
                <Badge variant={item.status_var === "S" ? "default" : "secondary"} className="text-xs">
                  {item.status_var === "S" ? "Success" : "Pending"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{item.terminal_in}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{item.terminal_out}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">{item.card_type_var}</span>
                <span className="text-muted-foreground">{formatTime(item.gate_out_on_dtm)}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
