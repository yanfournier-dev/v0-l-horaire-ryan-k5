-- Add new status values to replacement_status enum
-- This script is idempotent and can be run multiple times safely

DO $$ 
BEGIN
    -- Add 'pending' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'replacement_status')
    ) THEN
        ALTER TYPE replacement_status ADD VALUE 'pending';
        RAISE NOTICE 'Added "pending" to replacement_status enum';
    ELSE
        RAISE NOTICE '"pending" already exists in replacement_status enum';
    END IF;

    -- Add 'approved' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'approved' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'replacement_status')
    ) THEN
        ALTER TYPE replacement_status ADD VALUE 'approved';
        RAISE NOTICE 'Added "approved" to replacement_status enum';
    ELSE
        RAISE NOTICE '"approved" already exists in replacement_status enum';
    END IF;

    -- Add 'rejected' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'rejected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'replacement_status')
    ) THEN
        ALTER TYPE replacement_status ADD VALUE 'rejected';
        RAISE NOTICE 'Added "rejected" to replacement_status enum';
    ELSE
        RAISE NOTICE '"rejected" already exists in replacement_status enum';
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'replacement_status')
ORDER BY enumsortorder;
