import { createServer } from 'node:http';

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function createTrafficHandler({ env = process.env, fetchImpl = fetch } = {}) {
  let token;
  let pendingLogin;

  const post = async (path, body, auth) => {
    const response = await fetchImpl(`${env.LRT_API_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401 || response.status === 403) throw new ApiError(401, 'Upstream authentication failed');
    if (!response.ok) throw new ApiError(502, 'Layanan data penumpang gagal merespons.');
    const result = await response.json();
    if (!(result.code === 0 || result.sts === 'S') && /token|unauthori[sz]ed/i.test(result.msg ?? result.message ?? '')) {
      throw new ApiError(401, 'Upstream authentication failed');
    }
    return result;
  };

  const login = async () => {
    if (token) return token;
    if (!pendingLogin) {
      pendingLogin = (async () => {
        const result = await post('/login/doLogin', {
          rqid: env.LRT_API_RQID, username: env.LRT_API_USERNAME,
          password: env.LRT_API_PASSWORD, type: 'web',
        });
        const value = result.data?.token || result.token || result.data?.access_token;
        if (!(result.code === 0 || result.sts === 'S') || typeof value !== 'string' || !value) {
          throw new ApiError(502, 'Autentikasi layanan penumpang gagal.');
        }
        token = value;
        return token;
      })().finally(() => { pendingLogin = undefined; });
    }
    return pendingLogin;
  };

  const traffic = async (start, end, status, retried = false) => {
    const currentToken = await login();
    try {
      const result = await post('/transaction/list_gate_out_prepaid_trx', {
        rqid: env.LRT_API_RQID, order: 'DESC', start_date: start, end_date: end,
        rows: '100000', sort: 'gate_out_on_dtm', page: '1', status_trx: status,
        card_number: '', station_code: '', terminal_in: '', terminal_out: '', card_type: '',
      }, currentToken);
      if ((result.code === 0 || result.sts === 'S') && result.data) {
        const rows = (result.data.rows || []).map((row) => ({
          station_code_var: row.station_code_var,
          gate_out_on_dtm: row.gate_out_on_dtm,
          card_type_var: row.card_type_var,
        }));
        return { rows, total: Number(result.data.total) || 0 };
      }
      if (/success/i.test(result.msg ?? result.message ?? '') && !result.data) return { rows: [], total: 0 };
      throw new ApiError(502, 'Layanan data penumpang gagal merespons.');
    } catch (error) {
      if (error.status === 401) {
        if (token === currentToken) token = undefined;
        if (!retried) return traffic(start, end, status, true);
      }
      throw error;
    }
  };

  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/api/traffic-data') return reply(404, { message: 'Not found' });
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return reply(405, { message: 'Method not allowed' });
      }
      const start = url.searchParams.get('start_date');
      const end = url.searchParams.get('end_date');
      const status = url.searchParams.get('status_trx') ?? 'S';
      if (!validDate(start) || !validDate(end) || end < start ||
          Date.parse(end) - Date.parse(start) > 62 * 86_400_000 || !['', 'S'].includes(status)) {
        return reply(400, { message: 'Rentang tanggal tidak valid (maksimal 62 hari).' });
      }
      if (!['LRT_API_BASE_URL', 'LRT_API_RQID', 'LRT_API_USERNAME', 'LRT_API_PASSWORD'].every((key) => env[key])) {
        return reply(503, { message: 'Konfigurasi layanan penumpang belum lengkap di server.' });
      }
      return reply(200, { code: 0, sts: 'S', data: await traffic(start, end, status) });
    } catch (error) {
      // Never relay upstream bodies, tokens, credentials, or connection details to browsers/logs.
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      return reply(timeout ? 504 : 502, {
        message: timeout ? 'Layanan penumpang tidak merespons tepat waktu.' : 'Tidak dapat mengambil data penumpang dari layanan API.',
      });
    }
  };
}

export function createTrafficServer(options) {
  return createServer(createTrafficHandler(options));
}
