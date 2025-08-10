const fs = require("fs");
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair } = require("@solana/web3.js");
const path = require("path");

async function testIdl() {
  try {
    // Load the IDL
    const idlPath = path.join(__dirname, "polocfinal.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    
    console.log("✅ IDL loaded successfully");
    console.log("Instructions:", idl.instructions.length);
    console.log("Types:", idl.types.length);
    
    // Try to create a simple connection and wallet
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const keypair = Keypair.generate();
    const wallet = new anchor.Wallet(keypair);
    
    console.log("✅ Connection and wallet created");
    
    // Try to create the provider
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    
    console.log("✅ Provider created");
    
    // Try to create the program
    const programId = new anchor.web3.PublicKey(idl.address);
    console.log("✅ Program ID created:", programId.toString());
    
    // This is where it fails
    const program = new anchor.Program(idl, programId, provider);
    console.log("✅ Program created successfully!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

testIdl();
