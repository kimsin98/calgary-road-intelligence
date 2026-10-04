"""Empirical Bayes annual incident forecast and its ridge Poisson baseline.

Units are road segments and intersections (see prepare.py). For a cutoff date and a history of
H years ending at it, each unit's expected reports over the next horizon are:

  eta      SPF: Poisson GLM of the history count on site characteristics only
  k        negative binomial shape, by marginal maximum likelihood given eta (one per unit kind)
  w        k / (k + eta)
  EB       w * eta + (1 - w) * history count            (Hauer, Eq. 1–2)
  SD       sqrt((1 - w) * EB)                           (Eq. 3)
  forecast EB * horizon_days / history_days
  interval NB posterior predictive, shape k + history count

The ridge baseline is a Poisson GLM on each unit's own history features (no site
characteristics), trained on earlier cutoffs with known outcomes.

Reference: Hauer, E., Harwood, D. W., Council, F. M., & Griffith, M. S. (2002). Estimating Safety
by the Empirical Bayes Method: A Tutorial. Transportation Research Record, 1784(1), 126-131.
https://doi.org/10.3141/1784-16
"""

from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize_scalar
from scipy.special import gammaln
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import PoissonRegressor
from sklearn.preprocessing import OneHotEncoder, SplineTransformer, StandardScaler

DATA = Path(__file__).resolve().parent / "data"
FIRST_DATE = date(2017, 1, 1)  # first complete year; Dec 2016 records are dropped
HISTORY_YEARS = (1, 2, 3, 5, None)  # None = all history since FIRST_DATE
RIDGE_ALPHA = 0.001


@dataclass
class Inputs:
    units: pd.DataFrame  # one row per unit, see prepare.py
    event_unit: np.ndarray  # unit row number per event
    event_day: np.ndarray  # local date ordinal per event
    last_complete: date  # latest local date with a full day of records

    def counts(self, start, end):
        """Reports per unit with local date in [start, end] (dates, inclusive)."""
        inside = (self.event_day >= start.toordinal()) & (self.event_day <= end.toordinal())
        return np.bincount(self.event_unit[inside], minlength=len(self.units)).astype(float)

    def active_days(self, start, end):
        inside = (self.event_day >= start.toordinal()) & (self.event_day <= end.toordinal())
        pairs = np.unique(np.column_stack((self.event_unit[inside], self.event_day[inside])), axis=0)
        return np.bincount(pairs[:, 0], minlength=len(self.units)).astype(float)


def load(data_dir=DATA):
    units = pd.read_parquet(data_dir / "units.parquet")
    events = pd.read_parquet(data_dir / "events.parquet")
    events = events[events.date >= FIRST_DATE.isoformat()]
    last_complete = date.fromisoformat(events.date.max()) - timedelta(days=1)  # latest day is partial
    events = events[events.date <= last_complete.isoformat()]
    row = pd.Series(np.arange(len(units)), index=units.unit_id)
    return Inputs(
        units=units,
        event_unit=row[events.unit_id].to_numpy(),
        event_day=np.array([date.fromisoformat(d).toordinal() for d in events.date]),
        last_complete=last_complete,
    )


def history_start(cutoff, years):
    """First day of an H-year history ending at cutoff (Dec 31 -> Jan 1 of year - H + 1)."""
    if years is None:
        return FIRST_DATE
    try:
        start = cutoff.replace(year=cutoff.year - years) + timedelta(days=1)
    except ValueError:  # Feb 29
        start = cutoff.replace(year=cutoff.year - years, day=28) + timedelta(days=1)
    return max(start, FIRST_DATE)


# ---------------------------------------------------------------- empirical Bayes


def volume_up_to(units, year):
    """Mean log1p weekday volume over published count years <= year; NaN if never counted.

    Count years are averaged as observed, without imputation (2020–2021 were not published), and
    later years are excluded so a backtest never sees volumes from after its cutoff.
    """
    columns = [c for c in units.columns if c.startswith("volume_") and int(c[7:]) <= year]
    return np.log1p(units[columns]).mean(axis=1, skipna=True) if columns else pd.Series(np.nan, index=units.index)


def site_features(units, cutoff):
    log_volume = volume_up_to(units, cutoff.year)
    return pd.DataFrame(
        {
            "road_class": units.road_class.fillna("Unknown"),
            "major": units.major.fillna("none"),
            "minor": units.minor.fillna("none"),
            "legs": units.legs.fillna(0),
            "log_length": np.log1p(units.length_m.fillna(0)),
            "log_volume": log_volume.fillna(0),
            "has_volume": log_volume.notna().astype(float),
            "lon": units.lon,
            "lat": units.lat,
        },
        index=units.index,
    )


def spf_model(kind):
    """Site-only SPF: road class (segments) or leg classes (intersections), size, mean volume, location."""
    one_hot = lambda: OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=100)
    if kind == "segment":
        categorical = [("road_class", one_hot(), ["road_class"])]
        numeric = ["log_length", "log_volume", "has_volume"]
    else:
        categorical = [("major", one_hot(), ["major"]), ("minor", one_hot(), ["minor"])]
        numeric = ["legs", "log_volume", "has_volume"]
    columns = ColumnTransformer(
        categorical + [("numeric", StandardScaler(), numeric), ("space", SplineTransformer(n_knots=10), ["lon", "lat"])]
    )
    return columns, PoissonRegressor(alpha=1e-5, solver="newton-cholesky", max_iter=1000)


def nb_dispersion(y, mu):
    """Marginal ML of the NB2 shape k (Var = mu + mu^2 / k) with the mean held at mu."""

    def negative_loglik(log_k):
        k = np.exp(log_k)
        return -np.sum(gammaln(y + k) - gammaln(k) - gammaln(y + 1) + k * np.log(k / (k + mu))
                       + y * np.log(mu / (k + mu)))

    return float(np.exp(minimize_scalar(negative_loglik, bounds=(-8, 8), method="bounded").x))


def eb_forecast(inputs, cutoff, history_years, horizon_days, scale=1.0):
    """EB forecast for the horizon_days after cutoff. scale multiplies all predictions (season)."""
    start = history_start(cutoff, history_years)
    history_days = cutoff.toordinal() - start.toordinal() + 1
    y = inputs.counts(start, cutoff)
    features = site_features(inputs.units, cutoff)
    eta, k = np.zeros(len(y)), np.zeros(len(y))
    dispersion = {}
    for kind in ("segment", "intersection"):
        rows = np.flatnonzero(inputs.units.kind.to_numpy() == kind)
        columns, glm = spf_model(kind)
        x = columns.fit_transform(features.iloc[rows])
        eta[rows] = glm.fit(x, y[rows]).predict(x)
        k[rows] = dispersion[kind] = nb_dispersion(y[rows], eta[rows])
    w = k / (k + eta)
    eb_history = w * eta + (1 - w) * y
    factor = horizon_days / history_days * scale
    expected = factor * eb_history
    shape = k + y
    p = shape / (shape + expected)
    return {
        "expected": expected,
        "sd": factor * np.sqrt((1 - w) * eb_history),
        "low90": stats.nbinom.ppf(0.05, shape, p),
        "high90": stats.nbinom.ppf(0.95, shape, p),
        "shape": shape,
        "history": y,
        "historyDays": history_days,
        "spfExpected": factor * eta,
        "priorWeight": w,
        "k": dispersion,
    }


# ---------------------------------------------------------------- ridge baseline


def ridge_features(inputs, cutoff):
    """Own-history features: last 365 days, last 92 days, earlier mean per year, active days."""
    year_ago = cutoff - timedelta(days=365)
    last = inputs.counts(year_ago + timedelta(days=1), cutoff)
    recent = inputs.counts(cutoff - timedelta(days=91), cutoff)
    earlier_years = (year_ago.toordinal() - FIRST_DATE.toordinal() + 1) / 365
    earlier = inputs.counts(FIRST_DATE, year_ago) / earlier_years if earlier_years >= 1 else np.zeros_like(last)
    active = inputs.active_days(year_ago + timedelta(days=1), cutoff) / 365
    return np.column_stack((np.log1p(last), np.log1p(recent), np.log1p(earlier), active))


def fit_ridge(inputs, training_cutoffs):
    """Train on (cutoff, next 365 days) pairs; predictions are expected reports per 365 days."""
    x = np.vstack([ridge_features(inputs, c) for c in training_cutoffs])
    y = np.concatenate([inputs.counts(c + timedelta(days=1), c + timedelta(days=365)) for c in training_cutoffs])
    return PoissonRegressor(alpha=RIDGE_ALPHA, solver="newton-cholesky", max_iter=1000).fit(x, y)


def ridge_forecast(model, inputs, cutoff, horizon_days, scale=1.0):
    return model.predict(ridge_features(inputs, cutoff)) * horizon_days / 365 * scale


# ---------------------------------------------------------------- metrics


def deviance(actual, expected):
    """Mean Poisson deviance (zero predictions floored, as in src/forecast.mjs)."""
    expected = np.maximum(expected, 1e-9)
    ratio = np.where(actual > 0, actual / expected, 1)
    return float(np.mean(2 * (actual * np.log(ratio) - actual + expected)))


def rank(predicted, ids):
    """Descending prediction, ties broken by id."""
    return np.lexsort((ids, -predicted))
