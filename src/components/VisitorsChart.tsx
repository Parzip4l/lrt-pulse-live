import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { day: "Mon", visitors: 12543 },
  { day: "Tue", visitors: 13821 },
  { day: "Wed", visitors: 11234 },
  { day: "Thu", visitors: 15432 },
  { day: "Fri", visitors: 17654 },
  { day: "Sat", visitors: 19876 },
  { day: "Sun", visitors: 16543 },
];

export const VisitorsChart = () => {
  return (
    <Card className="glass hover-lift p-6 border-0">
      <h3 className="text-lg font-semibold mb-6">Daily Visitors</h3>
      
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Bar dataKey="visitors" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
