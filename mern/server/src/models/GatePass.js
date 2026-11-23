import mongoose from 'mongoose';
const o={timestamps:true};
const GatePassSchema=new mongoose.Schema({passNumber:{type:String,required:true,unique:true,index:true},lot:{type:mongoose.Schema.Types.ObjectId,ref:'Lot',required:true,unique:true},bill:{type:mongoose.Schema.Types.ObjectId,ref:'SaleBill',required:true},vehicle:String,buyer:{type:mongoose.Schema.Types.ObjectId,ref:'Buyer'},issuedAt:{type:Date,default:Date.now},issuedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},dispatchAt:Date,dispatchedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},overrideReason:String,status:{type:String,enum:['issued','dispatched','cancelled'],default:'issued'}},o);
export default mongoose.models.GatePass||mongoose.model('GatePass',GatePassSchema);
