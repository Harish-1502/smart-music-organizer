from __future__ import annotations

import ipaddress
import os
import re
import socket
import subprocess
from collections.abc import Iterable

from app.core.config import Settings

IPV4_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def is_usable_lan_ipv4(address: str) -> bool:
    try:
        ip = ipaddress.IPv4Address(address)
    except ipaddress.AddressValueError:
        return False

    return not (
        ip.is_loopback
        or ip.is_link_local
        or ip.is_unspecified
        or ip.is_multicast
        or ip.is_reserved
    )


def _dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for value in values:
        if value in seen:
            continue

        seen.add(value)
        deduped.append(value)

    return deduped


def _discover_windows_ipv4_addresses() -> list[str]:
    try:
        result = subprocess.run(
            ["ipconfig"],
            capture_output=True,
            check=False,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
    except OSError:
        return []

    return IPV4_PATTERN.findall(result.stdout)


def _discover_hostname_ipv4_addresses() -> list[str]:
    addresses: list[str] = []

    for host in {socket.gethostname(), socket.getfqdn()}:
        if not host:
            continue

        try:
            addresses.extend(socket.gethostbyname_ex(host)[2])
        except OSError:
            pass

        try:
            for info in socket.getaddrinfo(
                host,
                None,
                family=socket.AF_INET,
                type=socket.SOCK_STREAM,
            ):
                sockaddr = info[4]
                if sockaddr:
                    addresses.append(sockaddr[0])
        except OSError:
            pass

    return addresses


def _discover_probe_ipv4_addresses() -> list[str]:
    probe_targets = (
        ("1.1.1.1", 80),
        ("8.8.8.8", 80),
    )
    addresses: list[str] = []

    for target in probe_targets:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(target)
                addresses.append(sock.getsockname()[0])
        except OSError:
            continue

    return addresses


def discover_local_ipv4_addresses() -> list[str]:
    addresses: list[str] = []

    if os.name == "nt":
        addresses.extend(_discover_windows_ipv4_addresses())

    addresses.extend(_discover_hostname_ipv4_addresses())
    addresses.extend(_discover_probe_ipv4_addresses())

    return _dedupe_preserve_order(addresses)


def get_lan_ipv4_addresses(
    discovered_addresses: list[str] | None = None,
) -> list[str]:
    raw_addresses = (
        discovered_addresses
        if discovered_addresses is not None
        else discover_local_ipv4_addresses()
    )
    usable_addresses: list[str] = []

    for address in raw_addresses:
        if not is_usable_lan_ipv4(address):
            continue

        usable_addresses.append(address)

    return _dedupe_preserve_order(usable_addresses)


def build_network_info(
    settings: Settings,
    *,
    discovered_addresses: list[str] | None = None,
) -> dict[str, object]:
    lan_urls: list[str] = []

    if settings.app_lan_mode:
        for address in get_lan_ipv4_addresses(discovered_addresses):
            lan_urls.append(f"http://{address}:{settings.backend_port}")

    return {
        "lan_mode": settings.app_lan_mode,
        "backend_host": settings.backend_host,
        "backend_port": settings.backend_port,
        "local_url": f"http://localhost:{settings.backend_port}",
        "lan_urls": lan_urls,
        "api_token_configured": bool(settings.api_auth_token),
    }
