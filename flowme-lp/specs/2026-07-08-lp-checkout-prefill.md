## Goal

When a lead unlocks pricing on the landing page and clicks to claim the offer, the public checkout opens with the lead details already carried in the URL. This avoids asking for the same name, email and WhatsApp twice.

## Surface

- `public/landing.js`: pricing unlock, stored lead, checkout URL creation.
- `../flowme-app/app/checkout/page.tsx`: public checkout query parsing and field hydration.

## Acceptance Criteria

- Locked prices still require the lead form before checkout.
- The claim-offer button opens `/checkout` with `lead_token`, `name`, `email`, `phone`, `interval`, `locale` and `source` query parameters.
- The public checkout cardholder name is prefilled from `name`.
- The public checkout Pix full-name field is prefilled from `name`; CPF/CNPJ remains required because the LP does not collect it.
- The checkout still requires the signed `lead_token`; query parameters do not authorize checkout by themselves.
- The contact summary shows the captured email and WhatsApp when present.

## Responsive Behavior

No layout structure changes. Existing pricing modal and checkout responsive contracts remain in force for 390x844, 768x1024, 1024x768 and 1440x900.

## Test Plan

- Submit the LP lead form with mocked marketing endpoints and confirm the generated checkout URL contains the captured fields.
- Open public checkout with query parameters and confirm cardholder/Pix name are prefilled.
- Verify the user can still edit the prefilled name.
- Run focused Jest/API checks for checkout code touched by this change.
- Run local browser smoke checks for the static LP and public checkout.

## Regression Risks

- Query strings can expose contact details in browser history; this is intentional for the requested handoff and still backed by the signed lead token.
- Stored leads created before this change may only include token/email/interval and should continue to work.
- Changing plan interval after unlock must update only the `interval` query parameter while preserving captured contact data.

## Rollback

Remove the `name` and `phone` parameters from `checkoutUrl()` and stop using query-derived `initialName` in the public checkout.
