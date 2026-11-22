"use client";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useTenders } from "@/lib/tenders-context";
import { buildAlerts, parseUtc, relTime, verdictOf } from "@/lib/tenders";
import { Donut, Sparkline } from "@/components/dash/Charts";
import SampleNotice from "@/components/SampleNotice";
import { IconAlert, IconBuilding, IconClock, IconPdf, IconShield, IconSpark, IconTarget, IconTenders } from "@/components/icons";
import type { Tender } from "@/lib/types";

const COLORS = { high: "var(--c1)", medium: "var(--c2)", low: "var(--c3)" };

/** Cumulative number of tenders found per day over the last `days` days. */
function trend(tenders: Tender[], days = 7): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - i);
    out.push(tenders.filter(t => parseUtc(t.found).getTime() <= end.getTime()).length);
  }
  return out;
}

export default function Dashboard() {
  const { me } = useAuth();
  const { tenders, loaded, refresh } = useTenders();
  useEffect(() => { refresh(); }, [refresh]);

  const d = useMemo(() => {
    const analysed = tenders.filter(t => t.analysis);
    const count = (v: "high" | "medium" | "low") => tenders.filter(t => verdictOf(t) === v).length;
    const scopes = analysed.map(t => t.analysis!.scope_match_pct);
    return {
      analysed,
      high: count("high"), medium: count("medium"), low: count("low"),
      gov: tenders.filter(t => t.kind === "government").length,
      priv: tenders.filter(t => t.kind === "private/aggregator").length,
      manual: tenders.filter(t => t.kind === "manual").length,
      riskChecked: tenders.filter(t => t.intel).length,
      avgScope: scopes.length ? Math.round(scopes.reduce((a, b) => a + b, 0) / scopes.length) : null,
      series: trend(tenders),
      alerts: buildAlerts(tenders, me),
    };
  }, [tenders, me]);

  const week = d.series.length ? d.series[d.series.length - 1] - d.series[0] : 0;
  const empty = loaded && tenders.length === 0;

  return (
    <>
      <SampleNotice />
      {me.categories.length > 0 && (
        <p className="muted d-cats">Your categories: {me.categories.map(c => <span className="pill" key={c}>{c}</span>)}</p>
      )}

      {/* stat cards */}
      <section className="d-stats">
        <div className="d-card stat">
          <span className="d-ico"><IconTenders /></span>
          <div className="stat-main">
            <small>Active tenders</small>
            <b>{tenders.length}</b>
            <em className={week > 0 ? "up" : ""}>{week > 0 ? `↑ ${week} this week` : `${d.gov} government · ${d.priv} private`}</em>
          </div>
          <Sparkline values={d.series} width={72} height={30} />
        </div>
        <div className="d-card stat">
          <span className="d-ico"><IconTarget /></span>
          <div className="stat-main">
            <small>Matching tenders</small>
            <b>{d.high}</b>
            <em>{d.medium} partial · {d.analysed.length} analysed</em>
          </div>
        </div>
        <div className="d-card stat">
          <span className="d-ico"><IconShield /></span>
          <div className="stat-main">
            <small>Avg. scope match</small>
            <b>{d.avgScope === null ? "—" : `${d.avgScope}%`}</b>
            <em>{d.avgScope === null ? "Analyse a PDF to see this" : "from analysed PDFs"}</em>
          </div>
          <Donut size={52} thickness={7} segments={[{ value: d.avgScope ?? 0, color: "var(--rose)" }, { value: 100 - (d.avgScope ?? 0), color: "transparent" }]} />
        </div>
        <div className="d-card stat">
          <span className="d-ico"><IconPdf /></span>
          <div className="stat-main">
            <small>PDFs analysed</small>
            <b>{d.analysed.length}</b>
            <em>{d.riskChecked} risk-checked</em>
          </div>
        </div>
      </section>

      {/* insights + recent tenders */}
      <section className="d-row two">
        <div className="d-card">
          <div className="d-head"><h3>AI insights overview</h3><Link href="/tenders">View all</Link></div>
          <div className="d-donutrow">
            <Donut size={168} thickness={18} segments={[
              { value: d.high, color: COLORS.high }, { value: d.medium, color: COLORS.medium }, { value: d.low, color: COLORS.low }]}>
              <b className="donut-n">{d.analysed.length}</b><small>Analysed</small>
            </Donut>
            <ul className="legend">
              <li><i style={{ background: COLORS.high }} />High opportunity<b>{d.high}</b></li>
              <li><i style={{ background: COLORS.medium }} />Medium opportunity<b>{d.medium}</b></li>
              <li><i style={{ background: COLORS.low }} />Low opportunity<b>{d.low}</b></li>
              {d.analysed.length === 0 && <li className="muted nolabel">Upload a tender PDF to see how well each one fits you.</li>}
            </ul>
          </div>
        </div>

        <div className="d-card">
          <div className="d-head"><h3>Recent tenders</h3><Link href="/tenders">View all</Link></div>
          {tenders.slice(0, 5).map(t => (
            <Link key={t.id} href={`/tenders/${t.id}`} className="d-item">
              <span className="d-ico sm"><IconBuilding /></span>
              <span className="d-item-main"><b>{t.title}</b><small>{t.org || t.category} · {t.kind === "private/aggregator" ? "private" : t.kind}</small></span>
              <span className="d-item-side">
                {verdictOf(t) && <span className={`fit ${verdictOf(t)}`}>{t.analysis!.verdict}</span>}
                <small>{relTime(t.found)}</small>
              </span>
            </Link>
          ))}
          {empty && <p className="muted pad-s">No tenders yet. <Link href="/tenders">Find tenders</Link> matching your profile.</p>}
        </div>
      </section>

      {/* alerts + documents + sources */}
      <section className="d-row three">
        <div className="d-card" id="alerts">
          <div className="d-head"><h3>Alerts &amp; notifications</h3></div>
          {d.alerts.map(a => (
            <Link key={a.id} href={a.href} className="d-item">
              <span className={`d-ico sm ${a.kind}`}>{a.kind === "deadline" ? <IconClock /> : a.kind === "risk" ? <IconAlert /> : <IconSpark />}</span>
              <span className="d-item-main"><b>{a.text}</b></span>
              {a.when && <small className="d-item-side">{a.when}</small>}
            </Link>
          ))}
          {d.alerts.length === 0 && <p className="muted pad-s">You&apos;re all caught up.</p>}
        </div>

        <div className="d-card">
          <div className="d-head"><h3>Analysed documents</h3><Link href="/tenders">View all</Link></div>
          {d.analysed.slice(0, 4).map(t => (
            <Link key={t.id} href={`/tenders/${t.id}`} className="d-item">
              <span className="d-ico sm pdf"><IconPdf /></span>
              <span className="d-item-main"><b>{t.title}</b><small>Scope match {t.analysis!.scope_match_pct}%</small></span>
              <span className={`fit ${verdictOf(t)}`}>{t.analysis!.verdict}</span>
            </Link>
          ))}
          {d.analysed.length === 0 && <p className="muted pad-s">No PDFs analysed yet. Open a tender and upload its document.</p>}
        </div>

        <div className="d-card">
          <div className="d-head"><h3>Tender sources</h3></div>
          <div className="d-donutrow stack">
            <Donut size={132} thickness={15} segments={[
              { value: d.gov, color: COLORS.high }, { value: d.priv, color: COLORS.medium }, { value: d.manual, color: COLORS.low }]}>
              <b className="donut-n">{tenders.length}</b><small>Total</small>
            </Donut>
            <ul className="legend">
              <li><i style={{ background: COLORS.high }} />Government<b>{d.gov}</b></li>
              <li><i style={{ background: COLORS.medium }} />Private / aggregator<b>{d.priv}</b></li>
              <li><i style={{ background: COLORS.low }} />Added manually<b>{d.manual}</b></li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
