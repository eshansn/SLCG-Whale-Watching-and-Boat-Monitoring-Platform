# Whale Watching and Boat Monitoring Platform

Platform for whale watching trips, boat and GPS monitoring, passenger attendance,
crew management, wildlife reporting, and complaints.

- `apps/web`: React, TypeScript, and Vite web application.
- `apps/mobile`: Flutter mobile application.
- `server`: ASP.NET Core 8 API and Entity Framework migrations.
- `server.Tests` and `scripts/tests`: backend and browser regression checks.

## Local setup

Use Docker Desktop with Linux containers and Compose for SQL Server, the API,
and the web application. Node.js 22.12 or later is needed for frontend development
outside Docker, and Flutter for the mobile application. Running the API or backend
tests outside Docker also requires the .NET 8 SDK and runtime.

Create a local `.env` file if one does not already exist. Set
`MSSQL_SA_PASSWORD` to a strong database password and `JWT_SIGNING_KEY` to at
least 32 random bytes. Configure your own `INITIAL_*_EMAIL` and
`INITIAL_*_PASSWORD` values for the authority accounts listed in
`docker-compose.yml` before starting the services. Keep environment files and
development credentials outside Git.

Start the services:

```powershell
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Open http://localhost:5173 once all three services are healthy. `WEB_PORT` and
`API_PORT` in `.env` override the default web and API ports. The frontend serves
the built app and proxies `/api` and `/hubs` (including WebSockets) to the API.
Refreshing a portal URL also works. SQL Server data remains in its Docker volume.

The API applies database migrations on startup. Keep
`DevelopmentMockData__Enabled=false` for real-user testing. Configure SMTP
settings in `.env` before enabling email password recovery.

Start the system using Compose from this repository, including when using Docker
Desktop. Starting the API image on its own does not supply its database connection,
signing key, network, or startup dependencies. If startup fails, inspect
`docker compose logs --tail 100` and `docker compose ps -a`. The API health check
uses `/health/ready` to verify database access before starting the frontend.
Stop the system with `docker compose stop`; start it again with the command above.

For frontend development with live reload, run just SQL Server and the API in
Docker, then start Vite in a separate terminal. Stop the Compose frontend first
to free its port:

```powershell
docker compose stop web
docker compose up -d --build --wait sqlserver api
cd apps/web
npm ci
npm run dev
```

Use the URL printed by Vite. Its development proxy forwards `/api` and `/hubs`
to the local API. For a deployed API on a separate origin, configure
`VITE_API_BASE_URL` in a local `apps/web/.env` file.

For mobile development, run `flutter pub get` in `apps/mobile`, then use
`flutter run --dart-define=API_BASE_URL=https://your-api-host`. The API address
must be reachable from the target device.

## Build and checks

Run `npm run build` and `npm run lint` from `apps/web`. From the repository root,
run `dotnet test server.Tests/WhaleWatching.Api.Tests.csproj`. SQL and browser
integration tests require their configured test services and skip when those
prerequisites are absent. Run `flutter test` from `apps/mobile` for mobile tests.

With Compose running and Node.js installed, run `node scripts/tests/docker-smoke.cjs`
to check the built frontend, portal URL refreshes, assets, database readiness and
API/realtime proxy access control. Set `WWMS_WEB_URL` for a custom web port. Optional
`WWMS_TEST_EMAIL` and `WWMS_TEST_PASSWORD` for an operations account also check real
login, data access and a SignalR WebSocket handshake. Set `PLAYWRIGHT_MODULE` to an
installed Playwright module to include a browser rendering check.

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
