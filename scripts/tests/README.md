# Boat image regression checks

The latest uploaded `VesselPhotographOrDiagram` document is the boat display
image, including while that document awaits approval. Document approval and
history remain separate from image selection. The image endpoint reads the same
stored bytes as document download; no second image file is created. Its URL
contains the document ID, so replacements change the URL.

Boat and vessel-map responses derive their `imageUrl` from documents. This also
covers existing boats with missing or stale legacy `Boat.ImageUrl` values, without
a data migration. Boats without an aerial image return no image URL. JPEG and PNG
are accepted for aerial photographs/diagrams; other certificates still accept PDF.

## Backend

Run `dotnet test server.Tests/WhaleWatching.Api.Tests.csproj` using .NET 8.
Set `WWMS_TEST_SQL_CONNECTION` to a SQL Server connection string to enable the
three image integration tests. The login must be able to create/drop databases.
Each test creates a uniquely named `WWMS_BoatImageTests_*` database and deletes it
afterward; the database named in the supplied connection string is not used.
Without that variable these integration tests are explicitly skipped.

The tests cover large uploads, replacements before approval, retained history,
matching image/document bytes, existing boats, placeholders, invalid uploads,
owner scoping, and image-only access for Shore Wildlife.

## Web

With Vite running and Playwright available, run:

```sh
node scripts/tests/boat-images.cjs
```

Optional environment variables:

- `WWMS_WEB_URL`: Vite URL (default `http://localhost:5173`).
- `PLAYWRIGHT_MODULE`: installed Playwright module path.
- `PLAYWRIGHT_CHANNEL`: installed browser channel, such as `msedge`.
- `WWMS_TEST_PATH`: run one portal route only.

The browser suite mocks API and SignalR responses. It verifies authenticated image
rendering and replacement events across 21 portal screens, plus the owner upload
control and the no-image placeholder. It never writes to the running database.
