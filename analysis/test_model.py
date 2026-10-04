from dataclasses import replace
from datetime import date

import numpy as np
import pytest

import model


@pytest.fixture(scope="module")
def inputs():
    if not (model.DATA / "units.parquet").exists():
        pytest.skip("run fetch.py and prepare.py first")
    return model.load()


def test_nb_dispersion_recovers_known_shape():
    rng = np.random.default_rng(0)
    mu = rng.uniform(0.2, 5, 20000)
    y = rng.poisson(rng.gamma(shape=2.0, scale=mu / 2.0))
    assert model.nb_dispersion(y, mu) == pytest.approx(2.0, rel=0.1)


def test_history_start_covers_whole_years():
    assert model.history_start(date(2025, 12, 31), 5) == date(2021, 1, 1)
    assert model.history_start(date(2026, 10, 2), 1) == date(2025, 10, 3)
    assert model.history_start(date(2024, 2, 29), 1) == date(2023, 3, 1)
    assert model.history_start(date(2018, 12, 31), 5) == model.FIRST_DATE
    assert model.history_start(date(2025, 12, 31), None) == model.FIRST_DATE


def test_eb_lies_between_prior_and_history(inputs):
    f = model.eb_forecast(inputs, date(2024, 12, 31), 3, 365)
    factor = 365 / f["historyDays"]
    history = f["history"] * factor
    low, high = np.minimum(f["spfExpected"], history), np.maximum(f["spfExpected"], history)
    assert np.all((f["expected"] >= low - 1e-9) & (f["expected"] <= high + 1e-9))
    assert set(f["k"]) == {"segment", "intersection"} and all(k > 0 for k in f["k"].values())
    assert np.all(f["low90"] <= f["high90"])


def test_forecasts_ignore_events_after_cutoff(inputs):
    cutoff = date(2023, 12, 31)
    keep = inputs.event_day <= cutoff.toordinal()
    past = replace(inputs, event_unit=inputs.event_unit[keep], event_day=inputs.event_day[keep])
    assert np.allclose(model.eb_forecast(inputs, cutoff, 3, 365)["expected"],
                       model.eb_forecast(past, cutoff, 3, 365)["expected"])
    assert np.allclose(model.ridge_features(inputs, cutoff), model.ridge_features(past, cutoff))


def test_asset_features_only_count_installs_by_cutoff(inputs):
    signals = inputs.asset_type == "signal"
    late = signals & (inputs.asset_day > date(2020, 12, 31).toordinal())
    assert late.any(), "expected some signals installed after 2020"
    before, after = inputs.assets_at("signal", date(2020, 12, 31)), inputs.assets_at("signal", date(2026, 1, 1))
    assert before.sum() < after.sum()
    assert np.array_equal(before, np.bincount(inputs.asset_unit[signals & ~late], minlength=len(inputs.units)))
    undated = inputs.asset_type == "crosswalk"
    assert inputs.assets_at("crosswalk", model.FIRST_DATE).sum() == undated.sum()
