/**
 * Stakeholder playbook as a PDF (@react-pdf/renderer). Used by
 * GET /api/c/[slug]/playbook/[stakeholder]/pdf and scripts/export-playbooks.tsx.
 * Standard PDF fonts have no ₹ or → glyphs; see `rs`.
 */
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Playbook } from "@/lib/playbooks/ideathon";
import type { WordmarkSegment } from "@/lib/wordmark";

Font.register({
  family: "WordmarkDisplay",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf",
});
Font.register({
  family: "WordmarkSerif",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-italic.ttf",
});
Font.register({
  family: "WordmarkMono",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-300-normal.ttf",
});
Font.registerHyphenationCallback((word) => [word]);

const EMERALD = "#059669";
const INK = "#0f172a";
const MUTED = "#64748b";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  kicker: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1.2 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 2 },
  who: { fontSize: 9, color: MUTED, marginTop: 2 },
  summary: { fontSize: 11, marginBottom: 12, lineHeight: 1.4 },
  section: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6, color: EMERALD },
  stage: { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: EMERALD, paddingLeft: 8 },
  stageName: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  stageDates: { fontSize: 8.5, color: MUTED },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED, textTransform: "uppercase" },
  cWhen: { width: "15%", paddingRight: 4 },
  cWhat: { width: "45%", paddingRight: 4 },
  cWhere: { width: "20%", paddingRight: 4 },
  cOut: { width: "20%" },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { width: "48.5%", borderWidth: 0.5, borderColor: "#cbd5e1", borderRadius: 4, padding: 6 },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  bullet: { fontSize: 8.5, lineHeight: 1.35 },
  two: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  faqQ: { fontFamily: "Helvetica-Bold", marginTop: 4 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7.5, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

const FONT_OF: Record<string, string> = {
  display: "WordmarkDisplay",
  serif: "WordmarkSerif",
  mono: "WordmarkMono",
  sans: "Helvetica",
};

/** Map characters outside the standard PDF (WinAnsi) set. */
const rs = (x: string) =>
  x
    .replace(/₹\s?/g, "Rs ")
    .replace(/→/g, "›")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[✓✔]/g, "+");

export interface PlaybookPdfProps {
  contestName: string;
  wordmark: WordmarkSegment[] | null;
  playbook: Playbook;
  /** Already token-filled text transformer. */
  tr: (s: string) => string;
  stageLabel: (n: number) => { name: string; dates: string };
}

export function PlaybookDocument({ contestName, wordmark, playbook, tr, stageLabel }: PlaybookPdfProps) {
  const T = (x: string) => rs(tr(x));
  const groups = playbook.steps.reduce<Array<{ stage: number; steps: typeof playbook.steps }>>((acc, st) => {
    const last = acc[acc.length - 1];
    if (last && last.stage === st.stage) last.steps.push(st);
    else acc.push({ stage: st.stage, steps: [st] });
    return acc;
  }, []);
  return (
    <Document title={`${contestName} — ${playbook.title} playbook`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>Playbook · {T(playbook.title)}</Text>
            <Text style={s.title}>What you do, and when</Text>
            <Text style={s.who}>{T(playbook.who)}</Text>
          </View>
          {wordmark ? (
            <Text>
              {wordmark.map((w, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: FONT_OF[w.font ?? "sans"],
                    fontSize: 18 * (w.scale ?? 1),
                    color: w.tone === "accent" ? EMERALD : w.tone === "muted" ? MUTED : INK,
                  }}
                >
                  {w.text}
                </Text>
              ))}
            </Text>
          ) : (
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>{contestName}</Text>
          )}
        </View>
        <Text style={s.summary}>{T(playbook.summary)}</Text>

        {playbook.roleCards && (
          <>
            <Text style={s.section}>Crew roles (one person can play several)</Text>
            <View style={s.cards}>
              {playbook.roleCards.map((r) => (
                <View key={r.role} style={s.card} wrap={false}>
                  <Text style={s.cardTitle}>{r.role}</Text>
                  {r.does.map((d) => (
                    <Text key={d} style={s.bullet}>
                      • {T(d)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.section}>Your timeline</Text>
        {groups.map((g) => {
          const lbl = stageLabel(g.stage);
          return (
            <View key={g.stage} style={s.stage} wrap={false}>
              <Text style={s.stageName}>
                {rs(lbl.name)} {lbl.dates ? <Text style={s.stageDates}> · {lbl.dates}</Text> : null}
              </Text>
              <View style={[s.row, { borderBottomColor: "#94a3b8" }]}>
                <Text style={[s.th, s.cWhen]}>When</Text>
                <Text style={[s.th, s.cWhat]}>What you do</Text>
                <Text style={[s.th, s.cWhere]}>Where</Text>
                <Text style={[s.th, s.cOut]}>Output</Text>
              </View>
              {g.steps.map((st, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.cWhen}>{T(st.when)}</Text>
                  <Text style={s.cWhat}>{T(st.what)}</Text>
                  <Text style={s.cWhere}>{T(st.where)}</Text>
                  <Text style={[s.cOut, { color: EMERALD }]}>{T(st.output)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={s.two} wrap={false}>
          <View style={s.col}>
            <Text style={s.section}>Do</Text>
            {playbook.dos.map((d) => (
              <Text key={d} style={s.bullet}>
                • {T(d)}
              </Text>
            ))}
          </View>
          <View style={s.col}>
            <Text style={s.section}>Don&apos;t</Text>
            {playbook.donts.map((d) => (
              <Text key={d} style={s.bullet}>
                – {T(d)}
              </Text>
            ))}
          </View>
        </View>

        <Text style={s.section}>Questions</Text>
        {playbook.faqs.map((f) => (
          <View key={f.q} wrap={false}>
            <Text style={s.faqQ}>{T(f.q)}</Text>
            <Text style={s.bullet}>{T(f.a)}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{rs(contestName)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
