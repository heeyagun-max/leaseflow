import { demoRequest } from "@leaseflow/demo-data";

export default function MobilePreview() {
  return <main><header><div className="brand">LeaseFlow Mobile Preview</div><span className="pill">DEMO · LM Manager</span></header><div className="card" style={{maxWidth:520, margin:"0 auto"}}><div className="kicker">Recent request</div><h1 style={{fontSize:30}}>Prepare the current 5F package</h1><p>{demoRequest.text}</p><div className="actions"><button className="primary">Extract request with GPT-5.6</button><button className="secondary">Open published data</button></div></div></main>;
}
