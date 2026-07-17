# Development mock accounts

These accounts are seeded from `DemoIdentitySeed` whenever the API runs in the Development environment. They are independent of the bootstrap accounts configured through `.env`, so Docker environment overrides do not replace them. Restart the API after pulling these changes so the accounts are inserted.

| Portal | Email | Password |
|---|---|---|
| Administrator | `admin@wwms.test` | `Admin#WWMS2026!Secure` |
| OPS | `ops@wwms.test` | `Ops#WWMS2026!Secure` |
| Shore Crew | `shore@wwms.test` | `Shore#WWMS2026!Secure` |
| Wildlife | `wildlife@wwms.test` | `Wildlife#WWMS2026!Secure` |
| Boat Owner | `owner@wwms.test` | `Owner#WWMS2026!Secure` |
| Boat Crew | `crew@wwms.test` | `Crew#WWMS2026!Secure` |
| Passenger | `passenger@wwms.test` | `Passenger#WWMS2026!Secure` |

The operational seed links the Boat Owner to Mirissa King and Sea Princess, links the Boat Crew account to Mirissa King, and creates shared scheduled/completed trips for synchronization testing.
