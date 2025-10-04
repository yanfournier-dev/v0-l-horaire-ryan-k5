-- Restore email templates that were previously deleted
-- This script re-inserts the templates for leave approvals/rejections and application approvals

INSERT INTO email_templates (type, name, subject, body, variables, description) VALUES
(
  'leave_approved',
  'Congé approuvé',
  '✅ Congé approuvé',
  '<div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Congé approuvé</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Bonjour {{name}},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Bonne nouvelle! Votre demande de congé a été approuvée.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 5px 0;"><strong>Du:</strong> {{startDate}}</p>
      <p style="margin: 5px 0;"><strong>Au:</strong> {{endDate}}</p>
    </div>
    <p style="font-size: 16px; margin-bottom: 30px;">Profitez bien de votre congé!</p>
    <div style="text-align: center;">
      <a href="{{appUrl}}/dashboard/leaves" style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Voir mes congés</a>
    </div>
  </div>',
  '["name", "startDate", "endDate", "appUrl"]'::jsonb,
  'Email envoyé quand une demande de congé est approuvée'
),
(
  'leave_rejected',
  'Congé refusé',
  '❌ Congé refusé',
  '<div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">❌ Congé refusé</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Bonjour {{name}},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Malheureusement, votre demande de congé a été refusée.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 5px 0;"><strong>Du:</strong> {{startDate}}</p>
      <p style="margin: 5px 0;"><strong>Au:</strong> {{endDate}}</p>
      {{#if reason}}<p style="margin: 15px 0 5px 0;"><strong>Raison:</strong></p><p style="margin: 5px 0;">{{reason}}</p>{{/if}}
    </div>
    <p style="font-size: 16px; margin-bottom: 30px;">Contactez votre superviseur pour plus d''informations.</p>
    <div style="text-align: center;">
      <a href="{{appUrl}}/dashboard/leaves" style="display: inline-block; background: #dc2626; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Voir mes congés</a>
    </div>
  </div>',
  '["name", "startDate", "endDate", "reason", "appUrl"]'::jsonb,
  'Email envoyé quand une demande de congé est refusée'
),
(
  'application_approved',
  'Candidature acceptée',
  '✅ Candidature acceptée',
  '<div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Candidature acceptée</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Bonjour {{name}},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Félicitations! Votre candidature pour le remplacement a été acceptée.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
      <p style="margin: 5px 0;"><strong>Équipe:</strong> {{teamName}}</p>
      <p style="margin: 5px 0;"><strong>Date:</strong> {{date}}</p>
      <p style="margin: 5px 0;"><strong>Type de quart:</strong> {{shiftType}}</p>
    </div>
    <p style="font-size: 16px; margin-bottom: 30px;">Ce quart a été ajouté à votre horaire. Merci de votre disponibilité!</p>
    <div style="text-align: center;">
      <a href="{{appUrl}}/dashboard/calendar" style="display: inline-block; background: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Voir mon horaire</a>
    </div>
  </div>',
  '["name", "teamName", "date", "shiftType", "appUrl"]'::jsonb,
  'Email envoyé quand une candidature de remplacement est acceptée'
)
ON CONFLICT (type) DO NOTHING;
