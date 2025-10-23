import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Train } from "lucide-react";

interface TrainData {
  no_ka: string;
  kereta_id: string;
  masinis: string;
  kecepatan: string;
  last_latitude: string;
  last_longitude: string;
  stasiun_terakhir: string;
  status: string;
}

const STATIONS = [
  { id: "1", name: "VLD", label: "Velodrome" },
  { id: "2", name: "EQS", label: "Equestrian" },
  { id: "3", name: "PLS", label: "Pulomas" },
  { id: "4", name: "BLS", label: "Boulevard Selatan" },
  { id: "5", name: "BLU", label: "Boulevard Utara" },
  { id: "6", name: "PGD", label: "Pegangsaan Dua" },
];

export const TrainRouteVisualization = () => {
  const [trains, setTrains] = useState<TrainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetch - replace with actual API call
    const fetchTrains = async () => {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setTrains([
          {
            no_ka: "1091",
            kereta_id: "1",
            masinis: "Ekky Diyasnara",
            kecepatan: "15",
            last_latitude: "-6.1910539630486",
            last_longitude: "106.8912165198",
            stasiun_terakhir: "6",
            status: "1",
          },
          {
            no_ka: "1089",
            kereta_id: "2",
            masinis: "Suryo Adi Pamungkas",
            kecepatan: "0",
            last_latitude: "-6.1921779625752",
            last_longitude: "106.8911795597",
            stasiun_terakhir: "6",
            status: "1",
          },
        ]);
        setLoading(false);
      }, 500);
    };

    fetchTrains();
    const interval = setInterval(fetchTrains, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="hover-lift p-6 border-0 col-span-full lg:col-span-4">
      <h3 className="text-lg font-semibold mb-6">Live Train Positions</h3>
      
      <div className="relative">
        {/* Track Line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded-full transform -translate-y-1/2" />
        
        {/* Stations */}
        <div className="relative flex justify-between items-center py-8">
          {STATIONS.map((station, index) => (
            <div key={station.id} className="flex flex-col items-center gap-2 z-10">
              <div className="relative">
                <div className="h-4 w-4 rounded-full bg-primary border-4 border-white shadow-lg" />
                {trains.some(t => t.stasiun_terakhir === station.id) && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                    <Train className="h-6 w-6 text-primary animate-train" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">{station.name}</p>
                <p className="text-[10px] text-muted-foreground max-w-[60px] truncate">
                  {station.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Active Trains Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {trains.filter(t => t.status === "1").map((train) => (
            <div key={train.kereta_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Train className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Train {train.no_ka}</p>
                <p className="text-xs text-muted-foreground truncate">{train.masinis}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{train.kecepatan} km/h</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
          <div className="animate-pulse text-muted-foreground">Loading trains...</div>
        </div>
      )}
    </Card>
  );
};
