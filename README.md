# FoodGuard AI Nigeria

FoodGuard AI Nigeria is a React application for food-safety screening and supply-chain intelligence.

## Run locally

```sh
npm install
npm run dev
```

The Vite development server uses `http://localhost:5173` by default. Run `npm run lint` and `npm run build` to validate changes.

## Configure Supabase authentication

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and publishable/anon key from Supabase.
3. Set `VITE_SITE_URL` to the app's origin, such as `http://localhost:5173` during local development.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the deployed app origin and add the app's `/login` URL to the Redirect URLs list. For local testing, allow `http://localhost:5173/login`; add the deployed origin's `/login` URL as well.
5. In Supabase **Authentication → Providers → Email**, enable email sign-up and confirmation if confirmation emails are required. Configure SMTP if project email limits prevent confirmation or reset emails from being sent.

The login and sign-up forms use email/password authentication. Confirmation and password-reset links return to `/login`; reset links open a form for setting a new password. After signing in, users land on `/dashboard`, which is the only page available while signed in. Signing out returns users to the public landing page.

If a confirmation email does not arrive, check spam/junk and verify the address first. The sign-up page offers **Resend confirmation email** after an unconfirmed sign-up. If it still does not arrive, check Supabase **Authentication → Logs** for the request and email delivery status, confirm email sign-up is enabled, and configure custom SMTP under **Project Settings → Authentication → SMTP Settings**. The default email sender is rate-limited and intended for testing; repeated resend attempts can be throttled.

## Gemini visual review

The dashboard sends sample photos to the separate FastAPI service in [`backend/`](./backend/), which verifies the caller's Supabase access token, uses the existing Supabase daily quota RPC, preprocesses the image with Pillow, and calls Gemini. Supabase remains the authentication and quota system; this setup does not remove or replace it. The existing Supabase Edge Function is left in place but is no longer called by the dashboard.

Gemini is limited to visible observations. It must not return a safe/unsafe verdict and cannot detect pathogens, pesticide residues, chemical treatments, or toxins. Never treat its output as a food-safety result; consult an accredited laboratory or food-safety authority for safety decisions.

The food picker provides searchable starter suggestions for fruits, vegetables, grains/legumes, and animal products. It is not an exhaustive world food database; users can type an unlisted food name.

### Run the analysis service locally

1. Create a Gemini API key in Google AI Studio. Keep it private.
2. Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never go in the React `.env`, a `VITE_` variable, or browser code.
3. Install Python 3.12 or newer and start the API:

   ```sh
   python -m venv backend/.venv
   backend/.venv/bin/pip install -r backend/requirements.txt
   backend/.venv/bin/uvicorn backend.main:app --reload --port 8000
   ```

4. Set `VITE_FOOD_ANALYSIS_API_URL=http://localhost:8000` in the root `.env`, then run the React app with `npm run dev`.
5. The API checks Supabase authentication and calls the existing `consume_ai_visual_review_quota` RPC. The SQL migration [`supabase/migrations/20261005130500_add_ai_visual_review_quota.sql`](./supabase/migrations/20261005130500_add_ai_visual_review_quota.sql) must already have been applied; it limits each account to 10 reviews per UTC day. Do not rerun or alter the migration when deploying this service.
6. In the signed-in dashboard, follow Select food → Scan → Test → Analyse and choose **Review photo with AI**. The browser sends the compressed photo and Supabase access token to FastAPI; the Gemini key stays on the server. Results are shown for the current session and are not stored by this app.

### Deploy FastAPI to Google Cloud Run

The [`backend/Dockerfile`](./backend/Dockerfile) builds the service, and [`cloudbuild.yaml`](./cloudbuild.yaml) builds and pushes it to Artifact Registry before deploying it to Cloud Run.

1. Create or select a Google Cloud project, enable billing, and enable Cloud Build, Cloud Run, Artifact Registry, and Secret Manager APIs.
2. Create an Artifact Registry Docker repository named `foodguard` in the region you plan to use.
3. In Secret Manager, create `foodguard-gemini-api-key` and `foodguard-supabase-service-role` and add their secret values. Grant the Cloud Run runtime service account access to both secrets. Never commit keys to the repository.
4. Update the default substitutions in `cloudbuild.yaml` or provide these values when submitting a build: `_REGION`, `_REPOSITORY`, `_SERVICE`, `_SUPABASE_URL`, `_SUPABASE_ANON_KEY`, `_GEMINI_MODEL`, and `_WEB_ORIGIN`. The build identity needs permission to build/push images, deploy Cloud Run, and attach the runtime secrets.
5. Submit the build:

   ```sh
   gcloud builds submit --config=cloudbuild.yaml \
     --substitutions=_REGION=us-central1,_REPOSITORY=foodguard,_SERVICE=foodguard-gemini-analysis,_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY,_GEMINI_MODEL=gemini-2.5-flash,_WEB_ORIGIN=https://YOUR_FOODGUARD_DOMAIN .
   ```

6. Set `VITE_FOOD_ANALYSIS_API_URL` to the deployed Cloud Run service URL in the frontend build environment and rebuild/redeploy the web app. For mobile builds, set it in the root `.env` before syncing Capacitor.

Cloud Run allows unauthenticated HTTP access so the mobile and web clients can reach the API; each analysis endpoint still requires a valid Supabase bearer token, and the service enforces the existing per-user quota. Restrict `ALLOWED_ORIGINS` to your deployed site and the Capacitor origins when configuring the service.

## Android and iOS apps

The React app is wrapped with Capacitor; Supabase remains unchanged. Native project sources are in [`android/`](./android/) and [`ios/`](./ios/). Native confirmation and password-reset links use the `foodguard://login` app link; add that exact URI to Supabase **Authentication → URL Configuration → Redirect URLs** as well as your web callback URLs. Set the production `VITE_FOOD_ANALYSIS_API_URL` and Supabase client values before building; Vite embeds these public client settings into the app.

```sh
npm run cap:sync
npm run cap:open:android
npm run cap:open:ios
```

Use Android Studio with the Android SDK/JDK to test, sign, and export an Android App Bundle (`.aab`). Building and signing the iOS app (`.ipa`) requires macOS with Xcode and Apple signing credentials. Store developer accounts, signing, screenshots/listings, privacy disclosures, and store review are still required; generating native projects does not guarantee store approval. Before release, test Supabase sign-up confirmation and password-reset links on real devices and configure the Supabase redirect allowlist for the app's production web domain.

## Authentication smoke test

With the app connected to the Supabase project:

1. Create a new account, use **Resend confirmation email** if needed, then confirm it using the email link. Verify the app recognizes the new session.
2. Sign out, then sign in with that account and verify the private dashboard opens.
3. Sign out from the dashboard and verify the public landing page and navigation return.
4. Request a password reset, follow the email link, set a new password, and sign in with the new password.
5. Verify a signed-out visit to `/dashboard` returns to the public home page.
6. After configuring and deploying the FastAPI service, run a visual review on a sample image and confirm the response does not claim that the food is safe or unsafe.

Do not commit `.env`; the Supabase publishable/anon key is intended for client use, with access controlled by Supabase Auth and database Row Level Security policies.
