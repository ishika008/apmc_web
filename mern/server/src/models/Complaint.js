import mongoose from 'mongoose';
const o={timestamps:true};
const ComplaintSchema=new mongoose.Schema({complaintNumber:{type:String,required:true,unique:true,index:true},complainant:{type:String,required:true,trim:true},mobile:String,type:{type:String,required:true},lot:{type:mongoose.Schema.Types.ObjectId,ref:'Lot',default:null},details:{type:String,required:true,maxlength:5000},evidenceReferences:[String],status:{type:String,enum:['open','investigating','resolved','rejected'],default:'open'},assignedTo:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},resolution:{type:String,maxlength:5000},resolvedAt:Date,createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}},o);
export default mongoose.models.Complaint||mongoose.model('Complaint',ComplaintSchema);
