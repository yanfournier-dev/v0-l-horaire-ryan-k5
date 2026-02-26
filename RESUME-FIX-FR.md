## RÉSUMÉ DES FIXES APPLIQUÉS

### AVANT LE FIX ❌

**Photo 1**: Ajouter R1 Cloutier 07:00-15:00
- ✅ Fonctionne correctement

**Photo 2**: Ajouter R2 David Bois 07:00-08:30
- ❌ R1 affiche 08:30-07:00 (inversé!)
- ❌ Les `original_start_time` et `original_end_time` ne sont PAS sauvegardés

**Photo 3**: Supprimer R2
- ❌ R1 affiche "Quart complet" au lieu de 07:00-15:00
- Raison: `original_start_time` et `original_end_time` étaient NULL
- Raison 2: `is_partial` était forcé à `false`

---

### APRÈS LE FIX ✅

**Photo 1**: Ajouter R1 Cloutier 07:00-15:00
- ✅ Fonctionne correctement

**Photo 2**: Ajouter R2 David Bois 07:00-08:30
- ✅ R1 affiche correctement 08:30-15:00
- ✅ Les `original_start_time = 07:00` et `original_end_time = 15:00` sont SAUVEGARDÉS en BD

**Photo 3**: Supprimer R2
- ✅ R1 revient à son état original 07:00-15:00 (marqué comme partial)
- ✅ Les heures originales sont restaurées depuis la BD
- ✅ L'état `is_partial = true` est préservé

---

### CHANGEMENTS DANS LE CODE

**File**: `/app/actions/direct-assignments.ts`

**Change #1** (Ligne ~620-649): Cas "R2 couvre le début"
- AVANT: INSERT 11 colonnes (missing original_start_time, original_end_time)
- APRÈS: INSERT 13 colonnes + original_start_time et original_end_time

**Change #2** (Ligne ~659-688): Cas "R2 couvre la fin"  
- AVANT: INSERT 11 colonnes (missing original_start_time, original_end_time)
- APRÈS: INSERT 13 colonnes + original_start_time et original_end_time

**Change #3** (Ligne ~999): Restauration du R1 après suppression du R2
- AVANT: is_partial = ${false}  ❌
- APRÈS: is_partial = ${replacementToKeep.is_partial}  ✅

---

### VÉRIFICATION

Exécute ce script SQL pour confirmer que les données sont correctes:
\`\`\`bash
# scripts/verify-partial-fix.sql
\`\`\`

Ça affichera:
- Tommy Plouride - 2026-03-01
- R1: Cloutier avec original_start_time=07:00, original_end_time=15:00
- R2: Bois (si présent)
- Tous les `is_partial` correctement définis
