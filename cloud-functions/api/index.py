"""Risk & policy service — FastAPI, deployed as an EdgeOne Makers Python cloud function.

This file lives at cloud-functions/api/index.py, so the platform serves it under /api
(POST /api/risk, POST /api/policy, GET /api/health) and strips that prefix before FastAPI sees the path.

The TypeScript orchestrator calls /policy and /risk in parallel. The rules mirror the TypeScript
implementations in agents/_agents/specialists.ts one-to-one, and if this service is unreachable the
orchestrator falls back to those, so an outage or cold start never blocks a case.
"""
import re
from typing import List, Literal, Optional

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="After-sales risk & policy service")

RETURN_WINDOW_DAYS = 30

# ── Risk ────────────────────────────────────────────────────────────────────────

# Feature order: refunds, damage claims, replacements, address mismatch, new account, high value.
RISK_WEIGHTS = np.array([35.0, 25.0, 10.0, 20.0, 10.0, 10.0])


class RiskIn(BaseModel):
    refunds_90d: int = Field(0, ge=0)
    damage_claims_90d: int = Field(0, ge=0)
    replacements_90d: int = Field(0, ge=0)
    address_mismatch: bool = False
    member_since_days: int = Field(365, ge=0)
    order_total: float = Field(..., ge=0)


@app.post("/risk")
async def risk(r: RiskIn):
    features = np.array(
        [
            r.refunds_90d >= 3,
            r.damage_claims_90d >= 3,
            r.replacements_90d >= 2,
            r.address_mismatch,
            r.member_since_days < 30,
            r.order_total > 250,
        ],
        dtype=float,
    )
    score = int(features @ RISK_WEIGHTS)

    labels = [
        f"{r.refunds_90d} refunds in the last 90 days",
        f"{r.damage_claims_90d} damage claims in the last 90 days",
        f"{r.replacements_90d} replacement requests in the last 90 days",
        "Shipping address differs from billing address",
        f"New account ({r.member_since_days} days old)",
        f"High-value order (${r.order_total:.2f})",
    ]
    flags = [label for label, hit in zip(labels, features) if hit]

    level = "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW"
    return {"score": score, "level": level, "flags": flags, "engine": "python"}


# ── Policy ──────────────────────────────────────────────────────────────────────


class PolicyIn(BaseModel):
    order_status: str
    delivered_days: Optional[int] = Field(None, ge=0)
    item_text: str = ""
    issue: Literal["damaged", "wrong_item", "changed_mind"]


@app.post("/policy")
async def policy(p: PolicyIn):
    delivered = p.order_status == "delivered"
    age = p.delivered_days or 0
    final_sale = re.search(r"clearance|final sale", p.item_text, re.IGNORECASE) is not None
    already_refunded = re.match(r"^(refund|exchange)_", p.order_status) is not None

    checks: List[dict] = [
        {"label": "Order delivered", "pass": delivered or p.order_status == "shipped", "detail": f"Status: {p.order_status}"},
        {
            "label": f"Within {RETURN_WINDOW_DAYS}-day return window",
            "pass": (not delivered) or age <= RETURN_WINDOW_DAYS,
            "detail": f"Delivered {age} day{'' if age == 1 else 's'} ago" if delivered else "Not yet delivered",
        },
        {"label": "Product eligible", "pass": not final_sale, "detail": "Final-sale item" if final_sale else "Standard returnable item"},
        {
            "label": "No previous refund on this order",
            "pass": not already_refunded,
            "detail": "Refund already on record" if already_refunded else "No prior refund",
        },
    ]

    allowed = ["refund", "store_credit"] if p.issue == "changed_mind" else ["replace", "refund", "store_credit"]
    return {
        "eligible": all(c["pass"] for c in checks),
        "checks": checks,
        "citation": "Standard Return Policy v3.2" if p.issue == "changed_mind" else "Damaged Item Policy v3.2",
        "allowedActions": allowed,
        "engine": "python",
    }


@app.get("/health")
async def health():
    return {"ok": True, "runtime": "python", "framework": "fastapi", "numpy": np.__version__}
