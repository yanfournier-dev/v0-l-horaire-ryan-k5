-- Create table for shift exchanges
CREATE TABLE IF NOT EXISTS shift_exchanges (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_shift_date DATE NOT NULL,
  requester_shift_type shift_type NOT NULL,
  requester_team_id INTEGER NOT NULL REFERENCES teams(id),
  target_shift_date DATE NOT NULL,
  target_shift_type shift_type NOT NULL,
  target_team_id INTEGER NOT NULL REFERENCES teams(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  is_partial BOOLEAN DEFAULT FALSE,
  requester_start_time TIME,
  requester_end_time TIME,
  target_start_time TIME,
  target_end_time TIME,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table to track exchange counts per user per year
CREATE TABLE IF NOT EXISTS user_exchange_counts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  exchange_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_requester ON shift_exchanges(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_target ON shift_exchanges(target_id);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_status ON shift_exchanges(status);
CREATE INDEX IF NOT EXISTS idx_shift_exchanges_dates ON shift_exchanges(requester_shift_date, target_shift_date);
CREATE INDEX IF NOT EXISTS idx_user_exchange_counts_user_year ON user_exchange_counts(user_id, year);

-- Add comment to explain the exchange count logic
COMMENT ON TABLE user_exchange_counts IS 'Tracks the number of shift exchanges initiated by each user per year. Only the requester gets counted, not the target firefighter.';
COMMENT ON COLUMN user_exchange_counts.exchange_count IS 'Number of approved exchanges initiated by this user in this year. Maximum allowed is 8 per year.';

-- Create email templates for shift exchanges
INSERT INTO email_templates (type, name, subject, body, variables, description) VALUES
(
  'exchange_request_received',
  'Demande d''échange reçue',
  '🔄 Demande d''échange de quart',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1f2937;">🔄 Demande d''échange de quart</h2>
  <p>Bonjour {{targetName}},</p>
  <p>{{requesterName}} souhaite échanger un quart avec vous :</p>
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Son quart :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{requesterDate}} - {{requesterShiftType}}</p>
    {{#if requesterIsPartial}}
    <p style="margin: 5px 0 15px 20px; color: #f97316;">Partiel: {{requesterStartTime}} - {{requesterEndTime}}</p>
    {{/if}}
    <p style="margin: 5px 0;"><strong>Votre quart :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{targetDate}} - {{targetShiftType}}</p>
    {{#if targetIsPartial}}
    <p style="margin: 5px 0 15px 20px; color: #f97316;">Partiel: {{targetStartTime}} - {{targetEndTime}}</p>
    {{/if}}
  </div>
  <p>Cette demande doit être approuvée par un administrateur.</p>
  <a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les échanges</a>
</div>',
  '["targetName", "requesterName", "requesterDate", "requesterShiftType", "requesterIsPartial", "requesterStartTime", "requesterEndTime", "targetDate", "targetShiftType", "targetIsPartial", "targetStartTime", "targetEndTime", "appUrl"]'::jsonb,
  'Email envoyé au pompier cible quand une demande d''échange est créée'
),
(
  'exchange_approved',
  'Échange approuvé',
  '✅ Échange de quart approuvé',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #16a34a;">✅ Échange de quart approuvé</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Votre échange de quart avec {{otherFirefighterName}} a été approuvé :</p>
  <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #16a34a;">
    <p style="margin: 5px 0;"><strong>Votre nouveau quart :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{newDate}} - {{newShiftType}}</p>
    {{#if newIsPartial}}
    <p style="margin: 5px 0 15px 20px; color: #f97316;">Partiel: {{newStartTime}} - {{newEndTime}}</p>
    {{/if}}
    <p style="margin: 5px 0;"><strong>Votre ancien quart :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{oldDate}} - {{oldShiftType}}</p>
    {{#if oldIsPartial}}
    <p style="margin: 5px 0 15px 20px; color: #f97316;">Partiel: {{oldStartTime}} - {{oldEndTime}}</p>
    {{/if}}
  </div>
  <p>Les modifications ont été apportées à votre horaire.</p>
  <a href="{{appUrl}}/dashboard/calendar" style="display: inline-block; background-color: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir mon horaire</a>
</div>',
  '["firefighterName", "otherFirefighterName", "newDate", "newShiftType", "newIsPartial", "newStartTime", "newEndTime", "oldDate", "oldShiftType", "oldIsPartial", "oldStartTime", "oldEndTime", "appUrl"]'::jsonb,
  'Email envoyé aux deux pompiers quand un échange est approuvé'
),
(
  'exchange_rejected',
  'Échange refusé',
  '❌ Échange de quart refusé',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc2626;">❌ Échange de quart refusé</h2>
  <p>Bonjour {{firefighterName}},</p>
  <p>Votre demande d''échange de quart avec {{otherFirefighterName}} a été refusée.</p>
  <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626;">
    <p style="margin: 5px 0;"><strong>Votre quart :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{requesterDate}} - {{requesterShiftType}}</p>
    <p style="margin: 5px 0;"><strong>Quart demandé :</strong></p>
    <p style="margin: 5px 0 15px 20px;">{{targetDate}} - {{targetShiftType}}</p>
    {{#if reason}}
    <p style="margin: 15px 0 5px 0;"><strong>Raison :</strong></p>
    <p style="margin: 5px 0;">{{reason}}</p>
    {{/if}}
  </div>
  <a href="{{appUrl}}/dashboard/exchanges" style="display: inline-block; background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Voir les échanges</a>
</div>',
  '["firefighterName", "otherFirefighterName", "requesterDate", "requesterShiftType", "targetDate", "targetShiftType", "reason", "appUrl"]'::jsonb,
  'Email envoyé au demandeur quand un échange est refusé'
)
ON CONFLICT (type) DO NOTHING;
