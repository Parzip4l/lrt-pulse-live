import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Train, AlertTriangle, Clock, Users, Sun, Moon, WifiOff, ArrowUp, ArrowDown,
    CheckCircle, Repeat, Hash, Smile, TrendingUp, Star, Sunrise, Sunset,
    PieChart as PieChartIcon, Target, CalendarDays, BrainCircuit, Instagram,
    Facebook, Twitter, Youtube, Linkedin, Wifi, Cpu, Thermometer, TrainFront, Droplets, Activity, Zap
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, ReferenceLine
} from 'recharts';

// --- SVG Icons ---
const Loader2 = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);

// --- Interfaces ---
interface TrafficData { station_code_var: string; gate_out_on_dtm: string; }
interface ApiResponse<T> { sts: string; data?: T; msg?: string; }
interface TrafficApiResponseData { rows: TrafficData[]; total: number; }
interface LoginApiResponseData { token: string; }
interface StationSummary { [stationCode: string]: { total: number; change?: number }; }
interface ChartData { name: string; passengers: number; date: Date; }
interface SurveyData {
    id: number;
    year: number;
    quarter: number;
    target_value: number;
    achievement_value: number;
    respondent_count: number;
}
interface NewsItem {
    id: number;
    title: string;
    source: string;
    created_at: string;
}
interface SocialGrowth {
    platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin';
    growth_percentage: number;
}

// --- WebSocket Interfaces ---
interface LrvData {
    id: number;
    lng: number;
    lat: number;
    time: string;
}

interface TableData {
    kereta_id: string;
    no_ka: string;
    masinis: string;
    kecepatan: string;
}

interface WebSocketMessage {
    user_id: number;
    type: string;
    message: {
        lrv: LrvData;
        table: TableData;
    };
}

interface ActiveTrain {
    id: number;
    lat: number;
    lng: number;
    no_ka: string;
    masinis: string;
    kecepatan: number;
    last_update: number;
    direction: 'down' | 'up'; // 'down'=PGD->VLD, 'up'=VLD->PGD
}

// --- Utility & Constants ---
const STATION_NAMES = {
    PEG: 'PGD', PGD: 'PGD',
    BOU: 'BU',  BU: 'BU',
    BOS: 'BS',  BS: 'BS',
    PUL: 'PLA', PLA: 'PLA',
    EQS: 'EQS',
    VEL: 'VLD', VLD: 'VLD'
};

const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
};

const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " tahun lalu";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " bulan lalu";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " hari lalu";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " jam lalu";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " menit lalu";
    return "Baru saja";
};

// --- Custom Hook for Data Fetching ---
const useTrafficData = (options) => {
    const { defaultRange, refreshInterval } = options;

    const getTodayCacheKey = () => `traffic-data-today-${formatDate(new Date())}`;

    const loadInitialState = () => {
        const defaultState = { isLoading: true, stationSummary: {}, totalTransactions: 0, percentageChange: null, peakHours: null, yesterdayTotal: 0, chartData: [] };

        if (defaultRange === 'today') {
            try {
                const cacheKey = getTodayCacheKey();
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { data, timestamp } = JSON.parse(cachedItem);
                    const cacheAge = Date.now() - timestamp;
                    if (cacheAge < 2 * 60 * 1000) { 
                        return { ...defaultState, isLoading: false, stationSummary: data.stationSummary, totalTransactions: data.totalTransactions, percentageChange: data.percentageChange, peakHours: data.peakHours, yesterdayTotal: data.yesterdayTotal || 0 };
                    }
                }
            } catch (e) { localStorage.removeItem(getTodayCacheKey()); }
        }
        else if (defaultRange === 'month') {
            const tempStartDate = new Date(); tempStartDate.setDate(1);
            const cacheKey = `traffic-data-${formatDate(tempStartDate).substring(0, 7)}`;
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { total } = JSON.parse(cachedItem);
                    return { ...defaultState, isLoading: false, totalTransactions: total };
                }
            } catch (e) { localStorage.removeItem(cacheKey); }
        }
        else if (defaultRange === 'week') {
            const tempStartDate = new Date(); tempStartDate.setDate(tempStartDate.getDate() - 6);
            const [year, week] = getWeekNumber(tempStartDate);
            const cacheKey = `traffic-data-week-${year}-${week}`;
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { chartData: cachedChartData } = JSON.parse(cachedItem);
                    return { ...defaultState, isLoading: false, chartData: cachedChartData.map(d => ({...d, date: new Date(d.date)})) };
                }
            } catch (e) { localStorage.removeItem(cacheKey); }
        }
        return defaultState;
    };

    const initialState = loadInitialState();

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        if (defaultRange === 'week') date.setDate(date.getDate() - 6);
        else if (defaultRange === 'month') date.setDate(1);
        else if (defaultRange === 'previous-month') { date.setDate(1); date.setMonth(date.getMonth() - 1); }
        return date;
    });
    
    const [endDate, setEndDate] = useState(() => {
        if (defaultRange === 'previous-month') {
            const date = new Date(); date.setDate(1); date.setDate(date.getDate() - 1);
            return date;
        }
        return new Date();
    });

    const [token, setToken] = useState<string | null>(null);
    const tokenRef = useRef<string | null>(null);

    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    const [isLoading, setIsLoading] = useState(initialState.isLoading); 
    const [error, setError] = useState<string | null>(null);

    const [chartData, setChartData] = useState<ChartData[]>(initialState.chartData);
    const [stationSummary, setStationSummary] = useState<StationSummary>(initialState.stationSummary);
    const [totalTransactions, setTotalTransactions] = useState(initialState.totalTransactions); 
    const [percentageChange, setPercentageChange] = useState<number | null>(initialState.percentageChange);
    const [peakHours, setPeakHours] = useState<{ busiest: number, quietest: number } | null>(initialState.peakHours);
    const [yesterdayTotal, setYesterdayTotal] = useState(initialState.yesterdayTotal);

    const performLogin = useCallback(async () => {
        try {
            const response = await fetch("/api/index.php/login/doLogin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rqid: "456QWsad123QefasTY",
                    username: "202020",
                    password: "de88f321991be4f8e56a27aba3adc2aa",
                    type: "web"
                })
            });

            if (!response.ok) throw new Error(`Login failed: ${response.status}`);
            const result = await response.json();

            if (result.code === 0 || result.sts === "S") {
                const newToken = result.data?.token || result.token || result.data?.access_token;
                if (newToken) return newToken;
            }
            throw new Error(result.message || "Login failed: No token");
        } catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    }, []);

    const fetchTrafficData = useCallback(async (start, end, currentToken) => {
        try {
            const response = await fetch("/api/index.php/transaction/list_gate_out_prepaid_trx", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                    rqid: "456QWsad123QefasTY",
                    order: "DESC",
                    start_date: start,
                    end_date: end,
                    rows: "100000",
                    sort: "gate_out_on_dtm",
                    page: "1",
                    status_trx: "S",
                    card_number: "", station_code: "", terminal_in: "", terminal_out: "", card_type: ""
                })
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const result = await response.json();

            if (result.msg && (result.msg.includes("Token") || result.msg.includes("Unauthorized"))) {
                throw new Error("Token Expired/Invalid");
            }

            if ((result.code === 0 || result.sts === "S") && result.data) return result.data;
            if (result.msg?.includes("Success")) return { rows: [], total: 0 };
            throw new Error(result.message || result.msg || `API Error: code ${result.code}`);
        } catch (err) {
            throw err;
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async (isInitialLoad = false) => {
            if (!isMounted) return;

            if (defaultRange === 'month' || defaultRange === 'previous-month') { 
                const cacheKey = `traffic-data-${formatDate(startDate).substring(0, 7)}`;
                try {
                    const cachedItem = localStorage.getItem(cacheKey);
                    if (cachedItem) {
                        const { total, timestamp } = JSON.parse(cachedItem);
                        const isCurrentMonth = startDate.getMonth() === new Date().getMonth();
                        const expiryDuration = isCurrentMonth ? 60 * 60 * 1000 : Infinity;
                        if ((Date.now() - timestamp) < expiryDuration) {
                            if (isMounted) { setTotalTransactions(total); setIsLoading(false); }
                            return;
                        }
                    }
                } catch (e) {}
            } else if (defaultRange === 'week') {
                const [year, week] = getWeekNumber(startDate);
                const cacheKey = `traffic-data-week-${year}-${week}`;
                try {
                    const cachedItem = localStorage.getItem(cacheKey);
                    if (cachedItem) {
                        const { chartData: cachedChartData, timestamp } = JSON.parse(cachedItem);
                        const [curYear, curWeek] = getWeekNumber(new Date());
                        const isCurrentWeek = year === curYear && week === curWeek;
                        const expiryDuration = isCurrentWeek ? 60 * 60 * 1000 : Infinity;
                        if ((Date.now() - timestamp) < expiryDuration) {
                            if (isMounted) { 
                                setChartData(cachedChartData.map(d => ({...d, date: new Date(d.date)}))); 
                                setIsLoading(false); 
                            }
                            return;
                        }
                    }
                } catch (e) {}
            }

            if (defaultRange === 'today') setPercentageChange(null);

            try {
                let currentToken = tokenRef.current;
                
                if (!currentToken) {
                    try {
                        currentToken = await performLogin();
                        if (isMounted) {
                            setToken(currentToken);
                            tokenRef.current = currentToken;
                            setError(null);
                        }
                    } catch (loginErr) {
                        throw loginErr;
                    }
                }

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const [mainData, yesterdayData] = await Promise.all([
                    fetchTrafficData(formatDate(startDate), formatDate(endDate), currentToken),
                    (defaultRange === 'today' || defaultRange === 'week') ? fetchTrafficData(formatDate(yesterday), formatDate(yesterday), currentToken) : Promise.resolve(null)
                ]);

                if (!mainData || !isMounted) return;

                setError(null); 

                const dailyTotals = {};
                const summary = {};
                const yesterdaySummary = {};
                const now = new Date();

                (mainData.rows || []).forEach(row => {
                    const day = row.gate_out_on_dtm.substring(0, 10);
                    const station = row.station_code_var;
                    if (!dailyTotals[day]) dailyTotals[day] = { total: 0 };
                    dailyTotals[day].total++;
                    if (!summary[station]) summary[station] = { total: 0 };
                    summary[station].total++;
                });

                let currentPeakHours = null;
                if (defaultRange === 'today') {
                    const hourlyCounts = Array(24).fill(0);
                    (mainData.rows || []).forEach(row => {
                        try {
                            const hour = new Date(row.gate_out_on_dtm).getHours();
                            if (!isNaN(hour)) hourlyCounts[hour]++;
                        } catch (e) {}
                    });
                    const maxCount = Math.max(...hourlyCounts);
                    if (maxCount > 0) {
                        const busiestHour = hourlyCounts.indexOf(maxCount);
                        const nonZeroCounts = hourlyCounts.map((count, hour) => ({ count, hour })).filter(item => item.count > 0);
                        let quietestHour = -1;
                        if (nonZeroCounts.length > 0) {
                            const minCount = Math.min(...nonZeroCounts.map(item => item.count));
                            quietestHour = nonZeroCounts.find(item => item.count === minCount)?.hour || -1;
                        }
                        currentPeakHours = { busiest: busiestHour, quietest: quietestHour };
                        if (isMounted) setPeakHours(currentPeakHours);
                    } else if (isMounted) setPeakHours(null);
                }

                let yesterdayFullTotal = 0;
                if (yesterdayData) {
                    yesterdayFullTotal = yesterdayData.total;
                    if (isMounted) setYesterdayTotal(yesterdayFullTotal);

                    const yesterdayRowsUntilNow = (defaultRange === 'today')
                        ? (yesterdayData.rows || []).filter(row => new Date(row.gate_out_on_dtm) <= now)
                        : (yesterdayData.rows || []);

                    yesterdayRowsUntilNow.forEach(row => {
                        const station = row.station_code_var;
                        if (!yesterdaySummary[station]) yesterdaySummary[station] = { total: 0 };
                        yesterdaySummary[station].total++;
                    });

                    Object.keys(summary).forEach(station => {
                        const todayTotal = summary[station].total;
                        const yesterdayTotal = yesterdaySummary[station]?.total || 0;
                        if (yesterdayTotal > 0) {
                            summary[station].change = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
                        } else {
                            summary[station].change = todayTotal > 0 ? 100 : 0;
                        }
                    });
                }

                let chartDataResult: ChartData[] = [];
                if (defaultRange === 'week') {
                    const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
                    chartDataResult = Array.from({ length: diffDays }, (_, i) => {
                        const date = new Date(startDate);
                        date.setDate(date.getDate() + i);
                        const dayStr = formatDate(date);
                        return {
                            name: date.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' }),
                            passengers: dailyTotals[dayStr]?.total || 0,
                            date: date
                        };
                    });
                    setChartData(chartDataResult);
                }

                if (isMounted) {
                    setStationSummary(summary);
                    setTotalTransactions(mainData.total);
                }

                let currentPercentageChange = null;
                if (defaultRange === 'today' && yesterdayData) {
                    const yesterdayTotalUntilNow = (yesterdayData.rows || []).filter(row => new Date(row.gate_out_on_dtm) <= now).length;
                    const todayTotal = mainData.total;
                    if (yesterdayTotalUntilNow > 0) {
                        currentPercentageChange = ((todayTotal - yesterdayTotalUntilNow) / yesterdayTotalUntilNow) * 100;
                        if (isMounted) setPercentageChange(currentPercentageChange);
                    } else {
                        currentPercentageChange = todayTotal > 0 ? 100 : 0;
                        if (isMounted) setPercentageChange(currentPercentageChange);
                    }
                }

                if (defaultRange === 'month' || defaultRange === 'previous-month') {
                    const cacheKey = `traffic-data-${formatDate(startDate).substring(0, 7)}`;
                    try { localStorage.setItem(cacheKey, JSON.stringify({ total: mainData.total, timestamp: Date.now() })); } catch(e) {}
                }
                if (defaultRange === 'week') {
                    const [year, week] = getWeekNumber(startDate);
                    const cacheKey = `traffic-data-week-${year}-${week}`;
                    try { localStorage.setItem(cacheKey, JSON.stringify({ chartData: chartDataResult, timestamp: Date.now() })); } catch(e) {}
                }
                if (defaultRange === 'today') {
                    const cacheKey = getTodayCacheKey();
                    try {
                        const itemToCache = {
                            data: {
                                stationSummary: summary,
                                totalTransactions: mainData.total,
                                percentageChange: currentPercentageChange,
                                peakHours: currentPeakHours,
                                yesterdayTotal: yesterdayFullTotal,
                            },
                            timestamp: Date.now()
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
                    } catch (e) {}
                }

            } catch (err) {
                if (isMounted && err instanceof Error) {
                    setError(err.message); 
                    if (err.message.includes("Token") || err.message.includes("401") || err.message.includes("Unauthorized")) {
                        setToken(null);
                        tokenRef.current = null;
                    }
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData(true);

        if (refreshInterval) {
            const intervalId = setInterval(() => fetchData(false), refreshInterval);
            return () => {
                isMounted = false;
                clearInterval(intervalId);
            };
        }

        return () => { isMounted = false; };
    }, [startDate, endDate, performLogin, fetchTrafficData, defaultRange, refreshInterval]); 

    return { isLoading, error, chartData, stationSummary, totalTransactions, percentageChange, peakHours, yesterdayTotal };
};

// --- Components ---
const SocialSentimentCard = ({ isLight }) => {
    const sentimentData = { positive: 1250, neutral: 800, negative: 150 };
    const totalMentions = sentimentData.positive + sentimentData.neutral + sentimentData.negative;
    const sentiments = [
        { name: 'Positif', percent: (sentimentData.positive / totalMentions) * 100, emoji: '😊' },
        { name: 'Netral', percent: (sentimentData.neutral / totalMentions) * 100, emoji: '😐' },
        { name: 'Negatif', percent: (sentimentData.negative / totalMentions) * 100, emoji: '😠' },
    ];

    return (
        <div className={`relative rounded-lg p-3 flex-shrink-0 transition-colors h-100 flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Sentimen Media Sosial</h2>
            <div className="flex-1 flex items-center justify-center blur-sm">
                <div className="grid grid-cols-3 gap-4 text-center w-full">
                    {sentiments.map(sentiment => (
                        <div key={sentiment.name} className="flex flex-col items-center">
                            <span className="text-1xl mb-1">{sentiment.emoji}</span>
                            <span className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{sentiment.percent.toFixed(1)}%</span>
                            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{sentiment.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                <Target className={`h-5 w-5 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Sentimen Media Sosial</h3>
                <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>COMING SOON</span>
            </div>
        </div>
    );
};

const useSurveyData = () => {
    const [surveyData, setSurveyData] = useState<SurveyData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchSurveyData = async () => {
            try {
                const response = await fetch('https://ysrnueiftdhawiofuvxz.supabase.co/functions/v1/surveys-api/api/surveys');
                if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);
                const result = await response.json();
                if (isMounted) {
                    if (result.data) setSurveyData(result.data);
                    else throw new Error('Data survei tidak ditemukan');
                }
            } catch (err) {
                if (isMounted) setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchSurveyData();
        const intervalId = setInterval(fetchSurveyData, 15000);
        return () => { isMounted = false; clearInterval(intervalId); };
    }, []);
    return { surveyData, isLoading, error };
};

const usePerformanceData = (type: 'OTP' | 'SPM') => {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPerformanceData = async () => {
            try {
                const VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzcm51ZWlmdGRoYXdpb2Z1dnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTIzMDEsImV4cCI6MjA3NjI2ODMwMX0.v8qIGTwvOcJ9cLw1GBzcw0g95nSyGVe-n5ISPc-yCFg";
                const response = await fetch(`https://ysrnueiftdhawiofuvxz.supabase.co/functions/v1/metrics-api/api/metrics?type=${type}`, {
                    headers: { 'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}` }
                });

                if (!response.ok) throw new Error(`API request failed for ${type}`);
                const result = await response.json();

                if (isMounted && result.data) {
                    const currentYear = new Date().getFullYear();
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
                    const processedData = result.data
                        .filter(item => item.year === currentYear)
                        .map(item => ({
                            month: monthNames[item.month - 1],
                            value: item.achieved_value,
                            target: item.target_value,
                            monthIndex: item.month 
                        }))
                        .sort((a, b) => a.monthIndex - b.monthIndex);
                    setData(processedData);
                    setError(null); 
                }
            } catch (err) {
                if (isMounted) setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchPerformanceData();
        const intervalId = setInterval(fetchPerformanceData, 15000);
        return () => { isMounted = false; clearInterval(intervalId); };
    }, [type]); 
    return { data, isLoading, error };
};

const useNewsData = () => {
    const [newsData, setNewsData] = useState<NewsItem[]>([]);
    useEffect(() => {
        setNewsData([
            { id: 1, title: 'LRT Jakarta Tambah 5 Rangkaian Kereta Baru', source: 'Kompas.com', created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString() },
            { id: 2, title: 'Integrasi Tiket JakLingko Capai 90%', source: 'Detik.com', created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString() },
            { id: 3, title: 'Jam Operasional Diperpanjang Selama Akhir Pekan', source: 'CNN Indonesia', created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString() },
            { id: 4, title: 'Uji Coba Pembayaran QRIS di Semua Stasiun', source: 'BeritaSatu', created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString() },
            { id: 5, title: 'Pembangunan Fase 1B Velodrome-Manggarai Dimulai', source: 'Antara News', created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString() },
        ]);
    }, []);
    return { newsData, isLoading: false, error: null };
};

const useSocialMediaData = () => {
    const [socialData, setSocialData] = useState<SocialGrowth[]>([]);
    useEffect(() => {
        setSocialData([
            { platform: 'instagram', growth_percentage: 12.5 },
            { platform: 'facebook', growth_percentage: 3.2 },
            { platform: 'twitter', growth_percentage: -1.1 },
        ]);
    }, []);
    return { socialData, isLoading: false, error: null };
};

const PieChartCard = ({ data, isLight }) => {
    const chartData = [{ name: 'Capaian', value: data.value }, { name: 'Sisa', value: 100 - data.value }];
    const colors = ['#d3242b', isLight ? '#e5e7eb' : '#374151'];
    return (
        <div className="flex flex-col items-center text-center">
            <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} dataKey="value" innerRadius={0} outerRadius="80%" startAngle={90} endAngle={-270} paddingAngle={0}>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index]} stroke={colors[index]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <span className={`font-bold mt-2 text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>{data.value > 0 ? `${data.value.toFixed(2)}%` : '0.00%'}</span>
            <div className={`text-xs font-semibold mt-1 rounded-full px-2 py-0.5 inline-block ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300'}`}>{data.name}</div>
        </div>
    );
};

const CustomerSatisfactionChart = ({ isLight }) => {
    const { surveyData, isLoading, error } = useSurveyData();
    const { lineData, pieData, currentYear } = useMemo(() => {
        if (!surveyData || surveyData.length === 0) return { lineData: [], pieData: [], currentYear: new Date().getFullYear() };
        const yearlyData = surveyData.reduce((acc, curr) => {
            if (!acc[curr.year]) acc[curr.year] = { year: curr.year, totalAchievement: 0, totalTarget: 0, count: 0 };
            acc[curr.year].totalAchievement += curr.achievement_value;
            acc[curr.year].totalTarget += curr.target_value;
            acc[curr.year].count++;
            return acc;
        }, {});
        const processedLineData = Object.values(yearlyData).map(y => ({
            name: y.year.toString(),
            Capaian: parseFloat((y.totalAchievement / y.count).toFixed(2)),
            Target: parseFloat((y.totalTarget / y.count).toFixed(2)),
        })).sort((a, b) => parseInt(a.name) - parseInt(b.name));
        const latestYear = Math.max(...surveyData.map(d => d.year));
        const currentYearData = surveyData.filter(d => d.year === latestYear).sort((a, b) => a.quarter - b.quarter);
        const processedPieData = currentYearData.map(q => ({ name: `TW-${q.quarter}`, value: q.achievement_value, respondents: q.respondent_count }));
        return { lineData: processedLineData, pieData: processedPieData, currentYear: latestYear };
    }, [surveyData]);

    const pieGridClass = useMemo(() => {
        const length = pieData.length;
        if (length === 3) return 'grid-cols-3';
        if (length === 4) return 'grid-cols-4';
        if (length === 2) return 'grid-cols-2';
        return 'grid-cols-1';
    }, [pieData.length]);

    if (isLoading) return <div className={`flex-1 rounded-lg p-3 flex items-center justify-center transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}><Loader2 className={`h-8 w-8 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
    
    const totalScore = pieData.reduce((acc, curr) => acc + (curr.value || 0), 0);
    const averageScore = pieData.length > 0 ? (totalScore / pieData.length).toFixed(1) : 0;

    return (
        <div className={`flex-1 rounded-lg p-3 flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <div className={`flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2`}>
                {/* --- LEFT COLUMN (Line Chart) --- */}
                <div className="flex flex-col">
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Annual Satisfaction Record</h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#334155'} />
                                <XAxis dataKey="name" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} />
                                <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} />
                                <Tooltip contentStyle={{ backgroundColor: isLight ? 'white' : '#0f172a', border: '1px solid #a16207', borderRadius: '6px', fontSize: '12px' }} />
                                <Legend wrapperStyle={{ fontSize: "12px" }} />
                                <Line type="monotone" dataKey="Capaian" stroke="#a16207" strokeWidth={2} />
                                <Line type="monotone" dataKey="Target" stroke="#D3242B" strokeWidth={2} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* --- RIGHT COLUMN (Quarterly Pie Charts + Average) --- */}
                <div className="flex flex-col justify-center">
                    <h3 className={`text-sm font-bold text-center mb-4 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Quarterly Achievement - {currentYear}</h3>
                    
                    {/* Grid Chart */}
                    <div className={`grid ${pieGridClass} gap-2`}>
                        {pieData.map(d => <PieChartCard key={d.name} data={d} isLight={isLight} />)}
                    </div>

                    {/* --- BAGIAN BARU: RATA-RATA --- */}
                    <div className={`mt-4 flex flex-col items-center justify-center p-3 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-700'}`}>
                        <span className={`text-xs font-medium uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            Rata-rata Q1 - Q4
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className={`text-2xl font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                {averageScore}%
                            </span>
                            {/* Opsional: Indikator kecil jika diperlukan */}
                            <span className="text-xs text-slate-500">achievement</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClosingRateChart = ({ isLight }) => {
    const donutData = [{ name: 'Prasarana', value: 296, color: '#64748b' }, { name: 'IT', value: 81, color: '#D3242B' }, { name: 'Sarana', value: 8, color: '#a16207' }];
    const total = donutData.reduce((sum, entry) => sum + entry.value, 0);
    const barData = [{ name: 'Prasarana', 'Closing Rate': 83.1 }, { name: 'Sarana', 'Closing Rate': 100.0 }, { name: 'IT', 'Closing Rate': 91.4 }];
    return (
        <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-1 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Closing Rate Divisi</h2>
            <div className="flex-1 flex items-center">
                <div className="w-1/2 relative">
                    <ResponsiveContainer width="100%" height={95}>
                        <PieChart>
                            <Pie data={donutData} dataKey="value" innerRadius="60%" outerRadius="80%" startAngle={90} endAngle={-270}>
                                {donutData.map((entry) => <Cell key={entry.name} fill={entry.color} stroke={entry.color} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-1xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{total}</span>
                        <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Isu</span>
                    </div>
                </div>
                <div className="w-1/2 space-y-1 text-xs px-2">
                    {donutData.map(entry => (
                        <div key={entry.name} className="flex items-center justify-between">
                            <div className="flex items-center"><span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }}></span><span className={isLight ? 'text-slate-600' : 'text-slate-300'}>{entry.name} ({entry.value})</span></div>
                            <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{barData.find(b => b.name === entry.name)['Closing Rate']}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TrainMonitoringSlider = ({ isLight }) => {
    const [trains, setTrains] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        const trainIds = ['22', '19']; 
        const BASE_URL = '/api-proxy'; 
        try {
            const requests = trainIds.map(id => fetch(`${BASE_URL}/monitoring/summary?train_id=${id}`).then(res => { if (!res.ok) throw new Error("Gagal"); return res.json(); }));
            const responses = await Promise.all(requests);
            if (responses && responses.length > 0) { setTrains(responses); setLoading(false); }
        } catch (error) {
            const mockData = [
                { "train_id": "22", "summary": { "temperature": "25", "humidity": "81.5", "noise": "36.5", "devices": 2, "alerts": 0, "connectivity": 85 } },
                { "train_id": "19", "summary": { "temperature": "23.5", "humidity": "78.2", "noise": "42.0", "devices": 2, "alerts": 3, "connectivity": 45 } }
            ];
            setTrains(mockData); setLoading(false);
        }
    };

    useEffect(() => { fetchData(); const dataInterval = setInterval(fetchData, 30000); return () => clearInterval(dataInterval); }, []);
    useEffect(() => { if (trains.length <= 1) return; const sliderInterval = setInterval(() => { setCurrentIndex((prevIndex) => (prevIndex + 1) % trains.length); }, 10000); return () => clearInterval(sliderInterval); }, [trains]);

    const getConnColor = (val) => { if (val >= 80) return 'text-emerald-500'; if (val >= 50) return 'text-yellow-500'; return 'text-red-500'; };
    if (loading) return <div className="p-4 text-xs text-center animate-pulse">Loading Train Data...</div>;
    if (trains.length === 0) return null;

    const currentTrain = trains[currentIndex];
    const { summary } = currentTrain;
    const labelTrain = (id) => ({ "22": "LRV - 7", "19": "LRV - 4" }[id] ?? `TS-${id}`);

    return (
        <div className={`rounded-lg p-3 shadow-sm transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <div className="flex justify-between items-center border-b pb-2 mb-2 border-dashed border-slate-700/50">
                <h2 className={`text-xs font-bold uppercase flex items-center gap-2 ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`}><TrainFront size={14} /> Train Sensor Monitoring | {labelTrain(currentTrain.train_id)}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-2"><div className={`p-1.5 rounded-md ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-slate-800 text-blue-400'}`}><Thermometer size={14} /></div><div className="flex flex-col"><span className={`text-sm font-bold leading-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{summary.temperature}°C</span><span className="text-[9px] text-slate-500 uppercase">Temp</span></div></div>
                <div className="flex items-center gap-2"><div className={`p-1.5 rounded-md ${isLight ? 'bg-cyan-50 text-cyan-500' : 'bg-slate-800 text-cyan-400'}`}><Droplets size={14} /></div><div className="flex flex-col"><span className={`text-sm font-bold leading-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{summary.humidity}%</span><span className="text-[9px] text-slate-500 uppercase">Humid</span></div></div>
                <div className="flex items-center gap-2"><div className={`p-1.5 rounded-md ${isLight ? 'bg-purple-50 text-purple-500' : 'bg-slate-800 text-purple-400'}`}><Activity size={14} /></div><div className="flex flex-col"><span className={`text-sm font-bold leading-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{summary.noise} dB</span><span className="text-[9px] text-slate-500 uppercase">Noise</span></div></div>
                <div className="flex items-center gap-2"><div className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100' : 'bg-slate-800'} ${getConnColor(summary.connectivity)}`}><Wifi size={14} /></div><div className="flex flex-col w-full pr-2"><span className={`text-sm font-bold leading-none ${getConnColor(summary.connectivity)}`}>{summary.connectivity}%</span><div className="w-full bg-slate-200 dark:bg-slate-700 h-0.5 mt-1 rounded-full"><div className={`h-full rounded-full ${summary.connectivity >= 80 ? 'bg-emerald-500' : summary.connectivity >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${summary.connectivity}%` }}></div></div></div></div>
            </div>
            <div className={`mt-auto pt-2 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'} flex justify-between`}>
                 <div className="flex items-center gap-1.5"><Cpu size={12} className="text-slate-400"/><span className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Devices: <b className={isLight ? 'text-slate-800' : 'text-white'}>{summary.devices}</b></span></div>
                 <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${summary.alerts > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}><AlertTriangle size={12} /><span className="text-[10px] font-bold">{summary.alerts} Alerts</span></div>
            </div>
            <div className="absolute top-3 right-3 flex gap-1">{trains.map((_, idx) => (<div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-[#F6821F]' : 'w-1 bg-slate-600'}`}/>))}</div>
        </div>
    );
};

const CombinedPerformanceCard = ({ isLight, otpData, spmData }) => {
    const [visibleChart, setVisibleChart] = useState('OTP');
    useEffect(() => { const timer = setInterval(() => { setVisibleChart(prev => (prev === 'OTP' ? 'SPM' : 'OTP')); }, 5000); return () => clearInterval(timer); }, []);

    const chartConfig = {
        OTP: { title: 'Ketepatan Waktu (OTP)', color: '#a16207', ...otpData },
        SPM: { title: 'Capaian SPM', color: '#F6821F', ...spmData },
    };
    const { title, color, data, isLoading, error } = chartConfig[visibleChart];

    const renderContent = () => {
        if (isLoading) return <div className="flex flex-1 justify-center items-center min-h-[150px]"><Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
        if (error) return <div className="flex flex-1 flex-col justify-center items-center text-center min-h-[150px]"><AlertTriangle className="h-5 w-5 text-red-500 mb-1" /><h3 className="text-xs font-bold">Gagal Memuat</h3><p className="text-xs">{title}</p></div>;
        if (!data || data.length === 0) return <div className="flex flex-1 flex-col justify-center items-center text-center min-h-[150px]"><PieChartIcon className="h-5 w-5 text-slate-400 mb-1" /><p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Data {title} tidak tersedia.</p></div>;

        const average = data.reduce((sum, item) => sum + item.value, 0) / data.length;
        return (
            <div className="flex-1 flex flex-col">
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: -5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'transparent' : 'rgba(255,255,255,0.1)'} />
                            <XAxis dataKey="month" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} axisLine={false} tickLine={false} />
                            <YAxis domain={['dataMin - 2', 100]} stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value)}%`} />
                            <Tooltip cursor={{ fill: isLight ? '#f8fafc' : '#1e293b' }} contentStyle={{ backgroundColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', border: `1px solid ${color}`, borderRadius: '8px', fontSize: '12px' }} formatter={(value) => [`${value}%`, "Capaian"]} />
                            <Bar dataKey="value" fill={color} barSize={12} radius={[4, 4, 4, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className={`text-center text-xs mt-1 pt-1 border-t ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>Rata-rata {data.length} bulan: <span className="font-bold">{average.toFixed(2)}%</span></div>
            </div>
        );
    };

    return (
        <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>{title}</h2>
            <div key={visibleChart} className="animate-fade-in flex-1 flex flex-col">{renderContent()}</div>
            <div className="flex justify-center space-x-1.5 mt-2">{['OTP', 'SPM'].map((chartName) => (<div key={chartName} className={`w-2 h-2 rounded-full transition-all ${chartName === visibleChart ? (isLight ? 'bg-[#D3242B]' : 'bg-[#F6821F]') : (isLight ? 'bg-slate-300' : 'bg-slate-700')}`}></div>))}</div>
        </div>
    );
};

const PassengerInsights = ({ isLight, weeklyData }) => {
    if (!weeklyData || weeklyData.length === 0) return <div className={`rounded-lg p-3 h-full flex items-center justify-center text-sm ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>Data tidak cukup untuk analisis.</div>;
    const weekdays = weeklyData.filter(d => d.date.getDay() >= 1 && d.date.getDay() <= 5);
    const weekends = weeklyData.filter(d => d.date.getDay() === 0 || d.date.getDay() === 6);
    const avgWeekday = weekdays.length > 0 ? weekdays.reduce((sum, d) => sum + d.passengers, 0) / weekdays.length : 0;
    const avgWeekend = weekends.length > 0 ? weekends.reduce((sum, d) => sum + d.passengers, 0) / weekends.length : 0;
    
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const completedDaysData = weeklyData.filter(d => d.date.getTime() < today.getTime());
    const lastThreeCompletedDays = completedDaysData.slice(-3);
    const forecast = lastThreeCompletedDays.length > 0 ? (lastThreeCompletedDays.reduce((sum, d) => sum + d.passengers, 0) / lastThreeCompletedDays.length) : 0;

    return (
        <div className={`rounded-lg p-3 flex-shrink-0 transition-colors h-full flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Passenger Analysis & Projection</h2>
            <div className="flex-1 grid grid-rows-2 gap-3">
                <div className="flex flex-col">
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Weekday vs Weekend Comparison</h3>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                        <div><div className={`text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Average Weekday</div><div className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.round(avgWeekday).toLocaleString('id-ID')}</div><div className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>({weekdays.length} Day)</div></div>
                        <div><div className={`text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Average Weekend</div><div className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.round(avgWeekend).toLocaleString('id-ID')}</div><div className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>({weekends.length} Day)</div></div>
                    </div>
                </div>
                <div className={`flex flex-col items-center justify-center rounded-lg p-2 ${isLight ? 'bg-slate-50' : 'bg-slate-800/50'}`}>
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Projected Passengers Tomorrow</h3>
                    <div className="text-center"><div className="flex items-center justify-center gap-2"><BrainCircuit className="w-8 h-8 text-[#F6821F]" /><div className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>~{Math.round(forecast).toLocaleString('id-ID')}</div></div><div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Based on the trend from the past 3 days</div></div>
                </div>
            </div>
        </div>
    );
}

const LatestIssues = ({ isLight }) => {
    const issues = [{ title: 'Maintenance terjadwal di Stasiun Velodrome', status: 'Scheduled', time: '08:00' }, { title: 'Minor delay resolved - Stasiun Equestrian', status: 'Resolved', time: '07:30' }];
    return (
        <div className={`relative rounded-lg p-3 flex-shrink-0 transition-colors h-100 flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Last Issue</h2>
            <div className="space-y-1.5 flex-1 flex flex-col justify-center blur-sm">
                {issues.map((item, idx) => (
                    <div key={idx} className={`border-l-4 pl-2 ${item.status === 'Resolved' ? 'border-emerald-500' : 'border-amber-500'}`}>
                        <div className="flex items-center justify-between"><p className={`text-xs leading-tight ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{item.title}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${item.status === 'Resolved' ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400') : (isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-400')}`}>{item.status}</span></div>
                        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{item.time}</p>
                    </div>
                ))}
            </div>
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                <Target className={`h-10 w-10 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} /><h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Last Issue</h3><span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>COMING SOON</span>
            </div>
        </div>
    );
};

const HotNewsCard = ({ isLight }) => {
    const { newsData, isLoading, error } = useNewsData();
    const [currentIndex, setCurrentIndex] = useState(0);
    useEffect(() => { if (newsData && newsData.length > 0) { const timer = setInterval(() => { setCurrentIndex(prevIndex => (prevIndex + 1) % newsData.length); }, 10000); return () => clearInterval(timer); } }, [newsData]);
    const currentNews = newsData[currentIndex];
    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center h-full"><Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
        if (error) return <div className={`flex flex-col justify-center items-center h-full text-center ${isLight ? 'text-red-700' : 'text-red-300'}`}><AlertTriangle className="h-5 w-5 text-red-500 mb-1" /><p className="text-xs">Gagal memuat berita</p></div>;
        if (!currentNews) return <div className={`flex justify-center items-center h-full text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tidak ada berita.</div>;
        return <div key={currentIndex} className="flex flex-col justify-center flex-1 animate-fade-in"><p className={`text-xs font-semibold leading-tight ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{currentNews.title}</p><p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{currentNews.source} - {timeAgo(currentNews.created_at)}</p></div>;
    };
    return (
        <div className={`relative rounded-lg p-2 shadow-sm transition-colors flex flex-col flex-1 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Hot News</h2>
            <div className="flex-1 overflow-hidden blur-sm">{renderContent()}</div>
            <div className="flex justify-center space-x-1.5 mt-2 blur-sm">{newsData.map((_, index) => (<div key={index} className={`w-2 h-2 rounded-full transition-all ${index === currentIndex ? (isLight ? 'bg-[#D3242B]' : 'bg-[#F6821F]') : (isLight ? 'bg-slate-300' : 'bg-slate-700')}`}></div>))}</div>
            <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out; }`}</style>
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}><Target className={`h-5 w-5 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} /><h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Hot News</h3><span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>COMING SOON</span></div>
        </div>
    );
};

const SocialMediaGrowthCard = ({ isLight }) => {
    const { socialData, isLoading, error } = useSocialMediaData();
    const socialIcons = { instagram: <Instagram className="w-5 h-5 text-[#E1306C]" />, facebook: <Facebook className="w-5 h-5 text-[#1877F2]" /> };
    const platformOrder = ['instagram', 'facebook'];
    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center h-full"><Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
        if (error) return <div className={`flex flex-col justify-center items-center h-full text-center ${isLight ? 'text-red-700' : 'text-red-300'}`}><AlertTriangle className="h-5 w-5 text-red-500 mb-1" /><p className="text-xs">Gagal memuat data</p></div>;
        const sortedData = [...socialData].sort((a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform));
        return (
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-0">
                {sortedData.map(social => {
                    const growth = social.growth_percentage;
                    const color = growth > 0 ? 'text-emerald-500' : growth < 0 ? 'text-red-500' : (isLight ? 'text-slate-500' : 'text-slate-400');
                    const Icon = growth > 0 ? ArrowUp : growth < 0 ? ArrowDown : null;
                    return (
                        <div key={social.platform} className="flex flex-col items-center text-center">
                            {socialIcons[social.platform]}<span className={`text-[8px] font-bold capitalize mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{social.platform}</span>
                            <span className={`text-xs font-bold flex items-center ${color}`}>{Icon && <Icon className="w-3 h-3" />}{growth.toFixed(1)}%</span>
                        </div>
                    );
                })}
            </div>
        );
    };
    return (
        <div className={`relative rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-1 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Pertumbuhan Sosmed (Bulan Ini)</h2>
            <div className="flex-1 blur-sm">{renderContent()}</div>
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}><Target className={`h-5 w-5 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} /><h3 className={`text-sm font-bold text-center ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Social Media Growth</h3><span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>COMING SOON</span></div>
        </div>
    );
};

const RealtimeHoursInfo = ({ isLight, peakHours }) => {
    const formatHourRange = (hour) => { if (hour === null || hour < 0 || hour > 23) return 'N/A'; const start = hour.toString().padStart(2, '0'); const end = (hour + 1).toString().padStart(2, '0'); return `${start}:00 - ${end}:00`; };
    return (
      <div className={`mt-3 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <h3 className={`text-xs font-bold uppercase mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Peak Hour Analysis (Today)</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between"><span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Busiest Hour</span><span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}`}>{peakHours ? formatHourRange(peakHours.busiest) : 'Menghitung...'}</span></div>
          <div className="flex items-center justify-between"><span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Least Busy Hour</span><span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'}`}>{peakHours ? formatHourRange(peakHours.quietest) : 'Menghitung...'}</span></div>
        </div>
      </div>
    );
};

// --- REALTIME TRAIN TRACKER COMPONENT (WebSocket) ---

// Daftar Koordinat Stasiun (Urut PGD -> VLD / Arah Selatan)
const STATIONS_ORDER_DOWN = [
    { code: 'PGD', lat: -6.156952069555118, name: 'Pegangsaan Dua' },
    { code: 'BU',  lat: -6.159079450966208, name: 'Boulevard Utara' },
    { code: 'BS',  lat: -6.168944754902876, name: 'Boulevard Selatan' },
    { code: 'PLA', lat: -6.177093050483244, name: 'Pulomas' },
    { code: 'EQS', lat: -6.183657907397494, name: 'Equestrian' },
    { code: 'VLD', lat: -6.192364124448333, name: 'Velodrome' }
];

// Daftar Koordinat Stasiun (Urut VLD -> PGD / Arah Utara) - Reverse dari Down
const STATIONS_ORDER_UP = [...STATIONS_ORDER_DOWN].reverse();

// Helper hitung % posisi di track visual
const getTrainProgress = (currentLat: number, stations: typeof STATIONS_ORDER_DOWN) => {
    // Toleransi deteksi ujung track
    const buffer = 0.002; 
    const startLat = stations[0].lat;
    const endLat = stations[stations.length - 1].lat;
    
    // Cek apakah ini jalur PGD->VLD (Lat makin kecil/negatif bertambah) atau VLD->PGD (Lat makin besar)
    const isMovingSouth = startLat > endLat; 

    // 1. Handle Out of Bounds (Depot/Overrun)
    if (isMovingSouth) {
        if (currentLat > startLat + buffer) return 0;   // Sebelum PGD
        if (currentLat < endLat - buffer) return 100;   // Lewat VLD
    } else {
        if (currentLat < startLat - buffer) return 0;   // Sebelum VLD
        if (currentLat > endLat + buffer) return 100;   // Lewat PGD
    }

    // 2. Hitung Progress per Segmen Stasiun
    // Kita bagi UI menjadi 5 segmen rata (0-20, 20-40, 40-60, 60-80, 80-100)
    const segmentSize = 100 / (stations.length - 1);

    for (let i = 0; i < stations.length - 1; i++) {
        const segStart = stations[i];
        const segEnd = stations[i + 1];

        // Cek apakah latitude kereta berada di antara stasiun ini
        let inSegment = false;
        if (isMovingSouth) {
            inSegment = currentLat <= segStart.lat && currentLat >= segEnd.lat;
        } else {
            inSegment = currentLat >= segStart.lat && currentLat <= segEnd.lat;
        }

        if (inSegment) {
            // Hitung persentase presisi dalam segmen ini
            const totalLatDiff = Math.abs(segEnd.lat - segStart.lat);
            const trainLatDiff = Math.abs(currentLat - segStart.lat);
            const segProgress = trainLatDiff / totalLatDiff; // 0.0 - 1.0

            return (i * segmentSize) + (segProgress * segmentSize);
        }
    }
    
    return 0; // Default
};

const RealTimeTrainTracker = ({ isLight }) => {
    const [trains, setTrains] = useState<Record<number, ActiveTrain>>({});
    const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
    const wsRef = useRef<WebSocket | null>(null);

    // --- WebSocket Connection ---
    useEffect(() => {
        const connectWebSocket = () => {
            const ws = new WebSocket('wss://websocket.lrtjakarta.co.id/');
            wsRef.current = ws;

            ws.onopen = () => setStatus('CONNECTED');
            ws.onclose = () => {
                setStatus('DISCONNECTED');
                setTimeout(connectWebSocket, 5000); 
            };
            ws.onerror = () => ws.close();

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'chat' && data.message?.lrv && data.message?.table) {
                        const { lrv, table } = data.message;
                        const newLat = lrv.lat;
                        
                        setTrains(prev => {
                            const existing = prev[lrv.id];
                            let newDirection: 'down' | 'up' = existing?.direction || 'down';
                            let cleanSpeed = parseFloat(table.kecepatan || "0");

                            // LOGIKA DETEKSI DIAM / BERHENTI DI STASIUN
                            // Jika perubahan koordinat sangat kecil, nol-kan kecepatan
                            if (existing) {
                                const deltaLat = Math.abs(newLat - existing.lat);
                                const deltaLng = Math.abs(lrv.lng - existing.lng);
                                // Ambang batas toleransi (0.00001 derajat ~ 1.1 meter)
                                if (deltaLat < 0.00001 && deltaLng < 0.00001) {
                                    cleanSpeed = 0;
                                }

                                // Logika Direction (Deteksi arah gerak)
                                const diff = newLat - existing.lat;
                                // Jika Lat berkurang signifikan, berarti ke Selatan (Down)
                                if (diff < -0.000005) newDirection = 'down'; 
                                // Jika Lat bertambah signifikan, berarti ke Utara (Up)
                                else if (diff > 0.000005) newDirection = 'up'; 
                            } else {
                                // Inisialisasi awal: jika lebih dekat VLD (-6.19), anggap arah Up (pulang ke PGD)
                                if (newLat < -6.18) newDirection = 'up';
                            }

                            return {
                                ...prev,
                                [lrv.id]: {
                                    id: lrv.id,
                                    lat: lrv.lat,
                                    lng: lrv.lng,
                                    no_ka: table.no_ka,
                                    masinis: table.masinis,
                                    kecepatan: cleanSpeed,
                                    last_update: Date.now(),
                                    direction: newDirection
                                }
                            };
                        });
                    }
                } catch (err) { console.error(err); }
            };
        };

        connectWebSocket();

        // Cleanup Data Lama (> 1 menit tidak update)
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            setTrains(prev => {
                const newState = { ...prev };
                let hasChanges = false;
                Object.keys(newState).forEach(key => {
                    if (now - newState[key].last_update > 60000) { 
                        delete newState[key];
                        hasChanges = true;
                    }
                });
                return hasChanges ? newState : prev;
            });
        }, 5000);

        return () => {
            if (wsRef.current) wsRef.current.close();
            clearInterval(cleanupInterval);
        };
    }, []);

    const trainList = Object.values(trains);

    // --- Sub-Component Render Satu Track ---
    const TrackRenderer = ({ title, stations, directionFilter, stationOrder, colorClass }) => {
        // Ambil kereta yang sesuai arah jalur ini
        const activeTrainsOnTrack = trainList.filter(t => t.direction === directionFilter);

        return (
            <div className="mb-8 relative last:mb-2">
                 {/* Judul Jalur */}
                <div className={`text-[10px] font-bold uppercase mb-5 pl-1 flex items-center gap-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></span>
                    {title}
                </div>

                <div className="relative w-full h-8">
                    {/* Garis Track Visual */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                         {/* Gradient background track */}
                         <div className={`w-full h-full bg-current opacity-20 ${colorClass.replace('bg-', 'text-')}`}></div>
                    </div>

                    {/* Titik Stasiun */}
                    {stations.map((s, idx) => {
                        const leftPos = (idx / (stations.length - 1)) * 100;
                        return (
                            <div key={s.code} className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left: `${leftPos}%` }}>
                                <div className={`w-2.5 h-2.5 rounded-full border-2 -translate-x-1/2 bg-white ${isLight ? 'border-slate-400' : 'border-slate-600'}`}></div>
                                <span className={`absolute left-1/2 -translate-x-1/2 -top-4 text-[9px] font-bold whitespace-nowrap ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {s.code}
                                </span>
                            </div>
                        );
                    })}

                    {/* Kereta Bergerak */}
                    {activeTrainsOnTrack.map((train) => {
                        const progress = getTrainProgress(train.lat, stationOrder);
                        
                        return (
                            <div 
                                key={train.id}
                                className="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-1000 ease-linear"
                                style={{ left: `${progress}%` }}
                            >
                                <div className="relative -translate-x-1/2 flex flex-col items-center group">
                                    {/* Icon Kereta */}
                                    <div className={`p-1 rounded-full shadow-md border z-20 ${train.kecepatan > 0 ? `${colorClass} border-white animate-pulse` : 'bg-slate-600 border-slate-400'} text-white`}>
                                        <TrainFront size={14} />
                                    </div>
                                    
                                    {/* Info Card (Compact & Always Visible) */}
                                    <div className={`absolute top-6 min-w-[90px] px-2 py-1.5 rounded border shadow-sm flex flex-col items-center text-center backdrop-blur-sm z-30 ${isLight ? 'bg-white/95 border-slate-300' : 'bg-slate-800/95 border-slate-600'}`}>
                                         {/* Arrow Card */}
                                         <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-l border-t ${isLight ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-600'}`}></div>
                                         
                                         <span className={`text-[9px] font-extrabold leading-none mb-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>KA {train.no_ka}</span>
                                         <span className={`text-[8px] leading-tight mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'} truncate max-w-[100px]`}>{train.masinis}</span>
                                         <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${train.kecepatan > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                            {train.kecepatan} km/h
                                         </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className={`relative rounded-lg p-4 flex flex-col justify-center transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'} min-h-[280px]`}>
                {/* Header Card */}
                <div className="flex justify-between items-center mb-4 border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
                     <div className="flex items-center gap-2">
                        <Target className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                        <h3 className={`text-xs font-bold uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Real-Time Train Monitoring</h3>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className={`text-[9px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{status === 'CONNECTED' ? 'Live Data' : 'Offline'}</span>
                     </div>
                </div>

                <div className="flex-1 flex flex-col justify-center py-1">
                    {/* JALUR 1: PGD -> VLD (Merah) */}
                    <TrackRenderer 
                        title="Jalur 1: Pegangsaan Dua → Velodrome" 
                        stations={STATIONS_ORDER_DOWN} 
                        directionFilter="down" 
                        stationOrder={STATIONS_ORDER_DOWN}
                        colorClass="bg-[#D3242B]"
                    />

                    {/* JALUR 2: VLD -> PGD (Oranye) */}
                    <TrackRenderer 
                        title="Jalur 2: Velodrome → Pegangsaan Dua" 
                        stations={STATIONS_ORDER_UP} 
                        directionFilter="up"
                        stationOrder={STATIONS_ORDER_UP}
                        colorClass="bg-[#F6821F]"
                    />
                </div>
            </div>

            {/* CUSTOMER SATISFACTION CHART (Tetap Ada) */}
            <CustomerSatisfactionChart isLight={isLight} />
        </>
    );
};

// --- Main Dashboard Component ---
const LRTJakartaDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [theme, setTheme] = useState('light');
    
    // Set Interval 15 detik untuk semua data
    const { isLoading: isTodayLoading, error: todayError, totalTransactions: todayTotalTransactions, percentageChange, stationSummary, peakHours, yesterdayTotal } = useTrafficData({ defaultRange: 'today', refreshInterval: 15000 });
    const { totalTransactions: monthlyTotalTransactions, isLoading: isMonthLoading } = useTrafficData({ defaultRange: 'month', refreshInterval: 15000 });
    const { totalTransactions: prevMonthTotalTransactions, isLoading: isPrevMonthLoading } = useTrafficData({ defaultRange: 'previous-month', refreshInterval: 15000 });
    const { chartData: weeklyChartData, isLoading: isWeekLoading } = useTrafficData({ defaultRange: 'week', refreshInterval: 15000 });
    
    const { data: onTimeData, isLoading: isOtpLoading, error: otpError } = usePerformanceData('OTP');
    const { data: spmData, isLoading: isSpmLoading, error: spmError } = usePerformanceData('SPM');
    
    const today = new Date();
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth(), 0); 
    const prevMonthIndex = prevMonthDate.getMonth() + 1; 

    const prevMonthOtpData = onTimeData.find(d => d.monthIndex === prevMonthIndex);
    const prevMonthOtpValue = prevMonthOtpData ? prevMonthOtpData.value : null;
    const prevMonthOtpTarget = prevMonthOtpData ? prevMonthOtpData.target : null;

    // --- FIX: Sync Weekly Chart with Real-time Today Data ---
    const updatedWeeklyChartData = useMemo(() => {
        if (!weeklyChartData || weeklyChartData.length === 0) return [];
        const newChartData = [...weeklyChartData];
        const todayIndex = newChartData.findIndex(d => {
            const itemDate = new Date(d.date);
            const today = new Date();
            return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth() && itemDate.getDate() === today.getDate();
        });
        if (todayIndex !== -1) {
            newChartData[todayIndex] = { ...newChartData[todayIndex], passengers: todayTotalTransactions };
        }
        return newChartData;
    }, [weeklyChartData, todayTotalTransactions]);

    useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
    const toggleTheme = () => { setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light')); };
    const isLight = theme === 'light';

    // FIX: Station Traffic Data Processing
    // Perbaikan ini memastikan 'stationSummary' valid dan menangani kemungkinan kunci stasiun yang tidak terdefinisi
    const processedStations = Object.entries(stationSummary || {}).map(([code, summary]) => {
        let status = 'Low'; if (summary.total > 4000) status = 'High'; else if (summary.total > 1500) status = 'Medium';
        // Pastikan ada fallback jika STATION_NAMES[code] undefined
        const name = STATION_NAMES[code] || code || 'Unknown';
        return { name: name, traffic: summary.total, status: status, change: summary.change || null };
    }).sort((a, b) => b.traffic - a.traffic);

    return (
        <>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap'); .font-jakarta-sans { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>
            <div className={`min-h-screen lg:h-screen lg:overflow-hidden p-3 flex flex-col font-jakarta-sans transition-colors duration-300 ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-950 text-slate-200'}`}>
                <header className="mb-2 flex flex-col md:flex-row justify-between items-center p-3 rounded-lg bg-gradient-to-r from-[#D3242B] to-[#F6821F] flex-shrink-0 shadow-lg">
                    <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-2 md:gap-4">
                        <img src="https://e-ptw.lrtjakarta.co.id/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo-lrtj-white.847caf54.png&w=640&q=75" alt="LRT Jakarta Logo" className="h-10"/>
                        <div><h1 className="text-xl font-bold tracking-wide text-white">LRT JAKARTA DASHBOARD</h1><p className="text-xs font-semibold text-white/80">Pegangsaan Dua - Velodrome Line | Real-Time Monitoring System</p></div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 md:mt-0">
                        {todayError && (
                            <div className="bg-red-500 text-white px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 animate-pulse">
                                <WifiOff size={12}/> Reconnecting To Server
                            </div>
                        )}
                        <div className="text-right"><div className="text-xl font-bold text-white">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div><div className="text-white/80 text-xs">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
                        <button onClick={toggleTheme} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">{isLight ? <Moon size={20} /> : <Sun size={20} />}</button>
                    </div>
                </header>

                <section className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1 mb-2 flex-shrink-0 rounded-lg p-1 transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                    <div className="text-center p-1.5"><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Passengers Today</div><div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{todayTotalTransactions.toLocaleString('id-ID')}</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>on going (ex KLG & QR)</div></div>
                    <div className="text-center border-l p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Passengers Yesterday</div><div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{yesterdayTotal.toLocaleString('id-ID')}</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Daily Total (ex KLG & QR)</div></div>
                    <div className="text-center border-l p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Passengers This Month</div>{isMonthLoading ? <div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-red-500" /></div> : (<><div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{monthlyTotalTransactions.toLocaleString('id-ID')}</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Cumulative (ex KLG & QR)</div></>)}</div>
                    <div className="text-center border-l border-r p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Passengers Last Month</div>{isPrevMonthLoading ? <div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-red-500" /></div> : (<><div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{prevMonthTotalTransactions.toLocaleString('id-ID')}</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Cumulative (ex KLG & QR)</div></>)}</div>
                    <div className="text-center border-r p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>On-Time Performance</div>{isOtpLoading ? (<div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>) : (<><div className={`text-xl font-bold flex items-center justify-center gap-1.5 ${prevMonthOtpValue && prevMonthOtpTarget && prevMonthOtpValue >= prevMonthOtpTarget ? 'text-emerald-500' : 'text-amber-500'}`}><CheckCircle className="h-4 w-4" />{prevMonthOtpValue !== null ? `${prevMonthOtpValue.toFixed(2)}%` : 'N/A'}</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Target: {prevMonthOtpTarget !== null ? `${prevMonthOtpTarget.toFixed(2)}%` : 'N/A'} (Bln Lalu)</div></>)}</div>
                    <div className="text-center p-1.5 relative"><div className="blur-sm"><div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Completed Trips</div><div className="text-xl font-bold text-emerald-500 flex items-center justify-center gap-1.5"><Repeat className="h-4 w-4" /> 178/180</div><div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Performa 98.9%</div></div><div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-900/80'} backdrop-blur-sm`}><Target className={`h-6 w-6 mb-1 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} /><h3 className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Completed Trips</h3><span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>COMING SOON</span></div></div>
                </section>

                <main className="flex-1 min-h-0 flex flex-col gap-2">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 flex-1 min-h-0">
                        <div className={`md:col-span-5 lg:col-span-3 rounded-lg p-3 flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Station Traffic</h2>
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {processedStations.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {processedStations.map((station, idx) => (
                                            <div key={idx} className={`rounded-md p-2 border ${isLight ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-950'} flex flex-col justify-between`}>
                                                <div className="flex items-center gap-1 mb-1"><span className={`w-2 h-2 rounded-full ${station.status === 'High' ? 'bg-red-500' : station.status === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span><span className={`text-xs font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{station.name}</span></div>
                                                <div className="text-right"><span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{station.traffic.toLocaleString('id-ID')}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex justify-center items-center py-4">{isTodayLoading ? <Loader2 className="h-6 w-6 animate-spin text-red-500" /> : <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tidak ada data trafik.</p>}</div>
                                )}
                            </div>
                            {!isTodayLoading && processedStations.length > 0 && (
                                <div className={`mt-3 pt-0 border-t flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between text-xs mb-1"><span className={`${isLight ? 'text-slate-500' : 'text-slate-400'} font-semibold`}>Legend:</span></div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Tinggi (&gt;4k)</span></div>
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Sedang (&gt;1.5k)</span></div>
                                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Rendah</span></div>
                                    </div>
                                </div>
                            )}
                            {peakHours && (<RealtimeHoursInfo isLight={isLight} peakHours={peakHours} />)}
                            <div className={`mt-4 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}><LatestIssues isLight={isLight} /></div>
                        </div>

                        <div className="md:col-span-7 lg:col-span-6 flex flex-col gap-2">
                            {/* --- INTEGRASI WEBSOCKET COMPONENT --- */}
                            <RealTimeTrainTracker isLight={isLight} />
                        </div>

                        <div className="md:col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
                            <SocialSentimentCard isLight={isLight} />
                            <SocialMediaGrowthCard isLight={isLight} />
                            <HotNewsCard isLight={isLight} />
                            <CombinedPerformanceCard isLight={isLight} otpData={{ data: onTimeData, isLoading: isOtpLoading, error: otpError }} spmData={{ data: spmData, isLoading: isSpmLoading, error: spmError }} />
                            <ClosingRateChart isLight={isLight} />
                            <div className="h-[170px]"><TrainMonitoringSlider isLight={isLight} /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 flex-shrink-0">
                        <div className={`lg:col-span-2 rounded-lg p-3 transition-colors flex flex-col h-[300px] lg:h-full ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                            <h2 className={`text-xs font-bold mb-1 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Passenger Trend (Weekly)</h2>
                            <div className="flex-1 min-h-0">
                                {isWeekLoading && (!updatedWeeklyChartData || updatedWeeklyChartData.length === 0) ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={updatedWeeklyChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                            <defs><linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F6821F" stopOpacity={0.8} /><stop offset="95%" stopColor="#F6821F" stopOpacity={0} /></linearGradient></defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#334155'} />
                                            <XAxis dataKey="name" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '12px' }} />
                                            <YAxis stroke={isLight ? '#475569' : 'text-slate-400'} style={{ fontSize: '12px' }} />
                                            <Tooltip contentStyle={{ backgroundColor: isLight ? 'white' : '#0f172a', border: '1px solid #D3242B', borderRadius: '6px', fontSize: '12px' }} labelStyle={{ color: isLight ? '#334155' : '#cbd5e1' }} />
                                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                                            <Area type="monotone" dataKey="passengers" name="Total Penumpang" stroke="#D3242B" fill="url(#colorTrend)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-1 h-full"><PassengerInsights isLight={isLight} weeklyData={updatedWeeklyChartData} /></div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default LRTJakartaDashboard;