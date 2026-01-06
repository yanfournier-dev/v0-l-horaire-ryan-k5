-- Remplacement de toutes les occurrences de "direct_assignments" par "shift_assignments"
-- Script de test automatique pour la logique de double remplacement
-- Ce script crée un double remplacement, le supprime, et vérifie que le remplaçant restant s'étend correctement

-- 1. Afficher l'état actuel de Michel Ruel (user_id 13) le 6 janvier 2026
SELECT 'ÉTAT INITIAL - Michel Ruel le 6 janvier 2026' AS step;
SELECT 
  sa.id,
  sa.user_id,
  u.first_name || ' ' || u.last_name AS replacement_name,
  sa.replaced_user_id,
  sa.replacement_order,
  sa.is_partial,
  sa.start_time,
  sa.end_time,
  sa.shift_date
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
WHERE sa.replaced_user_id = 13
  AND sa.shift_date = '2026-01-06'
ORDER BY sa.replacement_order;

-- 2. Nettoyer les anciennes données de test si elles existent
DELETE FROM shift_assignments 
WHERE shift_date = '2026-01-06'
AND replaced_user_id = 13;

-- 3. Créer un double remplacement de test pour Michel Ruel
DO $$
DECLARE
  v_shift_id INTEGER;
  v_francis_id INTEGER;
  v_tommy_id INTEGER;
BEGIN
  -- Trouver un shift de type 'day' pour l'équipe 1 (pas de shift_date dans shifts)
  SELECT id INTO v_shift_id
  FROM shifts
  WHERE shift_type = 'day' AND team_id = 1
  LIMIT 1;

  -- Trouver Francis Bédard
  SELECT id INTO v_francis_id
  FROM users
  WHERE first_name = 'Francis' AND last_name = 'Bédard'
  LIMIT 1;

  -- Trouver Tommy Beauchemin
  SELECT id INTO v_tommy_id
  FROM users
  WHERE first_name = 'Tommy' AND last_name = 'Beauchemin'
  LIMIT 1;

  IF v_shift_id IS NULL OR v_francis_id IS NULL OR v_tommy_id IS NULL THEN
    RAISE NOTICE 'Erreur: shift_id=%, francis_id=%, tommy_id=%', v_shift_id, v_francis_id, v_tommy_id;
    RETURN;
  END IF;

  RAISE NOTICE 'IDs trouvés: shift_id=%, francis_id=%, tommy_id=%', v_shift_id, v_francis_id, v_tommy_id;

  -- Créer le Remplaçant 1: Francis (07:00-12:00)
  INSERT INTO shift_assignments (
    shift_id, user_id, replaced_user_id, replacement_order,
    is_partial, start_time, end_time, shift_date, 
    is_direct_assignment, created_at_audit, updated_at_audit
  ) VALUES (
    v_shift_id, v_francis_id, 13, 1,
    true, '07:00:00', '12:00:00', '2026-01-06',
    true, NOW(), NOW()
  );

  -- Créer le Remplaçant 2: Tommy (12:00-17:00)
  INSERT INTO shift_assignments (
    shift_id, user_id, replaced_user_id, replacement_order,
    is_partial, start_time, end_time, shift_date,
    is_direct_assignment, created_at_audit, updated_at_audit
  ) VALUES (
    v_shift_id, v_tommy_id, 13, 2,
    true, '12:00:00', '17:00:00', '2026-01-06',
    true, NOW(), NOW()
  );

  RAISE NOTICE 'Double remplacement créé: Francis (07:00-12:00) et Tommy (12:00-17:00)';
END $$;

-- 4. Afficher le double remplacement créé
SELECT 'APRÈS CRÉATION - Double remplacement pour Michel Ruel' AS step;
SELECT 
  sa.id,
  sa.user_id,
  u.first_name || ' ' || u.last_name AS replacement_name,
  sa.replaced_user_id,
  sa.replacement_order,
  sa.is_partial,
  sa.start_time,
  sa.end_time
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
WHERE sa.shift_date = '2026-01-06'
AND sa.replaced_user_id = 13
ORDER BY sa.replacement_order;

-- 5. Simuler la logique de suppression du Remplaçant 2 avec extension du Remplaçant 1
DO $$
DECLARE
  v_shift_id INTEGER;
  v_replacement1 RECORD;
  v_replacement2 RECORD;
  v_min_start_time TIME;
  v_max_end_time TIME;
  v_full_start_time TIME := '07:00:00';
  v_full_end_time TIME := '17:00:00';
  v_is_partial BOOLEAN;
BEGIN
  -- Trouver les deux remplacements
  SELECT * INTO v_replacement1
  FROM shift_assignments
  WHERE shift_date = '2026-01-06'
    AND replaced_user_id = 13
    AND replacement_order = 1;

  SELECT * INTO v_replacement2
  FROM shift_assignments
  WHERE shift_date = '2026-01-06'
    AND replaced_user_id = 13
    AND replacement_order = 2;

  IF v_replacement1 IS NULL OR v_replacement2 IS NULL THEN
    RAISE NOTICE 'Double remplacement NON détecté!';
    RETURN;
  END IF;

  RAISE NOTICE 'Double remplacement détecté:';
  RAISE NOTICE '  R1: start=%, end=%', v_replacement1.start_time, v_replacement1.end_time;
  RAISE NOTICE '  R2: start=%, end=%', v_replacement2.start_time, v_replacement2.end_time;

  -- Calculer la plage horaire totale
  v_min_start_time := LEAST(v_replacement1.start_time, v_replacement2.start_time);
  v_max_end_time := GREATEST(v_replacement1.end_time, v_replacement2.end_time);

  RAISE NOTICE 'Plage horaire totale: % - %', v_min_start_time, v_max_end_time;

  -- Vérifier si le remplacement étendu couvre le quart complet
  v_is_partial := NOT (v_min_start_time = v_full_start_time AND v_max_end_time = v_full_end_time);

  RAISE NOTICE 'Quart complet: % - %', v_full_start_time, v_full_end_time;
  RAISE NOTICE 'is_partial: %', v_is_partial;

  -- Étendre le Remplaçant 1
  UPDATE shift_assignments
  SET 
    start_time = v_min_start_time,
    end_time = v_max_end_time,
    is_partial = v_is_partial,
    replacement_order = 1,
    updated_at_audit = NOW()
  WHERE id = v_replacement1.id;

  RAISE NOTICE 'Remplaçant 1 étendu: % - %', v_min_start_time, v_max_end_time;

  -- Supprimer le Remplaçant 2
  DELETE FROM shift_assignments
  WHERE id = v_replacement2.id;

  RAISE NOTICE 'Remplaçant 2 supprimé';
END $$;

-- 6. Afficher le résultat final
SELECT 'APRÈS SUPPRESSION - Remplaçant 1 devrait être étendu' AS step;
SELECT 
  sa.id,
  sa.user_id,
  u.first_name || ' ' || u.last_name AS replacement_name,
  sa.replaced_user_id,
  sa.replacement_order,
  sa.is_partial,
  sa.start_time,
  sa.end_time,
  CASE 
    WHEN sa.start_time = '07:00:00' AND sa.end_time = '17:00:00' THEN '✓ Couvre le quart complet'
    ELSE '✗ Ne couvre PAS le quart complet'
  END AS verification
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
WHERE sa.shift_date = '2026-01-06'
AND sa.replaced_user_id = 13
ORDER BY sa.replacement_order;

-- 7. Nettoyer les données de test
DELETE FROM shift_assignments 
WHERE shift_date = '2026-01-06'
AND replaced_user_id = 13;

SELECT 'TEST TERMINÉ - Données de test nettoyées' AS step;
