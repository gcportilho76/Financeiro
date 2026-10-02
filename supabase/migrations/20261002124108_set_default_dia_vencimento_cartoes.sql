/*
# Set default value for dia_vencimento on cartoes_registry

1. Changes
- Sets the default value of `dia_vencimento` to 10 on `cartoes_registry`.
- Updates existing NULL values to 10 so all cards have a vencimento day.
2. Security
- No RLS or policy changes.
3. Notes
- `dia_vencimento` column already exists (added in a previous migration).
- This only sets a sensible default; the frontend now lets users edit it per card.
*/

UPDATE cartoes_registry SET dia_vencimento = 10 WHERE dia_vencimento IS NULL;

ALTER TABLE cartoes_registry ALTER COLUMN dia_vencimento SET DEFAULT 10;
