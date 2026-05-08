import dbConnect from './lib/db';
import { TransportRequest } from './lib/models';

async function clearData() {
  await dbConnect();
  const name = "AHMAD FARHAN BIN ZAKARIA";
  const result = await TransportRequest.deleteMany({ patient_name: name });
  console.log(`Deleted ${result.deletedCount} transport requests for ${name}`);
  process.exit(0);
}

clearData().catch(err => {
  console.error(err);
  process.exit(1);
});
