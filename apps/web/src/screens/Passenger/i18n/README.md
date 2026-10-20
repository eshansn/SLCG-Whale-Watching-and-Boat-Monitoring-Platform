# Passenger localization

`PassengerLocaleProvider` wraps only the existing `/passenger` routes in `App.tsx`.
The compact selector appears at the upper right of the entry/onboard pages and in
the invitation header. No localization dependency is required.

Resources live in `locales/en.ts`, `ru.ts`, `zh-CN.ts`, `de.ts`, and `fr.ts`.
English defines the keys; TypeScript requires the other resources to have the
same keys. `t(key, variables)` falls back to English for a missing/empty value.
Use whole messages with named placeholders rather than concatenated fragments.
Companion counts use `Intl.PluralRules`, including Russian plural categories.

`usePassengerLocale()` also provides locale formatting, country names, enum
display labels, and known application/error message translation. Store client
feedback keys in state and translate when rendering, so existing feedback
updates immediately when the selection changes. API messages are mapped only
at the display boundary; unknown diagnostics remain verbatim. Add new server
messages to the resources when they are introduced.

The selection is stored only under `wwms.passenger.language` in local storage.
Missing/invalid/blocked storage defaults to English; blocked writes still allow
switching for the current visit. Passenger session and authentication storage
are untouched. Document title/language changes are restored on provider cleanup.

Coverage includes landing, trip invitation, returning-passenger verification,
registration, onboard trip/profile/boarding QR, country search, companions and
special needs, complaints/inquiries, boat GPS, and SOS dialogs. The existing
custom complaint validation reports translated feedback rather than depending
on a browser-language native validation popup. There are no separate passenger
password-recovery, booking-calendar, or trip-history screens in this repository.
The shared staff login/registration remain outside this provider.

Dates/times use the selected locale and retain the browser time zone used by
the existing pages. No date values or API formats are converted. Names, boat
registrations, passenger identifiers, phone numbers, QR values, and submitted
messages remain unchanged. MapLibre accessibility/control labels are localized;
geographic labels and legal/provider attributions remain supplied by the map
provider. Native file-picker UI follows the browser/operating-system language.

The only shared-component extension is optional `label`/`flagLabel` props on
`CountryFlag`; callers outside the passenger portal retain the original defaults.
Existing fonts retain their system glyph fallbacks. Scoped wrapping and casing
rules accommodate translations without changing the theme or page structure.

Run from `apps/web`:

```sh
node --test tests/passenger-locale.test.mjs
npx eslint src/screens/Passenger src/components/CountryFlag.tsx src/App.tsx tests/passenger-locale.test.mjs
npm run build
```

The unit tests check resource/placeholder completeness, fallback, persistence
isolation, pluralization, formatting, known backend messages, and literal JSX
translation coverage. Headless browser verification additionally exercised all
five languages at 360px and 1280px with intercepted API fixtures; no real
passenger records or SOS/complaint events were created.
