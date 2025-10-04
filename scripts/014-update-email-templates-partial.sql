-- Update email templates to include partial replacement information

UPDATE email_templates
SET 
  html_content = REPLACE(html_content, 
    'Un nouveau remplacement est disponible pour le {{date}} ({{shiftType}}).',
    'Un nouveau remplacement{{partialLabel}} est disponible pour le {{date}} ({{shiftType}}){{timeInfo}}.'
  ),
  text_content = REPLACE(text_content,
    'Un nouveau remplacement est disponible pour le {{date}} ({{shiftType}}).',
    'Un nouveau remplacement{{partialLabel}} est disponible pour le {{date}} ({{shiftType}}){{timeInfo}}.'
  )
WHERE type = 'replacement_available';

UPDATE email_templates
SET 
  html_content = REPLACE(html_content,
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été approuvée.',
    'Votre candidature pour le remplacement{{partialLabel}} du {{date}} ({{shiftType}}){{timeInfo}} a été approuvée.'
  ),
  text_content = REPLACE(text_content,
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été approuvée.',
    'Votre candidature pour le remplacement{{partialLabel}} du {{date}} ({{shiftType}}){{timeInfo}} a été approuvée.'
  )
WHERE type = 'application_approved';

UPDATE email_templates
SET 
  html_content = REPLACE(html_content,
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été rejetée.',
    'Votre candidature pour le remplacement{{partialLabel}} du {{date}} ({{shiftType}}){{timeInfo}} a été rejetée.'
  ),
  text_content = REPLACE(text_content,
    'Votre candidature pour le remplacement du {{date}} ({{shiftType}}) a été rejetée.',
    'Votre candidature pour le remplacement{{partialLabel}} du {{date}} ({{shiftType}}){{timeInfo}} a été rejetée.'
  )
WHERE type = 'application_rejected';
