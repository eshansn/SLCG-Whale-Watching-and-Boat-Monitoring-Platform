FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY server/WhaleWatching.Api.csproj server/
RUN dotnet restore server/WhaleWatching.Api.csproj

COPY server/ server/
RUN dotnet publish server/WhaleWatching.Api.csproj \
    --configuration Debug \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir --parents /home/app/.aspnet/DataProtection-Keys \
    && chown --recursive $APP_UID:0 /home/app/.aspnet
COPY --from=build /app/publish .

USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "WhaleWatching.Api.dll"]
