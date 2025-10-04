-- Add isPartial and partialHours variables to email templates

-- Update replacement_available template
UPDATE email_templates
SET 
  variables = array_append(
    array_append(
      COALESCE(variables, ARRAY[]::text[]),
      'isPartial'
    ),
    'partialHours'
  ),
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
WHERE type = 'replacement_available'
  AND NOT ('isPartial' = ANY(variables));

-- Update application_approved template
UPDATE email_templates
SET 
  variables = array_append(
    array_append(
      COALESCE(variables, ARRAY[]::text[]),
      'isPartial'
    ),
    'partialHours'
  ),
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
WHERE type = 'application_approved'
  AND NOT ('isPartial' = ANY(variables));

-- Update application_rejected template
UPDATE email_templates
SET 
  variables = array_append(
    array_append(
      COALESCE(variables, ARRAY[]::text[]),
      'isPartial'
    ),
    'partialHours'
  ),
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
WHERE type = 'application_rejected'
  AND NOT ('isPartial' = ANY(variables));

-- Update replacement_created template (for admin notifications)
UPDATE email_templates
SET 
  variables = array_append(
    array_append(
      COALESCE(variables, ARRAY[]::text[]),
      'isPartial'
    ),
    'partialHours'
  ),
  body = REPLACE(
    REPLACE(
      body,
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>',
      '<p style="margin: 5px 0;"><strong>Type de quart :</strong> {{shiftType}}</p>
      {{#if isPartial}}<p style="margin: 5px 0; color: #f97316;"><strong>Remplacement partiel :</strong> {{partialHours}}</p>{{/if}}'
    ),
    'Un nouveau remplacement a été créé pour le {{date}} ({{shiftType}}).',
    'Un nouveau remplacement{{#if isPartial}} partiel{{/if}} a été créé pour le {{date}} ({{shiftType}}){{#if isPartial}} de {{partialHours}}{{/if}}.'
  )
WHERE type = 'replacement_created'
  AND NOT ('isPartial' = ANY(variables));
