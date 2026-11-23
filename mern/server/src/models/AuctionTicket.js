import mongoose from 'mongoose';
const o={timestamps:true};
const TicketSchema=new mongoose.Schema({ticketNumber:{type:String,required:true,unique:true,index:true},lot:{type:mongoose.Schema.Types.ObjectId,ref:'Lot',required:true},buyer:{type:mongoose.Schema.Types.ObjectId,ref:'Buyer',required:true},quantity:{type:Number,required:true,min:0.001},rate:{type:Number,required:true,min:0.01},quality:{type:String,default:'FAQ'},method:{type:String,enum:['open_outcry','e_auction','approved_negotiated'],default:'open_outcry'},notes:{type:String,maxlength:2000},farmerPaymentDueAt:Date,dispatchDueAt:Date,buyerCreditDueAt:Date,buyerCreditDays:Number,issuedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},voidedAt:Date,voidReason:String},o);
// One active ticket per lot. A voided ticket keeps its lot reference for the audit trail, so uniqueness is
// scoped by voidedAt (absent = active); otherwise a voided lot could never be re-auctioned.
TicketSchema.index({lot:1,voidedAt:1},{unique:true});
export default mongoose.models.AuctionTicket||mongoose.model('AuctionTicket',TicketSchema);
