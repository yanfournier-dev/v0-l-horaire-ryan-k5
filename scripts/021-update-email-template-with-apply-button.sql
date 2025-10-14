-- Update the replacement_available email template to include the apply button
UPDATE email_templates
SET body = '
<h2 style="color: #1f2937;">Remplacement disponible</h2>
<p>Bonjour {{name}},</p>
<p>Un remplacement est disponible pour votre équipe :</p>
<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p style="margin: 5px 0;"><strong>Date :</strong> {{date}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
  <p style="margin: 5px 0;"><strong>Pompier à remplacer :</strong> {{firefighterToReplace}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>
  {{/if}}
</div>
{{#if applyToken}}
<div style="text-align: center; margin: 30px 0;">
  <a href="{{appUrl}}/apply-replacement?token={{applyToken}}" 
     style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
    Postuler maintenant
  </a>
  <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">
    Cliquez sur ce bouton pour postuler directement
  </p>
</div>
{{/if}}
<a href="{{appUrl}}/dashboard/replacements" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les remplacements</a>
'
WHERE type = 'replacement_available';
