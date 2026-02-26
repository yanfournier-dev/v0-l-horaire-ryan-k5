# Fix for Partial Replacement Time Handling Bug

## Problem Summary

When managing multiple partial replacements (R1 + R2), the system wasn't properly tracking original shift times, causing:

1. **Bug #1 - Adding R2**: When adding a second replacement to cover part of the shift, the R1 replacement's hours would display incorrectly (e.g., showing 08:30-07:00 instead of 08:30-15:00)

2. **Bug #2 - Removing R2**: When removing the R2, the R1 would revert to full shift hours instead of its original partial hours (e.g., showing "Full shift" instead of 07:00-15:00)

## Root Cause

The database columns `original_start_time` and `original_end_time` exist in `shift_assignments` table to preserve the original partial times, but the code wasn't populating them when:
- Adding a second replacement that overlaps with the first partial replacement
- Additionally, when removing R2, the code was forcing `is_partial = false` instead of preserving the original state

## Solution Implemented

### Fix #1: Store Original Times When Adding R2 (Lines 624-649 and 659-688)

When a second replacement overlaps with the first partial replacement, we now:
1. Delete the old R1 record (as before)
2. **NEW**: Insert the R1 with **original_start_time** and **original_end_time** preserved

**Case: R2 covers the beginning (7:00-8:30)**
```typescript
INSERT INTO shift_assignments (
  ...,
  start_time = ${r2End},        // 08:30 (new start after R2)
  end_time = ${r1End},          // 15:00 (original end)
  original_start_time = ${r1Start},  // 07:00 (preserved)
  original_end_time = ${r1End},      // 15:00 (preserved)
  ...
)
```

**Case: R2 covers the end (14:00-15:00)**
```typescript
INSERT INTO shift_assignments (
  ...,
  start_time = ${r1Start},      // 07:00 (original start)
  end_time = ${r2Start},        // 14:00 (new end before R2)
  original_start_time = ${r1Start},  // 07:00 (preserved)
  original_end_time = ${r1End},      // 15:00 (preserved)
  ...
)
```

### Fix #2: Restore is_partial State When Removing R2 (Line 999)

Changed from:
```typescript
is_partial = ${false}  // ❌ Always resets to false
```

To:
```typescript
is_partial = ${replacementToKeep.is_partial}  // ✅ Preserves original state
```

## How It Works Now

**Scenario: Tommy Plouride - March 1st - 24h shift with partial replacement**

1. **Initial state**: R1 = Cloutier 07:00-15:00 (partial)
   - `start_time = 07:00`
   - `end_time = 15:00`
   - `original_start_time = NULL` (no previous value)
   - `original_end_time = NULL`
   - `is_partial = true`

2. **After adding R2 = David Bois 07:00-08:30**:
   - R1 becomes 08:30-15:00
   - `start_time = 08:30` (recalculated)
   - `end_time = 15:00` (unchanged)
   - `original_start_time = 07:00` **(NOW SAVED)**
   - `original_end_time = 15:00` **(NOW SAVED)**
   - `is_partial = true` (unchanged)

3. **After removing R2**:
   - R1 is restored using original times
   - `start_time = 07:00` (from original_start_time)
   - `end_time = 15:00` (from original_end_time)
   - `is_partial = true` **(PRESERVED)**
   - Display: Cloutier 07:00-15:00 ✅ (back to original partial)

## Files Modified

- `/app/actions/direct-assignments.ts`: 3 changes to `addSecondReplacement` and `removeDirectAssignment` functions

## Verification

Run the diagnostic script to verify the fix:
```sql
-- scripts/verify-partial-fix.sql
```

This shows all replacements for Tommy Plouride on March 1st with their time values and partial status.
