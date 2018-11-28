# General Consensus Platform
A platform for testing / verifying / benchmarking general consensus algorithms.

### Consensus Algorithms
- Async BA
- DEXON BA
- PBFT

### Attackers
- DDoS: DDoS PBFT proposed by HoneyBadger BFT
- Fuzz Partitioner: try every combination of partition
- No Validate: attack async BA since it has no `valid` function
- Partitioner: partition network
- Procrastinator: procrastinate DEXON BA for `f` rounds

### Communication Channels
- TCP
- IPC

### Install
```
npm install
```

### Run
```
npm start
```
