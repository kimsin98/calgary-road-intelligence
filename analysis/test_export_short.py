import json
from pathlib import Path
import pytest


def test_eb30_export_matches_comparison_and_future_is_unobserved():
    root = Path(__file__).resolve().parent.parent
    path = root / 'public/data/forecast-eb30.json'
    if not path.exists():
        pytest.skip('run export_short.py first')
    snapshot = json.loads(path.read_text())
    comparison = json.loads((root / 'reports/short-model-comparison.json').read_text())
    assert snapshot['dataFingerprint'] == comparison['dataFingerprint']
    assert snapshot['horizonDays'] == 30
    for row in comparison['results']:
        forecast = next(f for f in snapshot['forecasts'] if f['cutoff'] == row['cutoff'])
        assert forecast['evaluation']['eb']['top20'] == row['eb']['top20']
        assert forecast['evaluation']['eb']['deviance'] == pytest.approx(row['eb']['deviance'])
    future = next(f for f in snapshot['forecasts'] if f['mode'] == 'future')
    assert future['evaluation'] is None
    assert all(r['target'] is None for r in future['rows'])
    assert all(r['low90'] <= r['high90'] for f in snapshot['forecasts'] for r in f['rows'])
