# General Consensus Platform
A platform for testing / verifying / benchmarking general consensus algorithms.

### Consensus Algorithms
- Async BA
- DEXON BA
- PBFT
- VMware BA

### Attackers
- DDoS: DDoS PBFT proposed by HoneyBadger BFT
- Fuzz Partitioner: try every combination of partition
- No Validate: attack async BA since it has no `valid` function
- Partitioner: partition network
- Procrastinator: procrastinate DEXON BA for `f` rounds
- VMware Static Attacker: static attacker for postponing VMware basic BA
- VMware Adaptive Attacker: adaptive attacker for postponing VMware VRF BA

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
