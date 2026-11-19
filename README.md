# Jakarta LRT - Real-Time Monitoring Dashboard

A modern, real-time dashboard for monitoring the Jakarta LRT system. Built with React, TypeScript, and Tailwind CSS, featuring glassmorphism effects and bento grid layout.

## Features

- **Real-time Train Tracking**: Live visualization of train positions across the LRT network
- **Station Traffic Monitoring**: Real-time passenger flow at each station
- **Performance Analytics**: On-time performance tracking with historical data
- **KPI Dashboard**: Key metrics including active trains, passengers, and trip duration
- **Interactive Charts**: Daily visitors and ticket type distribution
- **Modern UI/UX**: Glassmorphism effects with smooth animations

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Icons**: Lucide React
- **Data Fetching**: React hooks with polling

## API Integration

The dashboard is designed to consume three main API endpoints:

### 1. Real-time Train Position
- **Endpoint**: `/api/trains/live`
- **Method**: `GET`
- **Polling**: Every 10 seconds
- **Component**: `TrainRouteVisualization.tsx`
- **Data**: Train ID, position, speed, driver name, station info

### 2. Station Traffic Status
- **Endpoint**: `/api/traffic-data?start_date={start}&end_date={end}`
- **Method**: `GET`
- **Polling**: Today's data refreshes every 15 seconds; historical totals also use browser caches
- **Component**: `Index.tsx`, `StationTrafficStatus.tsx`
- **Data**: Gate-out total, station, card type, timestamp
- **Authentication**: Server-side LRT login; upstream credentials and tokens never go to the browser

### 3. On-Time Performance
- **Endpoint**: `/api/performance/history?startDate={start}&endDate={end}`
- **Method**: `GET`
- **Trigger**: Date range filter change
- **Component**: `PerformanceChart.tsx`
- **Data**: Historical performance metrics

## Project Structure

```
src/
├── components/
│   ├── DashboardHeader.tsx       # Top navigation with breadcrumbs
│   ├── KPICard.tsx               # Reusable KPI metric card
│   ├── TrainRouteVisualization.tsx  # Live train positions
│   ├── StationTrafficStatus.tsx  # Real-time traffic list
│   ├── PerformanceChart.tsx      # Area chart with date filter
│   ├── VisitorsChart.tsx         # Daily visitors bar chart
│   ├── TicketShareChart.tsx      # Ticket distribution pie chart
│   └── ui/                       # shadcn components
├── pages/
│   └── Index.tsx                 # Main dashboard page
├── index.css                     # Design system tokens
└── main.tsx                      # App entry point
```

## Design System

The dashboard uses a comprehensive design system with:

- **Primary Color**: Orange (#FF6B2C / HSL 16, 100%, 58%)
- **Accent Color**: Amber (#FF8C42 / HSL 25, 95%, 53%)
- **Glass Effects**: Backdrop blur with semi-transparent backgrounds
- **Animations**: Train movements, card hovers, slide-in effects
- **Responsive**: Mobile-first approach with bento grid

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Passenger data uses `GET /api/traffic-data?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`.
The server logs into the LRT API and retains its token in memory. The browser receives
only passenger rows (station, time, card type) and a total, without API credentials or tokens.
The old `/api/index.php/...` browser proxy is disabled.

For local development, copy `.env.example` to `.env.local`, fill in the API credentials,
then restart `npm run dev`. Vite runs the same server handler for development and preview.
Never use a `VITE_` prefix for credentials, because those variables are intended for browser code.

### Docker deployment

The image runs Nginx on port 4023 and a private Node service on `127.0.0.1:3001`.
Only port 4023 needs to be published. Existing domain reverse proxies can continue
forwarding requests to that port; direct access is `http://DASHBOARD_SERVER_IP:4023`.
The dashboard server/container must be able to reach `10.214.91.58:80`.

On the deployment server, prepare an untracked credentials file once:

```bash
cd /var/www/lrt-pulse-live
cp .env.example .env
chmod 600 .env
nano .env
```

Fill in `LRT_API_RQID`, `LRT_API_USERNAME`, and `LRT_API_PASSWORD` using the API account.
The password must use the same format expected by the upstream login API.
Do not commit this file. Docker's build context excludes environment files; credentials
are passed only when the container starts.

Build first, and replace the running container only after the build succeeds:

```bash
docker build -t dashboard-container:latest .
```

```bash
docker stop dashboard-container
docker rm dashboard-container
docker run -d --name dashboard-container --restart unless-stopped \
  --env-file /var/www/lrt-pulse-live/.env \
  -p 4023:4023 dashboard-container:latest
```

Preserve any additional network or volume options used by your deployment. This change
requires a full image rebuild and container replacement; copying Nginx configuration
alone does not install the new backend or remove credentials from old browser bundles.

Verify in browser DevTools after refreshing: passenger requests should go to
`/api/traffic-data?...`, with date filters and no upstream login payload or bearer token.
The credentials were previously embedded in JavaScript; rotate the upstream API account
credentials as part of this deployment and put the replacement values in `.env`.

Run the server isolation/error-handling tests with `npm run test:server`.

## Customization

### Changing Colors
Edit design tokens in `src/index.css`:
```css
--primary: 16 100% 58%;  /* Orange */
--accent: 25 95% 53%;    /* Amber */
```

### Adjusting Polling Intervals
Modify `setInterval` duration in components (default: 10000ms)

### Adding New Stations
Update the `STATIONS` array in `TrainRouteVisualization.tsx`

## Performance

- Optimized with React hooks
- Debounced data fetching
- Lazy-loaded components
- Tree-shaken icon imports

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - Jakarta LRT Operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
