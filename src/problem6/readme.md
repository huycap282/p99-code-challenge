# Scoreboard Live Update Module

## Overview
This module manages user score updates and real-time leaderboard broadcasting for the top 10 users.
Responsibilities:
  - Receive score update requests from authenticated users
  - Validate the action and prevent malicious score manipulation
  - Persist score updates
  - Update the leaderboard
  - Broadcast real-time updates to connected clients
  - User can access to see leaderboard

## High Level Architecture
```code
                +-------------+
                |   Client    |
                +-------------+
                       |
                       | HTTP Request
                       ▼
               +---------------+
               |   API Server  |
               +---------------+
                       |
                       | Validate + Publish Event
                       ▼
                    Kafka
                       |
                       ▼
               +---------------+
               | Score Worker  |
               +---------------+
                |            |
                |            |
                ▼            ▼
           PostgreSQL      Redis
        (source of truth)  (leaderboard)
                |
                ▼
        Leaderboard Cache
                |
                ▼
        WebSocket Broadcast
                |
                ▼
              Clients
```

## API list
- Update score
```code
POST /api/v1/score/update
```
Request
```code
{
  "action_id": "string",
  "metadata": {}
}
```
Headers
```code
Authorization: Bearer <JWT>
```
Response
```code
{
  "success": true,
  "new_score": "1200"
}
```
- Get leaderboard
```code
GET /api/v1/leaderboard
```
Request
```code

```
Response
```code
{
  "data": [
    {
        "id": 1,
        "username": "logan",
        "rank": 1,
        "score": "1200"
    },
    {
        "id": 2,
        "username": "alex",
        "rank": 2,
        "score": "1000"
    }
  ]
}
```

## Flow
### Step 1: User completes an action

Client sends request: POST /api/v1/score/update

### Step 2: API Service

API server responsibilities:
1.	Authenticate user (JWT Bearer token)
2.	Validate action request 
3.	Prevent duplicate actions
4.	Publish event to Kafka

### Step 3: Kafka Event Consumer

Kafka acts as a buffer and event bus. 

Benefits:
 - Decouples API from score processing
 - Prevents API overload
 - Enables horizontal scaling

Partition by key:
```code
user_id
```

### Step 4: Score Worker

Responsibilities:
1. Anti-cheat validation
2. Persist action log
3. Update score
4. Update leaderboard
5. Publish socket event

```code
Kafka Event
     │
     ▼
Anti-cheat validation
     │
     ▼
Insert action log
     │
     ▼
Update user score
     │
     ▼
Update Redis leaderboard
     │
     ▼
Publish Socket Event
```

## Database schema

Users 
```code
users
------
id
username
password
score
created_at
```

Score Action
```code
score_actions
--------------
id
user_id
action_id
score_delta
created_at
--------------
Constraint: UNIQUE(action_id)
```
UNIQUE(action_id) to prevent replay attacks.

## Redis Leaderboard
Leaderboard stored using Redis Sorted Set

Key
```code
leaderboard:global
```

Increase score
```code
ZINCRBY leaderboard:global 50 user_123
```

Fetch top 10
```code
ZREVRANGE leaderboard:global 0 9 WITHSCORES
```

## Redis Cache Strategy
To reduce Redis load.

Cache key:
```code
leaderboard:top10
```

Cache TTL:
```code
5 seconds
```

Update Flow:
```code
Worker updates Redis Sorted Set
        │
        ▼
Recompute top10
        │
        ▼
Update Redis Cache
```

## Real-time Leaderboard Updates
Use WebSocket Gateway

Event triggered when leaderboard changes.

Event:
```code
leaderboard_update
```
Payload:
```json
{
  "data": [
    {"user_id": "1", "score": 1200},
    {"user_id": "2", "score": 1180}
  ]
}
```

## Anti-Cheat Layer
Critical for preventing malicious score inflation.

### Idempotency Protection
Ensure each action is processed once.
```code
UNIQUE(action_id)
```

### Action Validation
Server must verify: Action id is valid

### Replay Attack Protection
Ensure each action is processed once.
```code
UNIQUE(action_id)
```

## Failure Handling
### Worker crash

Kafka guarantees at-least-once delivery.

Idempotency prevents duplicates.

### Redis failure
Leaderboard rebuilt from database.