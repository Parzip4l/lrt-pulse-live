import { Card } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Single Trip", value: 45, color: "hsl(var(--primary))" },
  { name: "Daily Pass", value: 30, color: "hsl(var(--accent))" },
  { name: "Monthly Pass", value: 20, color: "hsl(16 90% 48%)" },
  { name: "Student", value: 5, color: "hsl(var(--muted))" },
];

export const TicketShareChart = () => {
  return (
    <Card className="glass hover-lift p-6 border-0">
      <h3 className="text-lg font-semibold mb-6">Ticket Type Share</h3>
      
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{item.name}</p>
              <p className="text-sm font-semibold">{item.value}%</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
