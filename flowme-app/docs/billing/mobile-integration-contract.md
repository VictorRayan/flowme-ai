# Mobile Billing Integration Contract

This contract prepares the shared Flow Me backend for native iOS and Android clients. The mobile apps own the store purchase UI; the backend owns verification, subscription persistence, and shared entitlements.

## Shared rules

- The mobile user must be authenticated with the same Supabase account used on web.
- Never grant Pro from client-provided product, status, dates, or price. Only verified provider data is authoritative.
- A successful verification updates `user_subscriptions` and `user_entitlements` atomically from the caller's perspective.
- The client refreshes `GET /api/billing/entitlements` after verification.
- Provider identifiers are diagnostic data and must not appear in user-facing messages.

## iOS

Create the StoreKit purchase with `appAccountToken` equal to the authenticated Flow Me user UUID. Send the signed StoreKit 2 transaction to:

```http
POST /api/billing/apple/verify
Content-Type: application/json

{ "signed_transaction": "<StoreKit 2 signed JWS>" }
```

The backend verifies the ES256 JWS certificate and signature, bundle ID, configured product ID, validity period, and exact `appAccountToken` binding. Configure App Store Server Notifications V2 to call `POST /api/webhooks/apple`. The webhook accepts Apple's `{ "signedPayload": "..." }`, verifies the outer and nested JWS payloads, and deduplicates by `notificationUUID`.

Required configuration:

- `APPLE_BUNDLE_ID`
- `APPLE_PRO_MONTHLY_PRODUCT_ID`
- `APPLE_PRO_ANNUAL_PRODUCT_ID`
- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY_BASE64`: base64 of the App Store Connect `.p8` file
- `APPLE_ROOT_CA_BASE64`: base64 DER or PEM contents of the trusted Apple root CA used to validate the JWS certificate chain

## Android

Set `obfuscatedAccountId` in the Play Billing purchase flow to the lowercase SHA-256 hex digest of the authenticated Flow Me user UUID. After purchase, send only the opaque purchase token:

```http
POST /api/billing/google/verify
Content-Type: application/json

{ "purchase_token": "<Google Play purchase token>" }
```

The backend calls `purchases.subscriptionsv2.get`, validates the configured package/product, and compares Google's `obfuscatedExternalAccountId` with the expected account hash. Configure Real-time Developer Notifications through Pub/Sub to call `POST /api/webhooks/google-play` with `Authorization: Bearer <GOOGLE_PLAY_WEBHOOK_TOKEN>`. The backend deduplicates by Pub/Sub `messageId` and always fetches current state from the Play Developer API.

Required configuration:

- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_PRO_MONTHLY_PRODUCT_ID`
- `GOOGLE_PLAY_PRO_ANNUAL_PRODUCT_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64`: base64 of compact service-account JSON
- `GOOGLE_PLAY_WEBHOOK_TOKEN`

## Responses

Successful verify routes return `200` with `ok`, `billing_provider`, and the updated `entitlements`. Missing or invalid receipts return `400`; unauthenticated callers return `401`. Webhooks return `200` for processed, duplicate, or intentionally ignored notifications so providers do not retry non-actionable messages.

## Provider references

- Apple App Store Server Notifications: <https://developer.apple.com/documentation/appstoreservernotifications>
- Apple App Store Server API: <https://developer.apple.com/documentation/appstoreserverapi>
- Google subscription state API: <https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get>
- Google Real-time Developer Notifications: <https://developer.android.com/google/play/billing/rtdn-reference>
