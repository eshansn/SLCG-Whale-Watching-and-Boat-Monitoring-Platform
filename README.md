# Whale Watching and Boat Monitoring Platform

SLTDA monitoring, complaint accountability, rollout instructions, APIs and verification results are documented in [SLTDA_IMPLEMENTATION.md](SLTDA_IMPLEMENTATION.md).

Email OTP password recovery, Gmail setup, migration instructions and security testing are documented in [PASSWORD_RECOVERY_IMPLEMENTATION.md](PASSWORD_RECOVERY_IMPLEMENTATION.md).

The shared deep-ocean Login, Sign Up and recovery UI is documented in [AUTHENTICATION_UI_IMPLEMENTATION.md](AUTHENTICATION_UI_IMPLEMENTATION.md).


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
