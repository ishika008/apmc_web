export const addDays = (date, days) => new Date(new Date(date).getTime() + Number(days || 0) * 86400000);
export const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
