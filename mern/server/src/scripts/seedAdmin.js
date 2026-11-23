import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

async function main() {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env');
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  await mongoose.connect(MONGODB_URI);
  const exists = await User.findOne({ role: 'admin' });
  if (exists) throw new Error('An administrator already exists. Use the admin user-management screen instead.');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash, role: 'admin' });
  console.log('Initial administrator created. Remove ADMIN_PASSWORD from your shell/environment now.');
  await mongoose.disconnect();
}
main().catch(async error => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});