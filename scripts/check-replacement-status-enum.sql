-- Check what values are valid for the replacement_status enum
SELECT 
  enumlabel as status_value
FROM pg_enum
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'replacement_status'
)
ORDER BY enumsortorder;
