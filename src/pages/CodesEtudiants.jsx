import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, Recherche } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getEtudiantsCodes, genererCodeEtudiant, setTelephoneEtudiant } from "@/lib/superieur.js";
import { lienWhatsApp } from "@/lib/recouvrement.js";

function messageEtudiant(origin, ecoleNom, prenom, code) {
  return (
    `Bonjour ${prenom || ""}, voici votre accès à l'espace étudiant GesSchool` +
    (ecoleNom ? ` (${ecoleNom})` : "") + `.\n\n` +
    `1) Ouvrez ${origin}\n2) Créez votre compte\n3) Choisissez « Je suis un étudiant » et entrez le code : ${code}`
  );
}

const FILTRES = [
  { id: "tous", label: "Tous" },
  { id: "sans", label: "Sans code" },
  { id: "avec", label: "Avec code" },
  { id: "sanstel", label: "Sans téléphone" },
  { id: "connecte", label: "Comptes activés" },
];

export default function CodesEtudiants() {
  const { ecoleId, ecole, typeEtablissement } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [rows, setRows] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [enCours, setEnCours] = useState(null);
  const [progression, setProgression] = useState(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ecoleNom = ecole?.nom || "";

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true); setErreur("");
    try { setRows(await getEtudiantsCodes(ecoleId)); }
    catch (e) { setErreur(e.message || "Chargement impossible."); }
    finally { setChargement(false); }
  }, [ecoleId]);
  useEffect(() => { recharger(); }, [recharger]);

  const stats = useMemo(() => {
    const total = rows.length;
    const avecCode = rows.filter((r) => r.code).length;
    const connectes = rows.filter((r) => r.connecte).length;
    return { total, avecCode, sansCode: total - avecCode, connectes };
  }, [rows]);

  const liste = useMemo(() => {
    const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const r = norm(q).trim();
    return rows.filter((t) => {
      if (filtre === "sans" && t.code) return false;
      if (filtre === "avec" && !t.code) return false;
      if (filtre === "sanstel" && t.telephone) return false;
      if (filtre === "connecte" && !t.connecte) return false;
      if (!r) return true;
      return norm(`${t.prenom} ${t.nom} ${t.matricule || ""} ${t.telephone || ""} ${t.code || ""}`).includes(r);
    });
  }, [rows, q, filtre]);

  const poser = (id, patch) => setRows((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function genererUn(t) {
    setEnCours(t.id);
    try { poser(t.id, { code: await genererCodeEtudiant(t.id) }); toast.succes(`Code généré pour ${t.prenom} ${t.nom}`); }
    catch (e) { toast.erreur(e); }
    finally { setEnCours(null); }
  }

  async function genererMasse() {
    const cibles = rows.filter((t) => !t.code);
    if (!cibles.length) { toast.info("Tous les étudiants ont déjà un code."); return; }
    if (!(await confirmer(`Générer ${cibles.length} code(s) étudiant(s) manquant(s) ?`))) return;
    setProgression({ fait: 0, total: cibles.length });
    try {
      let fait = 0;
      for (const t of cibles) {
        try { poser(t.id, { code: await genererCodeEtudiant(t.id) }); } catch { /* continue */ }
        setProgression({ fait: ++fait, total: cibles.length });
      }
      toast.succes(`${cibles.length} code(s) généré(s).`);
    } finally { setProgression(null); }
  }

  async function majTel(t, tel) {
    poser(t.id, { telephone: tel });
    try { await setTelephoneEtudiant(t.id, tel); } catch (e) { toast.erreur(e); }
  }

  async function exporter() {
    try {
      const XLSX = await import("xlsx");
      const lignes = liste.map((t) => ({ Matricule: t.matricule || "", "Nom & prénom": `${t.nom} ${t.prenom}`.trim(), Téléphone: t.telephone || "", Code: t.code || "", "Compte activé": t.connecte ? "Oui" : "Non" }));
      const ws = XLSX.utils.json_to_sheet(lignes);
      ws["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Codes étudiants");
      XLSX.writeFile(wb, `codes-etudiants-${ecole?.sigle || "ecole"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { toast.erreur(e); }
  }

  return (
    <>
      <EnTete titre="Codes étudiants" sousTitre="Générez et distribuez les accès à l'espace étudiant, en masse"
        action={
          <div className="flex flex-wrap gap-2">
            <Bouton variante="fantome" onClick={exporter} disabled={!liste.length}>⬇︎ Excel</Bouton>
            <Bouton variante="fantome" onClick={() => window.print()} disabled={!liste.length}>🖨️ Imprimer</Bouton>
            <Bouton variante="or" onClick={genererMasse} disabled={!!progression || stats.sansCode === 0}>
              {progression ? `Génération… ${progression.fait}/${progression.total}` : "⚡ Générer les codes manquants"}
            </Bouton>
          </div>
        } />

      <div className="space-y-6 p-4 sm:p-8">
        {erreur && <Alerte>{erreur}</Alerte>}
        {typeEtablissement !== "superieur" && (
          <Alerte ton="info">Cet établissement n'est pas en mode « Supérieur ». Les comptes étudiants concernent l'enseignement supérieur.</Alerte>
        )}
        <p className="rounded-xl bg-creme/60 px-4 py-2.5 text-xs text-navy-900/60 print:hidden">
          Un code par étudiant. Générez-les, renseignez le <b>téléphone</b> si besoin, puis cliquez <b>« WhatsApp »</b> pour envoyer le message pré-rempli.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
          {[{ l: "Étudiants", v: stats.total, c: "text-navy-900" }, { l: "Avec code", v: stats.avecCode, c: "text-emerald-600" }, { l: "Sans code", v: stats.sansCode, c: "text-rose-600" }, { l: "Comptes activés", v: stats.connectes, c: "text-or-600" }].map((s) => (
            <Carte key={s.l} className="p-4"><p className={`font-display text-2xl font-bold ${s.c}`}>{s.v}</p><p className="text-xs text-navy-900/50">{s.l}</p></Carte>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
          <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un étudiant, un matricule, un numéro…" className="sm:max-w-sm" />
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map((f) => (
              <button key={f.id} onClick={() => setFiltre(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filtre === f.id ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"}`}>{f.label}</button>
            ))}
          </div>
        </div>

        <Carte className="overflow-hidden">
          <div className="zone-impression">
            <div className="hidden px-6 pt-6 print:block">
              <h1 className="font-display text-lg font-bold text-navy-900">Codes d'accès étudiants — {ecoleNom}</h1>
              <p className="text-xs text-navy-900/50">Édité le {new Date().toLocaleDateString("fr-FR")}</p>
            </div>
            {chargement ? (
              <p className="p-6 text-sm text-navy-900/40">Chargement…</p>
            ) : liste.length === 0 ? (
              <p className="p-6 text-sm text-navy-900/40">Aucun étudiant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-900/10 text-left text-xs uppercase tracking-wide text-navy-900/50">
                      <th className="px-4 py-3 font-medium">Matricule</th>
                      <th className="px-4 py-3 font-medium">Étudiant</th>
                      <th className="px-4 py-3 font-medium">Téléphone</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 text-right font-medium print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((t) => (
                      <tr key={t.id} className="border-b border-navy-900/5 align-top last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-navy-900/60">{t.matricule || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-navy-900">{`${t.nom} ${t.prenom}`.trim()}</span>
                          {t.connecte && <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">activé</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input value={t.telephone || ""} onChange={(e) => poser(t.id, { telephone: e.target.value })}
                            onBlur={(e) => majTel(t, e.target.value.trim())} placeholder="+221…"
                            className="w-32 rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-xs outline-none focus:border-or-500 print:border-0" />
                        </td>
                        <td className="px-4 py-3">
                          {t.code ? <span className="rounded-lg bg-or-500/15 px-2 py-1 font-mono text-xs font-bold tracking-widest text-or-600">{t.code}</span> : <span className="text-xs text-navy-900/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right print:hidden">
                          {t.code ? (
                            t.telephone ? (
                              <a href={lienWhatsApp(t.telephone, messageEtudiant(origin, ecoleNom, t.prenom, t.code))} target="_blank" rel="noreferrer"
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700">💬 WhatsApp</a>
                            ) : (
                              <button onClick={() => { navigator.clipboard?.writeText(t.code); toast.info("Code copié"); }} className="text-xs text-navy-700 hover:text-or-500">Copier</button>
                            )
                          ) : (
                            <button onClick={() => genererUn(t)} disabled={enCours === t.id || !!progression} className="text-xs text-navy-700 hover:text-or-500 disabled:opacity-40">{enCours === t.id ? "…" : "Générer"}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Carte>
      </div>
    </>
  );
}
