-- Remove unused email templates
-- Keep: replacement_available, application_approved, application_rejected
-- Remove: leave_approved, leave_rejected, replacement_accepted, replacement_created

DELETE FROM email_templates 
WHERE type IN ('leave_approved', 'leave_rejected', 'replacement_accepted', 'replacement_created');
