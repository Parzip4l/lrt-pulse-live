import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Train, AlertTriangle, Clock, Users, Sun, Moon, WifiOff, ArrowUp, ArrowDown,
    CheckCircle, Repeat, Hash, Smile, TrendingUp, Star, Sunrise, Sunset,
    PieChart as PieChartIcon, Target, CalendarDays, BrainCircuit, Instagram,
    Facebook, Twitter, Youtube, Linkedin
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, ReferenceLine
} from 'recharts';

// --- SVG Icons ---
// A simple loader component used when data is being fetched.
const Loader2 = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>);

// --- Interfaces ---
// Defines the structure for a single traffic data record from the API.
interface TrafficData { station_code_var: string; gate_out_on_dtm: string; }
// A generic API response structure.
interface ApiResponse<T> { sts: string; data?: T; msg?: string; }
// The structure of the data object within the traffic API response.
interface TrafficApiResponseData { rows: TrafficData[]; total: number; }
// The structure of the data object within the login API response.
interface LoginApiResponseData { token: string; }
// A summary of traffic data for each station, including total passengers and percentage change.
interface StationSummary { [stationCode: string]: { total: number; change?: number }; }
// The data structure required by the Recharts library for plotting the line chart.
interface ChartData { name: string; passengers: number; date: Date; }
// Defines the structure for a single survey data record.
interface SurveyData {
    id: number;
    year: number;
    quarter: number;
    target_value: number;
    achievement_value: number;
    respondent_count: number;
}
// NEW: Structure for a single news item
interface NewsItem {
    id: number;
    title: string;
    source: string;
    created_at: string;
}
// NEW: Structure for social media growth data
interface SocialGrowth {
    platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin';
    growth_percentage: number;
}


// --- Utility & Constants ---
// A map to convert short station codes to full station names for display.
const STATION_NAMES = {
    PEG: 'PGD', BOU: 'BU', BOS: 'BS',
    PUL: 'PLA', EQS: 'EQS', VEL: 'VLD',
};

// Helper function to format a Date object into 'YYYY-MM-DD' string format.
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// Helper function to get the week number for caching
const getWeekNumber = (d: Date): [number, number] => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
};

// NEW: Helper function to calculate time ago
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
// This hook encapsulates all logic for fetching, processing, and managing traffic data.
const useTrafficData = (options) => {
    const { defaultRange, refreshInterval } = options;

    // --- CACHE LOGIC START ---
    // Helper to get cache key for today
    const getTodayCacheKey = () => `traffic-data-today-${formatDate(new Date())}`;

    // Function to load initial state from cache if available
    const loadInitialState = () => {
        // --- PERUBAHAN DI SINI ---
        // Menambahkan chartData ke defaultState agar bisa diisi oleh cache mingguan
        const defaultState = { isLoading: true, stationSummary: {}, totalTransactions: 0, percentageChange: null, peakHours: null, yesterdayTotal: 0, chartData: [] };
        // --- AKHIR PERUBAHAN ---

        if (defaultRange === 'today') {
            try {
                const cacheKey = getTodayCacheKey();
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { data, timestamp } = JSON.parse(cachedItem);
                    const cacheAge = Date.now() - timestamp;
                    
                    // Cache for today is valid for 2 minutes
                    if (cacheAge < 2 * 60 * 1000) { 
                        return {
                            ...defaultState, // <- Mulai dari default
                            isLoading: false, // <-- KEY CHANGE: Load instantly
                            stationSummary: data.stationSummary,
                            totalTransactions: data.totalTransactions,
                            percentageChange: data.percentageChange,
                            peakHours: data.peakHours,
                            yesterdayTotal: data.yesterdayTotal || 0, // <-- Load yesterday's total
                        };
                    }
                }
            } catch (e) {
                console.error("Failed to read 'today' cache", e);
                // If cache is corrupt, clear it
                localStorage.removeItem(getTodayCacheKey());
            }
        }
        // --- MODIFICATION START: Add cache loading for 'month' ---
        else if (defaultRange === 'month') {
            // Re-create the startDate logic here, just for the key.
            const tempStartDate = new Date();
            tempStartDate.setDate(1);
            const cacheKey = `traffic-data-${formatDate(tempStartDate).substring(0, 7)}`;
            
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    // --- MODIFICATION ---
                    // If *any* cache exists (even expired), load it.
                    // The useEffect will handle refetching if it's expired.
                    // This prevents showing 0 or a loader.
                    const { total } = JSON.parse(cachedItem);
                    return {
                        ...defaultState,
                        isLoading: false, // Load instantly
                        totalTransactions: total, // Show stale data
                    };
                    // --- END MODIFICATION ---
                }
            } catch (e) {
                console.error("Failed to read 'month' cache", e);
                localStorage.removeItem(cacheKey);
            }
        }
        // --- MODIFICATION END ---
        // --- PERUBAHAN DI SINI: Menambahkan logika cache 'week' saat inisialisasi ---
        else if (defaultRange === 'week') {
            const tempStartDate = new Date();
            tempStartDate.setDate(tempStartDate.getDate() - 6);
            const [year, week] = getWeekNumber(tempStartDate);
            const cacheKey = `traffic-data-week-${year}-${week}`;
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { chartData: cachedChartData } = JSON.parse(cachedItem);
                    return {
                        ...defaultState,
                        isLoading: false, // Load instantly
                        chartData: cachedChartData.map(d => ({...d, date: new Date(d.date)})) // Load stale data
                    };
                }
            } catch (e) {
                console.error("Failed to read 'week' cache", e);
                localStorage.removeItem(cacheKey);
            }
        }
        // --- AKHIR PERUBAHAN ---
        
        // Default if no cache or expired
        return defaultState;
    };

    const initialState = loadInitialState();
    // --- CACHE LOGIC END ---

    // State for managing the date range of the data to be fetched.
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        // Set default date range to the last 7 days if 'week' is specified.
        if (defaultRange === 'week') {
            date.setDate(date.getDate() - 6);
        } else if (defaultRange === 'month') {
            date.setDate(1);
        } else if (defaultRange === 'previous-month') { // <-- NEW
            date.setDate(1); // Go to 1st of current month
            date.setMonth(date.getMonth() - 1); // Go to 1st of previous month
        }
        return date;
    });
    const [endDate, setEndDate] = useState(() => {
        if (defaultRange === 'previous-month') { // <-- NEW
            const date = new Date();
            date.setDate(1); // 1st of current
            date.setDate(date.getDate() - 1); // Last day of previous month
            return date;
        }
        return new Date(); // Default
    });

    // State for managing API authentication token, loading status, and errors.
    const [token, setToken] = useState < string | null > (null);
    // --- MODIFICATION: These states now correctly use the improved initialState ---
    const [isLoading, setIsLoading] = useState(initialState.isLoading); 
    const [error, setError] = useState < string | null > (null);

    // State for storing processed data ready for display.
    // --- PERUBAHAN DI SINI: Menggunakan initialState.chartData ---
    const [chartData, setChartData] = useState < ChartData[] > (initialState.chartData);
    // --- AKHIR PERUBAHAN ---
    const [stationSummary, setStationSummary] = useState < StationSummary > (initialState.stationSummary);
    const [totalTransactions, setTotalTransactions] = useState(initialState.totalTransactions); 
    const [percentageChange, setPercentageChange] = useState < number | null > (initialState.percentageChange);
    const [peakHours, setPeakHours] = useState<{ busiest: number, quietest: number } | null>(initialState.peakHours);
    const [yesterdayTotal, setYesterdayTotal] = useState(initialState.yesterdayTotal); // <-- NEW state
    // --- END OF MODIFICATION ---

    // useCallback is used to memoize the login function, preventing re-creation on every render.
    const performLogin = useCallback(async () => {
        // ... (fungsi performLogin tidak berubah) ...
        try {
            
            // const response = await fetch("/api/index.php/login/doLogin", {
            const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/login/doLogin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rqid: "456QWsad123QefasTY",
                    username: "202020",
                    password: "de88f321991be4f8e56a27aba3adc2aa",
                    type: "web"
                })
            });

            if (!response.ok) {
                throw new Error(`Login failed with statuss: ${response.status}`);
            }

            const result = await response.json();

            const isSuccess = result.code === 0 || result.sts === "S";

            if (isSuccess) {
                const token = result.data?.token || result.token || result.data?.access_token;
                if (token) {
                    return token;
                }
            }

            throw new Error(result.message || result.msg || "Login failed: No token in response");
        } catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    }, []);

    // useCallback memoizes the traffic data fetching function.
    const fetchTrafficData = useCallback(async (start, end, currentToken) => {
        
        try {
            // const response = await fetch("/api/index.php/transaction/list_gate_out_prepaid_trx", {
            const response = await fetch("http://36.92.28.99/lrt_jakpro_api/index.php/transaction/list_gate_out_prepaid_trx", {
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
                    card_number: "", station_code: "", terminal_in: "",
                    terminal_out: "", card_type: ""
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status: ${response.status}`);
            }

            const result = await response.json();

            const isSuccess = result.code === 0 || result.sts === "S";

            if (isSuccess && result.data) {
                return result.data;
            }

            // Gracefully handle API success responses that contain no data.
            if (result.msg?.includes("Success list") || result.message?.includes("Success")) {
                return { rows: [], total: 0 };
            }

            throw new Error(result.message || result.msg || `API Error: code ${result.code}`);
        } catch (err) {
            console.error('Fetch traffic data error:', err);
            throw err;
        }
    }, []);

    // The main effect hook that orchestrates the data fetching and processing pipeline.
    useEffect(() => {
        let isMounted = true;

        const fetchData = async (isInitialLoad = false) => {
            if (!isMounted) return;
            
            // MODIFIKASI: Hapus setIsLoading(true) di sini.
            // Status loading awal sudah diatur oleh loadInitialState.
            // Ini mencegah spinner muncul jika data dimuat dari cache.
            /*
            if (isInitialLoad) {
                setIsLoading(true);
            }
            */
            setError(null);

            // --- CACHING LOGIC (Hanya untuk 'month' dan 'week', 'today' ditangani saat inisialisasi) ---
            if (defaultRange === 'month' || defaultRange === 'previous-month') { // <-- Modified
                // ... (logika cache 'month' tidak berubah) ...
                const cacheKey = `traffic-data-${formatDate(startDate).substring(0, 7)}`; // e.g., "traffic-data-2023-10"
                try {
                    const cachedItem = localStorage.getItem(cacheKey);
                    if (cachedItem) {
                        const { total, timestamp } = JSON.parse(cachedItem);
                        const cacheAge = Date.now() - timestamp;
                        
                        const isCurrentMonth = startDate.getMonth() === new Date().getMonth() && startDate.getFullYear() === new Date().getFullYear();
                        // Cache for current month is valid for 1 hour, past months are cached "forever"
                        const expiryDuration = isCurrentMonth ? 60 * 60 * 1000 : Infinity;

                        if (cacheAge < expiryDuration) {
                            if (isMounted) {
                                setTotalTransactions(total);
                                setIsLoading(false);
                            }
                            return; // Use cached data and skip API call
                        }
                    }
                } catch (cacheError) {
                    console.error("Failed to read from cache", cacheError);
                    // If cache is corrupted, proceed to fetch from API
                }
            } else if (defaultRange === 'week') {
                // ... (logika cache 'week' tidak berubah) ...
                const [year, week] = getWeekNumber(startDate);
                const cacheKey = `traffic-data-week-${year}-${week}`;
                try {
                    const cachedItem = localStorage.getItem(cacheKey);
                    if (cachedItem) {
                        const { chartData: cachedChartData, timestamp } = JSON.parse(cachedItem);
                        const cacheAge = Date.now() - timestamp;

                        const [currentYear, currentWeek] = getWeekNumber(new Date());
                        const isCurrentWeek = year === currentYear && week === currentWeek;
                        const expiryDuration = isCurrentWeek ? 60 * 60 * 1000 : Infinity; // 1 hour for current week

                        if (cacheAge < expiryDuration) {
                            if (isMounted) {
                                // Date objects are not preserved in JSON, so we need to restore them
                                setChartData(cachedChartData.map(d => ({...d, date: new Date(d.date)})));
                                setIsLoading(false);
                            }
                            return; // Use cached data
                        }
                    }
                } catch (cacheError) {
                    console.error("Failed to read weekly cache", cacheError);
                }
            }
            // --- CACHING LOGIC END ---

            if (defaultRange === 'today') setPercentageChange(null);

            try {
                // ... (logika performLogin tidak berubah) ...
                let currentToken = token;
                if (!currentToken) {
                    currentToken = await performLogin();
                    if (isMounted) {
                        setToken(currentToken);
                    } else {
                        return; // Stop if component unmounted during login
                    }
                }

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                // ... (logika fetchTrafficData tidak berubah) ...
                const [mainData, yesterdayData] = await Promise.all([
                    fetchTrafficData(formatDate(startDate), formatDate(endDate), currentToken),
                    // Only fetch yesterday's data if we need it for comparison
                    (defaultRange === 'today' || defaultRange === 'week') ? fetchTrafficData(formatDate(yesterday), formatDate(yesterday), currentToken) : Promise.resolve(null)
                ]);

                if (!mainData || !isMounted) return;

                // ... (logika pemrosesan data: dailyTotals, summary, yesterdaySummary) ...
                const dailyTotals = {};
                const summary = {};
                const yesterdaySummary = {};
                
                const now = new Date();

                mainData.rows.forEach(row => {
                    const day = row.gate_out_on_dtm.substring(0, 10);
                    const station = row.station_code_var;

                    if (!dailyTotals[day]) dailyTotals[day] = { total: 0 };
                    dailyTotals[day].total++;

                    if (!summary[station]) summary[station] = { total: 0 };
                    summary[station].total++;
                });
                

                // --- Peak Hours Analysis for Today ---
                let currentPeakHours = null; // <-- Variabel untuk menyimpan hasil
                if (defaultRange === 'today') {
                    // ... (logika hourlyCounts) ...
                    const hourlyCounts = Array(24).fill(0);
                    mainData.rows.forEach(row => {
                        try {
                            const hour = new Date(row.gate_out_on_dtm).getHours();
                            if (!isNaN(hour)) {
                                hourlyCounts[hour]++;
                            }
                        } catch (e) {
                            // Ignore invalid dates
                        }
                    });

                    const maxCount = Math.max(...hourlyCounts);
                    if (maxCount > 0) {
                        const busiestHour = hourlyCounts.indexOf(maxCount);
                        const nonZeroCounts = hourlyCounts.map((count, hour) => ({ count, hour })).filter(item => item.count > 0);
                        let quietestHour = -1;
                        if (nonZeroCounts.length > 0) {
                            const minCount = Math.min(...nonZeroCounts.map(item => item.count));
                            const quietestItem = nonZeroCounts.find(item => item.count === minCount);
                            if (quietestItem) {
                                quietestHour = quietestItem.hour;
                            }
                        }
                        currentPeakHours = { busiest: busiestHour, quietest: quietestHour }; // <-- Simpan hasil
                        if (isMounted) {
                            setPeakHours(currentPeakHours);
                        }
                    } else if (isMounted) {
                        setPeakHours(null);
                    }
                }


                // ... (logika proses yesterdayData) ...
                let yesterdayFullTotal = 0; // <-- NEW
                if (yesterdayData) { // <-- FIX: Check for yesterdayData, not just rows
                    
                    yesterdayFullTotal = yesterdayData.total; // <-- FIX: Use yesterdayData.total
                    if (isMounted) {
                        setYesterdayTotal(yesterdayFullTotal); // <-- This now sets the correct total
                    }

                    const yesterdayRowsUntilNow = (defaultRange === 'today')
                        ? yesterdayData.rows.filter(row => new Date(row.gate_out_on_dtm) <= now)
                        : yesterdayData.rows;

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

                // ... (logika siapkan chartData 'week') ...
                let chartDataResult: ChartData[] = []; // <-- Define outside if
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

                // Update state with the processed data.
                if (isMounted) {
                    setStationSummary(summary);
                    setTotalTransactions(mainData.total);
                }

                // Calculate the overall percentage change for today's data.
                let currentPercentageChange = null; // <-- Variabel untuk menyimpan hasil
                if (defaultRange === 'today' && yesterdayData) {
                    const yesterdayTotalUntilNow = yesterdayData.rows.filter(row => new Date(row.gate_out_on_dtm) <= now).length;
                    
                    const todayTotal = mainData.total;
                    
                    if (yesterdayTotalUntilNow > 0) {
                        const change = ((todayTotal - yesterdayTotalUntilNow) / yesterdayTotalUntilNow) * 100;
                        currentPercentageChange = change; // <-- Simpan hasil
                        if (isMounted) setPercentageChange(currentPercentageChange);
                    } else {
                        currentPercentageChange = todayTotal > 0 ? 100 : 0; // <-- Simpan hasil
                        if (isMounted) setPercentageChange(currentPercentageChange);
                    }
                }

                // --- CACHE SAVING LOGIC START ---
                if (defaultRange === 'month' || defaultRange === 'previous-month') { // <-- Modified
                    // ... (cache 'month' tidak berubah)
                    const cacheKey = `traffic-data-${formatDate(startDate).substring(0, 7)}`;
                        try {
                            const itemToCache = {
                                total: mainData.total,
                                timestamp: Date.now()
                            };
                            localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
                        } catch(cacheError) {
                            console.error("Failed to save to cache", cacheError);
                        }
                }
                if (defaultRange === 'week') {
                    // ... (cache 'week' tidak berubah)
                    const [year, week] = getWeekNumber(startDate);
                    const cacheKey = `traffic-data-week-${year}-${week}`;
                    try {
                        const itemToCache = {
                            chartData: chartDataResult, // <-- FIX: Use chartDataResult
                            timestamp: Date.now()
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
                    } catch(cacheError) {
                        console.error("Failed to save weekly data to cache", cacheError);
                    }
                }
                
                // --- NEW 'TODAY' CACHE SAVING LOGIC ---
                if (defaultRange === 'today') {
                    const cacheKey = getTodayCacheKey();
                    try {
                        const itemToCache = {
                            data: {
                                stationSummary: summary,
                                totalTransactions: mainData.total,
                                percentageChange: currentPercentageChange,
                                peakHours: currentPeakHours,
                                yesterdayTotal: yesterdayFullTotal, // <-- Save yesterday's total
                            },
                            timestamp: Date.now()
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
                    } catch (cacheError) {
                        console.error("Failed to save 'today' data to cache", cacheError);
                    }
                }
                // --- CACHE SAVING LOGIC END ---

            } catch (err) {
                if (isMounted && err instanceof Error) {
                    setError(err.message);
                    // If the error is token-related, clear the token to force re-login.
                    if (err.message.includes("Token") || err.message.includes("401")) {
                        setToken(null);
                    }
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData(true); // Initial fetch (akan menggunakan cache jika ada)

        // Set up interval for refreshing data if refreshInterval is provided
        if (refreshInterval) {
            const intervalId = setInterval(() => fetchData(false), refreshInterval);
            return () => {
                isMounted = false;
                clearInterval(intervalId);
            };
        }

        // Cleanup function to prevent state updates on an unmounted component.
        return () => { isMounted = false; };
    }, [startDate, endDate, performLogin, fetchTrafficData, defaultRange, refreshInterval]); // Dependencies MODIFIED: removed 'token'

    return { isLoading, error, chartData, stationSummary, totalTransactions, percentageChange, peakHours, yesterdayTotal };
};

// --- Social Media Sentiment Component ---
const SocialSentimentCard = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    // Mock data for social media sentiment
    const sentimentData = {
        positive: 1250,
        neutral: 800,
        negative: 150,
    };
    const totalMentions = sentimentData.positive + sentimentData.neutral + sentimentData.negative;
    const positivePercent = (sentimentData.positive / totalMentions) * 100;
    const neutralPercent = (sentimentData.neutral / totalMentions) * 100;
    const negativePercent = (sentimentData.negative / totalMentions) * 100;

    const sentiments = [
        { name: 'Positif', percent: positivePercent, emoji: '😊' },
        { name: 'Netral', percent: neutralPercent, emoji: '😐' },
        { name: 'Negatif', percent: negativePercent, emoji: '😠' },
    ];

    return (
        <div className={`relative rounded-lg p-3 flex-shrink-0 transition-colors h-100 flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Sentimen Media Sosial</h2>
            <div className="flex-1 flex items-center justify-center blur-sm"> {/* Added blur-sm */}
                {/* ✅ MODIFICATION: Changed to a grid layout without progress bars */}
                <div className="grid grid-cols-3 gap-4 text-center w-full">
                    {sentiments.map(sentiment => (
                        <div key={sentiment.name} className="flex flex-col items-center">
                            <span className="text-1xl mb-1">{sentiment.emoji}</span>
                            <span className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {sentiment.percent.toFixed(1)}%
                            </span>
                            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                {sentiment.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transparent Overlay */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                <Target className={`h-10 w-10 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Sentimen Media Sosial
                </h3>
                <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                    COMING SOON
                </span>
            </div>
        </div>
    );
};


// --- Custom Hook for Survey Data ---
const useSurveyData = () => {
    // ... (Komponen ini tidak berubah) ...
    const [surveyData, setSurveyData] = useState<SurveyData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchSurveyData = async () => {
            try {
                // Ganti URL dengan endpoint API Anda yang sebenarnya
                const response = await fetch('https://ysrnueiftdhawiofuvxz.supabase.co/functions/v1/surveys-api/api/surveys');
                if (!response.ok) {
                    throw new Error(`API request failed with status: ${response.status}`);
                }
                const result = await response.json();
                if (isMounted) {
                    if (result.data) {
                        setSurveyData(result.data);
                    } else {
                        throw new Error('Data survei tidak ditemukan di dalam respons API');
                    }
                }
            } catch (err) {
                if (isMounted) {
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError('Terjadi kesalahan yang tidak diketahui');
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSurveyData(); // Panggilan data awal
        const intervalId = setInterval(fetchSurveyData, 15000); // Set interval untuk refresh data

        return () => { // Fungsi cleanup
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []); // Dependency array kosong agar hanya berjalan sekali saat mount

    return { surveyData, isLoading, error };
};


// --- NEW Custom Hook for Performance Data (OTP & SPM) ---
const usePerformanceData = (type: 'OTP' | 'SPM') => {
    // ... (Komponen ini tidak berubah) ...
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchPerformanceData = async () => {
            // JANGAN set isLoading(true) di sini agar tidak flash
            setError(null);
            try {
                const VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzcm51ZWlmdGRoYXdpb2Z1dnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTIzMDEsImV4cCI6MjA3NjI2ODMwMX0.v8qIGTwvOcJ9cLw1GBzcw0g95nSyGVe-n5ISPc-yCFg";
                const response = await fetch(`https://ysrnueiftdhawiofuvxz.supabase.co/functions/v1/metrics-api/api/metrics?type=${type}`, {
                    headers: {
                        'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`API request failed for ${type}: ${response.status}`);
                }
                const result = await response.json();

                if (isMounted) {
                    if (result.data) {
                        const currentYear = new Date().getFullYear();
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
                        
                        const processedData = result.data
                            .filter(item => item.year === currentYear)
                            .map(item => ({
                                month: monthNames[item.month - 1],
                                value: item.achieved_value,
                                target: item.target_value, // MODIFICATION: Include target_value
                                monthIndex: item.month 
                            }))
                            .sort((a, b) => a.monthIndex - b.monthIndex);

                        setData(processedData);
                    } else {
                        throw new Error(`No data found for ${type}`);
                    }
                }

            } catch (err) {
               if (isMounted) {
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError(`An unknown error occurred while fetching ${type} data`);
                    }
               }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchPerformanceData(); // Panggilan data awal
        const intervalId = setInterval(fetchPerformanceData, 15000); // Set interval untuk refresh data

        return () => { // Fungsi cleanup
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [type]); 

    return { data, isLoading, error };
};

// --- NEW Custom Hook for Hot News (with Dummy Data) ---
const useNewsData = () => {
    // ... (Komponen ini tidak berubah) ...
    const [newsData, setNewsData] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Set to false
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Dummy data
        const dummyNews: NewsItem[] = [
            { id: 1, title: 'LRT Jakarta Tambah 5 Rangkaian Kereta Baru', source: 'Kompas.com', created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString() },
            { id: 2, title: 'Integrasi Tiket JakLingko Capai 90%', source: 'Detik.com', created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString() },
            { id: 3, title: 'Jam Operasional Diperpanjang Selama Akhir Pekan', source: 'CNN Indonesia', created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString() },
            { id: 4, title: 'Uji Coba Pembayaran QRIS di Semua Stasiun', source: 'BeritaSatu', created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString() },
            { id: 5, title: 'Pembangunan Fase 1B Velodrome-Manggarai Dimulai', source: 'Antara News', created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString() },
        ];
        setNewsData(dummyNews);
    }, []);

    return { newsData, isLoading, error };
};

// --- NEW Custom Hook for Social Media Growth (with Dummy Data) ---
const useSocialMediaData = () => {
    // ... (Komponen ini tidak berubah) ...
    const [socialData, setSocialData] = useState<SocialGrowth[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Set to false
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Dummy data
        const dummySocial: SocialGrowth[] = [
            { platform: 'instagram', growth_percentage: 12.5 },
            { platform: 'facebook', growth_percentage: 3.2 },
            { platform: 'twitter', growth_percentage: -1.1 },
            { platform: 'tiktok', growth_percentage: 22.8 },
            { platform: 'youtube', growth_percentage: 8.5 },
            { platform: 'linkedin', growth_percentage: 5.0 },
        ];
        setSocialData(dummySocial);
    }, []);

    return { socialData, isLoading, error };
};


// 3. Komponen untuk menampilkan satu Pie Chart
const PieChartCard = ({ data, isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    // Data untuk chart: satu slice untuk nilai, satu untuk sisa (agar menjadi 100%)
    const chartData = [
        { name: 'Capaian', value: data.value },
        { name: 'Sisa', value: 100 - data.value }
    ];
    // Warna untuk slice 'Capaian' dan 'Sisa'
    const colors = ['#d3242b', isLight ? '#e5e7eb' : '#374151'];

    return (
        <div className="flex flex-col items-center text-center">
            {/* Container untuk PieChart */}
            <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            innerRadius={0} // innerRadius 0 menjadikannya Pie, bukan Donut
                            outerRadius="80%" // Radius luar pie
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={0}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index]} stroke={colors[index]} />
                            ))}
                        </Pie>
                            <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            
            {/* Teks persentase di bawah chart */}
            <span className={`font-bold mt-2 text-lg ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {data.value > 0 ? `${data.value.toFixed(2)}%` : '0.00%'}
            </span>

            {/* Label Triwulan (TW-1, TW-2, dst.) */}
            <div className={`text-xs font-semibold mt-1 rounded-full px-2 py-0.5 inline-block ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300'}`}>
                {data.name}
            </div>
        </div>
    );
};


// 4. Komponen utama yang menggabungkan semuanya
const CustomerSatisfactionChart = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    const { surveyData, isLoading, error } = useSurveyData();

    // Gunakan useMemo untuk memproses data hanya ketika surveyData berubah
    const { lineData, pieData, currentYear } = React.useMemo(() => {
        if (!surveyData || surveyData.length === 0) {
            return { lineData: [], pieData: [], currentYear: new Date().getFullYear() };
        }

        // Proses data untuk Line Chart (agregat per tahun)
        const yearlyData = surveyData.reduce((acc, curr) => {
            if (!acc[curr.year]) {
                acc[curr.year] = { year: curr.year, totalAchievement: 0, totalTarget: 0, count: 0 };
            }
            acc[curr.year].totalAchievement += curr.achievement_value;
            acc[curr.year].totalTarget += curr.target_value;
            acc[curr.year].count++;
            return acc;
        }, {} as Record<number, { year: number; totalAchievement: number; totalTarget: number; count: number; }>);
        
        const processedLineData = Object.values(yearlyData)
            .map(y => ({
                name: y.year.toString(),
                Capaian: parseFloat((y.totalAchievement / y.count).toFixed(2)),
                Target: parseFloat((y.totalTarget / y.count).toFixed(2)),
            }))
            .sort((a, b) => parseInt(a.name) - parseInt(b.name));

        // Proses data untuk Pie Chart (data triwulan dari tahun terbaru)
        const latestYear = Math.max(...surveyData.map(d => d.year));
        const currentYearData = surveyData
            .filter(d => d.year === latestYear)
            .sort((a, b) => a.quarter - b.quarter);

        const processedPieData = currentYearData.map(q => ({
            name: `TW-${q.quarter}`,
            value: q.achievement_value,
            respondents: q.respondent_count,
        }));
        
        return {
            lineData: processedLineData,
            pieData: processedPieData,
            currentYear: latestYear,
        };
    }, [surveyData]);

    // --- PERUBAHAN DI SINI: Logika untuk kelas grid dinamis ---
    // Dinamis atur grid untuk Pie Chart berdasarkan jumlah data
    const pieGridClass = React.useMemo(() => {
        const length = pieData.length;
        if (length === 3) return 'grid-cols-3';
        if (length === 4) return 'grid-cols-4';
        if (length === 2) return 'grid-cols-2';
        if (length === 1) return 'grid-cols-1';
        return 'grid-cols-1'; // Default untuk 0 data
    }, [pieData.length]);
    // --- AKHIR PERUBAHAN ---

    // Tampilan saat loading
    if (isLoading) {
        return (
            <div className={`flex-1 rounded-lg p-3 flex items-center justify-center transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                <Loader2 className={`h-8 w-8 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} />
            </div>
        );
    }

    // Tampilan jika terjadi error
    if (error) {
        return (
            <div className={`flex-1 rounded-lg p-3 flex flex-col items-center justify-center text-center transition-colors ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-950 text-red-300'}`}>
                <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                <h3 className="font-bold">Gagal Memuat Data Survei</h3>
                <p className="text-xs mt-1">{error}</p>
            </div>
        );
    }

    // Tampilan utama setelah data berhasil dimuat
    return (
        <div className={`flex-1 rounded-lg p-3 flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <div className={`flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2`}>
                
                {/* Bagian Kiri: Line Chart */}
                <div className="flex flex-col">
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Rekam Capaian Kepuasan Tahunan</h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#334155'} />
                                <XAxis dataKey="name" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} />
                                <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} />
                                <Tooltip contentStyle={{ backgroundColor: isLight ? 'white' : '#0f172a', border: '1px solid #a16207', borderRadius: '6px', fontSize: '12px' }} labelStyle={{ color: isLight ? '#334155' : '#cbd5e1' }} />
                                <Legend wrapperStyle={{ fontSize: "12px" }} />
                                <Line type="monotone" dataKey="Capaian" stroke="#a16207" strokeWidth={2} />
                                <Line type="monotone" dataKey="Target" stroke="#D3242B" strokeWidth={2} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bagian Kanan: Pie Charts */}
                <div className="flex flex-col justify-center">
                    <h3 className={`text-sm font-bold text-center mb-4 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Capaian Per Triwulan - {currentYear}</h3>
                    {/* --- PERUBAHAN DI SINI: Menggunakan pieGridClass --- */}
                    <div className={`grid ${pieGridClass} gap-2`}>
                        {pieData.map(d => <PieChartCard key={d.name} data={d} isLight={isLight} />)}
                    </div>
                    {/* --- AKHIR PERUBAHAN --- */}
                </div>
            </div>
        </div>
    );
};


// --- NEW COMPONENT: Closing Rate Chart ---
const ClosingRateChart = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    const donutData = [
        { name: 'Prasarana', value: 296, color: '#64748b' },
        { name: 'IT', value: 81, color: '#D3242B' },
        { name: 'Sarana', value: 8, color: '#a16207' },
    ];
    const total = donutData.reduce((sum, entry) => sum + entry.value, 0);

    const barData = [
        { name: 'Prasarana', 'Closing Rate': 83.1, color: '#64748b' },
        { name: 'Sarana', 'Closing Rate': 100.0, color: '#a16207' },
        { name: 'IT', 'Closing Rate': 91.4, color: '#D3242B' },
    ];

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
                        <div className="flex items-center">
                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }}></span>
                            <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>{entry.name} ({entry.value})</span>
                        </div>
                        <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {barData.find(b => b.name === entry.name)['Closing Rate']}%
                        </span>
                    </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- UPDATED COMPONENT: Performance Chart (for OTP and SPM) ---
const PerformanceChart = ({ isLight, title, data, color, isLoading, error }) => {
    // ... (Komponen ini tidak berubah) ...
    if (isLoading) {
        return (
            <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col justify-center items-center min-h-[150px] ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
                <Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} />
            </div>
        )
    }

    if (error) {
        return (
            <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col justify-center items-center text-center min-h-[150px] ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-950 text-red-300'}`}>
                <AlertTriangle className="h-5 w-5 text-red-500 mb-1" />
                <h3 className="text-xs font-bold">Gagal Memuat</h3>
                <p className="text-xs">{title}</p>
            </div>
        );
    }
    
    if (!data || data.length === 0) {
         return (
            <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col justify-center items-center text-center min-h-[150px] ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
                <PieChartIcon className="h-5 w-5 text-slate-400 mb-1" />
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Data {title} tidak tersedia.</p>
            </div>
        );
    }

    const average = data.reduce((sum, item) => sum + item.value, 0) / data.length;
    return (
        <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>{title}</h2>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: -5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'transparent' : 'rgba(255,255,255,0.1)'} />
                        <XAxis dataKey="month" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} axisLine={false} tickLine={false} />
                        <YAxis 
                            domain={['dataMin - 2', 100]} 
                            stroke={isLight ? '#475569' : '#94a3b8'} 
                            style={{ fontSize: '10px' }} 
                            axisLine={false} 
                            tickLine={false}
                            tickFormatter={(value) => `${Math.round(value)}%`}
                        />
                        <Tooltip
                            cursor={{ fill: isLight ? '#f8fafc' : '#1e293b' }}
                            contentStyle={{ 
                                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)', 
                                backdropFilter: 'blur(4px)',
                                border: `1px solid ${color}`, 
                                borderRadius: '8px', 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                            }}
                            labelStyle={{ color: isLight ? '#334155' : '#cbd5e1', fontWeight: 'bold' }}
                            formatter={(value) => [`${value}%`, "Capaian"]}
                        />
                        <Bar dataKey="value" fill={color} barSize={12} radius={[4, 4, 4, 4]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className={`text-center text-xs mt-1 pt-1 border-t ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                Rata-rata {data.length} bulan: <span className="font-bold">{average.toFixed(2)}%</span>
            </div>
        </div>
    );
};

{/* --- NEW COMPONENT: Combined Performance Card (OTP & SPM) --- */}
const CombinedPerformanceCard = ({ isLight, otpData, spmData }) => {
    // ... (Komponen ini tidak berubah) ...
    const [visibleChart, setVisibleChart] = useState('OTP');

    useEffect(() => {
        const timer = setInterval(() => {
            setVisibleChart(prev => (prev === 'OTP' ? 'SPM' : 'OTP'));
        }, 5000); // 5 detik
        return () => clearInterval(timer);
    }, []);

    const chartConfig = {
        OTP: {
            title: 'Ketepatan Waktu (OTP)',
            color: '#a16207',
            ...otpData,
        },
        SPM: {
            title: 'Capaian SPM',
            color: '#F6821F',
            ...spmData,
        },
    };

    const { title, color, data, isLoading, error } = chartConfig[visibleChart];

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-1 justify-center items-center min-h-[150px]">
                    <Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-1 flex-col justify-center items-center text-center min-h-[150px]">
                    <AlertTriangle className="h-5 w-5 text-red-500 mb-1" />
                    <h3 className="text-xs font-bold">Gagal Memuat</h3>
                    <p className="text-xs">{title}</p>
                </div>
            );
        }
        
        if (!data || data.length === 0) {
            return (
                <div className="flex flex-1 flex-col justify-center items-center text-center min-h-[150px]">
                    <PieChartIcon className="h-5 w-5 text-slate-400 mb-1" />
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Data {title} tidak tersedia.</p>
                </div>
            );
        }

        const average = data.reduce((sum, item) => sum + item.value, 0) / data.length;
        
        return (
            <div className="flex-1 flex flex-col">
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: -5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'transparent' : 'rgba(255,255,255,0.1)'} />
                            <XAxis dataKey="month" stroke={isLight ? '#475569' : '#94a3b8'} style={{ fontSize: '10px' }} axisLine={false} tickLine={false} />
                            <YAxis 
                                domain={['dataMin - 2', 100]} 
                                stroke={isLight ? '#475569' : '#94a3b8'} 
                                style={{ fontSize: '10px' }} 
                                axisLine={false} 
                                tickLine={false}
                                tickFormatter={(value) => `${Math.round(value)}%`}
                            />
                            <Tooltip
                                cursor={{ fill: isLight ? '#f8fafc' : '#1e293b' }}
                                contentStyle={{ 
                                    backgroundColor: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)', 
                                    backdropFilter: 'blur(4px)',
                                    border: `1px solid ${color}`, 
                                    borderRadius: '8px', 
                                    fontSize: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                                }}
                                labelStyle={{ color: isLight ? '#334155' : '#cbd5e1', fontWeight: 'bold' }}
                                formatter={(value) => [`${value}%`, "Capaian"]}
                            />
                            <Bar dataKey="value" fill={color} barSize={12} radius={[4, 4, 4, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className={`text-center text-xs mt-1 pt-1 border-t ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                    Rata-rata {data.length} bulan: <span className="font-bold">{average.toFixed(2)}%</span>
                </div>
            </div>
        );
    };

    return (
        <div className={`rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>{title}</h2>
            
            {/* Animated Content */}
            <div key={visibleChart} className="animate-fade-in flex-1 flex flex-col">
                {renderContent()}
            </div>

            {/* Paging dots */}
            <div className="flex justify-center space-x-1.5 mt-2">
                {['OTP', 'SPM'].map((chartName) => (
                    <div
                        key={chartName}
                        className={`w-2 h-2 rounded-full transition-all ${
                            chartName === visibleChart ? (isLight ? 'bg-[#D3242B]' : 'bg-[#F6821F]') : (isLight ? 'bg-slate-300' : 'bg-slate-700')
                        }`}
                    ></div>
                ))}
            </div>
        </div>
    );
};


// --- NEW COMPONENT: Passenger Insights ---
const PassengerInsights = ({ isLight, weeklyData }) => {
    // ... (Komponen ini tidak berubah) ...
    if (!weeklyData || weeklyData.length === 0) {
        return <div className={`rounded-lg p-3 h-full flex items-center justify-center text-sm ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>Data tidak cukup untuk analisis.</div>;
    }

    const weekdays = weeklyData.filter(d => d.date.getDay() >= 1 && d.date.getDay() <= 5);
    const weekends = weeklyData.filter(d => d.date.getDay() === 0 || d.date.getDay() === 6);

    const avgWeekday = weekdays.length > 0 ? weekdays.reduce((sum, d) => sum + d.passengers, 0) / weekdays.length : 0;
    const avgWeekend = weekends.length > 0 ? weekends.reduce((sum, d) => sum + d.passengers, 0) / weekends.length : 0;

    // FIX: Calculate forecast based on the 3 days PRIOR to today.
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of the day for accurate comparison

    // Filter out today's data and get the last 3 completed days
    const completedDaysData = weeklyData.filter(d => d.date.getTime() < today.getTime());
    const lastThreeCompletedDays = completedDaysData.slice(-3);

    const forecast = lastThreeCompletedDays.length > 0
        ? (lastThreeCompletedDays.reduce((sum, d) => sum + d.passengers, 0) / lastThreeCompletedDays.length)
        : 0;


    return (
        <div className={`rounded-lg p-3 flex-shrink-0 transition-colors h-full flex flex-col ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Analisis & Proyeksi Penumpang</h2>
            <div className="flex-1 grid grid-rows-2 gap-3">
                {/* Weekday vs Weekend */}
                <div className="flex flex-col">
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Perbandingan Weekday vs Weekend</h3>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                        <div>
                            <div className={`text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rata-Rata Weekday</div>
                            <div className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.round(avgWeekday).toLocaleString('id-ID')}</div>
                            <div className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>({weekdays.length} hari)</div>
                        </div>
                        <div>
                            <div className={`text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rata-Rata Weekend</div>
                            <div className={`text-2xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.round(avgWeekend).toLocaleString('id-ID')}</div>
                            <div className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>({weekends.length} hari)</div>
                        </div>
                    </div>
                </div>
                {/* Forecast */}
                <div className={`flex flex-col items-center justify-center rounded-lg p-2 ${isLight ? 'bg-slate-50' : 'bg-slate-800/50'}`}>
                    <h3 className={`text-sm font-bold text-center mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Proyeksi Penumpang Besok</h3>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2">
                            <BrainCircuit className="w-8 h-8 text-[#F6821F]" />
                            <div className={`text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>~{Math.round(forecast).toLocaleString('id-ID')}</div>
                        </div>
                        <div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Berdasarkan tren 3 hari sebelumnya</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- NEW COMPONENT: Latest Issues ---
const LatestIssues = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    const issues = [
        { title: 'Maintenance terjadwal di Stasiun Velodrome', status: 'Scheduled', time: '08:00' },
        { title: 'Minor delay resolved - Stasiun Equestrian', status: 'Resolved', time: '07:30' }
    ];
    return (
        <div className={` ${isLight ? 'bg-white' : 'bg-slate-900'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Isu Terakhir</h2>
            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                {issues.map((item, idx) => (
                    <div key={idx} className={`border-l-4 pl-2 ${item.status === 'Resolved' ? 'border-emerald-500' : 'border-amber-500'}`}>
                        <div className="flex items-center justify-between">
                            <p className={`text-xs leading-tight ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{item.title}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.status === 'Resolved' ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400') : (isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-400')}`}>{item.status}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{item.time}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MODIFIED COMPONENT: Hot News Card (was NewsUpdates) ---
const HotNewsCard = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    const { newsData, isLoading, error } = useNewsData();
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (newsData && newsData.length > 0) {
            const timer = setInterval(() => {
                setCurrentIndex(prevIndex => (prevIndex + 1) % newsData.length);
            }, 10000); // 10 detik

            return () => clearInterval(timer);
        }
    }, [newsData]);

    const currentNews = newsData[currentIndex];

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-full"><Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
        }
        if (error) {
            return (
                <div className={`flex flex-col justify-center items-center h-full text-center ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                    <AlertTriangle className="h-5 w-5 text-red-500 mb-1" />
                    <p className="text-xs">Gagal memuat berita</p>
                </div>
            );
        }
        if (!currentNews) {
            return <div className={`flex justify-center items-center h-full text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tidak ada berita.</div>;
        }

        return (
            <div key={currentIndex} className="flex flex-col justify-center flex-1 animate-fade-in">
                <p className={`text-xs font-semibold leading-tight ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{currentNews.title}</p>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{currentNews.source} - {timeAgo(currentNews.created_at)}</p>
            </div>
        );
    };

    return (
        <div className={`relative rounded-lg p-2 shadow-sm transition-colors flex flex-col flex-1 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Hot News</h2>
            <div className="flex-1 overflow-hidden blur-sm"> {/* Added blur-sm */}
                {renderContent()}
            </div>
            {/* Paging dots */}
            <div className="flex justify-center space-x-1.5 mt-2 blur-sm"> {/* Added blur-sm */}
                {newsData.map((_, index) => (
                    <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all ${
                            index === currentIndex ? (isLight ? 'bg-[#D3242B]' : 'bg-[#F6821F]') : (isLight ? 'bg-slate-300' : 'bg-slate-700')
                        }`}
                    ></div>
                ))}
            </div>
            {/* We need to add keyframes for the fade animation */}
            <style>
                {`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }
                `}
            </style>

            {/* Transparent Overlay */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                <Target className={`h-10 w-10 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Hot News
                </h3>
                <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                    COMING SOON
                </span>
            </div>
        </div>
    );
};


// --- MODIFIED COMPONENT: Social Media Growth Card (was SocialSentimentCard) ---
const SocialMediaGrowthCard = ({ isLight }) => {
    // ... (Komponen ini tidak berubah) ...
    const { socialData, isLoading, error } = useSocialMediaData();

    const socialIcons = {
        instagram: <Instagram className="w-5 h-5 text-[#E1306C]" />,
        facebook: <Facebook className="w-5 h-5 text-[#1877F2]" />,
        twitter: <Twitter className="w-5 h-5 text-[#1DA1F2]" />,
        tiktok: <Hash className="w-5 h-5" style={{color: isLight ? 'black' : 'white'}} />, // Lucide doesn't have TikTok, using Hash
        youtube: <Youtube className="w-5 h-5 text-[#FF0000]" />,
        linkedin: <Linkedin className="w-5 h-5 text-[#0A66C2]" />,
    };

    const platformOrder = ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'];

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-full"><Loader2 className={`h-6 w-6 animate-spin ${isLight ? 'text-[#D3242B]' : 'text-[#F6821F]'}`} /></div>;
        }
        if (error) {
            return (
                <div className={`flex flex-col justify-center items-center h-full text-center ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                    <AlertTriangle className="h-5 w-5 text-red-500 mb-1" />
                    <p className="text-xs">Gagal memuat data</p>
                </div>
            );
        }

        const sortedData = [...socialData].sort((a, b) => 
            platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform)
        );

        return (
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 pt-2">
                {sortedData.map(social => {
                    const growth = social.growth_percentage;
                    const color = growth > 0 ? 'text-emerald-500' : growth < 0 ? 'text-red-500' : (isLight ? 'text-slate-500' : 'text-slate-400');
                    const Icon = growth > 0 ? ArrowUp : growth < 0 ? ArrowDown : null;
                    return (
                        <div key={social.platform} className="flex flex-col items-center text-center">
                            {socialIcons[social.platform]}
                            <span className={`text-[11px] font-bold capitalize mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{social.platform}</span>
                            <span className={`text-xs font-bold flex items-center ${color}`}>
                                {Icon && <Icon className="w-3 h-3" />}
                                {growth.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`relative rounded-lg p-2 shadow-sm transition-colors flex flex-col ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900 border border-slate-800'}`}>
            <h2 className={`text-xs font-bold mb-1 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Pertumbuhan Sosmed (Bulan Ini)</h2>
            <div className="flex-1 blur-sm"> {/* Added blur-sm */}
                {renderContent()}
            </div>

             {/* Transparent Overlay */}
             <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                <Target className={`h-10 w-10 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                <h3 className={`text-sm font-bold text-center ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Pertumbuhan Sosmed
                </h3>
                <span className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                    COMING SOON
                </span>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Realtime Peak Hours Info ---
const RealtimeHoursInfo = ({ isLight, peakHours }) => {
    // ... (Komponen ini tidak berubah) ...
    const formatHourRange = (hour) => {
        if (hour === null || hour < 0 || hour > 23) {
            return 'N/A';
        }
        const start = hour.toString().padStart(2, '0');
        const end = (hour + 1).toString().padStart(2, '0');
        return `${start}:00 - ${end}:00`;
    };

    return (
      <div className={`mt-3 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <h3 className={`text-xs font-bold uppercase mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Analisis Jam Sibuk (Hari Ini)</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Jam Tersibuk</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}`}>
              {peakHours ? formatHourRange(peakHours.busiest) : 'Menghitung...'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Jam Tersepi</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {peakHours ? formatHourRange(peakHours.quietest) : 'Menghitung...'}
            </span>
          </div>
        </div>
      </div>
    );
};


// --- Main Dashboard Component ---
const LRTJakartaDashboard = () => {
    // ... (State, hooks, dan logika lainnya tidak berubah) ...
    // State for UI elements like current time, theme, and simulated train positions.
    const [currentTime, setCurrentTime] = useState(new Date());
    const [theme, setTheme] = useState('light');
    
    // --- PERUBAHAN DI SINI: Menghapus state trainPositions ---
    // const [trainPositions, setTrainPositions] = useState([
    //     { id: 1, position: 10, direction: 1, driver: 'Ahmad S.', speed: 45 },
    //     { id: 2, position: 50, direction: -1, driver: 'Budi P.', speed: 52 },
    //     { id: 3, position: 85, direction: 1, driver: 'Citra W.', speed: 48 }
    // ]);
    // --- AKHIR PERUBAHAN ---

    // Use the custom hook to fetch data for "Today" and "This Week".
    // MODIFICATION: Set a 15-second refresh interval for all API data sources.
    const {
        isLoading: isTodayLoading, error, totalTransactions: todayTotalTransactions, percentageChange, stationSummary, peakHours, yesterdayTotal
    } = useTrafficData({ defaultRange: 'today', refreshInterval: 15000 });

    const {
        totalTransactions: monthlyTotalTransactions,
        isLoading: isMonthLoading,
    } = useTrafficData({ defaultRange: 'month', refreshInterval: 15000 });

    const {
        totalTransactions: prevMonthTotalTransactions,
        isLoading: isPrevMonthLoading,
    } = useTrafficData({ defaultRange: 'previous-month', refreshInterval: 15000 });

    const {
        chartData: weeklyChartData,
        isLoading: isWeekLoading,
    } = useTrafficData({ defaultRange: 'week', refreshInterval: 15000 });
    
    // NEW: Fetch performance data from API
    const { data: onTimeData, isLoading: isOtpLoading, error: otpError } = usePerformanceData('OTP');
    const { data: spmData, isLoading: isSpmLoading, error: spmError } = usePerformanceData('SPM');
    
    // --- MODIFICATION START: Calculate PREVIOUS month's OTP and Target ---
    const today = new Date();
    // Set date to 0 to get the last day of the *previous* month
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth(), 0); 
    const prevMonthIndex = prevMonthDate.getMonth() + 1; // getMonth() will be 0-11 for the prev month, +1 makes it 1-12

    const prevMonthOtpData = onTimeData.find(d => d.monthIndex === prevMonthIndex);
    const prevMonthOtpValue = prevMonthOtpData ? prevMonthOtpData.value : null;
    const prevMonthOtpTarget = prevMonthOtpData ? prevMonthOtpData.target : null;
    // --- MODIFICATION END ---

    // --- FIX STARTS HERE ---
    // Blok ini memastikan data chart mingguan selalu sinkron dengan data "hari ini" yang terbaru.
    // Hook untuk data mingguan (`useTrafficData({ defaultRange: 'week' })`) menggunakan cache yang bisa jadi datanya sudah 1 jam yang lalu.
    // Sementara itu, hook untuk data "hari ini" melakukan refresh setiap 15 detik.
    // Kode ini mengambil data mingguan (yang mungkin dari cache) dan mengganti nilai untuk hari ini dengan `todayTotalTransactions` yang paling baru.
    // Ini menyelesaikan perbedaan data tanpa mengubah struktur hook pengambilan data yang sudah ada.
    const updatedWeeklyChartData = React.useMemo(() => {
        if (!weeklyChartData || weeklyChartData.length === 0) {
            // Jika data MINGGUAN BELUM ada (loading atau cache kosong), KEMBALIKAN array kosong.
            // Biarkan <Loader2> yang ditampilkan di bawah.
            return [];
        }

        // Jika data mingguan ADA, lanjutkan dengan logika update
        const newChartData = [...weeklyChartData];

        const todayIndex = newChartData.findIndex(d => {
            const itemDate = new Date(d.date);
            const today = new Date();
            return itemDate.getFullYear() === today.getFullYear() &&
                   itemDate.getMonth() === today.getMonth() &&
                   itemDate.getDate() === today.getDate();
        });

        // Jika titik data hari ini ada di dalam array data mingguan, perbarui jumlah penumpangnya
        // dengan total terbaru yang diambil oleh hook 'today'.
        if (todayIndex !== -1) {
            newChartData[todayIndex] = {
                ...newChartData[todayIndex],
                passengers: todayTotalTransactions,
            };
        }

        return newChartData;
    }, [weeklyChartData, todayTotalTransactions]);
    // --- FIX ENDS HERE ---

    // Effect to update the current time every second.
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- PERUBAHAN DI SINI: Menghapus useEffect animasi kereta ---
    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         setTrainPositions(prev => prev.map(train => {
    //             let newPosition = train.position + (train.direction * 0.25);
    //             let newDirection = train.direction;
    //             if (newPosition >= 100) { newPosition = 100; newDirection = -1; }
    //             else if (newPosition <= 0) { newPosition = 0; newDirection = 1; }
                
    //             // ✅ MODIFICATION: Add speed simulation
    //             const speedFluctuation = Math.random() * 4 - 2; // Random number between -2 and 2
    //             let newSpeed = Math.max(30, Math.min(40, train.speed + speedFluctuation)); // Clamp speed between 30 and 70

    //             return { ...train, position: newPosition, direction: newDirection, speed: Math.round(newSpeed) };
    //         }));
    //     }, 100);
    //     return () => clearInterval(interval);
    // }, []);
    // --- AKHIR PERUBAHAN ---

    // Function to toggle between light and dark themes.
    const toggleTheme = () => {
        setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
    };

    const isLight = theme === 'light';

    // Process the station summary data to determine status and sort by traffic.
    const processedStations = Object.entries(stationSummary)
        .map(([code, summary]) => {
            let status = 'Low';
            if (summary.total > 4000) status = 'High';
            else if (summary.total > 1500) status = 'Medium';
            return {
                name: STATION_NAMES[code] || code,
                traffic: summary.total,
                status: status,
                change: summary.change || null,
            };
        })
        .sort((a, b) => b.traffic - a.traffic);

    // Render an error screen if data fetching fails.
    if (error) {
        return (
            <div className={`h-screen flex flex-col items-center justify-center p-4 text-center ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-950 text-red-200'}`}>
                <WifiOff className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold">Gagal Terhubung ke Server</h2>
                <p className="mt-2 text-md max-w-md">Tidak dapat mengambil data operasional. Mohon periksa koneksi Anda atau coba lagi nanti.</p>
                <p className={`mt-4 text-sm font-mono p-2 rounded ${isLight ? 'bg-red-100' : 'bg-red-900/50'}`}>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Import custom Google Font */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap'); .font-jakarta-sans { font-family: 'Plus Jakarta Sans', sans-serif; }`}</style>
            {/* Main container: Added min-h-screen for mobile scrolling, lg:h-screen lg:overflow-hidden for fixed desktop */}
            <div className={`min-h-screen lg:h-screen lg:overflow-hidden p-3 flex flex-col font-jakarta-sans transition-colors duration-300 ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-950 text-slate-200'}`}>
                {/* Header: Added flex-col md:flex-row */}
                <header className="mb-2 flex flex-col md:flex-row justify-between items-center p-3 rounded-lg bg-gradient-to-r from-[#D3242B] to-[#F6821F] flex-shrink-0 shadow-lg">
                    {/* Header Left: Added flex-col md:flex-row and text-center md:text-left */}
                    <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-2 md:gap-4">
                        <img 
                            src="https://e-ptw.lrtjakarta.co.id/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo-lrtj-white.847caf54.png&w=640&q=75" 
                            alt="LRT Jakarta Logo" 
                            className="h-10"
                        />
                        <div>
                            <h1 className="text-xl font-bold tracking-wide text-white">LRT JAKARTA DASHBOARD</h1>
                            <p className="text-xs font-semibold text-white/80">Pegangsaan Dua - Velodrome Line | Real-Time Monitoring System</p>
                        </div>
                    </div>
                    {/* Header Right: Added mt-3 md:mt-0 */}
                    <div className="flex items-center gap-4 mt-3 md:mt-0">
                        <div className="text-right">
                            <div className="text-xl font-bold text-white">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-white/80 text-xs">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        </div>
                        <button onClick={toggleTheme} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">{isLight ? <Moon size={20} /> : <Sun size={20} />}</button>
                    </div>
                </header>

                {/* MODIFIKASI: Top KPI Bar - Dibuat lebih ringkas */}
                <section className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1 mb-2 flex-shrink-0 rounded-lg p-1 transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                    <div className="text-center p-1.5">
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Penumpang Hari Ini</div>
                        <div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{todayTotalTransactions.toLocaleString('id-ID')}</div>
                        <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>on going (ex KLG & Qr)</div>
                    </div>
                    <div className="text-center border-l p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}>
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Penumpang Kemarin</div>
                        <div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{yesterdayTotal.toLocaleString('id-ID')}</div>
                        <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Harian (ex KLG & Qr)</div>
                    </div>
                    <div className="text-center border-l p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}>
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Penumpang Bulan Ini</div>
                        {isMonthLoading ? <div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-red-500" /></div> : (
                            <>
                                <div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{monthlyTotalTransactions.toLocaleString('id-ID')}</div>
                                <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Akumulasi (ex KLG & Qr)</div>
                            </>
                        )}
                    </div>
                     <div className="text-center border-l border-r p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}>
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Penumpang Bulan Lalu</div>
                        {isPrevMonthLoading ? <div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-red-500" /></div> : (
                            <>
                                <div className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{prevMonthTotalTransactions.toLocaleString('id-ID')}</div>
                                <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Bulanan (ex KLG & Qr)</div>
                            </>
                        )}
                    </div>
                    <div className="text-center border-r p-1.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}>
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>On-Time Performance</div>
                        {isOtpLoading ? (
                           <div className="flex justify-center mt-1"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                        ) : (
                            <>
                                {/* --- MODIFICATION START: Using previous month's data --- */}
                                <div className={`text-xl font-bold flex items-center justify-center gap-1.5 ${prevMonthOtpValue && prevMonthOtpTarget && prevMonthOtpValue >= prevMonthOtpTarget ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    <CheckCircle className="h-4 w-4" />
                                    {prevMonthOtpValue !== null ? `${prevMonthOtpValue.toFixed(1)}%` : 'N/A'}
                                </div>
                                <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Target: {prevMonthOtpTarget !== null ? `${prevMonthOtpTarget}%` : 'N/A'} (Bln Lalu)
                                </div>
                                {/* --- MODIFICATION END --- */}
                            </>
                        )}
                    </div>
                    <div className="text-center p-1.5">
                        <div className={`text-[11px] font-bold uppercase mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Trip Selesai</div>
                        <div className="text-xl font-bold text-emerald-500 flex items-center justify-center gap-1.5"><Repeat className="h-4 w-4" /> 178/180</div>
                        <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Performa 98.9%</div>
                    </div>
                    
                </section>
                {/* END MODIFIKASI */}

                {/* Main Content Area */}
                <main className="flex-1 min-h-0 flex flex-col gap-2">
                    {/* Row 1: Added grid-cols-1 lg:grid-cols-12 */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 flex-1 min-h-0">
                        {/* Station Traffic Panel: Added lg:col-span-3 */}
                        {/* --- RESPONSIVE FIX: Changed lg:col-span-3 to md:col-span-5 lg:col-span-3 --- */}
                        {/* --- PERUBAHAN DI SINI: Menghapus 'h-full' agar panel menyesuaikan tinggi konten --- */}
                        <div className={`md:col-span-5 lg:col-span-3 rounded-lg p-3 flex flex-col transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                            <h2 className={`text-xs font-bold mb-2 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>
                                Trafik Stasiun
                            </h2>

                            {/* --- PERUBAHAN DI SINI: Menambahkan flex-1, min-h-0 agar bisa scroll --- */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {processedStations.length > 0 ? (
                                    // --- RESPONSIVE FIX: Changed grid-cols-3 to be more adaptive ---
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {processedStations.map((station, idx) => (
                                            <div
                                                key={idx}
                                                className={`rounded-md p-2 border ${isLight ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-950'} flex flex-col justify-between`}
                                            >
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span
                                                        className={`w-2 h-2 rounded-full ${
                                                            station.status === 'High'
                                                                ? 'bg-red-500'
                                                                : station.status === 'Medium'
                                                                ? 'bg-amber-500'
                                                                : 'bg-emerald-500'
                                                        }`}
                                                    ></span>
                                                    <span className={`text-xs font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                                        {station.name}
                                                    </span>
                                                </div>

                                                <div className="text-right">
                                                    <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        {station.traffic.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // --- PERUBAHAN DI SINI: Menghapus 'h-full' dan memberi padding 'py-4' ---
                                    <div className="flex justify-center items-center py-4">
                                        {isTodayLoading ? 
                                            <Loader2 className="h-6 w-6 animate-spin text-red-500" /> :
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tidak ada data trafik.</p>
                                        }
                                    </div>
                                )}
                            </div>

                            {!isTodayLoading && processedStations.length > 0 && (
                                <div className={`mt-3 pt-0 border-t flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className={`${isLight ? 'text-slate-500' : 'text-slate-400'} font-semibold`}>Legenda:</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Tinggi (&gt;4k)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                            <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Sedang (&gt;1.5k)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Rendah</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* ✅ NEW: Peak Hours Info Component */}
                            {/* Tampilkan bahkan saat loading jika ada data cache */}
                            {peakHours && (
                                <RealtimeHoursInfo isLight={isLight} peakHours={peakHours} />
                            )}
                            
                            {/* Tampilkan isu terakhir (statis) */}
                                <div className={`mt-4 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                                <LatestIssues isLight={isLight} />
                            </div>
                        </div>


                        {/* Middle column wrapper: Added lg:col-span-6 */}
                        {/* --- RESPONSIVE FIX: Changed lg:col-span-6 to md:col-span-7 lg:col-span-6 --- */}
                        <div className="md:col-span-7 lg:col-span-6 flex flex-col gap-2">
                            {/* --- PERUBAHAN DI SINI: Menambahkan overlay "Coming Soon" transparan --- */}
                            <div className={`relative rounded-lg p-3 flex flex-col justify-center transition-colors ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'} min-h-[260px]`}>
                                {/* Container for the two-track simulation (visual only) */}
                                <div className="relative w-full h-24 mt-2">
                                    {/* Top Track: PGD -> VLD */}
                                    <div className="absolute top-[calc(50%-20px)] left-0 right-0 h-1 bg-gradient-to-r from-[#D3242B] to-[#F6821F] opacity-50"></div>
                                    <div className={`absolute top-[calc(50%-48px)] left-0 text-xs font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>PGD → VLD</div>

                                    {/* Bottom Track: VLD -> PGD */}
                                    <div className="absolute top-[calc(50%+20px)] left-0 right-0 h-1 bg-gradient-to-r from-[#F6821F] to-[#D3242B] opacity-50"></div>
                                    <div className={`absolute top-[calc(50%+36px)] right-0 text-xs font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>VLD → PGD</div>

                                    {/* Station markers positioned in the center */}
                                    {Object.values(STATION_NAMES).map((name, idx, arr) => (
                                        <div key={idx} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${(idx / (arr.length - 1)) * 100}%` }}>
                                            <div className="w-4 h-4 rounded-full border-2 -translate-x-1/2" style={{ backgroundColor: '#F6821F', borderColor: '#D3242B' }}></div>
                                            <span className={`absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap w-24 text-center ${isLight ? 'text-slate-500' : 'text-slate-400'} ${idx % 2 === 0 ? 'top-full mt-6' : 'bottom-full mb-6'}`}>{name}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Transparent Overlay */}
                                <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${isLight ? 'bg-white/80' : 'bg-slate-950/80'} backdrop-blur-sm`}>
                                    <Target className={`h-12 w-12 mb-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                                    <h3 className={`text-lg font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                        Real-Time Train Location
                                    </h3>
                                    <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Fitur ini sedang dalam pengembangan.
                                    </p>
                                    <span className={`mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'}`}>
                                        COMING SOON
                                    </span>
                                </div>
                            </div>
                            {/* --- AKHIR PERUBAHAN --- */}


                            <CustomerSatisfactionChart isLight={isLight} />
                        </div>

                        {/* --- PERUBAHAN ANDA DIMULAI DI SINI --- */}
                        {/* Right Sidebar with smaller info cards: Added lg:col-span-3 */}
                        {/* --- RESPONSIVE FIX: Changed lg:col-span-3 to md:col-span-12 lg:col-span-3 --- */}
                        {/* --- PERUBAHAN DI SINI: Menambahkan overflow-y-auto --- */}
                        <div className="md:col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
                            <SocialSentimentCard isLight={isLight} />
                            <SocialMediaGrowthCard isLight={isLight} />
                            <HotNewsCard isLight={isLight} />
                            
                            {/* Mengganti dua <PerformanceChart> dengan satu <CombinedPerformanceCard> */}
                            <CombinedPerformanceCard 
                                isLight={isLight}
                                otpData={{ data: onTimeData, isLoading: isOtpLoading, error: otpError }}
                                spmData={{ data: spmData, isLoading: isSpmLoading, error: spmError }}
                            />
                            
                            <ClosingRateChart isLight={isLight} />
                        </div>
                        {/* --- PERUBAHAN ANDA BERAKHIR DI SINI --- */}
                    </div>

                    {/* Bottom Section - Tata letak ini sudah benar */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 flex-shrink-0">
                        {/* Weekly Chart */}
                        <div className={`lg:col-span-2 rounded-lg p-3 transition-colors flex flex-col h-[300px] lg:h-full ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-800'}`}>
                            <h2 className={`text-xs font-bold mb-1 uppercase border-b pb-1 flex-shrink-0 ${isLight ? 'text-[#D3242B] border-slate-200' : 'text-[#F6821F] border-slate-800'}`}>Tren Penumpang Mingguan</h2>
                            <div className="flex-1 min-h-0">
                                {/* --- PERUBAHAN DI SINI: Menggunakan updatedWeeklyChartData untuk kondisi loading --- */}
                                {isWeekLoading && (!updatedWeeklyChartData || updatedWeeklyChartData.length === 0) ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={updatedWeeklyChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#F6821F" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#F6821F" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
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
                        {/* Passenger Insights */}
                        <div className="lg:col-span-1 h-full">
                            <PassengerInsights isLight={isLight} weeklyData={updatedWeeklyChartData} />
                        </div>
                        {/* Closing Rate */}
                        {/* <div className="lg:col-span-1 h-full">
                            
                        </div> */}
                    </div>
                </main>
            </div>
        </>
    );
};

export default LRTJakartaDashboard;
