# Deploy to Cloudflare Workers

This project uses Next.js 16. The Cloudflare target is Workers through the OpenNext adapter, with the existing Next.js app and Firebase data layer kept in place.

## Local preview

```bash
npm install
npm run cloudflare:preview
```

The preview runs the built Worker locally. Demo mode needs no Cloudflare or Firebase credentials; its sample data and saved timetables stay in that browser's local storage.

## Deploy

1. Sign in to Cloudflare in a terminal with `npx wrangler login`.
2. Run `npm run cloudflare:deploy` from the project root.
3. Open the `*.workers.dev` URL printed by Wrangler and choose Demo mode.

For Firebase mode, set the `NEXT_PUBLIC_FIREBASE_*` values and `NEXT_PUBLIC_SCHOOL_ID` in the Cloudflare build environment. Add these as Worker Secrets in **Workers & Pages → learning-table → Settings → Variables and Secrets**:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

The equivalent aliases `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are also supported. Set one complete group, not a mix. Paste the private key with literal `\n` between lines; the server converts those to line breaks. Keep all service-account values out of `wrangler.jsonc`, source control, and browser-visible `NEXT_PUBLIC_*` variables.

Custom-claim updates use a service-account OAuth JWT signed with Web Crypto and Firebase Identity Toolkit REST, so that operation does not load `firebase-admin/auth`. Other server routes still use Firebase Admin SDK for token verification, Firestore, and account create/delete operations; this repository has not been validated against a deployed Cloudflare Worker with those secrets. Confirm `/api/health` reports both Firebase client and Admin configured before using Firebase mode. Demo mode does not need these values.

## Commands

- `npm run cloudflare:preview` builds and previews the Worker locally.
- `npm run cloudflare:deploy` builds and deploys the Worker.
- `npm run cloudflare:typegen` generates Wrangler environment types.
