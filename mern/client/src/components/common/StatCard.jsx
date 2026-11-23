export function StatCard({label,value,note,icon:Icon,tone=''}) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={'metric-icon '+tone}><Icon size={18}/></span></div><strong>{value}</strong><small>{note}</small></article>;
}
