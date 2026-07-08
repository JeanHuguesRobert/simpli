# SFCP - Simple Fractal Confederation Protocol
## Version 0.1

## Philosophy

SFCP enables sovereign nodes to form voluntary, treaty-based relationships for content federation while maintaining local authority.

**Core Principles:**
1. **Sovereignty First** - Each node is the ultimate authority for its content
2. **Voluntary Relationships** - All treaties are proposed and accepted voluntarily
3. **Fractal Design** - Same protocol works at all scales (person → nation)
4. **Graceful Degradation** - Unreachable nodes show cached content
5. **Minimal Viable** - Start simple, evolve as needed

---

## Protocol Overview

SFCP is a RESTful JSON API over HTTP(S). All endpoints are prefixed with `/_sfc/` to avoid conflicts with application routes.

### Base URL Structure
```
https://node.domain/_sfc/v0/{endpoint}
```

### Authentication
- Optional: Bearer token or shared secret
- For public read: no auth required
- For treaty operations: node-to-node authentication (future)

---

## Node Operations

### 1. Node Identity

**GET** `/_sfc/v0/node`

Returns information about this node.

```json
{
  "version": "0.1",
  "nodeId": "simplijs.fractavolta.com",
  "nodeType": "wiki",
  "isSovereign": true,
  "authoritativePages": {
    "HomePage": "2026-07-08T04:00:00Z",
    "AboutWiki": "2026-07-07T12:00:00Z",
    "@SimpliWiki": "2026-07-06T08:00:00Z"
  },
  "capabilities": {
    "canServePages": true,
    "canAcceptTreaties": true,
    "canInitiateTreaties": true
  }
}
```

### 2. Node Health (for cache validation)

**GET** `/_sfc/v0/health`

Returns node health status for cache timeout decisions.

```json
{
  "status": "healthy",
  "timestamp": "2026-07-08T12:00:00Z",
  "cacheTTL": 300
}
```

---

## Treaty Operations

### 1. List Existing Treaties

**GET** `/_sfc/v0/treaties`

```json
{
  "treaties": [
    {
      "treatyId": "treaty-abc123",
      "with": "simpliwiki.fractavolta.com",
      "type": "peer",
      "status": "active",
      "createdAt": "2026-07-07T10:00:00Z",
      "terms": {
        "syncDirection": "bidirectional",
        "pages": ["SimpliWiki", "NewWiki"]
      }
    }
  ]
}
```

### 2. Propose Treaty

**POST** `/_sfc/v0/treaties/propose`

Propose a new treaty relationship.

```json
{
  "from": "simpliwiki.fractavolta.com",
  "type": "peer",
  "terms": {
    "syncDirection": "pull",
    "pages": ["SimpliWiki", "ReadAboutSimpliWiki", "NewWiki"],
    "proposedAt": "2026-07-08T12:00:00Z"
  }
}
```

Response:

```json
{
  "status": "proposed",
  "treatyId": "treaty-def456",
  "message": "Treaty proposed. Awaiting acceptance."
}
```

### 3. Accept Treaty

**POST** `/_sfc/v0/treaties/{treatyId}/accept`

Accept a proposed treaty.

```json
{
  "acceptedAt": "2026-07-08T12:05:00Z",
  "acceptedBy": "simplijs.fractavolta.com"
}
```

### 4. Revoke Treaty

**POST** `/_sfc/v0/treaties/{treatyId}/revoke`

Revoke a treaty (voluntary exit).

```json
{
  "revokedAt": "2026-07-08T13:00:00Z",
  "revokedBy": "simplijs.fractavolta.com",
  "reason": "optional"
}
```

---

## Content Operations

### 1. Get Remote Page

**GET** `/_sfc/v0/pages/{nodeName}/{pageName}`

Fetch a page from a treaty partner.

Query params:
- `cached=allow` - Return cached version if remote unavailable (default)
- `cached=only` - Return only from cache, don't fetch
- `cached=never` - Force fetch from remote

Response (success):

```json
{
  "pageName": "SimpliWiki",
  "fromNode": "simplijs.fractavolta.com",
  "fetchedAt": "2026-07-08T12:10:00Z",
  "lastModified": "2026-07-07T10:00:00Z",
  "content": "SimpliWiki, micro wikis for everybody...",
  "format": "markdown",
  "isCached": false,
  "authority": "simplijs.fractavolta.com"
}
```

Response (cached):

```json
{
  "pageName": "SimpliWiki",
  "fromNode": "simplijs.fractavolta.com",
  "fetchedAt": "2026-07-08T12:10:00Z",
  "cachedAt": "2026-07-08T11:00:00Z",
  "lastModified": "2026-07-07T10:00:00Z",
  "content": "...",
  "format": "markdown",
  "isCached": true,
  "cacheAge": 3600,
  "authority": "simplijs.fractavolta.com",
  "warning": "Remote node unavailable, serving cached version"
}
```

Response (not found):

```json
{
  "error": "page_not_found",
  "message": "Page not available from treaty partner"
}
```

### 2. Propose Page Change

**POST** `/_sfc/v0/pages/{nodeName}/{pageName}/propose`

Propose a change to a page owned by another node (requires active treaty).

```json
{
  "proposedBy": "simpliwiki.fractavolta.com",
  "proposedAt": "2026-07-08T12:15:00Z",
  "change": {
    "content": "Updated SimpliWiki description...",
    "format": "markdown",
    "comment": "Updated SaaS description"
  }
}
```

Response:

```json
{
  "status": "proposed",
  "proposalId": "prop-xyz789",
  "message": "Change proposed. Awaiting review by authority."
}
```

### 3. List Change Proposals

**GET** `/_sfc/v0/pages/{pageName}/proposals`

List pending change proposals for pages owned by this node.

```json
{
  "proposals": [
    {
      "proposalId": "prop-xyz789",
      "pageName": "SimpliWiki",
      "proposedBy": "simpliwiki.fractavolta.com",
      "proposedAt": "2026-07-08T12:15:00Z",
      "change": {
        "content": "...",
        "format": "markdown"
      },
      "status": "pending"
    }
  ]
}
```

---

## Treaty Types

| Type | Description | Sync Direction |
|------|-------------|----------------|
| `peer` | Equal nodes, bilateral cooperation | bidirectional |
| `delegation` | One node delegates to another | pull (delegate from higher) |
| `read-only` | One node reads from another | pull |
| `publish` | One node publishes to another | push |

---

## Sync Directions

| Direction | Description |
|-----------|-------------|
| `pull` | Receiver pulls from sender |
| `push` | Sender pushes to receiver |
| `bidirectional` | Both directions |

---

## Error Responses

All errors return:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "timestamp": "2026-07-08T12:00:00Z"
}
```

Error codes:
- `node_not_found` - Node doesn't exist or is unreachable
- `page_not_found` - Page not available from treaty partner
- `treaty_not_found` - Treaty doesn't exist
- `treaty_not_active` - Treaty exists but is not active
- `unauthorized` - Authentication required or failed
- `invalid_request` - Malformed request

---

## Local Storage (SQLite)

Each node maintains local SFCP state:

```sql
-- Node health cache
CREATE TABLE sfc_node_health (
  node_id TEXT PRIMARY KEY,
  status TEXT,
  last_check TIMESTAMP,
  cache_ttl INTEGER
);

-- Page cache
CREATE TABLE sfc_page_cache (
  cache_id TEXT PRIMARY KEY,
  from_node TEXT,
  page_name TEXT,
  content TEXT,
  format TEXT,
  fetched_at TIMESTAMP,
  last_modified TIMESTAMP,
  authority TEXT
);

-- Treaties
CREATE TABLE sfc_treaties (
  treaty_id TEXT PRIMARY KEY,
  with_node TEXT,
  treaty_type TEXT,
  status TEXT,
  created_at TIMESTAMP,
  terms_json TEXT
);

-- Change proposals
CREATE TABLE sfc_proposals (
  proposal_id TEXT PRIMARY KEY,
  page_name TEXT,
  proposed_by TEXT,
  proposed_at TIMESTAMP,
  change_json TEXT,
  status TEXT
);
```

---

## Implementation Phases

### Phase 1: Node Discovery (v0.1)
- [ ] GET /_sfc/v0/node
- [ ] GET /_sfc/v0/health
- [ ] SQLite cache tables

### Phase 2: Treaty Formation (v0.2)
- [ ] GET /_sfc/v0/treaties
- [ ] POST /_sfc/v0/treaties/propose
- [ ] POST /_sfc/v0/treaties/{id}/accept
- [ ] POST /_sfc/v0/treaties/{id}/revoke

### Phase 3: Content Federation (v0.3)
- [ ] GET /_sfc/v0/pages/{node}/{page}
- [ ] POST /_sfc/v0/pages/{node}/{page}/propose
- [ ] GET /_sfc/v0/pages/{page}/proposals

### Phase 4: Authentication (v0.4)
- [ ] Node-to-node authentication
- [ ] Signed treaties

### Phase 5: Event Federation (v0.5)
- [ ] Real-time event notifications
- [ ] Webhook support

---

## Example Flow

### Scenario: SimpliWiki wants to display SimpliJs documentation

1. **SimpliWiki discovers SimpliJs:**
   ```bash
   GET https://simplijs.fractavolta.com/_sfc/v0/node
   ```

2. **SimpliWiki proposes peer treaty:**
   ```bash
   POST https://simplijs.fractavolta.com/_sfc/v0/treaties/propose
   {
     "from": "simpliwiki.fractavolta.com",
     "type": "peer",
     "terms": { "syncDirection": "pull", "pages": ["AngularJs", "HelpApi"] }
   }
   ```

3. **SimpliJs accepts treaty:**
   ```bash
   POST https://simplijs.fractavolta.com/_sfc/v0/treaties/{id}/accept
   ```

4. **SimpliWiki fetches page:**
   ```bash
   GET https://simplijs.fractavolta.com/_sfc/v0/pages/simplijs.fractavolta.com/AngularJs
   ```

5. **SimpliWiki caches page locally** (SQLite)
6. **SimpliWiki displays page with attribution**: "From simplijs.fractavolta.com"

---

## Notes

- All timestamps in ISO 8601 format (UTC)
- All content UTF-8 encoded
- Cache TTL recommended: 5 minutes for health, 1 hour for pages
- Treaty IDs are opaque strings, format may change
- This is v0.1 - expect evolution
