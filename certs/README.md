# Supabase database certificate

`supabase-ca.crt` was downloaded from Supabase's official asset bucket:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The Node PostgreSQL client uses it with `rejectUnauthorized: true`. Hostname verification is not overridden. A real connection to the transaction pooler was verified on 4 November 2026.

The CA is a public trust certificate, not a private key or application credential.
