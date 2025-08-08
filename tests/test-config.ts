import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface TestConfig {
  provider: anchor.AnchorProvider;
  program: anchor.Program;
  testAccounts: {
    waldo: Keypair;
    challenger1: Keypair;
    challenger2: Keypair;
    challenger3: Keypair;
  };
  testData: {
    challengeId: string;
    claimedLat: number;
    claimedLon: number;
    duration: number;
    rewardPool: number;
    stakeAmount: number;
  };
}

export async function setupTestEnvironment(): Promise<TestConfig> {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  
  // Generate test keypairs
  const waldo = Keypair.generate();
  const challenger1 = Keypair.generate();
  const challenger2 = Keypair.generate();
  const challenger3 = Keypair.generate();

  // Airdrop SOL to test accounts
  const airdropAmount = 2 * LAMPORTS_PER_SOL;
  await provider.connection.requestAirdrop(waldo.publicKey, airdropAmount);
  await provider.connection.requestAirdrop(challenger1.publicKey, airdropAmount);
  await provider.connection.requestAirdrop(challenger2.publicKey, airdropAmount);
  await provider.connection.requestAirdrop(challenger3.publicKey, airdropAmount);

  // Wait for airdrops to confirm
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    provider,
    program: anchor.workspace.poloc as anchor.Program,
    testAccounts: {
      waldo,
      challenger1,
      challenger2,
      challenger3,
    },
    testData: {
      challengeId: "test-challenge-001",
      claimedLat: 40000000, // 40 degrees in micro-degrees
      claimedLon: -74000000, // -74 degrees in micro-degrees
      duration: 3600, // 1 hour
      rewardPool: LAMPORTS_PER_SOL, // 1 SOL
      stakeAmount: 100000000, // 0.1 SOL
    },
  };
}

export function deriveChallengePda(challengeId: string, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("challenge"), Buffer.from(challengeId)],
    programId
  );
  return pda;
}

export function deriveStakePda(
  challengeId: string, 
  challengerPubkey: PublicKey, 
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), Buffer.from(challengeId), challengerPubkey.toBuffer()],
    programId
  );
  return pda;
}

export function deriveVotePda(
  challengeId: string, 
  challengerPubkey: PublicKey, 
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), Buffer.from(challengeId), challengerPubkey.toBuffer()],
    programId
  );
  return pda;
}

export async function waitForTransaction(
  connection: anchor.web3.Connection,
  signature: string,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const status = await connection.getSignatureStatus(signature);
      if (status.value?.confirmationStatus === 'confirmed' || 
          status.value?.confirmationStatus === 'finalized') {
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Transaction ${signature} not confirmed within ${timeout}ms`);
}

export function createTestChallengeId(prefix: string = "test"): string {
  return `${prefix}-challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
