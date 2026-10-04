"""Same-unit short-model experiment; 2026 results are exploratory, not untouched tests."""
import json
from datetime import date, timedelta
import warnings
import numpy as np
from sklearn.linear_model import PoissonRegressor
from sklearn.exceptions import ConvergenceWarning
import model

HORIZON = 30
ALPHAS = (.001, .01, .1, 1.)


def windows(year):
    return [date(year, m, d) for m, d in [(3,31),(6,30),(9,30),(11,30)]]


def features(inputs, cutoff):
    bins = [inputs.counts(cutoff-timedelta(days=b-1), cutoff-timedelta(days=a))
            for a,b in [(0,7),(7,14),(14,30),(30,90)]]
    total = sum(bins)
    active = inputs.active_days(cutoff-timedelta(days=89),cutoff)/90
    share = np.divide(bins[0],total,out=np.zeros_like(total),where=total>0)
    return np.column_stack([*[np.log1p(b) for b in bins],active,share])


def metrics(actual, predicted, ids):
    order=model.rank(predicted,ids)
    active=actual>0
    return {'deviance':model.deviance(actual,predicted),
            'mae':float(np.mean(np.abs(actual-predicted))),
            'activeSiteMAE':float(np.mean(np.abs(actual[active]-predicted[active]))) if active.any() else None,
            'expected':float(predicted.sum()),'observed':int(actual.sum()),
            'top20':int(actual[order[:20]].sum()),'top100':int(actual[order[:100]].sum())}


def fit(x,y,alpha):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always',ConvergenceWarning)
        fitted=PoissonRegressor(alpha=alpha,solver='newton-cholesky',max_iter=1000,tol=1e-7).fit(x,y)
    return fitted, {'iterations':int(fitted.n_iter_), 'convergenceWarning':any(issubclass(w.category,ConvergenceWarning) for w in caught)}


def main():
    inputs=model.load();ids=inputs.units.unit_id.to_numpy()
    training=windows(2023)+windows(2024)+windows(2025)
    testing=[date(2026,m,d) for m,d in [(1,31),(3,31),(5,31),(6,30),(7,31),(8,31)]]
    cache={}
    for cutoff in training+testing:
        eb=model.eb_forecast(inputs,cutoff,3,HORIZON)['expected']
        x=features(inputs,cutoff)
        season=[np.sin(2*np.pi*cutoff.timetuple().tm_yday/365.25),np.cos(2*np.pi*cutoff.timetuple().tm_yday/365.25)]
        hybrid=np.column_stack([x,np.log1p(eb),np.tile(season,(len(x),1))])
        cache[cutoff]={'x':x,'hybrid':hybrid,'eb':eb,'y':inputs.counts(cutoff+timedelta(days=1),cutoff+timedelta(days=HORIZON)),
                       'rate':inputs.counts(cutoff-timedelta(days=89),cutoff)/3}
        print('Prepared',cutoff,flush=True)
    results={};selection={}
    for name,key in [('poisson','x'),('ebRecentSeason','hybrid')]:
        trials=[]
        for alpha in ALPHAS:
            folds=[]
            for train_years,valid_year in [([2023],2024),([2023,2024],2025)]:
                cutoffs=[c for c in training if c.year in train_years]
                fitted,diagnostics=fit(np.vstack([cache[c][key] for c in cutoffs]),np.concatenate([cache[c]['y'] for c in cutoffs]),alpha)
                scores=[metrics(cache[c]['y'],fitted.predict(cache[c][key]),ids) for c in windows(valid_year)]
                folds.append({'trainYears':train_years,'validationYear':valid_year,'diagnostics':diagnostics,
                              'deviance':float(np.mean([s['deviance'] for s in scores])),
                              'top20Mean':float(np.mean([s['top20'] for s in scores]))})
            trials.append({'alpha':alpha,'folds':folds,'deviance':float(np.mean([f['deviance'] for f in folds]))})
        chosen=min(trials,key=lambda t:(t['deviance'],-t['alpha']))
        fitted,diagnostics=fit(np.vstack([cache[c][key] for c in training]),np.concatenate([cache[c]['y'] for c in training]),chosen['alpha'])
        selection[name]={'selectedAlpha':chosen['alpha'],'trials':trials,'finalDiagnostics':diagnostics}
        results[name]=[metrics(cache[c]['y'],fitted.predict(cache[c][key]),ids) for c in testing]
        print('Fitted',name,chosen['alpha'],flush=True)
    rows=[]
    for i,c in enumerate(testing):
        row={'cutoff':c.isoformat(),'end':(c+timedelta(days=30)).isoformat(),
             'rate':metrics(cache[c]['y'],cache[c]['rate'],ids),'eb':metrics(cache[c]['y'],cache[c]['eb'],ids),
             **{name:scores[i] for name,scores in results.items()}}
        rows.append(row)
        print(c,{k:v['top20'] for k,v in row.items() if isinstance(v,dict)},flush=True)
    report={'experimental':True,'dataFingerprint':inputs.fingerprint(),'sameUnits':True,'units':len(ids),'horizonDays':30,
            'selectionMetric':'Equal-fold mean per-window Poisson deviance; no 2026 selection',
            'caveats':['Current geometry and volume publication-time limitations remain.',
                       'This reproduces pooled temporal Poisson features on annual units, not the browser fit/penalty.',
                       'Hybrid jointly learns temporal signals, log EB expectation and seasonal sin/cos; not a fixed EB offset.',
                       '2026 has been inspected repeatedly; results are exploratory. EB history fixed at 3 years, not tuned here.',
                       'All reports pooled; no collision-type weighting. Seasonal effects have only two validation years.'],
            'selection':selection,'results':rows}
    (model.DATA.parent.parent/'reports/short-model-comparison.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':main()
