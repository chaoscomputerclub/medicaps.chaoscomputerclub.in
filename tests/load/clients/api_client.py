"""
Medi-Caps Competitive Programming Platform — Locust API Client Wrapper
Provides clean request tagging, correlation tracking, token injection, and structured metric hooks.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
import requests
from locust.clients import ResponseContextManager

from tests.load.assertions.response_checks import (
    assert_status_code,
    parse_json_response,
    assert_required_fields,
    LoadTestAssertionError,
    classify_http_failure,
)
from tests.load.utilities.correlation import build_correlation_headers
from tests.load.utilities.credentials import VirtualStudentAccount

logger = logging.getLogger("ccc.loadtest.client")


class StudentApiClient:
    """Wrapper around Locust's HttpSession enforcing real-world headers and tagged naming."""

    def __init__(self, locust_client, account: VirtualStudentAccount):
        self._client = locust_client
        self.account = account
        self.base_headers: Dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": f"CCC-VirtualStudent/1.0 ({account.username})",
        }

    def set_token(self, token: str) -> None:
        """Attach Bearer access token."""
        self.account.access_token = token
        self.base_headers["Authorization"] = f"Bearer {token}"

    def clear_token(self) -> None:
        """Clear token upon logout."""
        self.account.access_token = None
        self.base_headers.pop("Authorization", None)

    def _prepare_headers(self, workflow: str, action: str, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = self.base_headers.copy()
        corr_headers = build_correlation_headers(
            user_id=self.account.username,
            workflow=workflow,
            action=action,
        )
        headers.update(corr_headers)
        if custom_headers:
            headers.update(custom_headers)
        return headers

    def get(
        self,
        path: str,
        name: str,
        workflow: str = "general",
        expected_status: Optional[list[int]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Execute tagged GET request."""
        expected = expected_status or [200]
        headers = self._prepare_headers(workflow=workflow, action=name)

        with self._client.get(
            path,
            name=name,
            headers=headers,
            params=params,
            catch_response=True,
        ) as response:
            try:
                assert_status_code(response, expected, context=name)
                data = parse_json_response(response, context=name)
                response.success()
                return data
            except LoadTestAssertionError as exc:
                response.failure(f"{exc.category.value}: {exc}")
                raise

    def post(
        self,
        path: str,
        name: str,
        json_data: Optional[Dict[str, Any]] = None,
        workflow: str = "general",
        expected_status: Optional[list[int]] = None,
        params: Optional[Dict[str, Any]] = None,
        custom_headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Execute tagged POST request."""
        expected = expected_status or [200, 201]
        headers = self._prepare_headers(workflow=workflow, action=name, custom_headers=custom_headers)

        with self._client.post(
            path,
            name=name,
            json=json_data,
            headers=headers,
            params=params,
            catch_response=True,
        ) as response:
            try:
                assert_status_code(response, expected, context=name)
                data = parse_json_response(response, context=name)
                response.success()
                return data
            except LoadTestAssertionError as exc:
                response.failure(f"{exc.category.value}: {exc}")
                raise
