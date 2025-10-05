-- Créer un congé partiel approuvé pour Marc-André Dubois le 24 octobre 2025
-- Ce script va créer le congé avec des heures spécifiques (08:00-16:00)

-- Étape 1: Trouver l'ID de Marc-André Dubois
DO $$
DECLARE
  dubois_user_id INT;
BEGIN
  -- Trouver l'ID de Marc-André Dubois
  SELECT id INTO dubois_user_id
  FROM users
  WHERE first_name = 'Marc-André' AND last_name = 'Dubois'
  LIMIT 1;

  IF dubois_user_id IS NULL THEN
    RAISE NOTICE 'ERREUR: Marc-André Dubois n''existe pas dans la base de données';
  ELSE
    RAISE NOTICE 'Marc-André Dubois trouvé avec ID: %', dubois_user_id;
    
    -- Supprimer les congés existants pour cette date (pour éviter les doublons)
    DELETE FROM leaves
    WHERE user_id = dubois_user_id
      AND start_date = '2025-10-24'
      AND end_date = '2025-10-24';
    
    RAISE NOTICE 'Congés existants supprimés pour le 24 octobre 2025';
    
    -- Créer le congé partiel approuvé
    INSERT INTO leaves (
      user_id,
      start_date,
      end_date,
      leave_type,
      start_time,
      end_time,
      status,
      reason,
      created_at,
      updated_at
    ) VALUES (
      dubois_user_id,
      '2025-10-24',
      '2025-10-24',
      'sick',  -- Type de congé (peut être changé selon vos besoins)
      '08:00:00',  -- Heure de début du congé partiel
      '16:00:00',  -- Heure de fin du congé partiel
      'approved',  -- IMPORTANT: Le congé doit être approuvé pour s'afficher
      'Congé partiel - remplacé par Yannick Dargy',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Congé partiel créé avec succès pour le 24 octobre 2025 (08:00-16:00)';
  END IF;
END $$;

-- Vérifier que le congé a été créé
SELECT 
  l.id,
  u.first_name,
  u.last_name,
  l.start_date,
  l.end_date,
  l.start_time,
  l.end_time,
  l.leave_type,
  l.status,
  l.reason
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' 
  AND u.last_name = 'Dubois'
  AND l.start_date = '2025-10-24'
ORDER BY l.created_at DESC;
