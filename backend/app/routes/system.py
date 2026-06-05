from fastapi import APIRouter

from app.core.config import settings
from app.schemas.system import SystemNetworkInfoResponse
from app.services.network_info import build_network_info

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/network-info", response_model=SystemNetworkInfoResponse)
def get_network_info():
    return build_network_info(settings)
