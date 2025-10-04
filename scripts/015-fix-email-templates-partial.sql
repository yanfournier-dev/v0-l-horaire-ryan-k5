-- Fix email templates to use correct partial replacement variables

-- Update replacement_available template
UPDATE email_templates
SET 
  body = REPLACE(
    REPLACE(
      body,
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>',
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}'
    ),
    'Un nouveau remplacement est disponible pour le {{date}} ({{shiftType}}).',
    'Un nouveau remplacement{{#if isPartial}} partiel{{/if}} est disponible pour le {{date}} ({{shiftType}}){{#if isPartial}} de {{partialHours}}{{/if}}.'
  )
WHERE type = 'replacement_available';

-- Update application_approved template
UPDATE email_templates
SET 
  body = REPLACE(
    REPLACE(
      body,
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>',
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}'
    ),
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été approuvée.',
    'Votre candidature pour le remplacement{{#if isPartial}} partiel{{/if}} du {{date}} ({{shiftType}}){{#if isPartial}} de {{partialHours}}{{/if}} a été approuvée.'
  )
WHERE type = 'application_approved';

-- Update application_rejected template
UPDATE email_templates
SET 
  body = REPLACE(
    REPLACE(
      body,
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>',
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}'
    ),
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été rejetée.',
    'Votre candidature pour le remplacement{{#if isPartial}} partiel{{/if}} du {{date}} ({{shiftType}}){{#if isPartial}} de {{partialHours}}{{/if}} a été rejetée.'
  )
WHERE type = 'application_rejected';
