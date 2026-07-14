FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY server/WhaleWatching.Api.csproj server/
RUN dotnet restore server/WhaleWatching.Api.csproj

COPY server/ server/
RUN dotnet publish server/WhaleWatching.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl \
    && mkdir -p /home/app/.aspnet/DataProtection-Keys \
    && chown -R $APP_UID:0 /home/app/.aspnet
COPY --from=build --chown=$APP_UID:0 /app/publish .

USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "WhaleWatching.Api.dll"]
