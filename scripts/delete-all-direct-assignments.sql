-- Supprimer toutes les assignations directes
DELETE FROM shift_assignments
WHERE is_direct_assignment = true;

-- Afficher le nombre d'assignations supprimées
SELECT 'Assignations directes supprimées avec succès' AS message;
