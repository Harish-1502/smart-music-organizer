from pydantic import BaseModel, Field


class SystemNetworkInfoResponse(BaseModel):
    lan_mode: bool
    backend_host: str
    backend_port: int
    local_url: str
    lan_urls: list[str] = Field(default_factory=list)
    api_token_configured: bool
