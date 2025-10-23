import { useEffect, useState, useRef, useCallback, memo } from "react";

// --- SVG Icons (No changes needed here) ---
const Loader2 = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);
const BuildingIcon = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 22h16"/><path d="M4 18h16"/><path d="M4 14h16"/><path d="M4 10h16"/><path d="M4 6h16"/><path d="M12 2v20"/></svg>);
const CreditCardIcon = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);
const ArrowUp = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>);
const ArrowDown = ({ className }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>);

// --- Utility & Interfaces ---
const formatDate = (date: Date): string => date.toISOString().split("T")[0];
interface TrafficData { station_code_var: string; card_type_var: string; }
interface TrafficApiResponse { code: number; data?: { rows: TrafficData[]; total: number; }; message?: string; }
interface LoginApiResponse { code: number; message: string; data?: { token: string; }; }
interface StationSummary { [stationCode: string]: { total: number; breakdown: { [cardType: string]: number }; }; }

// --- Memoized Child Component for Optimization ---
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

// --- Main Component ---
export const StationTrafficStatus = () => {
  const [summary, setSummary] = useState<StationSummary>({});
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [percentageChange, setPercentageChange] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));

  const performLogin = useCallback(async (): Promise<string> => {
      console.log("Attempting to log in...");
      const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/login/doLogin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rqid: "456QWsad123QefasTY", username: "202020", password: "de88f321991be4f8e56a27aba3adc2aa", type: "web" })
      });
      if (!response.ok) throw new Error(`Login failed: ${response.status}`);
      const result: LoginApiResponse = await response.json();
      if (result.code === 0 && result.data?.token) {
          console.log("Login successful.");
          return result.data.token;
      }
      throw new Error(result.message || "Login failed: No token returned.");
  }, []);

  const fetchTrafficData = useCallback(async (start: string, end: string, currentToken: string): Promise<TrafficApiResponse['data'] | null> => {
      try {
        const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/transaction/list_gate_out_prepaid_trx", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
            body: JSON.stringify({
                rqid: "456QWsad123QefasTY", order: "DESC", start_date: start, end_date: end,
                rows: "100000", sort: "gate_out_on_dtm", page: "1", card_type: "", status_trx: "", card_number: "",
                station_code: "", terminal_in: "", terminal_out: "", concession_type: ""
            })
        });
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.includes("application/json")) {
            throw new Error("Token may have expired.");
        }
        const result: TrafficApiResponse = await response.json();
        if (result.code === 0 && result.data) return result.data;
        // Handle cases where API returns success but no data (e.g., for past dates)
        if (result.code !== 0 && result.message?.includes("Success list")) return { rows: [], total: 0 };
        throw new Error(result.message || `API Error: Code ${result.code}`);
      } catch (error) {
          console.error(`Failed to fetch data for ${start}-${end}:`, error);
          throw error; // Re-throw to be caught by the main logic
      }
  }, []);

  const summarizeData = (rows: TrafficData[]): StationSummary => {
      return rows.reduce((acc, { station_code_var: station, card_type_var: card }) => {
          if (!acc[station]) acc[station] = { total: 0, breakdown: {} };
          acc[station].total++;
          acc[station].breakdown[card] = (acc[station].breakdown[card] || 0) + 1;
          return acc;
      }, {} as StationSummary);
  };
  
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        if (!isMounted) return;
        setLoading(true);
        setError(null);
        setPercentageChange(null);
        
        try {
            let currentToken = token;
            if (!currentToken) {
                currentToken = await performLogin();
                if (!isMounted) setToken(currentToken);
            }

            // OPTIMIZATION: Run API calls concurrently
            const promises = [fetchTrafficData(startDate, endDate, currentToken)];
            const isToday = startDate === endDate && startDate === formatDate(new Date());
            if (isToday) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                promises.push(fetchTrafficData(formatDate(yesterday), formatDate(yesterday), currentToken));
            }

            const [mainData, yesterdayData] = await Promise.all(promises);

            if (!isMounted) return;
            
            if (mainData) {
                setSummary(summarizeData(mainData.rows));
                setTotalTransactions(mainData.total);
            }

            if (yesterdayData) {
                const yesterdayTotal = yesterdayData.total;
                const todayTotal = mainData?.total ?? 0;
                if (yesterdayTotal > 0) {
                    const change = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
                    setPercentageChange(change);
                } else {
                    setPercentageChange(todayTotal > 0 ? 100 : 0);
                }
            }
        } catch (err) {
            if (isMounted && err instanceof Error) {
                console.error("Fetch cycle error:", err.message);
                setError(err.message);
                if (err.message.includes("Token")) setToken(null); // Trigger re-login on next attempt
            }
        } finally {
            if (isMounted) setLoading(false);
        }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [startDate, endDate, token, performLogin, fetchTrafficData]);

  return (
    <div className="bg-gray-100 rounded-lg p-6 font-sans min-h-[400px] col-span-full lg:col-span-4">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h3 className="text-xl font-bold text-gray-800">Ringkasan Traffic Stasiun</h3>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
          <span className="text-gray-500">-</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"/>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-[300px]"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div>
      ) : error ? (
        <div className="flex items-center justify-center h-[300px] text-center text-red-700 p-4 bg-red-50 rounded-lg">{error}</div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-red-600 to-orange-500 text-white p-6 rounded-xl mb-6 shadow-lg">
            <p className="text-sm font-medium text-red-200">Total Transaksi</p>
            <div className="flex justify-between items-end">
              <p className="text-4xl font-bold mt-2">{totalTransactions.toLocaleString('id-ID')}</p>
              {percentageChange !== null && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold ${percentageChange >= 0 ? 'bg-white/20 text-green-300' : 'bg-white/20 text-white-300'}`}>
                  {percentageChange >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  <span>{Math.abs(percentageChange).toFixed(1)}% vs kemarin</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(summary).length > 0 ? Object.keys(summary).sort().map(stationCode => (
              <StationCard key={stationCode} stationCode={stationCode} data={summary[stationCode]} />
            )) : <p className="col-span-full text-center text-gray-500 py-10">Tidak ada data untuk rentang tanggal yang dipilih.</p>}
          </div>
        </>
      )}
    </div>
  );
};