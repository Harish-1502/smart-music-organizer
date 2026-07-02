from hmac import compare_digest

from fastapi import HTTPException, Request, status

from app.core.config import settings

# Paths that don't require auth
AUTH_EXEMPT_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
}

# Any path starting with assets/ is also exempt from auth
AUTH_EXEMPT_PREFIXES = (
    "/assets/",
)

# This function checks if the given path is exempt from auth based on the defined paths and prefixes. It returns True if the path is exempt, otherwise false
def is_auth_exempt_path(path: str) -> bool:
    return path in AUTH_EXEMPT_PATHS or path.startswith(AUTH_EXEMPT_PREFIXES)

# This function checks the Authorization header for the Bearer token and returns the token if it's present. If the header is missing or doesn't contain a valid Bearer token, it returns None.
def _bearer_token_from_header(value: str | None) -> str | None:
    if not value:
        return None

    scheme, separator, token = value.partition(" ")

    if separator != " " or scheme.lower() != "bearer":
        return None

    token = token.strip()
    return token or None

# This function first checks the Authorization header for a Bearer token. If it finds it, then it will return it. If not, it will look for an api_token query parameter in the URL. If that's found then it will return the token, if not then it will return None.
def _request_token(request: Request) -> str | None:
    header_token = _bearer_token_from_header(request.headers.get("authorization"))

    if header_token:
        return header_token

    query_token = request.query_params.get("api_token")
    return query_token.strip() if query_token else None

# This is the main guard function used to enforce API token authentication. It gets the expected token from the settings and compared it wil the token from the request. If the expected token is not set, it raises a 401 error indicating that authentication is required. If the token from the request is missing or doesn't match the expected token, it raises a 401 error indicating that the token is invalid or missing.
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