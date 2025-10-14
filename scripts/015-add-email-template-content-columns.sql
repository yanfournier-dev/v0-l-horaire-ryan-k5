-- Add html_content and text_content columns to email_templates table

-- Add html_content column
ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Add text_content column
ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Copy existing body content to both new columns
UPDATE email_templates
SET 
  html_content = body,
  text_content = body
WHERE html_content IS NULL OR text_content IS NULL;
