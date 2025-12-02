/**
 * Grants (or removes) admin rights. The person must have logged in to the app once.
 *
 *   npm run make-admin -- 9876543210
 *   npm run make-admin -- 9876543210 --revoke
 */
import mongoose from 'mongoose';

import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { normalizeIndianPhone } from '../utils/phone';

async function main() {
  const [phoneArg, flag] = process.argv.slice(2);
  const phone = phoneArg ? normalizeIndianPhone(phoneArg) : null;
  if (!phone) {
    console.error('Usage: npm run make-admin -- <10-digit phone> [--revoke]');
    process.exit(1);
  }
  const revoke = flag === '--revoke';

  await mongoose.connect(env.MONGO_URI);
  const user = await User.findOneAndUpdate({ phone }, { isAdmin: !revoke }, { returnDocument: 'after' });
  if (!user) {
    console.error(`No user with phone ${phone}. Log in to the app with this number first.`);
    process.exitCode = 1;
  } else {
    console.log(`${user.name || phone} is ${revoke ? 'no longer an admin' : 'now an admin'}.`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
