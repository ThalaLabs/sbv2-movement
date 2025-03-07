import {
  Aggregator,
  Queue,
  Oracle,
  SwitchboardClient,
  axiosAptosClient,
  waitForTx,
  OracleData,
} from "@switchboard-xyz/aptos-sdk";
import {
  Account,
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Ed25519Account,
  PrivateKey,
  PrivateKeyVariants,
  APTOS_COIN,
} from "@aptos-labs/ts-sdk";
import * as fs from "fs";
import * as YAML from "yaml";

// ==============================================================================
// Setup Signer and account
// ==============================================================================
const parsedYaml = YAML.parse(
  fs.readFileSync("./.movement/config.yaml", "utf8")
);
const privateKey = PrivateKey.formatPrivateKey(
  parsedYaml!.profiles!.default!.private_key!,
  PrivateKeyVariants.Ed25519
);
const pk = new Ed25519PrivateKey(privateKey);
const signer = parsedYaml!.profiles!.default!.account!;

const account = new Ed25519Account({
  privateKey: pk,
  address: signer,
});

// ==============================================================================
// Setup Aptos RPC
// ==============================================================================

const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://mainnet.movementnetwork.xyz/v1",
  client: { provider: axiosAptosClient },
});
const aptos = new Aptos(config);

const client = new SwitchboardClient(aptos, "movement");
const { switchboardAddress, oracleQueue } = await client.fetchState();

const queue = new Queue(client, oracleQueue);
console.log(await queue.loadData());

console.log("Switchboard address:", switchboardAddress);

// ================================================================================================
// Initialization and Logging
// ================================================================================================

// const aggregatorInitTx = await Aggregator.initTx(client, signer, {
//   name: "BTC/USD",
//   minSampleSize: 1,
//   maxStalenessSeconds: 60,
//   maxVariance: 1e9,
//   feedHash:
//     "0x937efd0ba38a4db89364ea2c07de8873e443955b893ba5bcb2edaa611fb13a78",
//   minResponses: 1,
//   oracleQueue,
// });
// const res = await aptos.signAndSubmitTransaction({
//   signer: account,
//   transaction: aggregatorInitTx,
// });
// const result = await waitForTx(aptos, res.hash, 20);

//================================================================================================
// Get aggregator id
//================================================================================================

const aggregatorAddress = "0x35bc262eb3855bd3f0c458552ef4922146e75a6045b57361813cfb632156895c";
  // "address" in result.changes[0] ? result.changes[0].address : undefined;

if (!aggregatorAddress) {
  throw new Error("Failed to initialize aggregator");
}

console.log("Aggregator address:", aggregatorAddress);

// wait 2 seconds for the transaction to be finalized
await new Promise((r) => setTimeout(r, 2000));

//================================================================================================
// Fetch the aggregator ix
//================================================================================================

const aggregator = new Aggregator(client, aggregatorAddress);

console.log("aggregator", await aggregator.loadData());

const { responses, updates, updateTx } = await aggregator.fetchUpdate({
  sender: account.accountAddress.toString(),
});

console.log("Aggregator responses:", responses);

if (!updateTx) {
  console.log("No updates to submit");
  process.exit(0);
}

// run the first transaction
// const tx = transactions[0];
const tx = updateTx;
const resTx = await aptos.signAndSubmitTransaction({
  signer: account,
  transaction: updateTx,
});
const resultTx = await waitForTx(aptos, resTx.hash, 20);

console.log("Transaction result:", resultTx);
