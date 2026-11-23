import mongoose from 'mongoose';
const o={timestamps:true};
const PaymentSchema=new mongoose.Schema({receiptNumber:{type:String,required:true,unique:true,index:true},bill:{type:mongoose.Schema.Types.ObjectId,ref:'SaleBill',required:true,index:true},lot:{type:mongoose.Schema.Types.ObjectId,ref:'Lot',required:true},type:{type:String,enum:['farmer_settlement','buyer_purchase','buyer_fee'],required:true},amount:{type:Number,required:true,min:0.01},mode:{type:String,enum:['NEFT','RTGS','IMPS','UPI','BANK_TRANSFER','CASH_APPROVED'],required:true},reference:{type:String,required:true,trim:true},notes:String,receivedAt:{type:Date,default:Date.now},recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},o);
PaymentSchema.index({ mode: 1, reference: 1, type: 1 }, { unique: true });
export default mongoose.models.Payment||mongoose.model('Payment',PaymentSchema);
