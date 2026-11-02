import httpx
import pytest
import respx

from linear_client import LINEAR_URL, LinearError, fetch_issues

PROJECT = "00000000-0000-4000-8000-000000000001"


def page(nodes, has_next, cursor=None):
    return {"data": {"issues": {"nodes": nodes, "pageInfo": {"hasNextPage": has_next, "endCursor": cursor}}}}


@respx.mock
def test_pagination_follows_two_pages(raw_issues):
    route = respx.post(LINEAR_URL).mock(
        side_effect=[
            httpx.Response(200, json=page(raw_issues[:5], True, "c1")),
            httpx.Response(200, json=page(raw_issues[5:], False)),
        ]
    )
    result = fetch_issues("lin_api_test", PROJECT)
    assert len(result) == len(raw_issues)
    assert route.call_count == 2
    assert route.calls[0].request.headers["Authorization"] == "lin_api_test"
    assert b'"cursor":"c1"' in route.calls[1].request.content


@respx.mock
def test_graphql_errors_with_http_200_raise():
    respx.post(LINEAR_URL).mock(return_value=httpx.Response(200, json={"errors": [{"message": "Entity not found"}]}))
    with pytest.raises(LinearError, match="Entity not found"):
        fetch_issues("lin_api_test", PROJECT)


@respx.mock
def test_bad_key_raises():
    respx.post(LINEAR_URL).mock(
        return_value=httpx.Response(400, json={"errors": [{"message": "Authentication required, not authenticated"}]})
    )
    with pytest.raises(LinearError, match="Authentication required"):
        fetch_issues("wrong", PROJECT)


def test_missing_key_raises():
    with pytest.raises(LinearError, match="not set"):
        fetch_issues("", PROJECT)
