import mongoose from 'mongoose';
const gateEntrySchema = new mongoose.Schema({
  entryNumber: { type: String, required: true, unique: true, index: true },
  vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
  farmerName: { type: String, required: true, trim: true },
  commodity: { type: String, required: true, trim: true },
  estimatedQuantity: { type: Number, min: 0, default: 0 },
  notes: { type: String, trim: true, maxlength: 1000 },
  entryTime: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('GateEntry', gateEntrySchema);