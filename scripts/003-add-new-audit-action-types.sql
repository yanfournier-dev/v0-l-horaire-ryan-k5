-- Script pour ajouter les nouveaux types d'actions d'audit
-- Ajoute: REPLACEMENT_DELETED, CANDIDATE_REMOVED, EXCHANGE_REQUEST_CREATED

-- Ajout des nouveaux types d'actions d'audit manquants
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'REPLACEMENT_DELETED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'CANDIDATE_REMOVED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'EXCHANGE_REQUEST_CREATED';

-- Commentaire pour documentation
COMMENT ON TYPE audit_action_type IS 'Types d''actions tracées dans le journal d''audit. Mis à jour le 2025-11-28 pour inclure la suppression de remplacements, suppression de candidats, et création d''échanges.';
