from hmac import compare_digest

from fastapi import HTTPException, Request, status

from app.core.config import settings


AUTH_EXEMPT_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
}
AUTH_EXEMPT_PREFIXES = (
    "/assets/",
)


def is_auth_exempt_path(path: str) -> bool:
    return path in AUTH_EXEMPT_PATHS or path.startswith(AUTH_EXEMPT_PREFIXES)


def _bearer_token_from_header(value: str | None) -> str | None:
    if not value:
        return None

    scheme, separator, token = value.partition(" ")

    if separator != " " or scheme.lower() != "bearer":
        return None

    token = token.strip()
    return token or None


def _request_token(request: Request) -> str | None:
    header_token = _bearer_token_from_header(request.headers.get("authorization"))

    if header_token:
        return header_token

    query_token = request.query_params.get("api_token")
    return query_token.strip() if query_token else None


def require_api_token(request: Request) -> None:
    expected_token = settings.api_auth_token

    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _request_token(request)

    if not token or not compare_digest(token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
