-- Script pour enlever tous les mots de passe pour faciliter les tests
-- Les pompiers pourront se connecter uniquement avec leur email

UPDATE users
SET password_hash = NULL
WHERE TRUE;

-- Vérification
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  is_admin,
  CASE 
    WHEN password_hash IS NULL THEN 'Aucun mot de passe'
    ELSE 'Mot de passe présent'
  END as password_status
FROM users
ORDER BY last_name, first_name;
