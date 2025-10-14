-- Add email templates for shift exchanges

INSERT INTO email_templates (type, name, subject, body, variables, is_active)
VALUES 
(
  'exchange_request',
  'Demande d''échange de quart',
  'Demande d''échange de quart de {{requesterName}}',
  '<h2 style="color: #1f2937;">Demande d''échange de quart</h2>
<p>Bonjour {{targetName}},</p>
<p><strong>{{requesterName}}</strong> souhaite échanger un quart avec vous :</p>

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Quart de {{requesterName}}</h3>
  <p style="margin: 5px 0;"><strong>Date :</strong> {{requesterDate}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{requesterShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{requesterPartialHours}}</p>
  {{/if}}
</div>

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Votre quart</h3>
  <p style="margin: 5px 0;"><strong>Date :</strong> {{targetDate}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{targetShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{targetPartialHours}}</p>
  {{/if}}
</div>

<p>Cette demande doit être approuvée par un administrateur.</p>

<a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir la demande</a>',
  '["targetName", "requesterName", "requesterDate", "requesterShiftType", "targetDate", "targetShiftType", "isPartial", "requesterPartialHours", "targetPartialHours"]',
  true
),
(
  'exchange_approved',
  'Échange de quart approuvé',
  'Votre échange de quart a été approuvé',
  '<h2 style="color: #10b981;">Échange de quart approuvé</h2>
<p>Bonjour {{name}},</p>
<p>Votre échange de quart avec <strong>{{otherName}}</strong> a été approuvé par un administrateur.</p>

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Votre nouveau quart</h3>
  <p style="margin: 5px 0;"><strong>Date :</strong> {{otherDate}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{otherShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{otherPartialHours}}</p>
  {{/if}}
</div>

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Quart échangé</h3>
  <p style="margin: 5px 0;"><strong>Date :</strong> {{yourDate}}</p>
  <p style="margin: 5px 0;"><strong>Type de quart :</strong> {{yourShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{yourPartialHours}}</p>
  {{/if}}
</div>

<a href="{{appUrl}}/dashboard/calendar" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon calendrier</a>',
  '["name", "otherName", "yourDate", "yourShiftType", "otherDate", "otherShiftType", "isPartial", "yourPartialHours", "otherPartialHours"]',
  true
),
(
  'exchange_rejected',
  'Échange de quart refusé',
  'Votre demande d''échange a été refusée',
  '<h2 style="color: #ef4444;">Demande d''échange refusée</h2>
<p>Bonjour {{name}},</p>
<p>Votre demande d''échange de quart avec <strong>{{otherName}}</strong> a été refusée par un administrateur.</p>

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #374151;">Détails de l''échange</h3>
  <p style="margin: 5px 0;"><strong>Votre quart :</strong> {{yourDate}} - {{yourShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{yourPartialHours}}</p>
  {{/if}}
  <p style="margin: 5px 0;"><strong>Quart souhaité :</strong> {{otherDate}} - {{otherShiftType}}</p>
  {{#if isPartial}}
  <p style="margin: 5px 0; color: #f97316;"><strong>Partiel :</strong> {{otherPartialHours}}</p>
  {{/if}}
</div>

{{#if reason}}
<div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;">
  <p style="margin: 0; color: #991b1b;"><strong>Raison :</strong> {{reason}}</p>
</div>
{{/if}}

<a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mes échanges</a>',
  '["name", "otherName", "yourDate", "yourShiftType", "otherDate", "otherShiftType", "reason", "isPartial", "yourPartialHours", "otherPartialHours"]',
  true
)
ON CONFLICT (type) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
