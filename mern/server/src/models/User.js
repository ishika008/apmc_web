import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin','gate','auction','weighment','accounts','inspector'], required: true, default: 'inspector' },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });
userSchema.index({ role: 1, active: 1 });
export default mongoose.models.User || mongoose.model('User', userSchema);