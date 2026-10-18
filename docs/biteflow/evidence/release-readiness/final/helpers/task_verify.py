import subprocess,sys
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
cases={
'3':[
 ['backend-rc03-final','.','.venv/bin/python','-m','pytest','-q','tests/test_basis_correction.py','tests/test_canonical_domain.py','tests/test_meal_service.py','tests/test_partial_compatibility.py'],
 ['rc03-final','mobile','npm','test','--','--runInBand','src/domain/__tests__/basis-correction.test.ts','src/api/__tests__/basis-capability.test.ts','src/components/__tests__/MealFoodEditor.test.tsx']],
'4':[
 ['backend-rc04-final','.','.venv/bin/python','-m','pytest','-q','tests/test_goals.py','tests/test_meal_service.py','tests/test_health.py','tests/test_health_connect.py'],
 ['rc04-final','mobile','npm','test','--','--runInBand','src/api/__tests__/canonical-edit.test.ts','src/components/__tests__/MealEdit.test.tsx','src/components/__tests__/MealEditRoute.test.tsx','src/components/__tests__/MealEditPropagation.test.tsx','src/data/__tests__/journal.test.ts']],
'5':[
 ['rc05-final','mobile','npm','test','--','--runInBand','src/storage/__tests__/private-cleanup-recovery.test.ts','src/storage/__tests__/private-cleanup-process.test.js','src/storage/__tests__/export.test.ts','src/auth/__tests__/private-cleanup-navigation.test.tsx','src/auth/__tests__/export-cleanup.test.tsx','src/auth/__tests__/rollback-export-cleanup.test.tsx','src/components/__tests__/AccountExport.test.tsx']]
}
for args in cases[sys.argv[1]]:
 subprocess.run([sys.executable,str(out/'run.py'),*args],cwd=root,check=True)
