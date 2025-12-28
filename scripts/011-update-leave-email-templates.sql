-- Update email templates for leave (absence) approval and rejection

-- Update leave_approved template
UPDATE email_templates
SET 
  name = 'Absence approuvée',
  subject = 'Absence approuvée',
  body = '<div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Absence approuvée</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Bonjour {{name}},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Votre demande d''absence a été approuvée.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 5px 0;"><strong>Du:</strong> {{startDate}}</p>
      <p style="margin: 5px 0;"><strong>Au:</strong> {{endDate}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 30px;">Cette absence est maintenant enregistrée dans le système.</p>
    <div style="text-align: center;">
      <a href="{{appUrl}}/dashboard/absences" style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Voir mes absences</a>
    </div>
  </div>',
  description = 'Email envoyé quand une demande d''absence est approuvée',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'leave_approved';

-- Update leave_rejected template
UPDATE email_templates
SET 
  name = 'Absence refusée',
  subject = 'Absence refusée',
  body = '<div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Absence refusée</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Bonjour {{name}},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Votre demande d''absence a été refusée.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 5px 0;"><strong>Du:</strong> {{startDate}}</p>
      <p style="margin: 5px 0;"><strong>Au:</strong> {{endDate}}</p>
      {{#if reason}}<p style="margin: 15px 0 5px 0;"><strong>Raison du refus:</strong></p><p style="margin: 5px 0; color: #6b7280;">{{reason}}</p>{{/if}}
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 30px;">Pour plus d''informations, veuillez contacter votre superviseur.</p>
    <div style="text-align: center;">
      <a href="{{appUrl}}/dashboard/absences" style="display: inline-block; background: #dc2626; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Voir mes absences</a>
    </div>
  </div>',
  description = 'Email envoyé quand une demande d''absence est refusée',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'leave_rejected';
