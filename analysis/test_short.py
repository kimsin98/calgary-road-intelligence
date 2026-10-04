from datetime import date
import numpy as np
import pandas as pd
import model
from compare_short import features, metrics, windows, fit


def test_temporal_features_ignore_future_and_cover_bins():
    cutoff=date(2025,6,30)
    offsets=[0,6,7,13,14,29,30,89,90,-1]
    inputs=model.Inputs(pd.DataFrame({'unit_id':['a']}),np.zeros(len(offsets),dtype=int),np.array([cutoff.toordinal()-d for d in offsets]),cutoff)
    x=features(inputs,cutoff)
    assert np.allclose(x[0,:4],np.log1p([2,2,2,2]))
    assert x[0,4]==8/90
    assert x[0,5]==.25


def test_metrics_distinguish_sparse_and_active_errors():
    result=metrics(np.array([0.,2.]),np.array([1.,1.]),np.array(['a','b']))
    assert result['mae']==1
    assert result['activeSiteMAE']==1
    assert result['top20']==2


def test_training_windows_finish_inside_year():
    from datetime import timedelta
    assert all((c+timedelta(days=30)).year==c.year for c in windows(2024))
