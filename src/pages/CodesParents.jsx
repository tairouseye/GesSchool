import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contextes/AuthContext.jsx";
import { EnTete } from "@/composants/Layout.jsx";
import { Bouton, Carte, Alerte, Recherche } from "@/composants/ui.jsx";
import { useToast, useConfirm } from "@/composants/Feedback.jsx";
import { getTuteursCodes, genererCodeTuteur } from "@/lib/parent.js";
import { lienWhatsApp } from "@/lib/recouvrement.js";

// GesSchool — génération et envoi EN MASSE des codes d'accès parents.
// La fonction serveur `generer_code_tuteur` reste unitaire ; on l'orchestre ici
// pour couvrir tous les tuteurs en une fois, puis on propose l'envoi WhatsApp
// pré-rempli (assisté : un clic « envoyer » par contact — le vrai envoi groupé
// automatique exigerait l'API WhatsApp Business, payante).

// Petite exécution en lots pour aller vite sans marteler le serveur.
async function enLots(items, taille, fn, onAvance) {
  let fait = 0;
  for (let i = 0; i < items.length; i += taille) {
    const lot = items.slice(i, i + taille);
    await Promise.all(
      lot.map(async (it) => {
        try { await fn(it); } catch { /* on continue : le résultat sera visible dans la liste */ }
        finally { onAvance?.(++fait); }
      }),
    );
  }
}

function messageParent(origin, ecoleNom, enfants, code) {
  const qui = enfants.length ? enfants.join(", ") : "votre enfant";
  return (
    `Bonjour, voici votre accès à l'espace parent GesSchool` +
    (ecoleNom ? ` (${ecoleNom})` : "") +
    ` pour suivre ${qui} : notes, absences et paiements.\n\n` +
    `1) Ouvrez ${origin}\n2) Créez votre compte\n3) Entrez le code : ${code}`
  );
}

const FILTRES = [
  { id: "tous", label: "Tous" },
  { id: "sans", label: "Sans code" },
  { id: "avec", label: "Avec code" },
  { id: "tel", label: "Avec téléphone" },
  { id: "sanstel", label: "Sans téléphone" },
  { id: "connecte", label: "Déjà connectés" },
];

export default function CodesParents() {
  const { ecoleId, ecole } = useAuth();
  const toast = useToast();
  const confirmer = useConfirm();
  const [tuteurs, setTuteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [progression, setProgression] = useState(null); // { fait, total } pendant un lot
  const [enCours, setEnCours] = useState(false); // id d'un tuteur en génération unitaire

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ecoleNom = ecole?.nom || "";

  const recharger = useCallback(async () => {
    if (!ecoleId) return;
    setChargement(true);
    setErreur("");
    try {
      setTuteurs(await getTuteursCodes(ecoleId));
    } catch (e) {
      setErreur(e.message || "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, [ecoleId]);

  useEffect(() => { recharger(); }, [recharger]);

  const stats = useMemo(() => {
    const total = tuteurs.length;
    const avecCode = tuteurs.filter((t) => t.code).length;
    const avecTel = tuteurs.filter((t) => t.telephone).length;
    const connectes = tuteurs.filter((t) => t.connecte).length;
    const envoyables = tuteurs.filter((t) => t.code && t.telephone).length;
    return { total, avecCode, sansCode: total - avecCode, avecTel, connectes, envoyables };
  }, [tuteurs]);

  const filtres = useMemo(() => {
    const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const r = norm(q).trim();
    return tuteurs.filter((t) => {
      if (filtre === "sans" && t.code) return false;
      if (filtre === "avec" && !t.code) return false;
      if (filtre === "tel" && !t.telephone) return false;
      if (filtre === "sanstel" && t.telephone) return false;
      if (filtre === "connecte" && !t.connecte) return false;
      if (!r) return true;
      return norm(`${t.prenom} ${t.nom} ${t.telephone || ""} ${t.code || ""} ${t.enfants.join(" ")}`).includes(r);
    });
  }, [tuteurs, q, filtre]);

  // Applique un code fraîchement généré dans l'état local (sans tout recharger).
  const poserCode = (id, code) =>
    setTuteurs((liste) => liste.map((t) => (t.id === id ? { ...t, code } : t)));

  async function genererUn(t) {
    setEnCours(t.id);
    try {
      const code = await genererCodeTuteur(t.id);
      poserCode(t.id, code);
      toast.succes(`Code généré pour ${t.prenom} ${t.nom}`);
    } catch (e) {
      toast.erreur(e);
    } finally {
      setEnCours(null);
    }
  }

  // Génère en masse. Par défaut : uniquement les codes MANQUANTS.
  async function genererMasse(regenererTout = false) {
    const cibles = regenererTout ? tuteurs : tuteurs.filter((t) => !t.code);
    if (!cibles.length) {
      toast.info(regenererTout ? "Aucun tuteur." : "Tous les tuteurs ont déjà un code.");
      return;
    }
    const ok = await confirmer({
      titre: regenererTout ? "Régénérer TOUS les codes ?" : "Générer les codes manquants ?",
      message: regenererTout
        ? `${cibles.length} codes seront régénérés. Les anciens codes non encore utilisés ne fonctionneront plus.`
        : `${cibles.length} code(s) parent(s) vont être générés en une fois.`,
      danger: regenererTout,
      confirmer: "Générer",
    });
    if (!ok) return;
    setProgression({ fait: 0, total: cibles.length });
    try {
      await enLots(
        cibles,
        6,
        async (t) => {
          const code = await genererCodeTuteur(t.id);
          poserCode(t.id, code);
        },
        (fait) => setProgression((p) => (p ? { ...p, fait } : p)),
      );
      toast.succes(`${cibles.length} code(s) généré(s).`);
    } catch (e) {
      toast.erreur(e);
    } finally {
      setProgression(null);
    }
  }

  async function exporterExcel() {
    try {
      const XLSX = await import("xlsx");
      const lignes = filtres.map((t) => ({
        "Enfant(s)": t.enfants.join(", "),
        "Parent / tuteur": `${t.prenom} ${t.nom}`.trim(),
        "Téléphone": t.telephone || "",
        "Code d'accès": t.code || "",
        "Compte activé": t.connecte ? "Oui" : "Non",
      }));
      const ws = XLSX.utils.json_to_sheet(lignes);
      ws["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Codes parents");
      XLSX.writeFile(wb, `codes-parents-${ecole?.sigle || "ecole"}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.erreur(e);
    }
  }

  return (
    <>
      <EnTete
        titre="Codes parents"
        sousTitre="Générez et distribuez les accès à l'espace parent, en masse"
        action={
          <div className="flex flex-wrap gap-2">
            <Bouton variante="fantome" onClick={exporterExcel} disabled={!filtres.length}>
              ⬇︎ Excel
            </Bouton>
            <Bouton variante="fantome" onClick={() => window.print()} disabled={!filtres.length}>
              🖨️ Imprimer
            </Bouton>
            <Bouton variante="or" onClick={() => genererMasse(false)} disabled={!!progression || stats.sansCode === 0}>
              {progression ? `Génération… ${progression.fait}/${progression.total}` : "⚡ Générer les codes manquants"}
            </Bouton>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        {erreur && <Alerte>{erreur}</Alerte>}

        <p className="rounded-xl bg-creme/60 px-4 py-2.5 text-xs text-navy-900/60 print:hidden">
          Un code par parent. Cliquez sur <b>« Générer les codes manquants »</b> pour les créer tous d'un coup,
          puis <b>« WhatsApp »</b> sur chaque ligne pour envoyer le message pré-rempli (envoi assisté : vous
          confirmez l'envoi dans WhatsApp). Les parents sans numéro reçoivent leur code via l'export Excel ou l'impression.
        </p>

        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 print:hidden">
          {[
            { l: "Tuteurs", v: stats.total, c: "text-navy-900" },
            { l: "Avec code", v: stats.avecCode, c: "text-emerald-600" },
            { l: "Sans code", v: stats.sansCode, c: "text-rose-600" },
            { l: "Envoyables WhatsApp", v: stats.envoyables, c: "text-navy-900" },
            { l: "Comptes activés", v: stats.connectes, c: "text-or-600" },
          ].map((s) => (
            <Carte key={s.l} className="p-4">
              <p className={`font-display text-2xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-navy-900/50">{s.l}</p>
            </Carte>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
          <Recherche valeur={q} onChange={setQ} placeholder="Rechercher un parent, un enfant, un numéro…" className="sm:max-w-sm" />
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltre(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filtre === f.id ? "bg-navy-900 text-creme" : "border border-navy-900/15 bg-white text-navy-900/70 hover:bg-creme"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {stats.avecCode > 0 && (
            <button
              onClick={() => genererMasse(true)}
              disabled={!!progression}
              className="text-xs text-navy-900/40 hover:text-rose-500 sm:ml-auto"
            >
              Régénérer tous les codes
            </button>
          )}
        </div>

        {/* Tableau (imprimable) */}
        <Carte className="overflow-hidden">
          <div className="zone-impression">
            {/* En-tête visible seulement à l'impression */}
            <div className="hidden px-6 pt-6 print:block">
              <h1 className="font-display text-lg font-bold text-navy-900">Codes d'accès parents — {ecoleNom}</h1>
              <p className="text-xs text-navy-900/50">Édité le {new Date().toLocaleDateString("fr-FR")}</p>
            </div>

            {chargement ? (
              <p className="p-6 text-sm text-navy-900/40">Chargement…</p>
            ) : filtres.length === 0 ? (
              <p className="p-6 text-sm text-navy-900/40">Aucun tuteur ne correspond.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-900/10 text-left text-xs uppercase tracking-wide text-navy-900/50">
                      <th className="px-4 py-3 font-medium">Enfant(s)</th>
                      <th className="px-4 py-3 font-medium">Parent / tuteur</th>
                      <th className="px-4 py-3 font-medium">Téléphone</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 text-right font-medium print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((t) => (
                      <tr key={t.id} className="border-b border-navy-900/5 last:border-0 align-top">
                        <td className="px-4 py-3 text-navy-900/80">{t.enfants.join(", ") || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-navy-900">{`${t.prenom} ${t.nom}`.trim() || "—"}</span>
                          {t.connecte && (
                            <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              compte activé
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-navy-900/70">{t.telephone || <span className="text-rose-400">absent</span>}</td>
                        <td className="px-4 py-3">
                          {t.code ? (
                            <span className="rounded-lg bg-or-500/15 px-2 py-1 font-mono text-xs font-bold tracking-widest text-or-600">
                              {t.code}
                            </span>
                          ) : (
                            <span className="text-xs text-navy-900/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right print:hidden">
                          {t.code ? (
                            t.telephone ? (
                              <a
                                href={lienWhatsApp(t.telephone, messageParent(origin, ecoleNom, t.enfants, t.code))}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                              >
                                💬 WhatsApp
                              </a>
                            ) : (
                              <button
                                onClick={() => { navigator.clipboard?.writeText(t.code); toast.info("Code copié"); }}
                                className="text-xs text-navy-700 hover:text-or-500"
                              >
                                Copier
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => genererUn(t)}
                              disabled={enCours === t.id || !!progression}
                              className="text-xs text-navy-700 hover:text-or-500 disabled:opacity-40"
                            >
                              {enCours === t.id ? "…" : "Générer"}
                            </button>
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
