-- Remove applications where users applied for their own replacements
DELETE FROM replacement_applications ra
USING replacements r
WHERE ra.replacement_id = r.id
  AND ra.applicant_id = r.user_id;
