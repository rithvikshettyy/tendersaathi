"use client";
import { useTenders } from "@/lib/tenders-context";
import { setEnabled } from "@/lib/demo";

/** Shown whenever sample (synthetic) tenders are on screen. Honest about what it is and easy to turn off. */
export default function SampleNotice() {
  const { tenders } = useTenders();
  if (!tenders.some(t => t.demo)) return null;
  return (
    <div className="notice sample-note">
      <span><b>Sample data.</b> Live tenders aren&apos;t available right now, so tenders, risk analysis and bid scores below are generated examples for demonstration. They are not real buyers or awards.</span>
      <button type="button" onClick={() => setEnabled(false)}>Turn off</button>
    </div>
  );
}
