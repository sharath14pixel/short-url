# SmartLink Project: Interview Preparation Guide

This guide compiles 15 technical interview questions and answers based on the architecture, features, and optimizations implemented in your SmartLink URL Shortener & Analytics platform.

---

## 1. System Architecture & Core Stack

### Q1: What is the high-level architecture of the SmartLink application?
*   **Answer**: SmartLink is a high-performance URL shortening and analytics platform built with a decoupled client-server architecture:
    *   **Frontend**: Next.js (App Router) styled with responsive Glassmorphic Vanilla CSS. State management is handled client-side using Zustand.
    *   **Backend**: FastAPI (Python) running on an asynchronous Uvicorn server, utilizing SQLAlchemy ORM to manage data.
    *   **Databases**: PostgreSQL (Supabase) in production and SQLite for local development.
    *   **Caching & Background Workers**: Redis caching for rapid redirects, with FastAPI's native `BackgroundTasks` handling non-blocking analytics insertion.

---

## 2. Redirection Performance & Caching

### Q2: Redirection latency is critical for a URL shortener. How did you optimize redirect performance?
*   **Answer**: I implemented a **Layered Caching Strategy**:
    1.  **Fast Path (Redis)**: When a redirect request comes in, the backend first checks a Redis cache. If the key exists, the original URL is returned immediately, achieving sub-millisecond response times.
    2.  **Slow Path (Database)**: If there is a cache miss, the backend falls back to query PostgreSQL, then asynchronously populates Redis so subsequent visitors get the cached path.
    3.  **Non-Blocking Analytics**: Click log persistence is offloaded to FastAPI's asynchronous `BackgroundTasks`. The server returns the `302 Found` HTTP redirect response immediately to the user, and records the IP address, user-agent, and country code in the database *after* the connection is closed.

---

## 3. Analytics & Offline Geo-IP Lookups

### Q3: Why did you implement offline Geo-IP lookup instead of using a standard JSON API like ip-api.com?
*   **Answer**: 
    1.  **Rate Limiting & Reliability**: Public APIs have low rate limits (~45 requests/minute). Under real-world load, the service would quickly become rate-limited, failing to log visitor countries.
    2.  **Performance Latency**: Calling an external HTTP API on every click adds network overhead (100ms - 300ms per call), which delays database logging.
    3.  **Privacy**: Sending client IP addresses to third-party endpoints has regulatory implications (e.g., GDPR).
    *   *Solution*: I integrated the `geoip2` package using the free offline MaxMind GeoLite2-Country database (`.mmdb` binary). By loading the MaxMind reader into memory as a singleton at server startup, we can resolve IP addresses to country names locally in **less than 1 millisecond** with zero external network dependencies.

---

## 4. Security & Protection

### Q4: How is link password protection implemented securely on the backend?
*   **Answer**:
    *   **Hashing**: We do not store passwords in plain text. When a user protects a link, the password is encrypted using **bcrypt** (a slow hashing function resistant to brute force attacks) and stored as a hash in the database.
    *   **Challenge Flow**: If a visitor attempts to access a protected link, the backend returns a `401 Unauthorized` response indicating verification is required.
    *   **Verification**: The frontend renders a password challenge card. When submitted, the backend verifies the plain-text password against the stored bcrypt hash using `bcrypt.checkpw`. If verified, a short-lived access token is generated to grant access to the redirect destination.

### Q5: How does the application enforce Link Expiration (Time-To-Live)?
*   **Answer**: Links can be created with an optional `expires_at` timestamp.
    *   During redirection, the backend compares the current server time with the link's expiration date:
        ```python
        if link.expires_at and datetime.utcnow() > link.expires_at:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Link expired")
        ```
    *   The backend returns an HTTP status code **`410 Gone`**, which informs search engines and clients that the resource is permanently unavailable, instead of a generic `404 Not Found`.

---

## 5. Security Guardrails: SSRF Protection

### Q6: How does your URL shortener prevent Server-Side Request Forgery (SSRF)?
*   **Answer**: Because a URL shortener fetches or redirects to user-provided URLs, attackers might input internal network URLs (e.g., `http://127.0.0.1:8000/admin` or cloud metadata endpoints like `http://169.254.169.254`).
    *   To prevent this, the backend includes custom safety validators:
        1.  It parses the input URL.
        2.  It resolves the hostname to an IP address.
        3.  It explicitly checks if the IP falls within private ranges (RFC 1918 loopbacks `127.0.0.0/8`, link-local `169.254.0.0/16`, or local subnetworks).
        4.  If the IP address is private, the link creation request is rejected immediately with a `422 Unprocessable Entity` status.

---

## 6. Networking & Deployment Resiliency

### Q7: In production (e.g., Render/Nginx), why is reading `request.client.host` directly a bug? How did you resolve it?
*   **Answer**: When deploying behind a reverse proxy (like Cloudflare, Nginx, or Render's load balancer), `request.client.host` returns the internal network IP of the proxy load balancer rather than the client. This breaks geo-location analytics (all clicks appear to come from the same datacenter).
    *   *Solution*: I modified the redirect handler to check the headers added by load balancers, specifically `X-Forwarded-For` or `X-Real-IP`, before falling back to the host:
        ```python
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        ```

### Q8: What database connection pooling adjustments did you make to handle high traffic spikes?
*   **Answer**: Cloud databases (like Supabase PostgreSQL) drop idle connections to conserve server resources, which frequently causes `psycopg2.OperationalError: server closed the connection unexpectedly`.
    *   I configured the SQLAlchemy engine with robust pooling settings:
        *   `pool_pre_ping=True`: Automatically tests connection health before sending queries, throwing out dead connections.
        *   `pool_recycle=300`: Automatically recycles connections every 5 minutes to prevent connections from stagnating.
        *   `pool_size=20` and `max_overflow=10`: Allows the application to scale database connection concurrency up to 30 active sockets during high traffic bursts.

---

## 7. Frontend Architecture & Token Management

### Q9: How is the Axios authentication interceptor structured, and how did you prevent redirect loops on auth failures?
*   **Answer**: I built an Axios response interceptor that intercepts `401 Unauthorized` responses. If a request fails due to an expired access token, it silently requests a token refresh using a secure cookie-based `/api/auth/refresh` request, updates the Zustand store, and retries the original request.
    *   *The Loop Bug*: A common issue is when a user enters an incorrect password during login, causing a `401`. If the interceptor tries to run the refresh flow on that `401`, it fails recursively and forces a page reload.
    *   *Solution*: I added endpoint checks to skip token refresh logic for authentication endpoints:
        ```javascript
        const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/signup') || url.includes('/api/auth/refresh');
        ```

---

## 8. Database Migrations

### Q10: How do you handle schema migrations across development and production databases without data loss?
*   **Answer**: I use **Alembic** (SQLAlchemy's migration tool). I write idempotent migration scripts. For instance, when adding the `password_hash` column to the `links` table, I check if the column exists in the database schema before attempting to alter the table, avoiding execution errors across different staging environments:
    ```python
    # Idempotent check
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [col['name'] for col in inspector.get_columns('links')]
    if 'password_hash' not in columns:
        op.add_column('links', sa.Column('password_hash', sa.String(length=255), nullable=True))
    ```

---

## 9. Performance Tuning (Discussion)

### Q11: If this app grows to millions of clicks, what is the main performance bottleneck you would refactor next?
*   **Answer**:
    *   **The Bottleneck**: Currently, when rendering aggregated stats for a link, we query all raw clicks, and parse the user-agent strings on-the-fly to group by device and browser. For millions of clicks, dynamically running regex parsing on millions of strings in Python blocks the event loop.
    *   **The Refactoring Solution**: I would denormalize the `Click` table by adding pre-parsed `browser` and `device` columns, and updating the background worker to parse the user-agent *once* at logging time. This allows the database to aggregate counts directly using `GROUP BY` database queries, which are highly indexed and extremely fast.
