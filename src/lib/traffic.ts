interface TrafficRow {
  station_code_var: string;
  gate_out_on_dtm: string;
  card_type_var: string;
}

export async function requestTrafficData(start: string, end: string, status = 'S'): Promise<{ rows: TrafficRow[]; total: number }> {
  const query = new URLSearchParams({ start_date: start, end_date: end, status_trx: status });
  const response = await fetch(`/api/traffic-data?${query}`, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !result.data) throw new Error(result.message || 'Gagal mengambil data penumpang.');
  return result.data;
}
