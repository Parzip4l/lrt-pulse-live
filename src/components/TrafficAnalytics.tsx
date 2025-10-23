import { useEffect, useState, useCallback, memo } from "react";
import { ComposedChart, Bar, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Crown, TrendingDown } from "lucide-react";

// --- SVG Icons ---
const Loader2 = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);
const BuildingIcon = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 22h16"/><path d="M4 18h16"/><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 6h16"/><path d="M12 2v20"/></svg>);
const CreditCardIcon = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);
const ArrowUp = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>);
const ArrowDown = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>);

// --- Interfaces ---
interface TrafficData { station_code_var: string; gate_out_on_dtm: string; card_type_var: string; }
interface ApiResponse<T> { code: number; data?: T; message?: string; }
interface TrafficApiResponseData { rows: TrafficData[]; total: number; }
interface LoginApiResponseData { token: string; }
interface ChartData { name: string; [stationCode: string]: number | string; }
interface StationSummary { [stationCode: string]: { total: number; breakdown: { [cardType: string]: number }; }; }

// --- Utility Function (Timezone Safe) ---
const formatDate = (date: Date): string => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
};

// --- Custom Hook for Data Fetching ---
export const useTrafficData = (options: { defaultRange: 'today' | 'week' }) => {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        if (options.defaultRange === 'week') {
            date.setDate(date.getDate() - 6);
        }
        return date;
    });
    const [endDate, setEndDate] = useState(new Date());

    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [visitorsChartData, setVisitorsChartData] = useState<ChartData[]>([]);
    const [stationKeys, setStationKeys] = useState<string[]>([]);
    const [stationSummary, setStationSummary] = useState<StationSummary>({});
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [percentageChange, setPercentageChange] = useState<number | null>(null);

    const performLogin = useCallback(async (): Promise<string> => {
        const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/login/doLogin", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rqid: "456QWsad123QefasTY", username: "202020", password: "de88f321991be4f8e56a27aba3adc2aa", type: "web" })
        });
        if (!response.ok) throw new Error(`Login failed: ${response.status}`);
        const result: ApiResponse<LoginApiResponseData> = await response.json();
        if (result.code === 0 && result.data?.token) return result.data.token;
        throw new Error(result.message || "Login failed: No token returned.");
    }, []);

    const fetchTrafficData = useCallback(async (start: string, end: string, currentToken: string): Promise<TrafficApiResponseData> => {
        const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/transaction/list_gate_out_prepaid_trx", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
            body: JSON.stringify({
                rqid: "456QWsad123QefasTY", order: "DESC", start_date: start, end_date: end, rows: "100000",
                sort: "gate_out_on_dtm", page: "1", card_type: "", status_trx: "", card_number: "",
                station_code: "", terminal_in: "", terminal_out: "", concession_type: ""
            })
        });
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.includes("application/json")) throw new Error("Token may have expired.");
        const result: ApiResponse<TrafficApiResponseData> = await response.json();
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
            setPercentageChange(null);

            try {
                let currentToken = token;
                if (!currentToken) {
                    currentToken = await performLogin();
                    if (isMounted) setToken(currentToken); else return;
                }
                
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                const [mainData, yesterdayData] = await Promise.all([
                    fetchTrafficData(formatDate(startDate), formatDate(endDate), currentToken),
                    fetchTrafficData(formatDate(yesterday), formatDate(yesterday), currentToken)
                ]);

                if (!mainData || !isMounted) return;
                
                const allStations = new Set<string>();
                const dailyTotals: { [day: string]: { [station: string]: number } } = {};
                const summary: StationSummary = {};

                mainData.rows.forEach(row => {
                    // FIX: Parse date as string to avoid timezone issues
                    const day = row.gate_out_on_dtm.substring(0, 10); // e.g., "2025-10-07"
                    const station = row.station_code_var;
                    const card = row.card_type_var;
                    
                    allStations.add(station);

                    if (!dailyTotals[day]) dailyTotals[day] = {};
                    dailyTotals[day][station] = (dailyTotals[day][station] || 0) + 1;
                    
                    if (!summary[station]) summary[station] = { total: 0, breakdown: {} };
                    summary[station].total++;
                    summary[station].breakdown[card] = (summary[station].breakdown[card] || 0) + 1;
                });
                
                const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
                const chartDataResult: ChartData[] = Array.from({ length: diffDays }, (_, i) => {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    const dayStr = formatDate(date);
                    const dayData: ChartData = { name: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) };
                    allStations.forEach(station => { dayData[station] = dailyTotals[dayStr]?.[station] || 0; });
                    return dayData;
                });
                
                setVisitorsChartData(chartDataResult);
                setStationKeys(Array.from(allStations).sort());
                setStationSummary(summary);
                setTotalTransactions(mainData.total);
                
                const isToday = formatDate(startDate) === formatDate(endDate) && formatDate(endDate) === formatDate(new Date());
                if (isToday && yesterdayData) {
                    const yesterdayTotal = yesterdayData.total;
                    const todayTotal = mainData.total;
                    if (yesterdayTotal > 0) {
                        const change = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
                        setPercentageChange(change);
                    } else {
                        setPercentageChange(todayTotal > 0 ? 100 : 0);
                    }
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
    }, [startDate, endDate, token, performLogin, fetchTrafficData]);

    return { startDate, setStartDate, endDate, setEndDate, isLoading, error, visitorsChartData, stationKeys, stationSummary, totalTransactions, percentageChange };
};

// --- Presentational Components ---

// 1. VisitorsChart
interface VisitorsChartProps { data: ChartData[]; stationKeys: string[]; isLoading: boolean; error: string | null; startDate: Date; endDate: Date; onStartDateChange: (date: Date) => void; onEndDateChange: (date: Date) => void; }
export const VisitorsChart = ({ data, stationKeys, isLoading, error, startDate, endDate, onStartDateChange, onEndDateChange }: VisitorsChartProps) => {
    const stationTotals = stationKeys.reduce((acc, station) => {
        acc[station] = data.reduce((sum, day) => sum + (day[station] as number), 0);
        return acc;
    }, {} as { [key: string]: number });
    
    const busiestStation = stationKeys.length > 0 ? Object.keys(stationTotals).reduce((a, b) => stationTotals[a] > stationTotals[b] ? a : b) : null;
    const COLORS = ['#FB923C', '#FBBF24', '#A3E635', '#4ADE80', '#38BDF8', '#818CF8'];

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-full lg:col-span-2">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h3 className="text-lg font-semibold text-gray-800">Analisis Traffic Stasiun</h3>
                <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={formatDate(startDate)} onChange={e => onStartDateChange(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500" />
                    <span className="text-gray-500">-</span>
                    <input type="date" value={formatDate(endDate)} onChange={e => onEndDateChange(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
            </div>

            {isLoading ? ( <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div> ) 
            : error ? ( <div className="flex items-center justify-center text-center text-red-700 min-h-[300px]">{error}</div> ) 
            : (
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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

// 2. StationTrafficStatus
interface StationTrafficStatusProps { summary: StationSummary; totalTransactions: number; percentageChange: number | null; isLoading: boolean; error: string | null; startDate: Date; endDate: Date; onStartDateChange: (date: Date) => void; onEndDateChange: (date: Date) => void; }
const StationCard = memo(({ stationCode, data }: { stationCode: string, data: StationSummary[string] }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-orange-300">
        <div className="flex items-center mb-4">
            <div className="bg-red-100 p-2 rounded-lg mr-4"><BuildingIcon className="h-6 w-6 text-red-700" /></div>
            <div>
                <p className="font-bold text-lg text-gray-800">{stationCode}</p>
                <p className="text-sm text-gray-500">{data.total.toLocaleString('id-ID')} Transaksi</p>
            </div>
        </div>
        <div className="border-t border-gray-100 pt-3 mt-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Rincian per Bank</h4>
            <div className="space-y-2">
                {Object.entries(data.breakdown).map(([cardType, count]) => (
                    <div key={cardType} className="flex justify-between items-center text-sm">
                        <div className="flex items-center"><CreditCardIcon className="h-4 w-4 text-gray-400 mr-2" /><span className="text-gray-600">{cardType}</span></div>
                        <span className="font-semibold text-gray-800">{count.toLocaleString('id-ID')}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
));

export const StationTrafficStatus = ({ summary, totalTransactions, percentageChange, isLoading, error, startDate, endDate, onStartDateChange, onEndDateChange }: StationTrafficStatusProps) => {
    
    // Siapkan data untuk highlight cards
    const sortedStations = Object.entries(summary)
        .sort(([, a], [, b]) => b.total - a.total);

    const busiestStation = sortedStations.length > 0 ? { name: sortedStations[0][0], data: sortedStations[0][1] } : null;
    const quietestStation = sortedStations.length > 0 ? { name: sortedStations[sortedStations.length - 1][0], data: sortedStations[sortedStations.length - 1][1] } : null;
    const HighlightCard = ({ title, station, value, icon: Icon, colorClass }) => (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-500">{title}</p>
                    <Icon className={`h-6 w-6 ${colorClass}`} />
                </div>
                <p className="text-2xl font-bold text-gray-800">{station}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-4">{value.toLocaleString('id-ID')}
                <span className="text-base font-medium text-gray-500 ml-2">transaksi</span>
            </p>
        </div>
    );

    return (
        <div className="bg-gray-100/50 rounded-lg p-6 font-sans min-h-[400px] col-span-full">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h3 className="text-xl font-bold text-gray-800">Ringkasan Traffic Stasiun</h3>
                <div className="flex items-center gap-2 text-sm">
                     <input type="date" value={formatDate(startDate)} onChange={e => onStartDateChange(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                     <span className="text-gray-500">-</span>
                     <input type="date" value={formatDate(endDate)} onChange={e => onEndDateChange(new Date(e.target.value))} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
                </div>
            </div>
            
            {isLoading ? ( <div className="flex items-center justify-center h-[300px]"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div> ) 
            : error ? ( <div className="flex items-center justify-center h-[300px] text-center text-red-700 p-4 bg-red-50 rounded-lg">{error}</div> ) 
            : (
                <>
                    {/* --- BAGIAN 1: Highlight Grid 3 Kolom --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Kolom 1: Total Transaksi */}
                        <div className="bg-gradient-to-br from-red-600 to-orange-500 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-medium text-red-200">Total Transaksi</p>
                                <p className="text-5xl font-bold mt-2">{totalTransactions.toLocaleString('id-ID')}</p>
                            </div>
                            {percentageChange !== null && (
                                <div className={`flex items-center gap-1 mt-4 text-sm font-semibold`}>
                                    {percentageChange >= 0 ? 
                                        <ArrowUp className="h-4 w-4 bg-white/20 text-green-300 rounded-full p-0.5" /> : 
                                        <ArrowDown className="h-4 w-4 bg-white/20 text-white rounded-full p-0.5" />
                                    }
                                    <span className={percentageChange >= 0 ? 'text-green-300' : 'text-white'}>{Math.abs(percentageChange).toFixed(1)}% vs kemarin</span>
                                </div>
                            )}
                        </div>

                        {/* Kolom 2: Stasiun Tersibuk */}
                        {busiestStation && (
                            <HighlightCard
                                title="Stasiun Tersibuk"
                                station={busiestStation.name}
                                value={busiestStation.data.total}
                                icon={Crown}
                                colorClass="text-amber-500"
                            />
                        )}

                        {/* Kolom 3: Stasiun Tersepi */}
                        {quietestStation && busiestStation?.name !== quietestStation.name && (
                            <HighlightCard
                                title="Stasiun Tersepi"
                                station={quietestStation.name}
                                value={quietestStation.data.total}
                                icon={TrendingDown}
                                colorClass="text-blue-500"
                            />
                        )}
                    </div>

                    {/* --- BAGIAN 2: Rincian Semua Stasiun --- */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Rincian Semua Stasiun</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedStations.length > 0 ? sortedStations.map(([stationCode, stationData]) => (
                                <StationCard key={stationCode} stationCode={stationCode} data={stationData} />
                            )) : <p className="col-span-full text-center text-gray-500 py-10">Tidak ada data untuk rentang tanggal yang dipilih.</p>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};