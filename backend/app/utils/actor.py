"""Server-side actor authentication.

The actor *type* (human vs agent) is security-relevant — only human actors may approve
agent proposals — so it must NOT be derived from a spoofable client header. Instead an
agent proves it is an agent by presenting a server-configured secret in the
``X-FilaMama-Agent-Token`` header. Any request without a valid token is treated as the
trusted human (the local user / UI / Basic-Auth holder).

Configure agent tokens via the ``FILAMAMA_AGENT_TOKEN`` env var (comma-separated for
multiple agents). When unset there are no agents — every caller is human — which is the
correct single-user default.
"""

import os
import secrets
from typing import Optional

from ..models.schemas import Actor, ActorType

AGENT_TOKEN_HEADER = "X-FilaMama-Agent-Token"


def _configured_agent_tokens() -> frozenset[str]:
    """Read configured agent tokens lazily so the env can be set/overridden at runtime."""
    raw = os.environ.get("FILAMAMA_AGENT_TOKEN", "")
    return frozenset(token.strip() for token in raw.split(",") if token.strip())


def agent_tokens_configured() -> bool:
    return bool(_configured_agent_tokens())


def is_valid_agent_token(token: Optional[str]) -> bool:
    """Constant-time check of ``token`` against the configured agent tokens."""
    if not token:
        return False
    tokens = _configured_agent_tokens()
    if not tokens:
        return False
    # Compare against every configured token (constant-time per comparison) so a match
    # anywhere returns True without short-circuiting on the secret value.
    matched = False
    for configured in tokens:
        if secrets.compare_digest(token, configured):
            matched = True
    return matched


def actor_type_from_token(token: Optional[str]) -> ActorType:
    """Authoritative actor type: AGENT iff a valid agent token is presented, else HUMAN."""
    return ActorType.AGENT if is_valid_agent_token(token) else ActorType.HUMAN


def build_actor(
    *,
    agent_token: Optional[str],
    actor_id: Optional[str],
    actor_name: Optional[str],
) -> Actor:
    """Build an Actor whose ``type`` is derived from the agent token (unspoofable).

    ``id`` and ``name`` stay client-supplied — they are attribution only and never feed
    a security decision.
    """
    if actor_type_from_token(agent_token) == ActorType.AGENT:
        return Actor(id=actor_id or "agent", type=ActorType.AGENT, name=actor_name or "Agent")
    return Actor(id=actor_id or "local-user", type=ActorType.HUMAN, name=actor_name or "Local user")
