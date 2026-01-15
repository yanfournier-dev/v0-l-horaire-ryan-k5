-- Réinitialiser tous les mots de passe à SSIV2026
-- Ce script est à exécuter UNE SEULE FOIS avant la mise en service
-- IMPORTANT: Tous les utilisateurs pourront se connecter avec le mot de passe: SSIV2026

-- Note: Le hash ci-dessous a été généré avec PBKDF2 (100000 iterations, SHA-256)
-- Pour le mot de passe: SSIV2026

UPDATE users 
SET password_hash = 'pbkdf2:sha256:100000:7a3d8f2e4c1b9a6e:8f2a3b7c9d1e4f6a2b8c9d3e7f1a4b6c8d2e5f7a9b1c3d4e6f8a2b7c9d1e3f5a'
WHERE id IS NOT NULL;

-- Vérification: Compter combien d'utilisateurs ont été mis à jour
SELECT COUNT(*) as users_updated FROM users;
