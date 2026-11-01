# Per-user encryption design

## Current state

Supabase RLS is enabled in the migrations for every public table defined by the app. RLS controls **who may read or change rows**. It does not give every user a separate encryption key. Google and Slack OAuth tokens are currently stored in plaintext `TEXT` columns and protected by RLS; this is not per-user application encryption. The live project's policies and grants require a separate audit before this design can be called deployed.

## Proposed design

Use server-managed envelope encryption so the application and Balys can continue to search and process user data. Generate a random 256-bit data-encryption key (DEK) per user with a cryptographic random number generator. Encrypt each sensitive field or object with AES-256-GCM using a fresh nonce and associated data containing `user_id`, table, row ID, field, and format version. Wrap the DEK with a key-encryption key (KEK) held outside Supabase, ideally in a managed KMS. Store only the wrapped DEK and key version in a server-only table. Never derive a DEK from a user ID, email, password, or Supabase JWT.

Authenticate the user before any decrypt. Fetch and unwrap only that user's DEK server-side; never send the DEK or plaintext connector tokens to the browser. A service-role client bypasses RLS, so every such server operation must also enforce `user_id`. Rotate the KEK by rewrapping DEKs; rotate a user's DEK by re-encrypting their records in batches. Keep old key versions until verification and rollback complete. Back up wrapped DEKs and test restoration: losing the KEK permanently loses the data.

## Migration order

1. Select and provision the KEK service, recovery policy, and audit logs. Add secrets to the deployment secret store, not the repository.
2. Add a private `user_data_keys` table and server-only crypto module. Test wrong-user associated data, tampering, nonce uniqueness, and key rotation.
3. Move Google and Slack token reads/writes behind authenticated server endpoints. Stop direct browser access to token columns before encrypting them.
4. Add encrypted columns. Dual-read old/new records; write ciphertext only. Backfill existing rows in batches, verify counts, then remove plaintext columns and their backups after the retention window.
5. Extend to notes, documents, messages, and R2 objects. Search/indexing and AI features need server-side decrypt or a redesigned search index; test each workflow with two users.

Per-user server-managed encryption protects against a database-only breach. It does **not** protect against a compromised application server with KEK access or an authorized user asking the application to decrypt their own data. True end-to-end encryption would require users to hold keys and would change Balys and server-side search behavior.
