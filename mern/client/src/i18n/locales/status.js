// Status / role / method / ledger labels and deadline countdown words. Keys: 'status.<value>' (value = API enum),
// 'status.seller.*', 'status.deadline.*'. gu and hi are written fully in their own script (no English words); en is the source wording.
export default {
  gu: {
    'status.arrived': 'આવક નોંધાઈ', 'status.auctioned': 'હરાજી પૂર્ણ', 'status.weighed': 'તોલ પૂર્ણ', 'status.payment_pending': 'ચુકવણી બાકી',
    'status.part_paid': 'આંશિક ચુકવણી', 'status.paid': 'ચુકવણી પૂર્ણ', 'status.dispatched': 'માલ રવાના', 'status.held': 'હોલ્ડ',
    'status.open': 'ખુલ્લી', 'status.investigating': 'તપાસમાં', 'status.resolved': 'ઉકેલાઈ', 'status.rejected': 'નામંજૂર',
    'status.farmer_settlement': 'ખેડૂત ચુકવણી', 'status.buyer_purchase': 'વેપારી ખરીદ', 'status.buyer_fee': 'ખરીદદારની બાકી રકમ',
    'status.open_outcry': 'જાહેર હરાજી', 'status.e_auction': 'ઈ-હરાજી', 'status.approved_negotiated': 'મંજૂર વાટાઘાટ',
    'status.admin': 'પ્રશાસક', 'status.gate': 'ગેટ ઓપરેટર', 'status.auction': 'હરાજી ઓપરેટર', 'status.weighment': 'વજન ઓપરેટર',
    'status.accounts': 'હિસાબ અધિકારી', 'status.inspector': 'નિરીક્ષક',
    'status.seller.trader': 'વેપારી', 'status.seller.farmer': 'ખેડૂત',
    'status.deadline.overdue': 'મર્યાદા વટાવી', 'status.deadline.hours': '{n} કલાક બાકી', 'status.deadline.day': '{n} દિવસ બાકી', 'status.deadline.days': '{n} દિવસ બાકી'
  },
  en: {
    'status.arrived': 'Arrival recorded', 'status.auctioned': 'Auction completed', 'status.weighed': 'Weighed', 'status.payment_pending': 'Payment pending',
    'status.part_paid': 'Part paid', 'status.paid': 'Paid', 'status.dispatched': 'Dispatched', 'status.held': 'Hold',
    'status.open': 'Open', 'status.investigating': 'Investigating', 'status.resolved': 'Resolved', 'status.rejected': 'Rejected',
    'status.farmer_settlement': 'Farmer settlement', 'status.buyer_purchase': 'Trader purchase', 'status.buyer_fee': 'Buyer dues',
    'status.open_outcry': 'Open outcry', 'status.e_auction': 'e-Auction', 'status.approved_negotiated': 'Approved negotiated',
    'status.admin': 'Administrator', 'status.gate': 'Gate Operator', 'status.auction': 'Auction Operator', 'status.weighment': 'Weighment Operator',
    'status.accounts': 'Accounts Officer', 'status.inspector': 'Inspector',
    'status.seller.trader': 'Trader', 'status.seller.farmer': 'Farmer',
    'status.deadline.overdue': 'Deadline passed', 'status.deadline.hours': '{n} hr left', 'status.deadline.day': '{n} day left', 'status.deadline.days': '{n} days left'
  },
  hi: {
    'status.arrived': 'आवक दर्ज', 'status.auctioned': 'नीलामी पूर्ण', 'status.weighed': 'तौल पूर्ण', 'status.payment_pending': 'भुगतान बाकी',
    'status.part_paid': 'आंशिक भुगतान', 'status.paid': 'भुगतान पूर्ण', 'status.dispatched': 'माल रवाना', 'status.held': 'होल्ड',
    'status.open': 'खुली', 'status.investigating': 'जाँच में', 'status.resolved': 'सुलझाई गई', 'status.rejected': 'अस्वीकृत',
    'status.farmer_settlement': 'किसान भुगतान', 'status.buyer_purchase': 'व्यापारी खरीद', 'status.buyer_fee': 'खरीदार देय राशि',
    'status.open_outcry': 'खुली नीलामी', 'status.e_auction': 'ई-नीलामी', 'status.approved_negotiated': 'स्वीकृत समझौता',
    'status.admin': 'प्रशासक', 'status.gate': 'गेट ऑपरेटर', 'status.auction': 'नीलामी ऑपरेटर', 'status.weighment': 'तौल ऑपरेटर',
    'status.accounts': 'लेखा अधिकारी', 'status.inspector': 'निरीक्षक',
    'status.seller.trader': 'व्यापारी', 'status.seller.farmer': 'किसान',
    'status.deadline.overdue': 'समय सीमा बीत गई', 'status.deadline.hours': '{n} घंटे बाकी', 'status.deadline.day': '{n} दिन बाकी', 'status.deadline.days': '{n} दिन बाकी'
  }
};
