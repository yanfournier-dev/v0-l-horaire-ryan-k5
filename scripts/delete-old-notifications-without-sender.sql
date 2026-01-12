-- Supprime toutes les anciennes notifications qui n'ont pas d'expéditeur (sent_by)
-- Ces notifications ont été créées avant la mise à jour du système de tracking

DELETE FROM notifications
WHERE sent_by IS NULL;

-- Afficher un message de confirmation
SELECT 'Anciennes notifications supprimées avec succès' AS message;
