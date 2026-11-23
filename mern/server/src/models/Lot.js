import mongoose from 'mongoose';
const lotSchema = new mongoose.Schema({
  lotNumber: { type: String, required: true, unique: true, trim: true, index: true },
  sellerType: { type: String, enum: ['farmer','trader'], default: 'farmer' },
  farmerName: { type: String, required: true, trim: true },
  mobile: { type: String, trim: true },
  farmerRegistryId: { type: String, trim: true },
  landRecordType: { type: String, trim: true },
  landRecordNo: { type: String, trim: true },
  traderRegistrationNo: { type: String, trim: true },
  state: { type: String, default: 'Gujarat', trim: true },
  district: { type: String, trim: true },
  taluka: { type: String, trim: true },
  village: { type: String, trim: true },
  commodity: { type: String, required: true, trim: true },
  bags: { type: Number, required: true, min: 1 },
  vehicle: { type: String, trim: true, uppercase: true },
  estimated: { type: Number, min: 0, default: 0 },
  quality: { type: String, default: 'FAQ', trim: true },
  notes: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['arrived','auctioned','weighed','payment_pending','paid','dispatched','held'], default: 'arrived', index: true },
  arrivalAt: { type: Date, default: Date.now, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuctionTicket', default: null },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', default: null },
  auctionRate: { type: Number, min: 0, default: null },
  grossWeight: { type: Number, min: 0, default: null },
  tareWeight: { type: Number, min: 0, default: null },
  netWeight: { type: Number, min: 0, default: null },
  scaleId: { type: String, trim: true },
  slipRef: { type: String, trim: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleBill', default: null },
  passNumber: { type: String, default: null },
  dispatchAt: { type: Date, default: null },
  dispatchOverrideReason: { type: String, default: '' }
}, { timestamps: true });
lotSchema.index({ status: 1, arrivalAt: -1 });
lotSchema.index({ farmerName: 'text', commodity: 'text', lotNumber: 'text', vehicle: 'text' });
export default mongoose.models.Lot || mongoose.model('Lot', lotSchema);