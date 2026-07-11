import httpx
import time
import sys

# Wrap httpx requests to use a 30-second timeout
client = httpx.Client(timeout=30.0)
def get(*args, **kwargs):
    return client.get(*args, **kwargs)
def post(*args, **kwargs):
    return client.post(*args, **kwargs)
def put(*args, **kwargs):
    return client.put(*args, **kwargs)
def delete(*args, **kwargs):
    return client.delete(*args, **kwargs)
httpx.get = get
httpx.post = post
httpx.put = put
httpx.delete = delete

BASE_URL = "http://127.0.0.1:8000"

def test_flow():
    print("--- 1. Testing /health endpoint ---")
    try:
        r = httpx.get(f"{BASE_URL}/health")
        print(f"Health status: {r.status_code}, body: {r.json()}")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"
    except Exception as e:
        print(f"Health check failed: {e}")
        sys.exit(1)

    print("\n--- 2. Testing signup ---")
    email = f"user_{int(time.time())}@example.com"
    signup_data = {
        "name": "John Doe",
        "email": email,
        "password": "secretpassword"
    }
    r = httpx.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
    print(f"Signup status: {r.status_code}")
    assert r.status_code == 201
    res_data = r.json()
    access_token = res_data["access_token"]
    refresh_token = res_data["refresh_token"]
    user_id = res_data["user"]["id"]
    print("Signup successful. Access Token received.")

    print("\n--- 3. Testing login ---")
    login_data = {
        "email": email,
        "password": "secretpassword"
    }
    r = httpx.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print(f"Login status: {r.status_code}")
    assert r.status_code == 200
    assert "access_token" in r.json()

    print("\n--- 4. Testing token refresh ---")
    refresh_data = {
        "refresh_token": refresh_token
    }
    r = httpx.post(f"{BASE_URL}/api/auth/refresh", json=refresh_data)
    print(f"Refresh status: {r.status_code}")
    assert r.status_code == 200
    new_access_token = r.json()["access_token"]
    print("Refresh successful. New Access Token received.")

    headers = {"Authorization": f"Bearer {new_access_token}"}

    print("\n--- 5. Testing link creation (authenticated) ---")
    link_data = {
        "original_url": "https://www.google.com",
        "custom_alias": f"alias-{int(time.time())}"
    }
    r = httpx.post(f"{BASE_URL}/api/links", json=link_data, headers=headers)
    print(f"Create link status: {r.status_code}")
    assert r.status_code == 201
    link_res = r.json()
    print(f"Short url: {link_res['short_url']}")
    print(f"QR code base64 prefix: {link_res['qr_code_base64'][:50]}...")
    link_id = link_res["id"]
    short_code = link_res["short_code"]
    custom_alias = link_res["custom_alias"]

    print("\n--- 6. Testing redirect and click logging ---")
    # Redirect using custom_alias
    r = httpx.get(f"{BASE_URL}/{custom_alias}", follow_redirects=False)
    print(f"Redirect status (alias): {r.status_code}")
    assert r.status_code == 302
    assert r.headers["location"] == "https://www.google.com"

    # Redirect using short_code
    r = httpx.get(f"{BASE_URL}/{short_code}", follow_redirects=False)
    print(f"Redirect status (short code): {r.status_code}")
    assert r.status_code == 302

    # Give a tiny fraction of a second for background logging task to complete
    time.sleep(0.5)

    print("\n--- 7. Testing listing user's links ---")
    r = httpx.get(f"{BASE_URL}/api/links", headers=headers)
    print(f"List links status: {r.status_code}")
    assert r.status_code == 200
    links_list = r.json()
    assert len(links_list) > 0
    # The click count should be 2 because we visited it twice
    print(f"Updated click count on list: {links_list[0]['click_count']}")

    print("\n--- 8. Testing click log endpoint ---")
    r = httpx.get(f"{BASE_URL}/api/links/{link_id}/clicks", headers=headers)
    print(f"Clicks log status: {r.status_code}")
    assert r.status_code == 200
    clicks_log = r.json()
    print(f"Number of log records: {len(clicks_log)}")
    assert len(clicks_log) >= 2

    print("\n--- 9. Testing aggregated stats endpoint ---")
    r = httpx.get(f"{BASE_URL}/api/links/{link_id}/stats", headers=headers)
    print(f"Stats status: {r.status_code}")
    assert r.status_code == 200
    stats = r.json()
    print(f"Total Clicks: {stats['total_clicks']}")
    print(f"Clicks by day: {stats['clicks_by_day']}")
    print(f"Top Browsers: {stats['top_browsers']}")
    print(f"Top Devices: {stats['top_devices']}")
    assert stats["total_clicks"] >= 2

    print("\n--- 10. Testing anonymous link creation ---")
    anon_link_data = {
        "original_url": "https://news.ycombinator.com"
    }
    r = httpx.post(f"{BASE_URL}/api/links", json=anon_link_data)
    print(f"Anon link creation status: {r.status_code}")
    assert r.status_code == 201
    anon_res = r.json()
    print(f"Anon Short URL: {anon_res['short_url']}")
    assert anon_res["user_id"] is None

    print("\n--- 11. Testing PUT (update link) ---")
    update_data = {
        "custom_alias": f"newalias-{int(time.time())}",
        "is_active": True
    }
    r = httpx.put(f"{BASE_URL}/api/links/{link_id}", json=update_data, headers=headers)
    print(f"Update link status: {r.status_code}")
    assert r.status_code == 200
    updated_res = r.json()
    new_custom_alias = updated_res["custom_alias"]
    print(f"Updated custom alias: {new_custom_alias}")
    assert new_custom_alias == update_data["custom_alias"]

    # Verify that the new alias redirect works
    r = httpx.get(f"{BASE_URL}/{new_custom_alias}", follow_redirects=False)
    print(f"Redirect status of new alias: {r.status_code}")
    assert r.status_code == 302
    assert r.headers["location"] == "https://www.google.com"

    # Verify that the old custom_alias returns 404 (since it has been updated and freed)
    r = httpx.get(f"{BASE_URL}/{custom_alias}", follow_redirects=False)
    print(f"Old alias redirect status (expected 404): {r.status_code}")
    assert r.status_code == 404

    print("\n--- 12. Testing DELETE (delete link) ---")
    r = httpx.delete(f"{BASE_URL}/api/links/{link_id}", headers=headers)
    print(f"Delete link status: {r.status_code}")
    assert r.status_code == 204

    # Verify that redirect now returns 404
    r = httpx.get(f"{BASE_URL}/{new_custom_alias}", follow_redirects=False)
    print(f"Deleted link redirect status (expected 404): {r.status_code}")
    assert r.status_code == 404

    print("\nALL TESTS PASSED SUCCESSFULLY! The SmartLink Backend is fully operational!")

if __name__ == "__main__":
    test_flow()
