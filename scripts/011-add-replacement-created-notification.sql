-- Add notify_replacement_created column to notification_preferences table
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_replacement_created BOOLEAN DEFAULT true;

-- Update existing preferences to enable this notification by default
UPDATE notification_preferences
SET notify_replacement_created = true
WHERE notify_replacement_created IS NULL;

-- Insert template for replacement_created email
INSERT INTO email_templates (type, subject, body, variables)
VALUES (
  'replacement_created',
  'Nouveau remplacement disponible - {{date}}',
  '<div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
    <h2 style="color: #1f2937; margin-top: 0;">Bonjour {{name}},</h2>
    <p style="color: #4b5563; font-size: 16px;">
      Un nouveau remplacement a été créé et est maintenant disponible pour candidature.
    </p>
    <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Date:</strong> {{date}}</p>
      <p style="margin: 5px 0;"><strong>Type de quart:</strong> {{shiftType}}</p>
      <p style="margin: 5px 0;"><strong>Équipe:</strong> {{teamName}}</p>
    </div>
    <p style="color: #4b5563;">
      Connectez-vous à l''application pour postuler à ce remplacement.
    </p>
    <a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
      Voir les remplacements
    </a>
  </div>',
  '["name", "date", "shiftType", "teamName", "appUrl"]'
)
ON CONFLICT (type) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  updated_at = CURRENT_TIMESTAMP;
