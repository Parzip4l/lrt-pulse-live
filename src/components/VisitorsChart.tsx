import { useEffect, useState, useCallback, memo, useRef } from "react";
import { ComposedChart, Bar, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

// --- SVG Icons ---
const Loader2 = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);

// --- Utility & Interfaces ---
const formatDate = (date: Date): string => date.toISOString().split("T")[0];
interface TrafficData { station_code_var: string; gate_out_on_dtm: string; }
interface TrafficApiResponse { code: number; data?: { rows: TrafficData[]; total: number; }; message?: string; }
interface LoginApiResponse { code: number; message: string; data?: { token: string; }; }
interface ChartData { name: string; [stationCode: string]: number | string; }

// --- Main Chart Component ---
export const VisitorsChart = () => {
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [stationKeys, setStationKeys] = useState<string[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Date filter state - default to last 7 days
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 6);
        return date;
    });

    const performLogin = useCallback(async (): Promise<string> => {
        const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/login/doLogin", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rqid: "456QWsad123QefasTY", username: "202020", password: "de88f321991be4f8e56a27aba3adc2aa", type: "web" })
        });
        if (!response.ok) throw new Error(`Login failed: ${response.status}`);
        const result: LoginApiResponse = await response.json();
        if (result.code === 0 && result.data?.token) return result.data.token;
        throw new Error(result.message || "Login failed: No token returned.");
    }, []);

    const fetchTrafficData = useCallback(async (start: string, end: string, currentToken: string): Promise<TrafficApiResponse['data']> => {
        const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/transaction/list_gate_out_prepaid_trx", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
            body: JSON.stringify({
                rqid: "456QWsad123QefasTY", order: "DESC", start_date: start, end_date: end,
                rows: "100000", // Increased row limit for larger date ranges
                sort: "gate_out_on_dtm", page: "1", card_type: "", status_trx: "", card_number: "",
                station_code: "", terminal_in: "", terminal_out: "", concession_type: ""
            })
        });
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.includes("application/json")) throw new Error("Token may have expired.");
        const result: TrafficApiResponse = await response.json();
        if (result.code === 0 && result.data) return result.data;
        if (result.code !== 0 && result.message?.includes("Success list")) return { rows: [], total: 0 };
        throw new Error(result.message || `API Error: Code ${result.code}`);
    }, []);

    useEffect(() => {
        let isMounted = true;
        
        const fetchData = async () => {
            if (!isMounted) return;
            setIsLoading(true);
            setError(null);
            
            try {
                let currentToken = token;
                if (!currentToken) {
                    currentToken = await performLogin();
                    if (isMounted) setToken(currentToken);
                    else return;
                }

                const data = await fetchTrafficData(formatDate(startDate), formatDate(endDate), currentToken);
                
                if (data && isMounted) {
                    const dailyTotals: { [day: string]: { [station: string]: number } } = {};
                    const allStations = new Set<string>();
                    
                    data.rows.forEach(row => {
                        const day = formatDate(new Date(row.gate_out_on_dtm));
                        allStations.add(row.station_code_var);
                        if (!dailyTotals[day]) dailyTotals[day] = {};
                        dailyTotals[day][row.station_code_var] = (dailyTotals[day][row.station_code_var] || 0) + 1;
                    });

                    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
                    
                    const chartDataResult: ChartData[] = Array.from({ length: diffDays }, (_, i) => {
                        const date = new Date(startDate);
                        date.setDate(date.getDate() + i);
                        const dayStr = formatDate(date);
                        const dayData: ChartData = { name: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) };
                        allStations.forEach(station => { dayData[station] = dailyTotals[dayStr]?.[station] || 0; });
                        return dayData;
                    });
                    
                    setChartData(chartDataResult);
                    setStationKeys(Array.from(allStations).sort());
                }
            } catch (err) {
                if (isMounted && err instanceof Error) {
                    setError(err.message);
                    if (err.message.includes("Token")) setToken(null);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [token, startDate, endDate, performLogin, fetchTrafficData]);

    const stationTotals = stationKeys.reduce((acc, station) => {
        acc[station] = chartData.reduce((sum, day) => sum + (day[station] as number), 0);
        return acc;
    }, {} as {[key: string]: number});

    const busiestStation = stationKeys.length > 0 ? Object.keys(stationTotals).reduce((a, b) => stationTotals[a] > stationTotals[b] ? a : b) : null;
    const COLORS = ['#FB923C', '#FBBF24', '#A3E635', '#4ADE80', '#38BDF8', '#818CF8'];
    
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-full lg:col-span-2">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h3 className="text-lg font-semibold text-gray-800">Analisis Traffic Stasiun</h3>
                <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={formatDate(startDate)} onChange={e => setStartDate(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                    <span className="text-gray-500">-</span>
                    <input type="date" value={formatDate(endDate)} onChange={e => setEndDate(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>
            </div>

            {isLoading ? (
                 <div className="flex items-center justify-center min-h-[300px]">
                    <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center text-center text-red-700 min-h-[300px]">
                    {error}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "0.5rem" }} />
                        <Legend />
                        
                        {stationKeys.filter(s => s !== busiestStation).map((station, index) => (
                            <Bar key={station} dataKey={station} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                        
                        {busiestStation && (
                            <Line type="monotone" dataKey={busiestStation} stroke="#DC2626" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} name={`Tersibuk: ${busiestStation}`} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

