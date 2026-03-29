# Real-Time Search Ranking System

A distributed systems project that ranks search results in real time based on user click behaviour. Every click flows through a streaming pipeline - captured by a collection API, queued in Apache Kafka, scored by Apache Flink in 30-second windows, and served from Redis sorted sets in under 1ms. An A/B testing layer runs a live experiment comparing two ranking strategies.

**Live demo:** https://aruthrasathishkumar.github.io/Real-time-Search-Ranking-System/

> **Note:** The live demo runs in static demo mode with pre-loaded data. The full real-time pipeline (click tracking → Kafka → Flink → Redis → live rankings) requires local setup with the infrastructure running. Please follow the local setup instructions given below.

---

## Architecture

```
Browser
  │
  │  search query
  ▼
Search API (Node.js · port 3000)
  │
  ├── Level 1: LRU Cache (in-memory · 0ms)
  ├── Level 2: Redis Sorted Set (ZREVRANGE · ~1ms)
  └── Level 3: Fallback (products.json · first request only)
  
Browser
  │
  │  click event (sendBeacon)
  ▼
Collection API (Node.js · port 3001)
  │
  ▼
Apache Kafka (topic: user-clicks · 4 partitions)
  │
  ▼
Apache Flink (ClickStreamJob · 30s tumbling windows)
  │
  ▼
Redis Sorted Sets
  ├── headphones:A  →  sony-wh1000: 42, bose-qc45: 28 ...
  └── headphones:B  →  sony-wh1000: 42, bose-qc45: 28 ...
  
Redis Hash (A/B CTR tracking)
  ├── ctr:A  →  { searches: 142, clicks: 18 }
  └── ctr:B  →  { searches: 138, clicks: 23 }
```

---

## Tech Stack

| Technology | Role | Why this choice |
|---|---|---|
| Node.js + Express | Collection API, Search API | Non-blocking I/O ideal for high-throughput event ingestion |
| Apache Kafka | Message queue | Fault-tolerant, replayable stream - decouples ingestion from processing |
| Apache Flink | Stream processor | Stateful windowed aggregations with exactly-once semantics |
| Redis | Cache + rankings store | Sub-millisecond sorted set reads via ZREVRANGE |
| LRU Cache | In-memory L1 cache | Eliminates Redis network round-trip for hot queries |
| Plain HTML/CSS/JS | Frontend | No framework overhead - demonstrates core web fundamentals |

**No ML used.** Rankings are computed purely from click frequency and recency - a deliberate engineering choice that keeps the system deterministic, debuggable, and fast.

---

## Key Features

- **Real-time ranking updates** : click scores aggregated in Apache Flink using 30-second tumbling windows and written to Redis automatically
- **Three-level cache hierarchy** : LRU → Redis → fallback ensures results are always served, even on cold start
- **A/B testing with live CTR** : users deterministically assigned to variant A or B via MD5 hash of userId; click-through rates tracked in Redis hashes
- **Kafka-backed event stream** : click events partitioned by userId for ordered processing; replayable from earliest offset
- **Weighted click simulation** : `scripts/simulate.js` sends 100 realistic fake click events to demonstrate ranking changes at scale

---

## System Design Decisions

**Why Kafka instead of writing directly to Redis?**

Writing clicks directly to Redis would couple the frontend to the ranking store. Kafka acts as a durable buffer - if Flink goes down, no events are lost. When Flink restarts it replays from the last committed offset. This is the same pattern used by LinkedIn, Uber, and DoorDash for event-driven systems.

**Why Flink instead of a simple counter?**

A plain counter gives equal weight to a click from 6 hours ago and a click from 30 seconds ago. Flink's tumbling windows let us apply recency weighting - recent engagement matters more for ranking. This is the same principle behind real-time recommendation systems at scale.

**Why a three-level cache?**

| Level | Store | Latency | When used |
|---|---|---|---|
| L1 | LRU (in-process) | 0ms | Hot queries served from memory |
| L2 | Redis sorted set | ~1ms | Cache miss - single network call |
| L3 | products.json | ~5ms | Cold start - written to Redis immediately after |

After the first request for any query, the result is cached in both Redis and LRU. `products.json` is never read again for that query. This pattern mirrors how production recommendation systems handle cold-start without a database call on every request.

**Why MD5 hash for A/B assignment?**

`Math.random()` would assign a different variant on every request - making CTR measurements meaningless. MD5 hashing the userId produces a deterministic number that maps consistently to A or B. The same user always gets the same variant across sessions and devices, giving clean experiment data.

---

## Project Structure

```
├── collection-api/
│   ├── routes/clicks.js          # POST /api/clicks — validates and publishes events
│   ├── services/clickPublisher.js # Kafka producer
│   └── server.js
│
├── data/
│   └── products.json             # 10 fake products — fallback data source
│
├── flink-job/
│   ├── pom.xml                   # Maven build config
│   └── src/main/java/com/recommendation/
│       └── ClickStreamJob.java   # Kafka → score → Redis pipeline
│
├── scripts/
│   └── simulate.js               # Sends 100 weighted fake click events
│
├── search-api/
│   ├── routes/search.js          # GET /api/search, GET /api/ctr
│   └── services/
│       ├── rankingService.js     # Three-level cache + Redis sorted set reads
│       └── abTestService.js      # Variant assignment + CTR tracking
│
├── shared/
│   ├── constants.js              # Ports, TTLs, topic names
│   ├── kafkaClient.js            # KafkaJS producer instance
│   ├── lruCache.js               # LRU-cache instance (200 entries, 30s TTL)
│   └── redisClient.js            # ioredis instance
│
├── index.html                    # Frontend (GitHub Pages root)
├── style.css
└── app.js                        # IS_LOCAL detection → real or demo mode
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- Java 17+ (for Maven build)
- Maven 3.9+
- WSL2 Ubuntu (for Kafka, Flink, Redis)

### Infrastructure (run in Ubuntu/WSL2)

```bash
# 1. ZooKeeper
cd ~/kafka_2.13-3.7.0
bin/zookeeper-server-start.sh config/zookeeper.properties

# 2. Kafka broker
bin/kafka-server-start.sh config/server.properties

# 3. Redis
redis-server --daemonize yes

# 4. Flink cluster
cd ~/flink-1.18.0
./bin/start-cluster.sh

# 5. Submit Flink job
./bin/flink run ~/flink-job.jar
```

### Node.js servers

```bash
# Install dependencies
npm install

# Collection API (port 3001)
node collection-api/server.js

# Search API (port 3000)
node search-api/server.js
```

### Build the Flink job (Windows PowerShell)

```bash
cd flink-job
mvn clean package -DskipTests
cp target/flink-job-1.0.jar \\wsl$\Ubuntu\home\<username>\flink-job.jar
```

### Test the pipeline

```bash
# Send a click event
Invoke-RestMethod -Uri "http://localhost:3001/api/clicks" -Method POST `
  -ContentType "application/json" `
  -Body '{"events":[{"userId":"user1","itemId":"sony-wh1000","query":"headphones","position":1}]}'

# Search
curl http://localhost:3000/api/search?q=headphones&userId=user1

# Check A/B CTR
curl http://localhost:3000/api/ctr

# Run load simulation (100 weighted clicks)
node scripts/simulate.js
```

### Verify rankings in Redis

```bash
redis-cli
ZREVRANGE headphones:A 0 9 WITHSCORES
HGETALL ctr:A
HGETALL ctr:B
```

---

## What I Would Do Differently at Production Scale

| Concern | Current approach | Production approach |
|---|---|---|
| Auth | Random userId in browser | JWT tokens from auth service |
| Storage | `products.json` fallback | PostgreSQL product catalog |
| Flink offsets | `earliest` on restart | Committed offsets in Kafka |
| Flink windows | 30s tumbling | Sliding windows with watermarks for late events |
| Redis TTL | 1 hour fixed | Adaptive TTL based on query popularity |
| A/B assignment | MD5 hash mod 2 | Feature flag service (LaunchDarkly / Optimizely) |
| Monitoring | Console logs | Prometheus + Grafana + Kafka lag alerts |
| Deployment | Local WSL2 | Kubernetes with Helm charts for Kafka and Flink |
