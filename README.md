# Whale Watching and Boat Monitoring Platform

Platform for whale watching trips, boat and GPS monitoring, passenger attendance,
crew management, wildlife reporting, and complaints.

- `apps/web`: React, TypeScript, and Vite web application.
- `apps/mobile`: Flutter mobile application.
- `server`: ASP.NET Core 8 API and Entity Framework migrations.
- `server.Tests` and `scripts/tests`: backend and browser regression checks.

## Local setup

Use Docker with Compose for SQL Server and the API, Node.js 22.12 or later for
the web application, and Flutter for the mobile application. Running the API
or backend tests outside Docker also requires the .NET 8 SDK and runtime.

Copy `.env.example` to `.env` if a local environment file does not already
exist. Replace the example database password, JWT signing key, and initial
account credentials before starting the services:

```powershell
docker compose up -d --build
```

The API applies database migrations on startup and listens on port 8080 by
default. Keep `DevelopmentMockData__Enabled=false` for real-user testing.
Configure SMTP settings in `.env` before enabling email password recovery.

Start the web application in a separate terminal:

```powershell
cd apps/web
npm ci
npm run dev
```

Use the URL printed by Vite. Its development proxy forwards `/api` and `/hubs`
to the local API. For a deployed API on a separate origin, configure
`VITE_API_BASE_URL` using `apps/web/.env.example`.

For mobile development, run `flutter pub get` in `apps/mobile`, then use
`flutter run --dart-define=API_BASE_URL=https://your-api-host`. The API address
must be reachable from the target device.

## Build and checks

Run `npm run build` and `npm run lint` from `apps/web`. From the repository root,
run `dotnet test server.Tests/WhaleWatching.Api.Tests.csproj`. SQL and browser
integration tests require their configured test services and skip when those
prerequisites are absent. Run `flutter test` from `apps/mobile` for mobile tests.

The offline development database cleanup procedure is documented in
[scripts/maintenance/README.md](scripts/maintenance/README.md).

## TrackMyCar GPS configuration

TrackMyCar is called only by the ASP.NET Core backend. Never place its API key in
React/Vite configuration, source code, `appsettings*.json`, logs, or a committed
environment file.

For a local PowerShell session, set the key and start the backend from that same
session:

```powershell
$env:TrackMyCar__ApiKey="YOUR_API_KEY"
dotnet run --project server
```

Alternatively, store it in the .NET development user-secrets store:

```powershell
dotnet user-secrets set "TrackMyCar:ApiKey" "YOUR_API_KEY" --project server
dotnet run --project server
```

Non-secret settings are under `TrackMyCar` in `server/appsettings.json`. Live
locations are polled every 10 seconds by default. `PollIntervalSeconds`, request
timeout, and the Online/Stale/Offline thresholds are configurable there or with
ASP.NET Core environment variables.

Boats are matched exclusively by TrackMyCar `imei` to `Boat.GpsDeviceId`. Set a
boat's GPS device ID to its TrackMyCar IMEI before expecting live or historical
data. The browser communicates only with this application's API and SignalR hub;
it never calls TrackMyCar directly.
