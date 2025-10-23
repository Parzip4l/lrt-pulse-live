import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar } from "lucide-react";

interface PerformanceData {
  date: string;
  onTimePercentage: number;
}

export const PerformanceChart = () => {
  const [data, setData] = useState<PerformanceData[]>([]);
  const [dateRange, setDateRange] = useState({ start: "2025-09-01", end: "2025-09-07" });

  useEffect(() => {
    const fetchPerformance = async () => {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setData([
          { date: "Mon", onTimePercentage: 92 },
          { date: "Tue", onTimePercentage: 95 },
          { date: "Wed", onTimePercentage: 93 },
          { date: "Thu", onTimePercentage: 97 },
          { date: "Fri", onTimePercentage: 94 },
          { date: "Sat", onTimePercentage: 96 },
          { date: "Sun", onTimePercentage: 91 },
        ]);
      }, 300);
    };

    fetchPerformance();
  }, [dateRange]);

  return (
    <Card className="glass hover-lift p-6 border-0 col-span-full lg:col-span-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">On-Time Performance</h3>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          {dateRange.start} - {dateRange.end}
        </Button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Area
            type="monotone"
            dataKey="onTimePercentage"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPerformance)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};
