"""Monthly annual replay exports, loaded separately to avoid one large download."""
import calendar,json,subprocess,sys
from datetime import date
from pathlib import Path
import model
root=Path(__file__).resolve().parent.parent
inputs=model.load()
latest=inputs.last_complete
fingerprint=inputs.fingerprint()
entries=[]
for year in (2025,2026):
 for month in range(1,13):
  cutoff=date(year,month,calendar.monthrange(year,month)[1])
  if cutoff>=latest:continue
  path=root/'public/data/annual-replays'/f'{cutoff}.json'
  valid = False
  if path.exists():
   saved=json.loads(path.read_text())
   valid=saved.get("dataFingerprint")==fingerprint and "totalReports" in (saved.get("observation") or {})
  if not valid:
   subprocess.run([sys.executable,str(root/'analysis/export.py'),'--cutoff',str(cutoff),'--output',str(path)],check=True)
  entries.append({'cutoff':str(cutoff),'url':f'/data/annual-replays/{cutoff}.json.gz'})
(root/'public/data/annual-replays/index.json').write_text(json.dumps({'entries':entries}))
