-- Update email templates to include partial replacement information
-- This script adds isPartial and partialHours variables and updates the body

-- Update replacement_available template
UPDATE email_templates
SET 
  variables = ARRAY['firefighterName', 'date', 'shift', 'station', 'isPartial', 'partialHours'],
  body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Nouveau remplacement disponible</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Un nouveau remplacement est disponible :</p>
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Quart :</strong> {{shift}}</p>
    <p style="margin: 5px 0;"><strong>Caserne :</strong> {{station}}</p>
    {{#if isPartial}}
    <p style="margin: 5px 0;"><strong style="color: #f97316;">Type :</strong> <span style="color: #f97316;">Partiel ({{partialHours}})</span></p>
    {{/if}}
  </div>
  <p>Connectez-vous pour postuler.</p>
  <a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir les remplacements</a>
</div>'
WHERE type = 'replacement_available';

-- Update application_approved template
UPDATE email_templates
SET 
  variables = ARRAY['firefighterName', 'date', 'shift', 'station', 'isPartial', 'partialHours'],
  body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #16a34a;">Candidature approuvée ✓</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Votre candidature a été approuvée pour le remplacement suivant :</p>
  <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
    <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Quart :</strong> {{shift}}</p>
    <p style="margin: 5px 0;"><strong>Caserne :</strong> {{station}}</p>
    {{#if isPartial}}
    <p style="margin: 5px 0;"><strong style="color: #f97316;">Type :</strong> <span style="color: #f97316;">Partiel ({{partialHours}})</span></p>
    {{/if}}
  </div>
  <p>Merci de votre disponibilité !</p>
</div>'
WHERE type = 'application_approved';

-- Update application_rejected template
UPDATE email_templates
SET 
  variables = ARRAY['firefighterName', 'date', 'shift', 'station', 'isPartial', 'partialHours'],
  body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc2626;">Candidature non retenue</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Votre candidature pour le remplacement suivant n''a pas été retenue :</p>
  <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
    <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Quart :</strong> {{shift}}</p>
    <p style="margin: 5px 0;"><strong>Caserne :</strong> {{station}}</p>
    {{#if isPartial}}
    <p style="margin: 5px 0;"><strong style="color: #f97316;">Type :</strong> <span style="color: #f97316;">Partiel ({{partialHours}})</span></p>
    {{/if}}
  </div>
  <p>D''autres remplacements seront bientôt disponibles.</p>
  <a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir les remplacements</a>
</div>'
WHERE type = 'application_rejected';

-- Update replacement_filled template
UPDATE email_templates
SET 
  variables = ARRAY['firefighterName', 'date', 'shift', 'station', 'isPartial', 'partialHours'],
  body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #6b7280;">Remplacement comblé</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Le remplacement suivant a été comblé :</p>
  <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
    <p style="margin: 5px 0;"><strong>Quart :</strong> {{shift}}</p>
    <p style="margin: 5px 0;"><strong>Caserne :</strong> {{station}}</p>
    {{#if isPartial}}
    <p style="margin: 5px 0;"><strong style="color: #f97316;">Type :</strong> <span style="color: #f97316;">Partiel ({{partialHours}})</span></p>
    {{/if}}
  </div>
  <p>D''autres remplacements seront bientôt disponibles.</p>
  <a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir les remplacements</a>
</div>'
WHERE type = 'replacement_filled';
