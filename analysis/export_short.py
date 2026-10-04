"""Precompute pure EB next30 outlooks on the validated full-inventory units."""
import gzip
import json
from datetime import date, timedelta, datetime, timezone
import pandas as pd
import model
from compare_short import metrics, target_and_rate
from export import CAVEATS


def main():
    inputs = model.load()
    ids = inputs.units.unit_id.to_numpy()
    records = pd.read_parquet(model.DATA / 'events.parquet')
    cutoffs = [date(2026,m,d) for m,d in [(1,31),(3,31),(5,31),(6,30),(7,31),(8,31)]]
    forecasts = []
    for cutoff in cutoffs + [inputs.last_complete]:
        future = cutoff == inputs.last_complete
        end = cutoff + timedelta(days=30)
        fitted = model.eb_forecast(inputs, cutoff, 3, 30)
        actual, rate = target_and_rate(inputs, cutoff, 30)
        recent = inputs.counts(cutoff-timedelta(days=89), cutoff)
        past = records[(records.date >= model.history_start(cutoff,3).isoformat()) & (records.date <= cutoff.isoformat())]
        evidence = {uid:[{'id':str(e.id),'date':str(e.date),'description':str(e.description)} for e in g.sort_values('date',ascending=False).head(3).itertuples()] for uid,g in past.groupby('unit_id')}
        assets = {name: inputs.assets_at(name, cutoff) for name in ("signal", "stop_sign", "yield_sign", "crosswalk")}
        rows = []
        for rank,i in enumerate(model.rank(fitted['expected'],ids)[:1000],1):
            u = inputs.units.iloc[i]
            rows.append({'id':u.unit_id,'name':u['name'] if isinstance(u['name'],str) else u.unit_id,
                'kind':u.kind,'lon':float(u.lon),'lat':float(u.lat),'rank':rank,
                'predicted':float(fitted['expected'][i]),'baseline':float(rate[i]),'count':int(recent[i]),
                'historyReports':int(fitted['history'][i]),'priorWeight':float(fitted['priorWeight'][i]),
                'low90':int(fitted['low90'][i]),'high90':int(fitted['high90'][i]),
                'siteControl':{'kind':u.kind,'name':u['name'] if isinstance(u['name'],str) else None,
                    'roadClass':u.major if u.kind=='intersection' else u.road_class,
                    'minorRoadClass':u.minor if u.kind=='intersection' else None,
                    'legs':int(u.legs) if u.kind=='intersection' else 0,
                    'signalized':bool(assets['signal'][i]),'stopSigns':int(assets['stop_sign'][i]),
                    'yieldSigns':int(assets['yield_sign'][i]),'crosswalks':int(assets['crosswalk'][i])},
                'target':None if future else int(actual[i]),'reportEvidence':evidence.get(u.unit_id,[])})
        forecasts.append({'cutoff':cutoff.isoformat(),'end':end.isoformat(),'mode':'future' if future else 'backtest',
            'historyStart':model.history_start(cutoff,3).isoformat(),'k':fitted['k'],'rows':rows,
            'expectedTotal':float(fitted['expected'].sum()),
            'evaluation':None if future else {'eb':metrics(actual,fitted['expected'],ids),'rate':metrics(actual,rate,ids)}})
        print('Exported',cutoff,flush=True)
    report={'version':'eb-short-30-v1','generatedAt':datetime.now(timezone.utc).isoformat(),
        'dataFingerprint':inputs.fingerprint(),'dataThrough':inputs.last_complete.isoformat(),
        'horizonDays':30,'historyYears':3,'units':len(ids),'caveats':CAVEATS,
        'selection':'Three-year EB history fixed in the exploratory comparison; not tuned. All reports pooled, no event-type weights.',
        'forecasts':forecasts}
    path=model.DATA.parent.parent/'public/data/forecast-eb30.json'
    text=json.dumps(report,separators=(',',':')).encode()
    path.write_bytes(text);path.with_suffix('.json.gz').write_bytes(gzip.compress(text,compresslevel=9))
    print('Bytes',len(text),'gzip',len(gzip.compress(text)),flush=True)

if __name__=='__main__':main()
