#Amaterasu
## **BFT-PoLoc — Byzantine Fault-Tolerant Proof of Location**

## 📌 Overview
**BFT-PoLoc** is a **trustless, decentralized, and cryptographically secure geolocation verification protocol** built for blockchain ecosystems.  
It verifies a claimant’s location (*Waldo*) using **crowdsourced challengers**, robust delay filtering, geometric constraints, and **Byzantine Fault Tolerance** — all without relying on centralized geolocation services.

This repository contains:
- **On-chain Solana program** (Anchor framework) for staking, challenge coordination, and reward distribution.
- **CLI-based challenger and Waldo clients** for measuring round-trip times (RTTs) and submitting proofs.
- **Robust measurement filtering & delay-distance mapping** for accurate location estimation.
- **Mathematical model implementation** from the original research paper.

📖 **Full research-level explanation, workflow diagrams, and math derivations** are available in the [Notion Documentation](https://glen-donkey-b18.notion.site/Amaterasu-24c8c49f31d880de9632f3d234074986?pvs=74).

---

## 🚀 Key Features
- **Decentralized Location Proof** — Multiple independent challengers verify claimed positions.
- **Robust Delay Filtering** — Median Absolute Deviation (MAD) + monotone delay→distance mapping.
- **BFT Consensus** — Aggregates challenger reports tolerating malicious participants.
- **Incentives & Slashing** — Automated staking, reward, and penalty system per challenge.
- **Physical Geometry Enforcement** — Speed-of-light constraints + trigonometric bounds:
