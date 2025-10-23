
/**
 * Melakukan login ke API LRT dari sisi server untuk mendapatkan token otorisasi.
 * Kredensial diambil dari environment variables yang aman.
 * @returns {Promise<string>} Token otorisasi.
 */
async function performLrtLogin() {
    try {
        const response = await fetch(`${process.env.LRT_API_BASE_URL}/login/doLogin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rqid: process.env.LRT_API_RQID,
                username: process.env.LRT_API_USERNAME,
                password: process.env.LRT_API_PASSWORD,
                type: "web"
            })
        });

        if (!response.ok) {
            console.error("Server-side login response not OK:", await response.text());
            throw new Error(`Server-side login failed with status: ${response.status}`);
        }

        const result = await response.json();
        const token = result.data?.token || result.token || result.data?.access_token;

        if (!token) {
            console.error("Server-side login failed: No token in response from LRT API", result);
            throw new Error("Authentication with LRT API failed on the server.");
        }
        return token;

    } catch (error) {
        console.error("LRT Login Error (server-side):", error.message);
        throw error; // Lempar error untuk ditangkap oleh handler utama
    }
}


/**
 * Handler utama untuk API route.
 * Menerima request dari frontend, lalu secara aman mengambil data dari API LRT.
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ message: 'Query parameters "start_date" and "end_date" are required.' });
    }

    try {
        // 1. Lakukan login aman di server untuk mendapatkan token
        const token = await performLrtLogin();

        // 2. Gunakan token untuk mengambil data lalu lintas
        const trafficResponse = await fetch(`${process.env.LRT_API_BASE_URL}/transaction/list_gate_out_prepaid_trx`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                rqid: process.env.LRT_API_RQID,
                order: "DESC",
                start_date, // Ambil dari query request
                end_date,   // Ambil dari query request
                rows: "100000",
                sort: "gate_out_on_dtm",
                page: "1",
                status_trx: "S",
                card_number: "", station_code: "", terminal_in: "",
                terminal_out: "", card_type: ""
            })
        });
        
        if (!trafficResponse.ok) {
             console.error("Fetch traffic data response not OK:", await trafficResponse.text());
            throw new Error(`Failed to fetch traffic data from LRT API. Status: ${trafficResponse.status}`);
        }

        const trafficData = await trafficResponse.json();

        // 3. Kirim data yang berhasil didapat kembali ke frontend
        return res.status(200).json(trafficData);

    } catch (error) {
        console.error("API Route /api/traffic-data Error:", error.message);
        return res.status(500).json({ sts: 'E', msg: error.message || 'An internal server error occurred' });
    }
}