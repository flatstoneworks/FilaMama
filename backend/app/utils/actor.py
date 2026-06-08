"""Server-side actor authentication.

The actor *type* (human vs agent) is security-relevant — only human actors may approve
agent proposals — so it must NOT be derived from a spoofable client header. Identity is
proven with server-configured secret tokens:

- ``FILAMAMA_AGENT_TOKEN`` (header ``X-FilaMama-Agent-Token``) → actor typed ``agent``.
- ``FILAMAMA_HUMAN_TOKEN`` (header ``X-FilaMama-Human-Token``) → actor typed ``human``.

When at least one token is configured the agent/human boundary is *active*: a request that
presents no valid token is treated as an untrusted (non-human) actor and therefore CANNOT
approve proposals — omitting a token must never confer human authority. When NO tokens are
configured the deployment is single-user/local and every caller is the trusted human.

All token env vars are comma-separated to allow several agents/humans.
"""

import os
import secrets
from typing import Optional

from ..models.schemas import Actor, ActorType

AGENT_TOKEN_HEADER = "X-FilaMama-Agent-Token"
HUMAN_TOKEN_HEADER = "X-FilaMama-Human-Token"

_AGENT_TOKEN_ENV = "FILAMAMA_AGENT_TOKEN"
_HUMAN_TOKEN_ENV = "FILAMAMA_HUMAN_TOKEN"


def _tokens(env_var: str) -> frozenset[str]:
    """Read configured tokens lazily so the env can be set/overridden at runtime."""
    raw = os.environ.get(env_var, "")
    return frozenset(token.strip() for token in raw.split(",") if token.strip())


def tokens_configured() -> bool:
    """True when the agent/human boundary is active (any agent or human token configured)."""
    return bool(_tokens(_AGENT_TOKEN_ENV) or _tokens(_HUMAN_TOKEN_ENV))


def _matches(token: Optional[str], env_var: str) -> bool:
    if not token:
        return False
    configured = _tokens(env_var)
    if not configured:
        return False
    # Compare against every configured token (constant-time per comparison) without
    # short-circuiting on the secret value.
    matched = False
    for value in configured:
        if secrets.compare_digest(token, value):
            matched = True
    return matched


def is_valid_agent_token(token: Optional[str]) -> bool:
    return _matches(token, _AGENT_TOKEN_ENV)


def is_valid_human_token(token: Optional[str]) -> bool:
    return _matches(token, _HUMAN_TOKEN_ENV)


def resolve_actor_type(agent_token: Optional[str], human_token: Optional[str]) -> ActorType:
    """Authoritative actor type derived from server-side tokens.

    agent token → AGENT; human token → HUMAN; boundary active but no valid token →
    AGENT (untrusted, cannot approve); no tokens configured → HUMAN (single-user default).
    """
    if is_valid_agent_token(agent_token):
        return ActorType.AGENT
    if is_valid_human_token(human_token):
        return ActorType.HUMAN
    if tokens_configured():
        # Boundary active and the caller proved nothing: untrusted. Never treat the mere
        # absence of a token as trusted-human authority (that would re-open the approval bypass).
        return ActorType.AGENT
    return ActorType.HUMAN


def build_actor(
    *,
    agent_token: Optional[str],
    human_token: Optional[str],
    actor_id: Optional[str],
    actor_name: Optional[str],
) -> Actor:
    """Build an Actor whose ``type`` is derived from tokens (unspoofable).

    ``id`` and ``name`` stay client-supplied — attribution only, never a security decision.
    """
    if resolve_actor_type(agent_token, human_token) == ActorType.AGENT:
        return Actor(id=actor_id or "agent", type=ActorType.AGENT, name=actor_name or "Agent")
    return Actor(id=actor_id or "local-user", type=ActorType.HUMAN, name=actor_name or "Local user")
