import { DashboardHeader } from "@/components/DashboardHeader";
import { KPICard } from "@/components/KPICard";
import { TrainRouteVisualization } from "@/components/TrainRouteVisualization";
import { StationTrafficStatus } from "@/components/StationTrafficStatus";
import { PerformanceChart } from "@/components/PerformanceChart";
import { VisitorsChart } from "@/components/VisitorsChart";
import { TicketShareChart } from "@/components/TicketShareChart";
import { Train, Users, TrendingUp, Clock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-8">
        {/* KPI Cards - Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Active Trains"
            value={8}
            subtitle="All systems operational"
            icon={Train}
            trend={{ value: 12, isPositive: true }}
          />
          <KPICard
            title="Total Passengers Today"
            value="94,521"
            subtitle="vs 89,234 yesterday"
            icon={Users}
            trend={{ value: 5.9, isPositive: true }}
          />
          <KPICard
            title="On-Time Performance"
            value="94.8%"
            subtitle="Above 90% target"
            icon={TrendingUp}
            trend={{ value: 2.3, isPositive: true }}
          />
          <KPICard
            title="Avg. Trip Duration"
            value="14.2m"
            subtitle="End-to-end journey"
            icon={Clock}
          />
        </div>

        {/* Main Dashboard Grid - Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Train Route - spans 2 columns */}
          <TrainRouteVisualization />
          
          {/* Station Traffic - 1 column */}
          <StationTrafficStatus />
          
          {/* Performance Chart - full width */}
          <PerformanceChart />
          
          {/* Visitors and Ticket Charts */}
          <VisitorsChart />
          <TicketShareChart />
        </div>
      </main>
    </div>
  );
};

export default Index;
