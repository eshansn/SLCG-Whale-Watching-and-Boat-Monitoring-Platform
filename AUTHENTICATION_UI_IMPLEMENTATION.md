# WWMS shared deep-ocean authentication UI

## Result

Login, the three-step Sign Up flow, the account entry page and all password recovery steps now share one English-only authentication layout. The CSS/SVG ocean environment and whale remain mounted while React Router changes authentication pages, so following Sign In, Create an account, Forgot password or browser Back/Forward does not restart the whale drawing unnecessarily.

The interface uses the existing abyss/navy/cyan palette, Coast Guard/WWMS branding, Geist typography, dark translucent fields, visible focus outlines, restrained transitions and a responsive two-column composition. On phones the whale sits above the form. Reduced-motion preferences disable decorative animation and leave the whale fully drawn. No new dependencies, stock backgrounds, WebGL or JavaScript animation loops were added.

## Files

| Area | Files |
| --- | --- |
| Persistent route layout and shared environment | `apps/web/src/components/auth/OceanAuthLayout.tsx`, `OceanScene.tsx`, `ocean-auth.css` |
| Form system | `apps/web/src/components/auth/AuthPanel.tsx`, `AuthField.tsx`, `AuthButton.tsx`, `AuthPasswordGuidance.tsx`, `passwordPolicy.ts` |
| Redesigned screens | `apps/web/src/screens/publicweb/Login.tsx`, `SignUp.tsx`, `AuthLanding.tsx` |
| Recovery integration | `apps/web/src/screens/publicweb/PasswordRecovery.tsx`, recovery-only `recovery/RecoveryOtpInput.tsx` |
| Routing | `apps/web/src/App.tsx` groups `/auth`, `/login`, `/signup` and `/forgot-password` under the shared layout |
| Verification | `scripts/tests/deep-ocean-auth.cjs`, updated `scripts/tests/password-recovery.cjs`, browser harness in `server.Tests/PasswordRecoveryTests.cs` |
| Documentation | This file, `PASSWORD_RECOVERY_IMPLEMENTATION.md`, `scripts/tests/README.md`, `README.md` |

The ocean scene and styles moved out of the recovery-only folder into `components/auth`. Styling is now scoped to `ocean-auth-*` selectors. Passenger/public landing pages and operational portals retain their own styles. Recovery's six-digit input remains in its dedicated folder because it is specific to that flow.

## Authentication behavior retained

Login still calls the existing AuthContext login method with the trimmed account email and password. It retains the original redirect order and paths for Admin, SLTDA, OPS, ShoreCrew, Wildlife, ShoreWildlife, Supervisor, HarbourOfficer, BoatOwner, BoatCrew and Passenger, including the existing compatible requested-path checks. The label now accurately says Email address; the actual backend already authenticates by email. No remember-me option, new identifier type or new authentication method was invented.

Public registration remains limited to Boat Owner and Crew Member. It still proceeds through role → details → password and sends the existing request fields: `userName`, `displayName`, `nicNumber`, `email`, `phoneNumber`, `password`, `role`. All existing mandatory fields are present. Username/NIC formats and length limits are preserved, and server-side Identity validators remain authoritative. Password guidance displays the existing 12–128-character input bound, six unique characters, uppercase, lowercase, number and symbol requirements.

Crew registration additionally requires a certificate in the details step and sends these fields with the certificate as multipart form data to the existing registration URL. Boat owner registration continues to use JSON. Registration persists the crew account and certificate atomically; see [CREW_CERTIFICATE_IMPLEMENTATION.md](CREW_CERTIFICATE_IMPLEMENTATION.md) for validation, approval enforcement and tests.

Registration still waits for server-confirmed creation, signs in through the existing login method and routes to `/owner` or `/crew`. If creation succeeds but the subsequent sign-in fails, the page accurately explains that an account was created and offers Sign In; it does not encourage another registration attempt. Errors appear inline rather than in browser alert dialogs. A synchronous ref guard prevents duplicate login/registration requests while the disabled/loading state renders.

Sessions, refresh-token storage, cookies/credentials handling, API contracts, backend permissions, registration restrictions, Identity password policy and role guards were not changed. Recovery continues to use its existing real endpoints and server-issued authorization. The matching recovery email, SMTP configuration, expiration, delivery worker and database model were not changed by this login/signup redesign. No database migration or new configuration is needed.

## English-only authentication

There are no language controls on account entry, Login, Sign Up, Forgot Password, OTP/resend, Reset Password or Success. The shared layout declares `lang="en"` and never reads or writes passenger language preferences. Existing passenger localization resources and selectors remain intact. The browser test changes the actual passenger selector, returns to Login, and confirms that authentication remains English while the passenger preference is preserved.

## Verification

The tests use the production frontend against live ASP.NET Identity/auth endpoints and GUID-named disposable SQL databases. Automated tests use a fake email sender and never send real mail. Non-authentication portal datasets and SignalR responses are isolated as unavailable fixtures; these checks verify authentication, redirects and access boundaries, not operational portal data features.

The login/signup browser suite covers:

- Valid login and original portal redirects for all 11 existing roles, plus live authorized/forbidden HTTP checks.
- Invalid credentials, password visibility without clearing input, disabled/loading feedback and immediate duplicate-click prevention.
- Existing refresh-token session restoration after reload.
- Real BoatOwner and BoatCrew registration followed by automatic sign-in and the correct portal redirect.
- Invalid username length/characters and NIC input, weak password input, mismatched confirmation, real duplicate-email rejection and registration service failure feedback.
- Account entry/Login/Sign Up/Forgot Password navigation, browser Back/Forward and persistent whale DOM identity.
- English-only authentication, the preserved working passenger language selector, reduced motion, simulated short viewport scrolling and eight widths: 320, 360, 390, 430, 768, 1024, 1440 and 1920 pixels.

The existing live recovery browser suite was updated for the shared components and passed in both engines. It continues to verify OTP typing/paste/navigation, resend and failed resend, expiry, reset/password confirmation, login after reset, state cleanup, role boundaries, English-only screens, language preference preservation, reduced motion and actual email-template previews with a synthetic code.

Executed checks:

- Frontend TypeScript and production build: passed.
- ESLint on all modified authentication components/screens: passed.
- Live login/signup browser suite: passed in Chromium/Edge and WebKit.
- Live recovery browser suite: passed in Chromium/Edge and WebKit.
- Backend regression suite: **149 passed, 0 failed, 5 browser checks skipped** in the non-browser run. The two authentication/recovery browser checks were run separately in both engines; the other three skips belong to existing complaint, shore and SLTDA suites.
- Backend regression results are recorded in `.runlogs/recovery-test-results/auth-full-suite.trx`; browser results/previews are in `auth-login-*.trx`, `auth-ocean-*.trx` and `.runlogs/auth-ocean-{chromium,webkit}/`.

Example PowerShell setup (adjust paths/SQL permissions for the machine):

```powershell
$env:WWMS_TEST_SQL_CONNECTION='Server=.\SQLEXPRESS;Database=master;Integrated Security=True;TrustServerCertificate=True'
$env:WWMS_BROWSER_WEB_ROOT='D:/SLCG-Whale-Watching-and-Boat-Monitoring-Platform/apps/web/dist'
$env:PLAYWRIGHT_MODULE='path/to/installed/playwright'
dotnet test server.Tests/WhaleWatching.Api.Tests.csproj --filter FullyQualifiedName~PasswordRecoveryTests.Browser_Live
```

Set `PLAYWRIGHT_ENGINE=webkit` to use an installed WebKit engine. Chromium uses installed Edge by default. `AUTH_DEBUG=1` prints non-sensitive role progress when diagnosing this isolated browser suite.

## Remaining manual checks

Automated desktop engines do not replace physical iOS/Android keyboard and screen-reader testing. Verify the layouts on the target devices before a production rollout. The UI build is ready for the existing frontend deployment process; the running local Vite server reads these source changes. This task needs no Gmail credential change, API migration or new backend deployment.
