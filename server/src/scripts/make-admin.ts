/**
 * Grants (or removes) admin rights. Creates the admin account if the number is new,
 * so admins never need to use the app: they log in to the admin panel directly.
 *
 *   npm run make-admin -- 9876543210
 *   npm run make-admin -- 9876543210 --name "Suman"
 *   npm run make-admin -- 9876543210 --revoke
 */
import mongoose from 'mongoose';

import { env } from '../config/env';
import { setAdminByPhone } from '../modules/admin/admin.service';
import { User } from '../modules/users/user.model';
import { randomAvatar } from '../utils/avatar';
import { normalizeIndianPhone } from '../utils/phone';

async function main() {
  const args = process.argv.slice(2);
  const phone = args[0] ? normalizeIndianPhone(args[0]) : null;
  if (!phone) {
    console.error('Usage: npm run make-admin -- <10-digit phone> [--name "Name"] [--revoke]');
    process.exit(1);
  }
  const revoke = args.includes('--revoke');
  const nameAt = args.indexOf('--name');
  const name = nameAt >= 0 ? (args[nameAt + 1] ?? '').trim() : '';

  await mongoose.connect(env.MONGO_URI);
  let user = await setAdminByPhone(phone, !revoke);
  if (!user && !revoke) {
    // A brand-new admin: no app profile, wallet or welcome bonus
    user = await User.create({ phone, name: name || 'Admin', avatar: randomAvatar(), isAdmin: true });
    console.log(`Created a new admin account for ${phone}.`);
  } else if (user && name) {
    user.name = name;
    await user.save();
  }
  if (!user) {
    console.error(`No user with phone ${phone}.`);
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
