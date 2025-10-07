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
- **Endpoint**: `/api/stations/traffic`
- **Method**: `GET`
- **Polling**: Every 10 seconds
- **Component**: `StationTrafficStatus.tsx`
- **Data**: Entry/exit transactions, card types, timestamps

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

Currently using mock data. To connect to real APIs, update the fetch URLs in:
- `src/components/TrainRouteVisualization.tsx`
- `src/components/StationTrafficStatus.tsx`
- `src/components/PerformanceChart.tsx`

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
