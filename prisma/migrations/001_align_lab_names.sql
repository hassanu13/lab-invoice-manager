-- Align lab names with the strings the Python extractor's detect_lab() returns.
-- The original seed used trade/registered names; the extractor uses the
-- everyday names that appear on invoices. The upload route looks the lab up
-- by name, so they must match exactly.
--
-- Idempotent: each UPDATE is a no-op if it's already been run, so this is
-- safe to apply multiple times.

UPDATE lab SET name = 'Innovate Dental'  WHERE name = 'Innovate Dental Lab';
UPDATE lab SET name = 'Dent8'            WHERE name = 'Dent8 Lab';
UPDATE lab SET name = 'Invisalign'       WHERE name = 'Align Technology (Invisalign)';
UPDATE lab SET name = 'Carl Kearney'     WHERE name = 'Carl Kearney Dental';
UPDATE lab SET name = 'S4S'              WHERE name = 'S4S (UK) Limited';
